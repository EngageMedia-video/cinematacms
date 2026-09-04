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
LOCAL_OBSERVABILITY_INSTALLER = PROJECT_ROOT / "deploy" / "install-local-observability.sh"
RESTART_SCRIPT = PROJECT_ROOT / "restart_script.sh"


class InstallScriptTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.test_root = Path(self.temp_dir.name)

    def run_installer(self, *args, input_text="", env=None):
        return subprocess.run(
            ["bash", str(INSTALLER), *args],
            cwd=PROJECT_ROOT,
            env=env,
            input=input_text,
            capture_output=True,
            text=True,
            check=False,
        )

    def platform_env(self, version="22.04", architecture="amd64"):
        os_release = self.test_root / "os-release"
        os_release.write_text(f'ID=ubuntu\nVERSION_ID="{version}"\n')
        fake_bin = self.test_root / "bin"
        fake_bin.mkdir(exist_ok=True)
        dpkg = fake_bin / "dpkg"
        dpkg.write_text(f"#!/bin/sh\nprintf '%s\\n' '{architecture}'\n")
        dpkg.chmod(dpkg.stat().st_mode | stat.S_IXUSR)
        env = os.environ.copy()
        env.update(
            {
                "CINEMATA_OS_RELEASE_FILE": str(os_release),
                "PATH": f"{fake_bin}:{env['PATH']}",
            }
        )
        return env

    def run_installer_function(self, function_call, env=None):
        return subprocess.run(
            [
                "bash",
                "-c",
                'source "$1"; eval "$2"',
                "installer-test",
                str(INSTALLER),
                function_call,
            ],
            cwd=PROJECT_ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

    def service_env(self, postgres_exit="0", redis_exit="0"):
        fake_bin = self.test_root / "service-bin"
        fake_bin.mkdir(exist_ok=True)
        command_log = self.test_root / "service-commands.log"
        commands = {
            "systemctl": "exit 0",
            "pg_isready": f'exit "{postgres_exit}"',
            "redis-cli": f'exit "{redis_exit}"',
        }
        for name, result in commands.items():
            command = fake_bin / name
            command.write_text(f'#!/bin/sh\nprintf "%s\\n" "{name} $*" >> "$FAKE_COMMAND_LOG"\n{result}\n')
            command.chmod(command.stat().st_mode | stat.S_IXUSR)
        env = os.environ.copy()
        env.update(
            {
                "CINEMATA_SERVICE_WAIT_ATTEMPTS": "1",
                "CINEMATA_SERVICE_WAIT_DELAY": "0",
                "FAKE_COMMAND_LOG": str(command_log),
                "PATH": f"{fake_bin}:{env['PATH']}",
            }
        )
        return env, command_log

    def bento4_env(self, git_clone_exit="0", mp4hls_exit="0"):
        fake_bin = self.test_root / "bento4-bin"
        fake_bin.mkdir(exist_ok=True)
        command_log = self.test_root / "bento4-commands.log"
        install_dir = self.test_root / "opt" / "bento4"
        git = fake_bin / "git"
        git.write_text(
            textwrap.dedent(
                f"""\
                #!/bin/sh
                printf '%s\\n' "git $*" >> "$FAKE_COMMAND_LOG"
                if [ "$1" = "clone" ]; then
                    [ "{git_clone_exit}" = "0" ] || exit "{git_clone_exit}"
                    for argument in "$@"; do destination="$argument"; done
                    mkdir -p "$destination/Scripts"
                    exit 0
                fi
                if [ "$1" = "-C" ]; then
                    printf '%s\\n' dc264854d1f76c370b65b18d9f303a95f7f21ab1
                    exit 0
                fi
                exit 1
                """
            )
        )
        cmake = fake_bin / "cmake"
        cmake.write_text('#!/bin/sh\nprintf \'%s\\n\' "cmake $*" >> "$FAKE_COMMAND_LOG"\nexit 0\n')
        python = fake_bin / "python3"
        python.write_text(
            textwrap.dedent(
                f"""\
                #!/bin/sh
                printf '%s\\n' "python3 $*" >> "$FAKE_COMMAND_LOG"
                target="$2"
                sdk="SDK/Bento4-SDK-1-6-0-641.$target"
                mkdir -p "$sdk/bin"
                printf '#!/bin/sh\\nexit {mp4hls_exit}\\n' > "$sdk/bin/mp4hls"
                chmod +x "$sdk/bin/mp4hls"
                """
            )
        )
        nproc = fake_bin / "nproc"
        nproc.write_text("#!/bin/sh\nprintf '2\\n'\n")
        for command in (git, cmake, python, nproc):
            command.chmod(command.stat().st_mode | stat.S_IXUSR)
        env = os.environ.copy()
        env.update(
            {
                "CINEMATA_BENTO4_INSTALL_DIR": str(install_dir),
                "FAKE_COMMAND_LOG": str(command_log),
                "PATH": f"{fake_bin}:{env['PATH']}",
            }
        )
        return env, command_log, install_dir

    def npm_env(self, installed_version="11.19.0", package_manager="npm@11.19.0"):
        fake_bin = self.test_root / "npm-bin"
        fake_bin.mkdir(exist_ok=True)
        command_log = self.test_root / "npm-commands.log"
        node = fake_bin / "node"
        node.write_text(f"#!/bin/sh\nprintf '%s\\n' '{package_manager}'\n")
        npm = fake_bin / "npm"
        npm.write_text(
            textwrap.dedent(
                f"""\
                #!/bin/sh
                printf '%s\\n' "npm $*" >> "$FAKE_COMMAND_LOG"
                if [ "$1" = "-v" ]; then
                    printf '%s\\n' "{installed_version}"
                fi
                """
            )
        )
        for command in (node, npm):
            command.chmod(command.stat().st_mode | stat.S_IXUSR)
        env = os.environ.copy()
        env.update(
            {
                "FAKE_COMMAND_LOG": str(command_log),
                "PATH": f"{fake_bin}:{env['PATH']}",
            }
        )
        return env, command_log

    def test_service_readiness_starts_and_checks_postgres_and_redis(self):
        env, command_log = self.service_env()

        result = self.run_installer_function("ensure_services_ready", env=env)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            command_log.read_text().splitlines(),
            [
                "systemctl enable --now postgresql redis-server",
                "pg_isready -q",
                "redis-cli ping",
            ],
        )

    def test_service_readiness_fails_when_postgres_does_not_start(self):
        env, _ = self.service_env(postgres_exit="1")

        result = self.run_installer_function("ensure_services_ready", env=env)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("PostgreSQL did not become ready", result.stderr)

    def test_bento4_build_target_matches_supported_architecture(self):
        expected_targets = {
            "amd64": "x86_64-unknown-linux",
            "arm64": "arm64-unknown-linux",
        }

        for architecture, expected_target in expected_targets.items():
            with self.subTest(architecture=architecture):
                result = self.run_installer_function(f"bento4_target_for_arch {architecture}")

                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout.strip(), expected_target)

    def test_bento4_install_builds_arm64_and_smoke_tests_mp4hls(self):
        env, command_log, install_dir = self.bento4_env()

        result = self.run_installer_function("install_bento4 arm64", env=env)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertTrue((install_dir / "bin" / "mp4hls").is_file())
        commands = command_log.read_text()
        self.assertIn("arm64-unknown-linux", commands)
        self.assertIn("checkout --quiet -b cinematacms-build", commands)
        self.assertIn("Bento4 installed", result.stdout)

    def test_bento4_download_failure_stops_installation(self):
        env, _, install_dir = self.bento4_env(git_clone_exit="23")

        result = self.run_installer_function("install_bento4 amd64", env=env)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("could not download Bento4", result.stderr)
        self.assertNotIn("Bento4 installed", result.stdout)
        self.assertFalse(install_dir.exists())

    def test_bento4_smoke_test_failure_leaves_no_partial_install(self):
        env, _, install_dir = self.bento4_env(mp4hls_exit="7")

        result = self.run_installer_function("install_bento4 arm64", env=env)

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("failed its smoke test", result.stderr)
        self.assertFalse(install_dir.exists())

    def test_project_npm_version_comes_from_frontend_package(self):
        env, command_log = self.npm_env()

        result = self.run_installer_function(
            f"install_project_npm {PROJECT_ROOT / 'frontend' / 'package.json'}",
            env=env,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("npm install --global npm@11.19.0", command_log.read_text())

    def test_project_npm_version_mismatch_fails_installation(self):
        env, _ = self.npm_env(installed_version="10.9.8")

        result = self.run_installer_function(
            f"install_project_npm {PROJECT_ROOT / 'frontend' / 'package.json'}",
            env=env,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("expected npm 11.19.0", result.stderr)

    def test_project_npm_ignores_corepack_integrity_suffix_for_version_check(self):
        package_manager = "npm@11.19.0+sha512.deadbeef"
        env, command_log = self.npm_env(package_manager=package_manager)

        result = self.run_installer_function(
            f"install_project_npm {PROJECT_ROOT / 'frontend' / 'package.json'}",
            env=env,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f"npm install --global {package_manager}", command_log.read_text())

    def test_non_interactive_install_disables_package_prompts(self):
        result = self.run_installer_function(
            "NON_INTERACTIVE=true; configure_package_manager; printf '%s' \"$DEBIAN_FRONTEND\""
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout, "noninteractive")

    def test_platform_check_accepts_ubuntu_22_arm64(self):
        result = self.run_installer(
            "--check-platform",
            env=self.platform_env(architecture="arm64"),
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("Supported platform: Ubuntu 22.04 (arm64)", result.stdout)

    def test_platform_check_rejects_other_ubuntu_release(self):
        result = self.run_installer(
            "--check-platform",
            env=self.platform_env(version="24.04"),
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Ubuntu 22.04 is required", result.stderr)

    def test_platform_check_rejects_unsupported_architecture(self):
        result = self.run_installer(
            "--check-platform",
            env=self.platform_env(architecture="ppc64el"),
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("amd64 and arm64", result.stderr)

    def test_full_install_rejects_non_root_with_failure_status(self):
        fake_bin = self.test_root / "non-root-bin"
        fake_bin.mkdir()
        fake_id = fake_bin / "id"
        fake_id.write_text("#!/bin/sh\nprintf '1000\\n'\n")
        fake_id.chmod(fake_id.stat().st_mode | stat.S_IXUSR)
        env = os.environ.copy()
        env["PATH"] = f"{fake_bin}:{env['PATH']}"

        result = self.run_installer(
            "--non-interactive",
            "--domain",
            "localhost",
            "--proxy",
            "none",
            "--observability",
            "none",
            env=env,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must run as root", result.stderr)

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

    def test_non_interactive_dry_run_rejects_portal_name_with_backslash(self):
        result = self.run_installer(
            "--non-interactive",
            "--domain",
            "video.example.org",
            "--portal-name",
            "Example\\",
            "--proxy",
            "none",
            "--observability",
            "none",
            "--dry-run",
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("--portal-name may contain", result.stderr)

    def test_bento4_fake_python_has_valid_shebang(self):
        self.bento4_env()

        python = self.test_root / "bento4-bin" / "python3"
        self.assertTrue(python.read_bytes().startswith(b"#!/bin/sh\n"))

    def test_runtime_settings_read_observability_environment(self):
        env = os.environ.copy()
        env.update(
            {
                "DJANGO_SETTINGS_MODULE": "cms.ci_settings",
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

    def test_runtime_settings_fall_back_for_invalid_sampler_value(self):
        env = os.environ.copy()
        env.update(
            {
                "DJANGO_SETTINGS_MODULE": "cms.ci_settings",
                "OTEL_TRACES_SAMPLER_ARG": "0,25",
            }
        )
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                "from django.conf import settings; print(settings.OTEL_TRACES_SAMPLER_ARG)",
            ],
            cwd=PROJECT_ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "1.0")

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


class LocalObservabilityInstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.fake_bin = Path(self.temp_dir.name) / "bin"
        self.command_log = Path(self.temp_dir.name) / "commands.log"
        self.fake_bin.mkdir()
        self._write_fake_command("prometheus", "exit 0")
        self._write_fake_command("otelcol-contrib", "exit 0")
        self._write_fake_command(
            "id",
            """
            if [ "$#" -eq 1 ] && [ "$1" = "-u" ]; then
                printf '0\\n'
                exit 0
            fi
            if [ "${FAKE_USER_EXISTS:-0}" = "1" ]; then
                printf '999\\n'
                exit 0
            fi
            exit 1
            """,
        )
        self._write_fake_command(
            "getent",
            """
            [ "${FAKE_GROUP_EXISTS:-0}" = "1" ]
            """,
        )
        self._write_fake_command("groupadd", "exit 0")
        self._write_fake_command("useradd", "exit 0")
        self._write_fake_command(
            "systemctl",
            """
            case "$1" in
                show)
                    if [ "${FAKE_MISSING_UNITS:-0}" = "1" ]; then
                        printf 'not-found\\n'
                    else
                        printf 'loaded\\n'
                    fi
                    ;;
                disable)
                    [ "${FAKE_DISABLE_FAIL_SERVICE:-}" != "$3" ]
                    ;;
                is-active)
                    [ "${FAKE_ACTIVE_SERVICE:-}" = "$3" ]
                    ;;
            esac
            """,
        )

    def _write_fake_command(self, name, body):
        command = self.fake_bin / name
        command.write_text(
            "#!/bin/sh\nprintf '%s\\n' \"" + name + ' $*" >> "$FAKE_COMMAND_LOG"\n' + textwrap.dedent(body).lstrip()
        )
        command.chmod(command.stat().st_mode | stat.S_IXUSR)

    def run_installer(self, *args, env_updates=None):
        env = os.environ.copy()
        env.update(
            {
                "FAKE_COMMAND_LOG": str(self.command_log),
                "PATH": f"{self.fake_bin}:{env['PATH']}",
            }
        )
        if env_updates:
            env.update(env_updates)
        return subprocess.run(
            ["bash", str(LOCAL_OBSERVABILITY_INSTALLER), *args],
            cwd=PROJECT_ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_missing_group_is_created_before_the_service_user(self):
        result = self.run_installer("--no-service-changes")

        self.assertEqual(result.returncode, 0, result.stderr)
        commands = self.command_log.read_text().splitlines()
        groupadd = commands.index("groupadd --system otelcol-contrib")
        useradd = commands.index(
            "useradd --system --gid otelcol-contrib --home-dir /nonexistent --shell /usr/sbin/nologin otelcol-contrib"
        )
        self.assertLess(groupadd, useradd)

    def test_existing_service_shutdown_failure_aborts_installation(self):
        result = self.run_installer(
            env_updates={
                "FAKE_USER_EXISTS": "1",
                "FAKE_GROUP_EXISTS": "1",
                "FAKE_DISABLE_FAIL_SERVICE": "prometheus",
            }
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("could not stop package service prometheus", result.stderr)

    def test_service_that_remains_active_aborts_installation(self):
        result = self.run_installer(
            env_updates={
                "FAKE_USER_EXISTS": "1",
                "FAKE_GROUP_EXISTS": "1",
                "FAKE_ACTIVE_SERVICE": "prometheus",
            }
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("package service prometheus is still active", result.stderr)

    def test_missing_package_services_are_ignored(self):
        result = self.run_installer(
            env_updates={
                "FAKE_USER_EXISTS": "1",
                "FAKE_GROUP_EXISTS": "1",
                "FAKE_MISSING_UNITS": "1",
            }
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("systemctl disable", self.command_log.read_text())


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
                    printf '#!/bin/sh\\nexit 0\\n' > "$FAKE_BIN/$command"
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

    def test_fake_observability_installer_has_valid_shebang(self):
        self.assertTrue(self.observability_installer.read_bytes().startswith(b"#!/bin/sh\n"))

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
        app_env_path = self.deploy_root / "etc/cinematacms/app.env"
        app_env = app_env_path.read_text()
        self.assertIn("OTEL_ENABLED=true", app_env)
        self.assertIn("FRONTEND_HOST=https://video.example.org", app_env)
        self.assertRegex(app_env, r"TELEMETRY_WORKER_ID=[0-9a-f-]{36}")
        self.assertRegex(app_env, r"TELEMETRY_WORKER_HMAC_KEY=[A-Za-z0-9_-]{40,}")
        self.assertFalse((self.deploy_root / "etc/cinematacms/observability.env").exists())
        for unit in ("mediacms", "celery_long", "celery_short", "celery_whisper", "celery_email", "celery_beat"):
            unit_text = (self.deploy_root / f"etc/systemd/system/{unit}.service").read_text()
            self.assertIn("EnvironmentFile=/etc/cinematacms/app.env", unit_text)
        site = (self.deploy_root / "etc/nginx/sites-available/mediacms.io").read_text()
        self.assertIn("server_name video.example.org;", site)
        self.assertEqual(site.count("cinematacms-metrics.conf"), 2)
        self.assertIn("nginx -t", self.command_log.read_text())
        self.assertNotIn("systemctl enable --now", self.command_log.read_text())

    def test_apply_restarts_active_application_services(self):
        result = self.run_updater(
            "--domain",
            "video.example.org",
            "--proxy",
            "none",
            "--observability",
            "none",
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        commands = self.command_log.read_text().splitlines()
        application_services = "mediacms celery_long celery_short celery_whisper celery_email celery_beat"
        self.assertIn(f"systemctl enable {application_services}", commands)
        self.assertIn(f"systemctl restart {application_services}", commands)
        self.assertNotIn(f"systemctl enable --now {application_services}", commands)

    def test_application_service_restart_failure_aborts_apply(self):
        self._write_fake_command(
            "systemctl",
            """
            if [ "$1" = "restart" ]; then
                exit 23
            fi
            """,
        )

        result = self.run_updater(
            "--domain",
            "video.example.org",
            "--proxy",
            "none",
            "--observability",
            "none",
        )

        self.assertNotEqual(result.returncode, 0)
        commands = self.command_log.read_text().splitlines()
        self.assertIn(
            "systemctl restart mediacms celery_long celery_short celery_whisper celery_email celery_beat",
            commands,
        )
        self.assertNotIn("systemctl reload-or-restart nginx", commands)

    def test_no_restart_performs_no_service_lifecycle_actions(self):
        result = self.run_updater(
            "--domain",
            "video.example.org",
            "--proxy",
            "none",
            "--observability",
            "none",
            "--no-restart",
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        lifecycle_actions = {"enable", "disable", "start", "stop", "restart", "reload-or-restart"}
        systemctl_commands = (
            command.split()[1]
            for command in self.command_log.read_text().splitlines()
            if command.startswith("systemctl ")
        )
        self.assertTrue(lifecycle_actions.isdisjoint(systemctl_commands))

    def test_installed_mediacms_unit_uses_systemd_process_shutdown(self):
        result = self.run_updater(
            "--domain",
            "video.example.org",
            "--proxy",
            "none",
            "--observability",
            "none",
            "--no-restart",
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        unit = (self.deploy_root / "etc/systemd/system/mediacms.service").read_text()
        self.assertNotIn("ExecStop=", unit)
        self.assertNotIn("killall", unit)

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
        app_env_path = self.deploy_root / "etc/cinematacms/app.env"
        original_app_env = app_env_path.read_text()
        app_env_path.write_text(original_app_env + "EMAIL_HOST=smtp.example.org\n")
        site_path = self.deploy_root / "etc/nginx/sites-available/mediacms.io"
        site_path.write_text(site_path.read_text() + "# retained Certbot configuration\n")

        second = self.run_updater("--no-restart")

        self.assertEqual(second.returncode, 0, second.stderr)
        site = site_path.read_text()
        self.assertEqual(site.count("cinematacms-metrics.conf"), 2)
        self.assertIn("# retained Certbot configuration", site)
        updated_app_env = app_env_path.read_text()
        self.assertIn("EMAIL_HOST=smtp.example.org", updated_app_env)
        for key in ("TELEMETRY_WORKER_ID", "TELEMETRY_WORKER_HMAC_KEY"):
            original_value = next(line for line in original_app_env.splitlines() if line.startswith(f"{key}="))
            self.assertIn(original_value, updated_app_env)
        self.assertFalse((self.deploy_root / "etc/nginx/conf.d/cloudflare_real_ip.conf").exists())

    def test_first_apply_migrates_and_removes_legacy_observability_environment(self):
        legacy_path = self.deploy_root / "etc/cinematacms/observability.env"
        legacy_path.parent.mkdir(parents=True)
        legacy_path.write_text("OTEL_SERVICE_NAMESPACE=legacy-namespace\n")

        result = self.run_updater(
            "--domain",
            "video.example.org",
            "--proxy",
            "none",
            "--observability",
            "local",
            "--no-restart",
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(
            "OTEL_SERVICE_NAMESPACE=legacy-namespace",
            (self.deploy_root / "etc/cinematacms/app.env").read_text(),
        )
        self.assertFalse(legacy_path.exists())

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

    def test_managed_file_write_failure_restores_previous_config(self):
        config_path = self.deploy_root / "etc/cinematacms/deployment.env"
        config_path.parent.mkdir(parents=True)
        original = (
            "CINEMATA_DOMAIN=video.example.org\n"
            "CINEMATA_PROXY=none\n"
            "CINEMATA_OBSERVABILITY=none\n"
            "# preserve this line\n"
        )
        config_path.write_text(original)
        self._write_fake_command("install", "exit 17")

        result = self.run_updater(
            "--proxy",
            "cloudflare",
            "--no-restart",
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(config_path.read_text(), original)

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


class RestartScriptTests(unittest.TestCase):
    def test_restart_installs_and_starts_every_application_unit(self):
        script = RESTART_SCRIPT.read_text()
        units = "mediacms celery_long celery_short celery_whisper celery_email celery_beat"

        self.assertIn("set -e", script)
        self.assertIn("deploy/apply-release-config.sh --no-restart", script)
        self.assertIn(f"for unit in {units}; do", script)
        self.assertIn('install -m 0644 "deploy/$unit.service" "/etc/systemd/system/$unit.service"', script)
        self.assertIn(f"systemctl enable {units}", script)
        self.assertIn(f"systemctl restart {units}", script)


if __name__ == "__main__":
    unittest.main()
