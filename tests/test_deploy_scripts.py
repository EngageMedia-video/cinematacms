import os
import stat
import subprocess
import sys
import tempfile
import textwrap
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
INSTALLER = PROJECT_ROOT / "install.sh"
UPDATER = PROJECT_ROOT / "deploy" / "apply-release-config.sh"


class InstallScriptTests(unittest.TestCase):
    def run_installer(self, *args, input_text=""):
        return subprocess.run(
            ["bash", str(INSTALLER), *args],
            cwd=PROJECT_ROOT,
            input=input_text,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_non_interactive_dry_run_resolves_all_options(self):
        result = self.run_installer(
            "--non-interactive",
            "--domain",
            "video.example.org",
            "--portal-name",
            "Example Video",
            "--proxy",
            "cloudflare",
            "--observability",
            "local",
            "--dry-run",
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("domain=video.example.org", result.stdout)
        self.assertIn("portal_name=Example Video", result.stdout)
        self.assertIn("proxy=cloudflare", result.stdout)
        self.assertIn("observability=local", result.stdout)
        self.assertIn("No changes were made.", result.stdout)

    def test_runtime_settings_read_observability_environment(self):
        env = os.environ.copy()
        env.update(
            {
                "DJANGO_SETTINGS_MODULE": "cms.settings",
                "OTEL_ENABLED": "true",
                "OTEL_SERVICE_NAME": "cinematacms-deploy-test",
                "OTEL_EXPORTER_OTLP_ENDPOINT": "http://127.0.0.1:14318/v1/traces",
                "OTEL_TRACES_SAMPLER_ARG": "0.25",
            }
        )
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "from django.conf import settings; "
                    "print(settings.OTEL_ENABLED); "
                    "print(settings.OTEL_SERVICE_NAME); "
                    "print(settings.OTEL_EXPORTER_OTLP_ENDPOINT); "
                    "print(settings.OTEL_TRACES_SAMPLER_ARG)"
                ),
            ],
            cwd=PROJECT_ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            result.stdout.splitlines(),
            ["True", "cinematacms-deploy-test", "http://127.0.0.1:14318/v1/traces", "0.25"],
        )

    def test_non_interactive_mode_rejects_missing_required_option(self):
        result = self.run_installer(
            "--non-interactive",
            "--domain",
            "video.example.org",
            "--proxy",
            "none",
            "--dry-run",
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("--observability is required with --non-interactive", result.stderr)

    def test_interactive_dry_run_prompts_for_missing_options(self):
        result = self.run_installer(
            "--dry-run",
            input_text="video.example.org\nExample Video\ncloudflare\nlocal\n",
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("domain=video.example.org", result.stdout)
        self.assertIn("portal_name=Example Video", result.stdout)
        self.assertIn("proxy=cloudflare", result.stdout)
        self.assertIn("observability=local", result.stdout)


class ApplyReleaseConfigTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.deploy_root = Path(self.temp_dir.name) / "root"
        self.fake_bin = Path(self.temp_dir.name) / "bin"
        self.command_log = Path(self.temp_dir.name) / "commands.log"
        self.observability_installer = Path(self.temp_dir.name) / "install-observability"
        self.fake_bin.mkdir()
        self.deploy_root.mkdir()
        self._write_fake_command("systemctl")
        self._write_fake_command("nginx", 'exit "${FAKE_NGINX_EXIT:-0}"')
        self._write_fake_command("prometheus")
        self._write_fake_command("otelcol-contrib")
        self.observability_installer.write_text(
            textwrap.dedent(
                """\
                #!/bin/sh
                echo "install-observability" >> "$FAKE_COMMAND_LOG"
                for command in prometheus otelcol-contrib; do
                    printf '#!/bin/sh\nexit 0\n' > "$FAKE_BIN/$command"
                    chmod +x "$FAKE_BIN/$command"
                done
                """
            )
        )
        self.observability_installer.chmod(self.observability_installer.stat().st_mode | stat.S_IXUSR)

    def _write_fake_command(self, name, extra=""):
        path = self.fake_bin / name
        path.write_text(
            textwrap.dedent(
                f"""\
                #!/bin/sh
                echo "{name} $*" >> "$FAKE_COMMAND_LOG"
                {extra}
                """
            )
        )
        path.chmod(path.stat().st_mode | stat.S_IXUSR)

    def run_updater(self, *args, nginx_exit="0"):
        env = os.environ.copy()
        env.update(
            {
                "CINEMATA_DEPLOY_ROOT": str(self.deploy_root),
                "CINEMATA_SKIP_ROOT_CHECK": "1",
                "FAKE_COMMAND_LOG": str(self.command_log),
                "FAKE_NGINX_EXIT": nginx_exit,
                "FAKE_BIN": str(self.fake_bin),
                "PATH": f"{self.fake_bin}:{env['PATH']}",
                "CINEMATA_OBSERVABILITY_INSTALLER": str(self.observability_installer),
            }
        )
        return subprocess.run(
            ["bash", str(UPDATER), *args],
            cwd=PROJECT_ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_first_apply_persists_config_and_installs_managed_files(self):
        result = self.run_updater(
            "--domain",
            "video.example.org",
            "--proxy",
            "cloudflare",
            "--observability",
            "local",
            "--no-restart",
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        config = (self.deploy_root / "etc/cinematacms/deployment.env").read_text()
        self.assertIn("CINEMATA_DOMAIN=video.example.org", config)
        self.assertIn("CINEMATA_PROXY=cloudflare", config)
        self.assertIn("CINEMATA_OBSERVABILITY=local", config)
        self.assertTrue((self.deploy_root / "etc/nginx/snippets/cinematacms-metrics.conf").is_file())
        self.assertTrue((self.deploy_root / "etc/nginx/conf.d/cloudflare_real_ip.conf").is_file())
        self.assertTrue((self.deploy_root / "etc/cinematacms/prometheus.yml").is_file())
        self.assertTrue((self.deploy_root / "etc/cinematacms/otelcol-contrib.yml").is_file())
        observability_env = (self.deploy_root / "etc/cinematacms/observability.env").read_text()
        self.assertIn("OTEL_ENABLED=true", observability_env)
        for unit in ("mediacms", "celery_long", "celery_short", "celery_whisper", "celery_beat"):
            unit_text = (self.deploy_root / f"etc/systemd/system/{unit}.service").read_text()
            self.assertIn("EnvironmentFile=-/etc/cinematacms/observability.env", unit_text)
        site = (self.deploy_root / "etc/nginx/sites-available/mediacms.io").read_text()
        self.assertIn("server_name video.example.org;", site)
        self.assertEqual(site.count("cinematacms-metrics.conf"), 2)
        self.assertIn("nginx -t", self.command_log.read_text())
        self.assertNotIn("systemctl enable --now", self.command_log.read_text())

    def test_second_apply_reuses_saved_config_without_duplicate_nginx_include(self):
        first = self.run_updater(
            "--domain",
            "video.example.org",
            "--proxy",
            "none",
            "--observability",
            "none",
            "--no-restart",
        )
        self.assertEqual(first.returncode, 0, first.stderr)
        site_path = self.deploy_root / "etc/nginx/sites-available/mediacms.io"
        site_path.write_text(site_path.read_text() + "# retained Certbot configuration\n")

        second = self.run_updater("--no-restart")

        self.assertEqual(second.returncode, 0, second.stderr)
        site = site_path.read_text()
        self.assertEqual(site.count("cinematacms-metrics.conf"), 2)
        self.assertIn("# retained Certbot configuration", site)
        self.assertFalse((self.deploy_root / "etc/nginx/conf.d/cloudflare_real_ip.conf").exists())

    def test_failed_nginx_validation_restores_existing_site(self):
        site_path = self.deploy_root / "etc/nginx/sites-available/mediacms.io"
        site_path.parent.mkdir(parents=True)
        original = "server {\n    location / { return 200; }\n}\n"
        site_path.write_text(original)

        result = self.run_updater(
            "--domain",
            "video.example.org",
            "--proxy",
            "cloudflare",
            "--observability",
            "none",
            "--no-restart",
            nginx_exit="1",
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("nginx validation failed", result.stderr)
        self.assertEqual(site_path.read_text(), original)

    def test_local_mode_installs_missing_observability_binaries(self):
        (self.fake_bin / "prometheus").unlink()
        (self.fake_bin / "otelcol-contrib").unlink()

        result = self.run_updater(
            "--domain",
            "video.example.org",
            "--proxy",
            "none",
            "--observability",
            "local",
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("install-observability", self.command_log.read_text())

    def test_saved_domain_cannot_change_through_release_updater(self):
        first = self.run_updater(
            "--domain",
            "video.example.org",
            "--proxy",
            "none",
            "--observability",
            "none",
            "--no-restart",
        )
        self.assertEqual(first.returncode, 0, first.stderr)

        second = self.run_updater(
            "--domain",
            "other.example.org",
            "--no-restart",
        )

        self.assertNotEqual(second.returncode, 0)
        self.assertIn("Certbot and nginx", second.stderr)


if __name__ == "__main__":
    unittest.main()
