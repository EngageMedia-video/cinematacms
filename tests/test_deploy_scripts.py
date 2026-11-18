import errno
import hashlib
import io
import json
import os
import re
import runpy
import shlex
import shutil
import signal
import stat
import subprocess
import sys
import tarfile
import tempfile
import textwrap
import time
import types
import unittest
from pathlib import Path
from unittest import mock

import yaml

PROJECT_ROOT = Path(__file__).resolve().parents[1]
INSTALLER = PROJECT_ROOT / "install.sh"
UPDATER = PROJECT_ROOT / "deploy" / "apply-release-config.sh"
MIGRATOR = PROJECT_ROOT / "deploy" / "migrate-python-runtime.sh"
LOCAL_OBSERVABILITY_INSTALLER = PROJECT_ROOT / "deploy" / "install-local-observability.sh"
LOCAL_GRAFANA_INSTALLER = PROJECT_ROOT / "deploy" / "install-local-grafana.sh"
RESTART_SCRIPT = PROJECT_ROOT / "restart_script.sh"
CI_WORKFLOW = PROJECT_ROOT / ".github" / "workflows" / "ci.yml"
APP_ENV_RENDERER = PROJECT_ROOT / "deploy" / "render-app-env.py"
NODE_INSTALLER = PROJECT_ROOT / "install-nodejs.sh"
FRONTEND_ARTIFACT_TOOL = PROJECT_ROOT / "deploy" / "frontend-artifact.py"
PATH_EXCHANGE_TOOL = PROJECT_ROOT / "deploy" / "exchange-paths.py"
STATIC_RELEASES = Path("static_releases")
COLLECTED_STATIC = Path("static_collected")
FRONTEND_BUILD = Path("frontend/build/production/static")
# A hook passes GIT_DIR and GIT_INDEX_FILE to its commands, which would point a test repository at this one.
GIT_ENVIRONMENT = {name: value for name, value in os.environ.items() if not name.startswith("GIT_")} | {
    "GIT_CONFIG_GLOBAL": os.devnull,
    "GIT_CONFIG_SYSTEM": os.devnull,
    "GIT_AUTHOR_NAME": "Deployer",
    "GIT_AUTHOR_EMAIL": "deployer@example.org",
    "GIT_COMMITTER_NAME": "Deployer",
    "GIT_COMMITTER_EMAIL": "deployer@example.org",
}


def write_frontend_build(root, script):
    files = {
        ".vite/manifest.json": json.dumps(
            {
                "src/entries/base.js": {
                    "file": "assets/base-1a2b.js",
                    "css": ["assets/base-3c4d.css"],
                    "imports": ["_vendor-5e6f.js"],
                    "dynamicImports": ["src/pages/player.js"],
                    "isEntry": True,
                },
                "_vendor-5e6f.js": {"file": "assets/vendor-5e6f.js"},
                "src/pages/player.js": {
                    "file": "assets/player-7a8b.js",
                    "imports": ["_vendor-5e6f.js"],
                    "isDynamicEntry": True,
                },
            }
        ),
        "assets/base-1a2b.js": script,
        "assets/base-3c4d.css": "body{}",
        "assets/vendor-5e6f.js": "export {}",
        "assets/player-7a8b.js": "export {}",
        "lib/Inter/inter.woff2": "font",
    }
    write_tree(root, files)
    return files


def write_tree(root, files):
    for name, content in files.items():
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)


def read_tree(root):
    return {path.relative_to(root).as_posix(): path.read_text() for path in root.rglob("*") if path.is_file()}


def run_frontend_artifact_tool(*arguments):
    return subprocess.run(
        [sys.executable, str(FRONTEND_ARTIFACT_TOOL), *(str(argument) for argument in arguments)],
        capture_output=True,
        text=True,
        check=False,
    )


def pack_frontend_artifact(build, commit, artifact):
    result = run_frontend_artifact_tool("pack", "--build-dir", build, "--commit", commit, "--output-dir", artifact)
    if result.returncode != 0:
        raise AssertionError(result.stderr)


def gunicorn_settings(environment):
    """The settings gunicorn resolves from deploy/gunicorn.conf.py, as the text it prints for each."""
    result = subprocess.run(
        [
            str(Path(sys.executable).parent / "gunicorn"),
            "--config",
            str(PROJECT_ROOT / "deploy/gunicorn.conf.py"),
            "--print-config",
            "wsgiref.simple_server:demo_app",
        ],
        env={"PATH": os.environ["PATH"], **environment},
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode != 0:
        raise AssertionError(result.stderr)
    return dict(re.findall(r"(?m)^(\w+) +=(?: (.*))?$", result.stdout))


def application_locations(config):
    """Bodies of the locations that pass requests to the application server."""
    return [
        match.group("body")
        for match in re.finditer(r"location\s+[^{]+\{(?P<body>(?:[^{}]|\{[^{}]*\})*)\}", config)
        if "proxy_pass http://127.0.0.1:9000;" in match.group("body")
    ]


class NginxConfigTests(unittest.TestCase):
    def test_user_facing_locations_define_upload_policy(self):
        location_bodies = application_locations((PROJECT_ROOT / "deploy/mediacms.io").read_text())

        self.assertEqual(len(location_bodies), 2)
        for body in location_bodies:
            with self.subTest(body=body):
                self.assertIn("proxy_read_timeout 900s;", body)
                self.assertIn("proxy_send_timeout 300s;", body)
                self.assertIn("proxy_request_buffering on;", body)

    def test_every_location_that_reaches_the_application_replaces_the_client_headers(self):
        for name, passes in (
            ("mediacms.io", 2),
            ("nginx/cinematacms-metrics.conf", 2),
            ("nginx/cinematacms-rate-limits.conf", 3),
        ):
            config = (PROJECT_ROOT / "deploy" / name).read_text()
            with self.subTest(name=name):
                self.assertNotIn("uwsgi", config)
                location_bodies = application_locations(config)
                self.assertEqual(len(location_bodies), passes)
                for body in location_bodies:
                    self.assertIn("include /etc/nginx/snippets/cinematacms-proxy.conf;", body)

    def test_the_application_reads_its_client_headers_from_nginx_variables(self):
        snippet = (PROJECT_ROOT / "deploy/nginx/cinematacms-proxy.conf").read_text()

        self.assertEqual(
            dict(re.findall(r"(?m)^proxy_set_header (\S+) (\S+);$", snippet)),
            {"Host": "$http_host", "X-Real-IP": "$remote_addr", "X-Forwarded-Proto": "$cinematacms_forwarded_proto"},
        )

    def test_client_body_timeout_allows_slow_upload_chunks(self):
        config = (PROJECT_ROOT / "deploy/nginx/cinematacms-http.conf").read_text()

        self.assertIn("client_body_timeout 300s;", config)

    def test_access_log_format_records_only_a_well_formed_upload_id(self):
        config = (PROJECT_ROOT / "deploy/nginx/cinematacms-http.conf").read_text()
        log_format = re.search(r"log_format\s+cinematacms\s+(.*?);", config, re.DOTALL).group(1)
        upload_id_map = re.search(r"map\s+\$http_x_upload_id\s+\$cinematacms_upload_id\s*\{(.*?)\}", config, re.DOTALL)

        self.assertIsNotNone(upload_id_map)
        self.assertRegex(upload_id_map.group(1), r'default\s+"-";')
        self.assertTrue(log_format.rstrip().endswith("uid=$cinematacms_upload_id'"), log_format)
        self.assertNotIn("$http_x_upload_id", log_format)

    def test_main_config_has_no_proxy_only_timeouts(self):
        config = (PROJECT_ROOT / "deploy/nginx.conf").read_text()

        self.assertNotRegex(config, r"\bproxy_(?:connect|read)_timeout\b")

    def test_access_logs_use_request_timing_format(self):
        main_config = (PROJECT_ROOT / "deploy/nginx.conf").read_text()
        http_policy = (PROJECT_ROOT / "deploy/nginx/cinematacms-http.conf").read_text()
        site_config = (PROJECT_ROOT / "deploy/mediacms.io").read_text()
        access_logs = [
            line.strip()
            for config in (main_config, site_config)
            for line in config.splitlines()
            if line.strip().startswith("access_log ")
        ]

        self.assertEqual(len(access_logs), 3)
        formats = {
            match.group("name"): match.group("body")
            for match in re.finditer(
                r"log_format\s+(?P<name>\w+)\s+(?P<body>.*?);",
                "\n".join((main_config, http_policy)),
                re.DOTALL,
            )
        }
        for directive in access_logs:
            with self.subTest(directive=directive):
                match = re.match(r"^access_log\s+\S+\s+(?P<format>\w+);$", directive)
                self.assertIsNotNone(match)
                log_format = formats[match.group("format")]
                for variable in ("$request_time", "$upstream_response_time", "$request_length"):
                    self.assertIn(variable, log_format)

        self.assertLess(main_config.index("log_format compression"), main_config.index("access_log "))

    def test_site_logs_with_client_ips_rotate_out_after_14_days(self):
        site_config = (PROJECT_ROOT / "deploy/mediacms.io").read_text()
        logrotate = (PROJECT_ROOT / "deploy/logrotate-cinematacms-nginx").read_text()
        log_paths = re.findall(r"^\s*(?:access|error)_log\s+(\S+)", site_config, re.MULTILINE)

        self.assertEqual(len(log_paths), 4)
        for path in log_paths:
            with self.subTest(path=path):
                self.assertTrue(path.startswith("/var/log/cinematacms/nginx/"))
        self.assertIn("/var/log/cinematacms/nginx/*.log {", logrotate)
        self.assertRegex(logrotate, r"\n\s+daily\n")
        self.assertRegex(logrotate, r"\n\s+rotate 14\n")
        self.assertRegex(logrotate, r"\n\s+maxage 14\n")

    def test_rate_limited_locations_use_zones_keyed_by_client_network(self):
        http_policy = (PROJECT_ROOT / "deploy/nginx/cinematacms-http.conf").read_text()
        rate_limits = (PROJECT_ROOT / "deploy/nginx/cinematacms-rate-limits.conf").read_text()
        site_config = (PROJECT_ROOT / "deploy/mediacms.io").read_text()
        zones = set(re.findall(r"limit_req_zone\s+\$cinematacms_client_network\s+zone=(\w+):", http_policy))
        used_zones = re.findall(r"limit_req\s+zone=(\w+)", rate_limits)

        self.assertEqual(set(used_zones), zones)
        self.assertEqual(len(used_zones), 3)
        self.assertIn("limit_req_status 429;", http_policy)
        self.assertEqual(site_config.count("include /etc/nginx/snippets/cinematacms-rate-limits.conf;"), 2)
        for location in ("location = /view", "/actions$", "/password$"):
            self.assertIn(location, rate_limits)

    def test_client_body_size_remains_5800_megabytes(self):
        configs = [
            (PROJECT_ROOT / path).read_text()
            for path in (
                "deploy/nginx.conf",
                "deploy/nginx/cinematacms-http.conf",
                "deploy/mediacms.io",
                "deploy/nginx/cinematacms-metrics.conf",
            )
        ]
        directives = re.findall(r"\bclient_max_body_size\s+\S+;", "\n".join(configs))

        self.assertEqual(directives, ["client_max_body_size 5800M;"])


class GunicornConfigTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.metrics_directory = Path(directory.name)
        environment = mock.patch.dict(os.environ, {"PROMETHEUS_MULTIPROC_DIR": directory.name})
        environment.start()
        self.addCleanup(environment.stop)
        from prometheus_client import values

        self.addCleanup(setattr, values, "ValueClass", values.ValueClass)
        self.hooks = runpy.run_path(str(PROJECT_ROOT / "deploy/gunicorn.conf.py"))
        # The arbiter's table of live workers, keyed by pid.
        self.arbiter = types.SimpleNamespace(WORKERS={})
        self.pids = iter(range(1000, 2000))

    def start_worker(self):
        """Fork a worker as the arbiter does, then count one request in it."""
        from prometheus_client import CollectorRegistry, Counter, Gauge

        worker = types.SimpleNamespace()
        self.hooks["pre_fork"](self.arbiter, worker)
        self.arbiter.WORKERS[next(self.pids)] = worker
        self.hooks["post_fork"](self.arbiter, worker)
        registry = CollectorRegistry()
        Counter("requests", "Requests.", registry=registry).inc()
        Gauge("configured", "Configured.", multiprocess_mode="livemin", registry=registry).set(1)
        return worker

    def reap(self, worker):
        pid = next(pid for pid, live in self.arbiter.WORKERS.items() if live is worker)
        del self.arbiter.WORKERS[pid]
        self.hooks["child_exit"](self.arbiter, worker)

    def requests_counted(self):
        from prometheus_client import CollectorRegistry, multiprocess

        registry = CollectorRegistry()
        multiprocess.MultiProcessCollector(registry)
        return registry.get_sample_value("requests_total")

    def metric_files(self, kind):
        return sorted(path.name for path in self.metrics_directory.glob(f"{kind}_*.db"))

    def test_only_the_scheme_header_that_nginx_overwrites_is_trusted_and_only_from_loopback(self):
        settings = gunicorn_settings({})

        self.assertEqual(settings["secure_scheme_headers"], "{'X-FORWARDED-PROTO': 'https'}")
        self.assertEqual(settings["forwarded_allow_ips"], "['127.0.0.1', '::1']")

    def test_the_master_opens_no_control_socket(self):
        settings = gunicorn_settings({})

        self.assertEqual(settings["control_socket_disable"], "True")

    def test_a_replacement_worker_continues_the_files_of_the_one_it_replaces(self):
        first = self.start_worker()
        self.start_worker()

        self.reap(first)
        replacement = self.start_worker()

        self.assertEqual(replacement.metrics_slot, first.metrics_slot)
        self.assertEqual(self.requests_counted(), 3)
        self.assertEqual(self.metric_files("counter"), ["counter_1.db", "counter_2.db"])

    def test_reloads_keep_the_files_within_twice_the_worker_count(self):
        workers = [self.start_worker(), self.start_worker()]
        for _reload in range(3):
            replacements = [self.start_worker(), self.start_worker()]
            for worker in workers:
                self.reap(worker)
            workers = replacements

        self.assertEqual(self.requests_counted(), 8)
        self.assertEqual(len(self.metric_files("counter")), 4)
        # Only live workers hold a live gauge, so a reaped worker's value no longer counts.
        self.assertEqual(
            self.metric_files("gauge_livemin"),
            sorted(f"gauge_livemin_{worker.metrics_slot}.db" for worker in workers),
        )


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

    def npm_env(self, installed_version="11.20.0", package_manager="npm@11.20.0"):
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
        self.assertIn("npm install --global npm@11.20.0", command_log.read_text())

    def test_project_npm_version_mismatch_fails_installation(self):
        env, _ = self.npm_env(installed_version="10.9.8")

        result = self.run_installer_function(
            f"install_project_npm {PROJECT_ROOT / 'frontend' / 'package.json'}",
            env=env,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("expected npm 11.20.0", result.stderr)

    def test_project_npm_ignores_corepack_integrity_suffix_for_version_check(self):
        package_manager = "npm@11.20.0+sha512.deadbeef"
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

    def test_non_interactive_dry_run_accepts_managed_observability(self):
        result = self.run_installer(
            "--non-interactive",
            "--domain",
            "video.example.org",
            "--portal-name",
            "Example Video",
            "--proxy",
            "cloudflare",
            "--observability",
            "managed",
            "--dry-run",
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("observability=managed", result.stdout)

    def test_installer_leaves_certbot_storage_to_a_single_certbot_run(self):
        script = INSTALLER.read_text()

        self.assertNotRegex(script, r"(?m)^\s*(mkdir|cp|install)\b[^\n]*/etc/letsencrypt")
        self.assertIn("cp deploy/mediacms.io_fullchain.pem /etc/cinematacms/tls/placeholder-fullchain.pem", script)
        self.assertIn("cp deploy/mediacms.io_privkey.pem /etc/cinematacms/tls/placeholder-privkey.pem", script)
        self.assertEqual(script.count("certbot --nginx"), 1)

    def test_installer_preserves_url_separately_from_certificate_domain(self):
        script = INSTALLER.read_text()

        self.assertIn('FRONTEND_DOMAIN="${FRONTEND_HOST#http://}"', script)
        self.assertIn('export CINEMATACMS_APP_FRONTEND_HOST="$FRONTEND_DOMAIN"', script)
        self.assertIn('--domain "$FRONTEND_DOMAIN"', script)

    def test_installer_loads_runtime_environment_before_django_commands(self):
        # Management commands need the same settings and keys as the services.
        script = INSTALLER.read_text()

        render = script.index("deploy/render-app-env.py --output /etc/cinematacms/app.env")
        load = script.index(". /etc/cinematacms/app.env")
        self.assertLess(render, load)
        self.assertLess(load, script.index("./scripts/build_frontend.sh"))
        self.assertLess(load, script.index("manage.py"))

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


FAKE_NVM_INSTALLER = """\
mkdir -p "$HOME/.nvm"
cat > "$HOME/.nvm/nvm.sh" <<'NVM'
nvm() {
    case "$1" in
        install)
            bin="$NVM_DIR/versions/node/v$2.1.0/bin"
            mkdir -p "$bin"
            for tool in node npm npx; do
                printf '#!/bin/sh\\necho v%s.1.0\\n' "$2" > "$bin/$tool"
                chmod +x "$bin/$tool"
            done ;;
        which) echo "$NVM_DIR/versions/node/v$2.1.0/bin/node" ;;
    esac
}
NVM
"""

FAKE_CURL = """\
#!/bin/sh
while [ "$#" -gt 0 ]; do
    if [ "$1" = "-o" ]; then cp "$FAKE_NVM_INSTALLER" "$2"; fi
    shift
done
"""


class NodeInstallerTests(unittest.TestCase):
    def setUp(self):
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        self.root = Path(temp_dir.name)
        self.home = self.root / "home"
        self.home.mkdir()
        self.link_dir = self.root / "usr-local-bin"
        self.link_dir.mkdir()
        self.fake_bin = self.root / "bin"
        self.fake_bin.mkdir()
        self.write_executable(self.fake_bin / "id", "#!/bin/sh\necho 0\n")
        self.write_executable(self.fake_bin / "apt-get", "#!/bin/sh\nexit 0\n")
        self.write_executable(self.fake_bin / "curl", FAKE_CURL)
        self.nvm_installer = self.root / "nvm-installer.sh"
        self.nvm_installer.write_text(FAKE_NVM_INSTALLER)
        self.new_bin = self.home / ".nvm" / "versions" / "node" / "v26.1.0" / "bin"

    def write_executable(self, path, content):
        path.write_text(content)
        path.chmod(0o755)

    def run_node_installer(self):
        env = os.environ.copy()
        env.update(
            {
                "HOME": str(self.home),
                "PATH": f"{self.fake_bin}:{env['PATH']}",
                "NODE_LINK_DIR": str(self.link_dir),
                "NVM_INSTALL_TMP": str(self.root / "nvm-install.sh"),
                "FAKE_NVM_INSTALLER": str(self.nvm_installer),
            }
        )
        return subprocess.run(
            ["bash", str(NODE_INSTALLER)],
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_rerun_moves_existing_links_to_the_new_release_line(self):
        old_bin = self.root / "old-node" / "bin"
        old_bin.mkdir(parents=True)
        for tool in ("node", "npm", "npx"):
            self.write_executable(old_bin / tool, "#!/bin/sh\necho v22.0.0\n")
            (self.link_dir / tool).symlink_to(old_bin / tool)

        result = self.run_node_installer()

        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        for tool in ("node", "npm", "npx"):
            self.assertEqual((self.link_dir / tool).resolve(), (self.new_bin / tool).resolve())
        self.assertIn("Node.js version: v26.1.0", result.stdout)

    def test_second_run_keeps_the_links_on_the_new_release_line(self):
        first = self.run_node_installer()
        second = self.run_node_installer()

        self.assertEqual(first.returncode, 0, first.stdout + first.stderr)
        self.assertEqual(second.returncode, 0, second.stdout + second.stderr)
        self.assertEqual((self.link_dir / "node").resolve(), (self.new_bin / "node").resolve())


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
        # An existing install whose virtualenv is the home directory itself.
        legacy_python = self.deploy_root / "home/cinemata/bin/python"
        legacy_python.parent.mkdir(parents=True)
        legacy_python.write_text("#!/bin/sh\n")
        legacy_python.chmod(0o755)
        self._write_fake_command("systemctl")
        self._write_fake_command("chgrp")
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
        observability_snippet = (self.deploy_root / "etc/nginx/snippets/cinematacms-metrics.conf").read_text()
        self.assertIn("location = /internal/observability/error-probe", observability_snippet)
        self.assertIn("limit_except POST", observability_snippet)
        self.assertIn("allow 127.0.0.1;", observability_snippet)
        self.assertIn("allow ::1;", observability_snippet)
        self.assertIn("deny all;", observability_snippet)
        self.assertTrue((self.deploy_root / "etc/nginx/conf.d/cinematacms-http.conf").is_file())
        self.assertTrue((self.deploy_root / "etc/nginx/conf.d/cloudflare_real_ip.conf").is_file())
        self.assertTrue((self.deploy_root / "etc/cinematacms/prometheus.yml").is_file())
        self.assertTrue((self.deploy_root / "etc/cinematacms/otelcol-contrib.yml").is_file())
        app_env_path = self.deploy_root / "etc/cinematacms/app.env"
        app_env = app_env_path.read_text()
        self.assertIn("OTEL_ENABLED=true", app_env)
        self.assertIn("FRONTEND_HOST=https://video.example.org", app_env)
        self.assertRegex(app_env, r"TELEMETRY_WORKER_ID=[0-9a-f-]{36}")
        self.assertRegex(app_env, r"TELEMETRY_WORKER_HMAC_KEY=[A-Za-z0-9_-]{40,}")
        self.assertRegex(app_env, r"EMAIL_RECIPIENT_HMAC_KEY=[A-Za-z0-9_-]{40,}")
        self.assertRegex(app_env, r"MEDIA_ACTION_IP_HMAC_KEY=[A-Za-z0-9_-]{40,}")
        self.assertFalse((self.deploy_root / "etc/cinematacms/observability.env").exists())
        for unit in ("mediacms", "celery_long", "celery_short", "celery_whisper", "celery_email", "celery_beat"):
            unit_text = (self.deploy_root / f"etc/systemd/system/{unit}.service").read_text()
            self.assertIn("EnvironmentFile=/etc/cinematacms/app.env", unit_text)
        site = (self.deploy_root / "etc/nginx/sites-available/mediacms.io").read_text()
        self.assertIn("server_name video.example.org;", site)
        # Certbot refuses to create a lineage over an existing live directory.
        self.assertNotIn("/etc/letsencrypt/", site)
        self.assertIn("ssl_certificate  /etc/cinematacms/tls/placeholder-fullchain.pem;", site)
        self.assertIn("ssl_certificate_key  /etc/cinematacms/tls/placeholder-privkey.pem;", site)
        self.assertEqual(site.count("cinematacms-metrics.conf"), 2)
        self.assertEqual(site.count("cinematacms-rate-limits.conf"), 2)
        self.assertTrue((self.deploy_root / "etc/nginx/snippets/cinematacms-rate-limits.conf").is_file())
        logrotate = (self.deploy_root / "etc/logrotate.d/cinematacms-nginx").read_text()
        self.assertIn("/var/log/cinematacms/nginx/*.log", logrotate)
        log_dir = self.deploy_root / "var/log/cinematacms/nginx"
        self.assertEqual(stat.S_IMODE(log_dir.stat().st_mode), 0o750)
        # nginx workers run as www-data and must reopen the logs after rotation.
        self.assertIn(f"chgrp www-data {log_dir}", self.command_log.read_text())
        self.assertIn("ssl_ecdh_curve X25519:P-256:P-384;", site)
        self.assertIn("nginx -t", self.command_log.read_text())
        self.assertNotIn("systemctl enable --now", self.command_log.read_text())

    def test_managed_observability_enables_tracing_without_local_collector(self):
        result = self.run_updater(
            "--domain",
            "video.example.org",
            "--proxy",
            "none",
            "--observability",
            "managed",
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        config = (self.deploy_root / "etc/cinematacms/deployment.env").read_text()
        app_env = (self.deploy_root / "etc/cinematacms/app.env").read_text()
        self.assertIn("CINEMATA_OBSERVABILITY=managed", config)
        self.assertIn("OTEL_ENABLED=true", app_env)
        commands = self.command_log.read_text()
        self.assertNotIn("install-observability", commands)
        self.assertIn(
            "systemctl disable --now cinematacms-prometheus cinematacms-otelcol",
            commands,
        )
        self.assertFalse((self.deploy_root / "etc/cinematacms/prometheus.yml").exists())
        self.assertFalse((self.deploy_root / "etc/cinematacms/otelcol-contrib.yml").exists())

    def install_full_stack_collector_unit(self):
        unit = self.deploy_root / "etc/systemd/system/cinematacms-otelcol.service"
        unit.parent.mkdir(parents=True, exist_ok=True)
        full_stack_unit = (PROJECT_ROOT / "deploy/observability/templates/cinematacms-otelcol.service").read_text()
        unit.write_text(full_stack_unit)
        return unit, full_stack_unit

    def test_managed_observability_keeps_the_full_stack_collector_unit(self):
        unit, full_stack_unit = self.install_full_stack_collector_unit()

        for restart in ([], ["--no-restart"]):
            with self.subTest(restart=restart):
                result = self.run_updater(
                    "--domain", "video.example.org", "--proxy", "none", "--observability", "managed", *restart
                )

                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(unit.read_text(), full_stack_unit)

    def test_managed_observability_leaves_the_full_stack_collector_running(self):
        self.install_full_stack_collector_unit()

        result = self.run_updater("--domain", "video.example.org", "--proxy", "none", "--observability", "managed")

        self.assertEqual(result.returncode, 0, result.stderr)
        commands = self.command_log.read_text().splitlines()
        self.assertIn("systemctl disable --now cinematacms-prometheus", commands)
        self.assertFalse([command for command in commands if "cinematacms-otelcol" in command], commands)

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

    WEB_WORKERS = "CINEMATA_WEB_WORKERS"
    CELERY_POOL_SIZES = {
        "long": "CINEMATA_CELERY_LONG_CONCURRENCY",
        "short": "CINEMATA_CELERY_SHORT_CONCURRENCY",
        "email": "CINEMATA_CELERY_EMAIL_CONCURRENCY",
        "whisper": "CINEMATA_CELERY_WHISPER_CONCURRENCY",
    }

    def celery_worker_arguments(self, pool, overrides, units=PROJECT_ROOT / "deploy"):
        """Run the start command of a Celery unit and return what Celery receives.

        systemd applies the Environment= lines of a unit first and the values of
        its EnvironmentFile= over them. The overrides stand for those values.
        """
        unit = (units / f"celery_{pool}.service").read_text()
        environment = dict(re.findall(r'^Environment=(\w+)="?([^"\n]*)"?$', unit, re.MULTILINE))
        start_command = re.search(r"^ExecStart=/bin/sh -c '(.*)'$", unit, re.MULTILINE).group(1)
        recorder = Path(self.temp_dir.name) / "celery"
        recorder.write_text('#!/bin/sh\nprintf "%s\\n" "$@" > "$0.arguments"\n')
        recorder.chmod(recorder.stat().st_mode | stat.S_IXUSR)
        subprocess.run(
            ["/bin/sh", "-c", start_command],
            env={**environment, **overrides, "CELERY_BIN": str(recorder)},
            check=True,
        )
        return Path(f"{recorder}.arguments").read_text().splitlines()

    def celery_pool_size(self, pool, overrides, **unit_source):
        sizes = [
            argument.removeprefix("--concurrency=")
            for argument in self.celery_worker_arguments(pool, overrides, **unit_source)
            if argument.startswith("--concurrency=")
        ]
        # Celery keeps the last value of an option that is given twice.
        return sizes[-1]

    def web_workers(self, environment):
        """Ask gunicorn for the worker count that deploy/gunicorn.conf.py gives it."""
        return gunicorn_settings(environment)["workers"]

    def render_app_env(self, existing):
        output = Path(self.temp_dir.name) / "app.env"
        output.write_text(existing)
        result = subprocess.run(
            [
                sys.executable,
                str(APP_ENV_RENDERER),
                "--output",
                str(output),
                "--domain",
                "video.example.org",
                "--otel-enabled",
                "false",
            ],
            capture_output=True,
            text=True,
            check=False,
        )
        return result, output.read_text()

    def test_celery_pools_keep_their_sizes_and_options_without_an_override(self):
        released = {
            "long": ("4", ["-Ofair", "--prefetch-multiplier=1"]),
            "short": ("10", ["--soft-time-limit=300"]),
            "email": ("4", ["--prefetch-multiplier=1"]),
            "whisper": ("1", ["-Ofair", "--prefetch-multiplier=1"]),
        }
        for pool, (size, options) in released.items():
            with self.subTest(pool=pool):
                arguments = self.celery_worker_arguments(pool, {})

                self.assertEqual(
                    [argument for argument in arguments if argument.startswith("--concurrency")],
                    [f"--concurrency={size}"],
                )
                self.assertLessEqual(set(options), set(arguments))
                self.assertEqual(arguments[-2:], ["-Q", f"{pool}_tasks"])

    def test_app_env_sets_the_size_of_each_celery_pool(self):
        for pool, key in self.CELERY_POOL_SIZES.items():
            with self.subTest(pool=pool):
                self.assertEqual(self.celery_pool_size(pool, {key: "3"}), "3")

    def test_drop_in_that_sets_celeryd_opts_still_sets_the_pool_size(self):
        drop_in = {"CELERYD_OPTS": "-Ofair --prefetch-multiplier=1 --concurrency=2"}

        self.assertEqual(self.celery_pool_size("long", drop_in), "2")

    def test_web_keeps_eight_workers_without_an_override(self):
        self.assertEqual(self.web_workers({}), "8")

    def test_app_env_sets_the_web_worker_count(self):
        self.assertEqual(self.web_workers({self.WEB_WORKERS: "4"}), "4")

    def test_small_host_process_budget_survives_a_second_apply(self):
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
        budget = {self.WEB_WORKERS: "4", **dict.fromkeys(self.CELERY_POOL_SIZES.values(), "1")}
        budget[self.CELERY_POOL_SIZES["short"]] = "2"
        app_env_path = self.deploy_root / "etc/cinematacms/app.env"
        app_env_path.write_text(app_env_path.read_text() + "".join(f"{key}={value}\n" for key, value in budget.items()))
        web_allocator = "[Service]\nEnvironment=MALLOC_MMAP_THRESHOLD_=131072\n"
        drop_in = self.deploy_root / "etc/systemd/system/mediacms.service.d/allocator.conf"
        drop_in.parent.mkdir()
        drop_in.write_text(web_allocator)

        second = self.run_updater()

        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(drop_in.read_text(), web_allocator)
        app_env = dict(line.split("=", 1) for line in app_env_path.read_text().splitlines())
        self.assertEqual(self.web_workers({self.WEB_WORKERS: app_env[self.WEB_WORKERS]}), "4")
        installed_units = {"units": self.deploy_root / "etc/systemd/system"}
        self.assertEqual(
            {pool: self.celery_pool_size(pool, app_env, **installed_units) for pool in self.CELERY_POOL_SIZES},
            {"long": "1", "short": "2", "email": "1", "whisper": "1"},
        )

    def test_invalid_process_count_stops_the_apply_before_any_restart(self):
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
        app_env_path.write_text(app_env_path.read_text() + f"{self.WEB_WORKERS}=\n")

        second = self.run_updater()

        self.assertNotEqual(second.returncode, 0)
        self.assertIn(self.WEB_WORKERS, second.stderr)
        self.assertNotIn("systemctl restart", self.command_log.read_text())

    def test_renderer_rejects_a_process_count_that_is_not_a_positive_integer(self):
        for value in ("", "0", "-1", "1.5", "four", "4 # web", "4 4", '"4'):
            with self.subTest(value=value):
                existing = f"{self.WEB_WORKERS}={value}\n"

                result, app_env = self.render_app_env(existing)

                self.assertNotEqual(result.returncode, 0)
                self.assertIn(self.WEB_WORKERS, result.stderr)
                self.assertEqual(app_env, existing)

    def test_renderer_checks_every_process_count(self):
        for key in (self.WEB_WORKERS, *self.CELERY_POOL_SIZES.values()):
            with self.subTest(key=key):
                result, _ = self.render_app_env(f"{key}=0\n")

                self.assertNotEqual(result.returncode, 0)
                self.assertIn(key, result.stderr)

    def test_renderer_accepts_a_plain_or_quoted_process_count(self):
        for value in ("1", "12", '"4"', "'4'"):
            with self.subTest(value=value):
                result, app_env = self.render_app_env(f"{self.WEB_WORKERS}={value}\n")

                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn(f"{self.WEB_WORKERS}={value}\n", app_env)

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
        self.assertIn("KillMode=mixed", unit)
        stop_timeout = int(re.search(r"(?m)^TimeoutStopSec=(\d+)s$", unit).group(1))
        # Gunicorn must finish its graceful stop before systemd kills what is left.
        self.assertLess(int(gunicorn_settings({})["graceful_timeout"]), stop_timeout)

    def test_installed_celery_long_unit_sends_sigterm_only_to_celery(self):
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
        unit = (self.deploy_root / "etc/systemd/system/celery_long.service").read_text()
        # A shell left as the main process would take the SIGTERM and die, and
        # systemd would then SIGKILL the encodes before they can retry.
        self.assertRegex(unit, r"(?m)^ExecStart=/bin/sh -c 'exec \$\{CELERY_BIN\} ")
        self.assertIn("\nKillMode=mixed\n", unit)
        self.assertNotIn("ExecStop=", unit)

    def apply_without_restart(self):
        return self.run_updater(
            "--domain", "video.example.org", "--proxy", "none", "--observability", "none", "--no-restart"
        )

    def installed_programs(self):
        """The program each installed unit starts, as a path of the server."""
        programs = {}
        for unit in ("mediacms", "celery_long", "celery_short", "celery_whisper", "celery_email", "celery_beat"):
            text = (self.deploy_root / f"etc/systemd/system/{unit}.service").read_text()
            celery = re.search(r'(?m)^Environment=CELERY_BIN="([^"]+)"$', text)
            programs[unit] = celery[1] if celery else shlex.split(re.search(r"(?m)^ExecStart=(.*)$", text)[1])[0]
        return programs

    def test_apply_links_the_virtualenv_of_an_older_install_for_every_unit(self):
        legacy_bin = self.deploy_root / "home/cinemata/bin"
        for program in ("uwsgi", "celery"):
            (legacy_bin / program).write_text("#!/bin/sh\n")

        result = self.apply_without_restart()

        self.assertEqual(result.returncode, 0, result.stderr)
        link = self.deploy_root / "home/cinemata/venv"
        self.assertEqual(os.readlink(link), str(self.deploy_root / "home/cinemata"))
        for unit, program in self.installed_programs().items():
            with self.subTest(unit=unit):
                self.assertTrue(program.startswith("/home/cinemata/venv/bin/"), program)
                self.assertTrue((self.deploy_root / program.lstrip("/")).is_file(), program)

    def test_apply_keeps_the_virtualenv_that_the_link_names(self):
        venv = self.deploy_root / "home/cinemata/venvs/py3.14"
        (venv / "bin").mkdir(parents=True)
        link = self.deploy_root / "home/cinemata/venv"
        link.symlink_to(venv)

        result = self.apply_without_restart()

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(os.readlink(link), str(venv))

    def test_apply_installs_no_unit_when_no_virtualenv_can_be_linked(self):
        (self.deploy_root / "home/cinemata/bin/python").unlink()

        result = self.apply_without_restart()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("holds no virtualenv", result.stderr)
        self.assertFalse((self.deploy_root / "home/cinemata/venv").exists())
        self.assertFalse((self.deploy_root / "etc/systemd/system/mediacms.service").exists())

    def test_installed_mediacms_unit_overrides_the_virtualenv_of_uwsgi_ini(self):
        """uWSGI starts Python from the virtualenv it is given last.

        A unit from an older release still reads the virtualenv of uwsgi.ini, so the
        ini keeps naming the legacy one and this unit's --virtualenv must win.
        """
        result = self.apply_without_restart()
        self.assertEqual(result.returncode, 0, result.stderr)
        exec_start = shlex.split(
            re.search(r"(?m)^ExecStart=(.*)$", (self.deploy_root / "etc/systemd/system/mediacms.service").read_text())[
                1
            ]
        )
        self.assertEqual(
            exec_start,
            [
                "/home/cinemata/venv/bin/uwsgi",
                "--ini",
                "/home/cinemata/cinematacms/uwsgi.ini",
                "--virtualenv",
                "/home/cinemata/venv",
            ],
        )
        self.assertRegex((PROJECT_ROOT / "uwsgi.ini").read_text(), r"(?m)^virtualenv = /home/cinemata$")

        not_a_python_home = Path(self.temp_dir.name) / "legacy-home"
        not_a_python_home.mkdir()
        portable = Path(self.temp_dir.name) / "uwsgi.ini"
        portable.write_text(f"[uwsgi]\nvirtualenv = {not_a_python_home}\n")
        this_python_home = subprocess.run(
            [sys.executable, "-c", "import sys; print(sys.base_prefix)"], capture_output=True, text=True, check=True
        ).stdout.strip()
        uwsgi = str(Path(sys.executable).parent / "uwsgi")
        arguments = {"/home/cinemata/cinematacms/uwsgi.ini": str(portable), "/home/cinemata/venv": this_python_home}
        as_the_unit = [uwsgi, *(arguments.get(argument, argument) for argument in exec_start[1:]), "--no-server"]
        as_an_older_unit = [uwsgi, "--ini", str(portable), "--no-server"]
        for command, starts in ((as_the_unit, True), (as_an_older_unit, False)):
            with self.subTest(command=command):
                started = subprocess.run(command, cwd=self.temp_dir.name, capture_output=True, text=True, check=False)
                self.assertEqual(started.returncode == 0, starts, started.stderr)

    def test_uwsgi_ini_does_not_run_os_after_fork_hooks(self):
        """With py-call-osafterfork, uWSGI 2.0 workers abort on Python 3.13 and later (unbit/uwsgi#2710)."""
        unit = (PROJECT_ROOT / "deploy/mediacms.service").read_text()
        self.assertNotIn("py-call-osafterfork", unit)
        for path in (PROJECT_ROOT / "uwsgi.ini", PROJECT_ROOT / "deploy/uwsgi.ini"):
            with self.subTest(path=path):
                options = [
                    line.split("=")[0].strip()
                    for line in path.read_text().splitlines()
                    if "=" in line and not line.lstrip().startswith((";", "#"))
                ]
                self.assertNotIn("py-call-osafterfork", options)

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
        self.assertEqual(site.count("cinematacms-rate-limits.conf"), 2)
        self.assertIn("# retained Certbot configuration", site)
        updated_app_env = app_env_path.read_text()
        self.assertIn("EMAIL_HOST=smtp.example.org", updated_app_env)
        for key in (
            "TELEMETRY_WORKER_ID",
            "TELEMETRY_WORKER_HMAC_KEY",
            "EMAIL_RECIPIENT_HMAC_KEY",
            "MEDIA_ACTION_IP_HMAC_KEY",
        ):
            original_value = next(line for line in original_app_env.splitlines() if line.startswith(f"{key}="))
            self.assertIn(original_value, updated_app_env)
        self.assertFalse((self.deploy_root / "etc/nginx/conf.d/cloudflare_real_ip.conf").exists())

    GUNICORN_PASS = (
        "        include /etc/nginx/snippets/cinematacms-proxy.conf;\n"
        "        proxy_read_timeout 900s;\n"
        "        proxy_send_timeout 300s;\n"
        "        proxy_request_buffering on;\n"
        "        proxy_pass http://127.0.0.1:9000;\n"
    )
    # The application locations of earlier releases, before and after they set an upload policy.
    UWSGI_PASSES = {
        "uwsgi without upload policy": (
            "        include /etc/nginx/sites-enabled/uwsgi_params;\n        uwsgi_pass 127.0.0.1:9000;\n"
        ),
        "uwsgi with upload policy": (
            "        include /etc/nginx/sites-enabled/uwsgi_params;\n"
            "        uwsgi_read_timeout 900s;\n"
            "        uwsgi_send_timeout 300s;\n"
            "        uwsgi_request_buffering on;\n"
            "        uwsgi_pass 127.0.0.1:9000;\n"
        ),
    }

    def apply_new_site(self):
        result = self.run_updater(
            "--domain", "video.example.org", "--proxy", "none", "--observability", "none", "--no-restart"
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        return self.deploy_root / "etc/nginx/sites-available/mediacms.io"

    def test_second_apply_moves_a_uwsgi_site_to_gunicorn_and_a_third_changes_nothing(self):
        site_path = self.apply_new_site()
        released_site = site_path.read_text()
        self.assertEqual(released_site.count(self.GUNICORN_PASS), 2)
        uwsgi_params = self.deploy_root / "etc/nginx/sites-enabled/uwsgi_params"

        for name, uwsgi_pass in self.UWSGI_PASSES.items():
            with self.subTest(name):
                site_path.write_text(
                    released_site.replace(self.GUNICORN_PASS, uwsgi_pass).replace(" cinematacms;", ";")
                )
                uwsgi_params.write_text("uwsgi_param  QUERY_STRING  $query_string;\n")

                converted = self.run_updater("--no-restart")

                self.assertEqual(converted.returncode, 0, converted.stderr)
                self.assertEqual(site_path.read_text(), released_site)
                self.assertFalse(uwsgi_params.exists())

                again = self.run_updater("--no-restart")

                self.assertEqual(again.returncode, 0, again.stderr)
                self.assertEqual(site_path.read_text(), released_site)

    def test_apply_stops_at_a_uwsgi_pass_to_another_server_before_it_reloads_anything(self):
        site_path = self.apply_new_site()
        foreign_site = site_path.read_text().replace(
            "    location / {",
            "    location /legacy/ {\n        uwsgi_pass 127.0.0.1:9001;\n    }\n\n    location / {",
            1,
        )
        site_path.write_text(foreign_site)
        self.command_log.write_text("")

        result = self.run_updater("--no-restart")

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("uWSGI server other than 127.0.0.1:9000", result.stderr)
        self.assertEqual(site_path.read_text(), foreign_site)
        self.assertNotIn("systemctl", self.command_log.read_text())

    def test_apply_renders_again_the_full_stack_files_that_reach_the_web_server(self):
        self.apply_new_site()
        full_stack = self.deploy_root / "etc/cinematacms-observability"
        full_stack.mkdir()
        (full_stack / "stack.env").write_text(
            "APP_METRICS_PORT=8123\nAPP_LOG_PATH=/srv/logs/app.json.log\nAPP_SERVICE_LOG_DIR=/srv/logs\n"
        )
        app_metrics = self.deploy_root / "etc/nginx/conf.d/cinematacms-app-metrics.conf"
        app_metrics.write_text(
            "server {\n    listen 127.0.0.1:8123;\n"
            "    location = /metrics {\n        include uwsgi_params;\n        uwsgi_pass 127.0.0.1:9000;\n    }\n}\n"
        )
        rotation = full_stack / "app-logs.logrotate"
        rotation.write_text('/srv/logs/*.log {\n  postrotate\n    touch "/srv/logs/.uwsgi-logreopen"\n  endscript\n}\n')

        result = self.run_updater("--no-restart")

        self.assertEqual(result.returncode, 0, result.stderr)
        listener = app_metrics.read_text()
        self.assertIn("listen 127.0.0.1:8123;", listener)
        self.assertEqual(listener.count("proxy_pass http://127.0.0.1:9000;"), 2)
        self.assertNotIn("uwsgi", listener)
        rendered_rotation = rotation.read_text()
        self.assertIn("/srv/logs/errorlog.txt", rendered_rotation)
        self.assertIn("systemctl show --property=MainPID --value mediacms.service", rendered_rotation)
        self.assertNotIn("uwsgi", rendered_rotation)

    def test_apply_writes_no_full_stack_file_where_that_stack_is_absent(self):
        self.apply_new_site()

        self.assertFalse((self.deploy_root / "etc/nginx/conf.d/cinematacms-app-metrics.conf").exists())
        self.assertFalse((self.deploy_root / "etc/cinematacms-observability").exists())

    def test_second_apply_upgrades_legacy_access_log_and_http_policy(self):
        site_path = self.apply_new_site()
        site_path.write_text(site_path.read_text().replace(" cinematacms;", ";"))

        second = self.run_updater("--no-restart")

        self.assertEqual(second.returncode, 0, second.stderr)
        site = site_path.read_text()
        self.assertEqual(site.count("access_log /var/log/cinematacms/nginx/mediacms.io.access.log cinematacms;"), 2)
        http_policy = (self.deploy_root / "etc/nginx/conf.d/cinematacms-http.conf").read_text()
        self.assertIn("client_body_timeout 300s;", http_policy)
        self.assertIn("log_format cinematacms", http_policy)

    def test_second_apply_replaces_legacy_access_log_format_without_dropping_options(self):
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
        legacy_directive = (
            "access_log /var/log/nginx/mediacms.io.access.log combined buffer=32k gzip flush=5m if=$loggable;"
        )
        legacy_site = site_path.read_text().replace(
            "access_log /var/log/cinematacms/nginx/mediacms.io.access.log cinematacms;",
            legacy_directive,
        )
        self.assertEqual(legacy_site.count(legacy_directive), 2)
        site_path.write_text(legacy_site)

        second = self.run_updater("--no-restart")

        self.assertEqual(second.returncode, 0, second.stderr)
        migrated_directive = (
            "access_log /var/log/cinematacms/nginx/mediacms.io.access.log cinematacms "
            "buffer=32k gzip flush=5m if=$loggable;"
        )
        site = site_path.read_text()
        self.assertEqual(site.count(migrated_directive), 2)
        self.assertNotIn(legacy_directive, site)

    def test_second_apply_moves_legacy_site_logs_under_the_retention_policy(self):
        site_path = self.deploy_root / "etc/nginx/sites-available/mediacms.io"
        site_path.parent.mkdir(parents=True)
        site_path.write_text(
            "server {\n"
            "    access_log /var/log/nginx/mediacms.io.access.log;\n"
            "    error_log  /var/log/nginx/mediacms.io.error.log  warn;\n"
            "    location / { return 200; }\n"
            "}\n"
        )

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
        site = site_path.read_text()
        self.assertIn("access_log /var/log/cinematacms/nginx/mediacms.io.access.log cinematacms;", site)
        self.assertIn("error_log  /var/log/cinematacms/nginx/mediacms.io.error.log  warn;", site)
        self.assertNotIn("/var/log/nginx/mediacms.io.", site)
        self.assertEqual(site.count("include /etc/nginx/snippets/cinematacms-rate-limits.conf;"), 1)
        self.assertLess(site.index("cinematacms-rate-limits.conf"), site.index("location / {"))

    def test_second_apply_updates_legacy_tls_curves(self):
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
        site_path.write_text(
            site_path.read_text().replace(
                "ssl_ecdh_curve X25519:P-256:P-384;",
                "ssl_ecdh_curve secp521r1:secp384r1;",
            )
        )

        second = self.run_updater("--no-restart")

        self.assertEqual(second.returncode, 0, second.stderr)
        site = site_path.read_text()
        self.assertIn("ssl_ecdh_curve X25519:P-256:P-384;", site)
        self.assertNotIn("ssl_ecdh_curve secp521r1:secp384r1;", site)

    def test_apply_adds_tls_curves_to_each_https_server_block(self):
        site_path = self.deploy_root / "etc/nginx/sites-available/mediacms.io"
        site_path.parent.mkdir(parents=True)
        site_path.write_text(
            textwrap.dedent(
                """\
                server {
                    listen 443 ssl;
                    location / { return 200; }
                }
                server {
                    listen 443 ssl;
                    location / { return 200; }
                }
                """
            )
        )

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
        self.assertEqual(
            site_path.read_text().count("ssl_ecdh_curve X25519:P-256:P-384;"),
            2,
        )

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

    def test_legacy_python_settings_are_translated_to_supported_environment_keys(self):
        legacy = Path(self.temp_dir.name) / "local_settings.py"
        output = Path(self.temp_dir.name) / "app.env"
        legacy.write_text(
            "CORS_ALLOW_ALL_ORIGINS = False\n"
            "CORS_ALLOWED_ORIGINS = ['https://video.example.org']\n"
            "CACHES = {'default': {'LOCATION': 'redis://cache.example/4'}}\n"
            "DJANGO_ADMIN_URL = 'private-admin/'\n"
            "MAINTENANCE_MODE = True\n"
            "RECAPTCHA_PRIVATE_KEY = 'private-placeholder'\n"
            "SENTRY_DSN = 'http://public@127.0.0.1:8001/1'\n"
            "SENTRY_ENVIRONMENT = 'staging'\n"
            "SENTRY_RELEASE = 'cinematacms@test'\n"
            "SENTRY_SAMPLE_RATE = 1.0\n"
            "ERROR_TRACKING_DIAGNOSTICS_ENABLED = False\n"
            "ERROR_TRACKING_DIAGNOSTICS_TOKEN = 'diagnostic-placeholder'\n"
            "ERROR_TRACKING_DIAGNOSTICS_RATE_LIMIT = 50\n"
            "ERROR_TRACKING_DIAGNOSTICS_RATE_WINDOW_SECONDS = 3600\n"
            "SECURE_HSTS_SECONDS = 31536000\n"
            "UI_VARIANT_ALLOWED = ['legacy', 'revamp']\n"
            "UI_VARIANT_DEFAULT = 'legacy'\n"
            "UI_VARIANT_REVAMP_PAGES = []\n"
            "UPLOAD_MAX_SIZE = 123456\n"
            "WHISPER_MODEL = 'large-v3'\n"
            "WHISPER_CPP_DIR = '/opt/whisper'\n"
            "WHISPER_CPP_COMMAND = '/opt/whisper/whisper-cli'\n"
            "WHISPER_CPP_MODEL = '/opt/whisper/model.bin'\n"
        )

        env = os.environ.copy()
        for key in (
            "CORS_ALLOW_ALL_ORIGINS",
            "CORS_ALLOWED_ORIGINS",
            "DJANGO_ADMIN_URL",
            "MAINTENANCE_MODE",
            "RECAPTCHA_PRIVATE_KEY",
            "REDIS_LOCATION",
            "SECURE_HSTS_SECONDS",
            "UI_VARIANT_ALLOWED",
            "UPLOAD_MAX_SIZE",
            "WHISPER_CPP_COMMAND",
            "WHISPER_CPP_DIR",
            "WHISPER_CPP_MODEL",
            "WHISPER_MODEL",
            "WHISPER_MODEL_SIZE",
        ):
            env.pop(key, None)

        result = subprocess.run(
            [
                sys.executable,
                str(APP_ENV_RENDERER),
                "--output",
                str(output),
                "--domain",
                "video.example.org",
                "--otel-enabled",
                "false",
                "--legacy-local-settings",
                str(legacy),
            ],
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        migrated = output.read_text()
        self.assertIn("CORS_ALLOW_ALL_ORIGINS=false", migrated)
        self.assertIn("CORS_ALLOWED_ORIGINS=https://video.example.org", migrated)
        self.assertIn("REDIS_LOCATION=redis://cache.example/4", migrated)
        self.assertIn("DJANGO_ADMIN_URL=private-admin/", migrated)
        self.assertIn("MAINTENANCE_MODE=true", migrated)
        self.assertIn("RECAPTCHA_PRIVATE_KEY=private-placeholder", migrated)
        self.assertIn("SENTRY_DSN=http://public@127.0.0.1:8001/1", migrated)
        self.assertIn("SENTRY_ENVIRONMENT=staging", migrated)
        self.assertIn("SENTRY_RELEASE=cinematacms@test", migrated)
        self.assertIn("SENTRY_SAMPLE_RATE=1.0", migrated)
        self.assertIn("ERROR_TRACKING_DIAGNOSTICS_ENABLED=false", migrated)
        self.assertIn("ERROR_TRACKING_DIAGNOSTICS_TOKEN=diagnostic-placeholder", migrated)
        self.assertIn("ERROR_TRACKING_DIAGNOSTICS_RATE_LIMIT=50", migrated)
        self.assertIn("ERROR_TRACKING_DIAGNOSTICS_RATE_WINDOW_SECONDS=3600", migrated)
        self.assertIn("SECURE_HSTS_SECONDS=31536000", migrated)
        self.assertNotIn("UI_VARIANT_ALLOWED=", migrated)
        self.assertNotIn("UI_VARIANT_DEFAULT=", migrated)
        self.assertNotIn("UI_VARIANT_REVAMP_PAGES=", migrated)
        self.assertIn("UPLOAD_MAX_SIZE=123456", migrated)
        self.assertIn("WHISPER_MODEL_SIZE=large-v3", migrated)
        self.assertIn("WHISPER_CPP_DIR=/opt/whisper", migrated)
        self.assertIn("WHISPER_CPP_COMMAND=/opt/whisper/whisper-cli", migrated)
        self.assertIn("WHISPER_CPP_MODEL=/opt/whisper/model.bin", migrated)

    def test_rendered_environment_loads_in_the_installer_shell(self):
        output = Path(self.temp_dir.name) / "app.env"
        render = subprocess.run(
            [
                sys.executable,
                str(APP_ENV_RENDERER),
                "--output",
                str(output),
                "--domain",
                "video.example.org",
                "--otel-enabled",
                "false",
            ],
            capture_output=True,
            text=True,
            check=False,
            # A fresh install has no runtime settings in its environment; the renderer would copy them.
            env={"PATH": os.environ["PATH"], "CINEMATACMS_APP_PORTAL_NAME": "Example Video"},
        )
        self.assertEqual(render.returncode, 0, render.stderr)

        loaded = subprocess.run(
            [
                "bash",
                "-c",
                'set -a; . "$1"; set +a; printf "%s\\n" "$PORTAL_NAME" "$SECRET_KEY" "$EMAIL_RECIPIENT_HMAC_KEY"',
                "load",
                str(output),
            ],
            capture_output=True,
            text=True,
            check=False,
            env={"PATH": os.environ["PATH"]},
        )

        self.assertEqual(loaded.returncode, 0, loaded.stderr)
        portal_name, secret_key, email_key = loaded.stdout.splitlines()
        self.assertEqual(portal_name, "Example Video")
        self.assertGreaterEqual(len(secret_key), 40)
        self.assertGreaterEqual(len(email_key), 40)

    def test_unknown_legacy_setting_stops_migration_without_printing_its_value(self):
        legacy = Path(self.temp_dir.name) / "local_settings.py"
        output = Path(self.temp_dir.name) / "app.env"
        legacy.write_text("CLIENT_ONLY_SETTING = 'do-not-print-this-value'\n")

        result = subprocess.run(
            [
                sys.executable,
                str(APP_ENV_RENDERER),
                "--output",
                str(output),
                "--domain",
                "video.example.org",
                "--otel-enabled",
                "false",
                "--legacy-local-settings",
                str(legacy),
            ],
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("CLIENT_ONLY_SETTING", result.stderr)
        self.assertNotIn("do-not-print-this-value", result.stderr)
        self.assertFalse(output.exists())

    def test_destructured_unknown_legacy_setting_stops_migration(self):
        legacy = Path(self.temp_dir.name) / "local_settings.py"
        output = Path(self.temp_dir.name) / "app.env"
        legacy.write_text("DEBUG, CLIENT_ONLY_SETTING = False, 'private-value'\n")

        result = subprocess.run(
            [
                sys.executable,
                str(APP_ENV_RENDERER),
                "--output",
                str(output),
                "--domain",
                "video.example.org",
                "--otel-enabled",
                "false",
                "--legacy-local-settings",
                str(legacy),
            ],
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("CLIENT_ONLY_SETTING", result.stderr)
        self.assertNotIn("private-value", result.stderr)
        self.assertFalse(output.exists())

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
        self.assertFalse((self.deploy_root / "etc/nginx/conf.d/cinematacms-http.conf").exists())

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


class PythonRuntimeMigrationTests(unittest.TestCase):
    RUNTIME_VENV = "/home/cinemata/venvs/py3.14"
    LEGACY_VENV = "/home/cinemata"
    REQUIREMENTS = "/home/cinemata/cinematacms/requirements.txt"

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        # readlink -f answers with the resolved path, which differs from a temporary path on macOS.
        self.deploy_root = Path(self.temp_dir.name).resolve() / "root"
        self.fake_bin = Path(self.temp_dir.name) / "bin"
        self.command_log = Path(self.temp_dir.name) / "commands.log"
        self.runtime_template = Path(self.temp_dir.name) / "python-3.14-venv"
        self.fake_bin.mkdir()
        self.write_venv(self.deploy_root / self.LEGACY_VENV.lstrip("/"), "3.10.12")
        self.write_venv(self.runtime_template, "3.14.0")
        write_tree(
            self.deploy_root,
            {
                self.REQUIREMENTS.lstrip("/"): "django\n",
                "etc/cinematacms/app.env": "CINEMATA_SERVICE_SETTING=from-app-env\n",
            },
        )
        uv_version = re.search(r"(?m)^UV_VERSION=(\S+)$", MIGRATOR.read_text())[1]
        self.write_command(
            self.deploy_root / "opt/cinematacms/bin/uv",
            textwrap.dedent(
                f"""\
                [ "$1" != --version ] || {{ echo "uv {uv_version}"; exit 0; }}
                log "uv $*"
                if [ "$1" = venv ]; then
                    for venv; do :; done
                    mkdir -p "$venv" && cp -R "$FAKE_RUNTIME_VENV/." "$venv/"
                fi
                """
            ),
        )
        self.write_command(
            self.fake_bin / "runuser",
            'log "runuser $* with $CINEMATA_SERVICE_SETTING in $PWD"\nshift 3\n"$@" || exit\nexit "$FAKE_CHECK_EXIT"',
        )
        self.write_command(self.fake_bin / "chown", 'log "chown $*"')
        self.write_command(
            self.deploy_root / "home/cinemata/cinematacms/deploy/apply-release-config.sh",
            'log "apply-release-config $* while venv -> $(readlink "$FAKE_VENV_LINK")"',
        )

    def write_command(self, path, body):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f'#!/bin/sh\nlog() {{ printf \'%s\\n\' "$*" >> "$FAKE_COMMAND_LOG"; }}\n{body}\n')
        path.chmod(0o755)

    def write_venv(self, venv, version):
        self.write_command(
            venv / "bin/python",
            f'case "$1" in --version) echo "Python {version}" ;; -c) ;; *) log "$0 $*" ;; esac',
        )
        self.write_command(venv / "bin/pip", 'log "$0 $*"')

    def environment(self, check_exit="0"):
        env = os.environ.copy()
        env.update(
            {
                "CINEMATA_DEPLOY_ROOT": str(self.deploy_root),
                "CINEMATA_SKIP_ROOT_CHECK": "1",
                "FAKE_COMMAND_LOG": str(self.command_log),
                "FAKE_RUNTIME_VENV": str(self.runtime_template),
                "FAKE_VENV_LINK": str(self.venv_link),
                "FAKE_CHECK_EXIT": check_exit,
                "PATH": f"{self.fake_bin}:{env['PATH']}",
            }
        )
        return env

    def migrate(self, *arguments, check_exit="0"):
        self.command_log.write_text("")
        result = subprocess.run(
            ["bash", str(MIGRATOR), *arguments],
            env=self.environment(check_exit),
            capture_output=True,
            text=True,
            check=False,
        )
        commands = self.command_log.read_text().replace(str(self.deploy_root), "").splitlines()
        return result, commands

    @property
    def venv_link(self):
        return self.deploy_root / "home/cinemata/venv"

    def link_target(self, link):
        return os.readlink(link).replace(str(self.deploy_root), "")

    def checks_and_restarts_on(self, venv):
        return [
            f"runuser -u www-data -- {venv}/bin/python manage.py check with from-app-env in /home/cinemata/cinematacms",
            f"{venv}/bin/python manage.py check",
            "chown -R www-data: /home/cinemata/venvs",
            "chown -h www-data: /home/cinemata/venv",
            f"apply-release-config  while venv -> {venv}",
        ]

    def test_migration_builds_and_checks_the_new_virtualenv_before_the_services_use_it(self):
        result, commands = self.migrate()

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            commands,
            [
                "uv python install --no-config --no-bin 3.14",
                f"uv venv --no-project --no-config --managed-python --seed --clear --python 3.14 {self.RUNTIME_VENV}",
                f"{self.RUNTIME_VENV}/bin/pip install --disable-pip-version-check -r {self.REQUIREMENTS}",
                *self.checks_and_restarts_on(self.RUNTIME_VENV),
            ],
        )
        self.assertEqual(self.link_target(self.venv_link), self.RUNTIME_VENV)
        self.assertEqual(self.link_target(self.deploy_root / "home/cinemata/venvs/previous"), self.LEGACY_VENV)
        self.assertIn("now runs on Python 3.14.0", result.stdout)

    def test_failed_check_leaves_the_services_on_the_virtualenv_they_use(self):
        result, commands = self.migrate(check_exit="1")

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.link_target(self.venv_link), self.LEGACY_VENV)
        self.assertFalse((self.deploy_root / "home/cinemata/venvs/previous").is_symlink())
        self.assertFalse([command for command in commands if command.startswith(("chown", "apply-release-config"))])

    def test_second_migration_builds_nothing_and_keeps_the_previous_virtualenv(self):
        first, _ = self.migrate()
        self.assertEqual(first.returncode, 0, first.stderr)

        second, commands = self.migrate()

        self.assertEqual(second.returncode, 0, second.stderr)
        self.assertEqual(
            commands,
            [
                "uv python install --no-config --no-bin 3.14",
                f"{self.RUNTIME_VENV}/bin/pip install --disable-pip-version-check -r {self.REQUIREMENTS}",
                *self.checks_and_restarts_on(self.RUNTIME_VENV),
            ],
        )
        self.assertEqual(self.link_target(self.venv_link), self.RUNTIME_VENV)
        self.assertEqual(self.link_target(self.deploy_root / "home/cinemata/venvs/previous"), self.LEGACY_VENV)

    def test_rollback_brings_the_previous_virtualenv_up_to_date_before_it_switches(self):
        migration, _ = self.migrate()
        self.assertEqual(migration.returncode, 0, migration.stderr)

        for attempt in ("first", "second"):
            with self.subTest(attempt=attempt):
                rollback, commands = self.migrate("--rollback")

                self.assertEqual(rollback.returncode, 0, rollback.stderr)
                self.assertEqual(
                    commands,
                    [
                        f"{self.LEGACY_VENV}/bin/pip install --disable-pip-version-check -r {self.REQUIREMENTS}",
                        *self.checks_and_restarts_on(self.LEGACY_VENV),
                    ],
                )
                self.assertEqual(self.link_target(self.venv_link), self.LEGACY_VENV)
                self.assertIn("now runs on Python 3.10.12", rollback.stdout)

    def test_failed_rollback_check_leaves_the_services_on_the_new_virtualenv(self):
        migration, _ = self.migrate()
        self.assertEqual(migration.returncode, 0, migration.stderr)

        rollback, commands = self.migrate("--rollback", check_exit="1")

        self.assertNotEqual(rollback.returncode, 0)
        self.assertEqual(self.link_target(self.venv_link), self.RUNTIME_VENV)
        self.assertFalse([command for command in commands if command.startswith("apply-release-config")])

    def test_rollback_without_a_previous_virtualenv_changes_nothing(self):
        result, commands = self.migrate("--rollback")

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("no earlier virtualenv is known", result.stderr)
        self.assertEqual(commands, [])

    def test_adoption_links_a_missing_link_to_the_legacy_virtualenv_and_nothing_else(self):
        venv = self.deploy_root / self.RUNTIME_VENV.lstrip("/")
        for existing, expected in ((None, self.LEGACY_VENV), (venv, self.RUNTIME_VENV)):
            with self.subTest(existing=existing):
                self.venv_link.unlink(missing_ok=True)
                if existing:
                    self.write_venv(existing, "3.14.0")
                    self.venv_link.symlink_to(existing)

                result, commands = self.migrate("--adopt-legacy-venv")

                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(commands, [])
                self.assertEqual(self.link_target(self.venv_link), expected)

    def test_adoption_refuses_a_link_whose_virtualenv_is_gone(self):
        gone = self.deploy_root / "home/cinemata/venvs/py3.13"
        self.venv_link.symlink_to(gone)

        result, _ = self.migrate("--adopt-legacy-venv")

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("which does not exist", result.stderr)
        self.assertEqual(os.readlink(self.venv_link), str(gone))

    def test_uv_whose_checksum_differs_from_the_pin_is_not_installed(self):
        uv = self.deploy_root / "opt/cinematacms/bin/uv"
        uv.unlink()
        self.write_command(self.fake_bin / "uname", "echo x86_64")
        self.write_command(
            self.fake_bin / "curl",
            'while [ "$1" != --output ]; do shift; done\nprintf "not uv" > "$2"',
        )

        result, commands = self.migrate()

        self.assertNotEqual(result.returncode, 0)
        self.assertIn("does not match the checksum pinned", result.stderr)
        self.assertFalse(uv.exists())
        self.assertEqual(self.link_target(self.venv_link), self.LEGACY_VENV)
        self.assertEqual(commands, [])

    def test_missing_uv_is_not_reported_as_a_failure_by_the_installer(self):
        # install.sh sources this file and reports every command that fails, even in a
        # command substitution. Only the checksum mismatch below is a failure.
        self.deploy_root.joinpath("opt/cinematacms/bin/uv").unlink()
        self.write_command(self.fake_bin / "uname", "echo x86_64")
        self.write_command(
            self.fake_bin / "curl",
            'while [ "$1" != --output ]; do shift; done\nprintf "not uv" > "$2"',
        )
        installer = textwrap.dedent(
            f"""\
            set -Eeuo pipefail
            trap 'echo "installation failed at line $LINENO" >&2; exit 1' ERR
            source "{MIGRATOR}"
            install_uv
            """
        )

        result = subprocess.run(
            ["bash", "-c", installer],
            env=self.environment(),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            check=False,
        )

        before_download, _, _ = result.stdout.partition("Installing uv")
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("does not match the checksum pinned", result.stdout)
        self.assertNotIn("installation failed", before_download)


class FrontendArtifactTests(unittest.TestCase):
    COMMIT = "a" * 40
    OTHER_COMMIT = "b" * 40

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        root = Path(self.temp_dir.name)
        self.build = root / "build"
        self.artifact = root / "artifact"
        self.archive = self.artifact / "frontend-build.tar.gz"
        self.metadata = self.artifact / "frontend-build.json"
        self.target = root / "host" / "build"

    def pack(self):
        return run_frontend_artifact_tool(
            "pack", "--build-dir", self.build, "--commit", self.COMMIT, "--output-dir", self.artifact
        )

    def unpack(self, commit=COMMIT):
        return run_frontend_artifact_tool(
            "unpack", "--artifact-dir", self.artifact, "--commit", commit, "--target", self.target
        )

    def write_artifact(self, members):
        self.artifact.mkdir()
        with tarfile.open(self.archive, "w:gz") as tar:
            for member, content in members:
                if isinstance(member, str):
                    member = tarfile.TarInfo(member)
                    member.size = len(content)
                tar.addfile(member, io.BytesIO(content))
        self.record_archive_checksum()

    def record_archive_checksum(self):
        sha256 = hashlib.sha256(self.archive.read_bytes()).hexdigest()
        self.metadata.write_text(json.dumps({"commit": self.COMMIT, "sha256": sha256}))

    def assert_rejected(self, result, message):
        self.assertEqual(result.returncode, 1, result.stderr)
        self.assertIn(message, result.stderr)
        self.assertFalse(self.target.exists())
        if self.target.parent.exists():
            self.assertEqual(list(self.target.parent.iterdir()), [])

    def test_unpacked_artifact_holds_the_whole_build_with_its_hidden_manifest(self):
        files = write_frontend_build(self.build, "console.log('new')")

        self.assertEqual(self.pack().returncode, 0)
        result = self.unpack()

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(".vite/manifest.json", files)
        self.assertEqual(read_tree(self.target), files)

    def test_artifact_records_its_commit_and_the_checksum_of_its_archive(self):
        write_frontend_build(self.build, "console.log('new')")

        self.assertEqual(self.pack().returncode, 0)

        self.assertEqual(sorted(path.name for path in self.artifact.iterdir()), [self.metadata.name, self.archive.name])
        self.assertEqual(
            json.loads(self.metadata.read_text()),
            {"commit": self.COMMIT, "sha256": hashlib.sha256(self.archive.read_bytes()).hexdigest()},
        )

    def test_pack_rejects_a_build_without_a_manifest(self):
        write_frontend_build(self.build, "console.log('new')")
        (self.build / ".vite/manifest.json").unlink()

        result = self.pack()

        self.assertEqual(result.returncode, 1)
        self.assertIn("the build has no .vite/manifest.json", result.stderr)
        self.assertFalse(self.artifact.exists())

    def test_pack_rejects_a_manifest_that_references_a_missing_file(self):
        write_frontend_build(self.build, "console.log('new')")
        (self.build / "assets/base-3c4d.css").unlink()

        result = self.pack()

        self.assertEqual(result.returncode, 1)
        self.assertIn("assets/base-3c4d.css", result.stderr)
        self.assertFalse(self.artifact.exists())

    def change_manifest_chunk(self, chunk_key, field, value):
        manifest_path = self.build / ".vite/manifest.json"
        manifest = json.loads(manifest_path.read_text())
        manifest[chunk_key][field] = value
        manifest_path.write_text(json.dumps(manifest))

    def test_pack_rejects_a_manifest_that_imports_a_chunk_it_does_not_list(self):
        # django-vite follows `imports` when it renders a page and raises on a key the manifest lacks.
        for chunk_key in ("src/entries/base.js", "_vendor-5e6f.js"):
            for field in ("imports", "dynamicImports"):
                with self.subTest(chunk_key=chunk_key, field=field):
                    write_frontend_build(self.build, "console.log('new')")
                    self.change_manifest_chunk(chunk_key, field, ["_gone.js"])

                    result = self.pack()

                    self.assertEqual(result.returncode, 1)
                    self.assertIn("Error: ", result.stderr)
                    self.assertIn("_gone.js", result.stderr)
                    self.assertFalse(self.artifact.exists())

    def test_pack_rejects_a_reference_list_that_is_not_a_list_of_names(self):
        for field in ("css", "assets", "imports", "dynamicImports"):
            for value in ("assets/base-1a2b.js", [None], None):
                with self.subTest(field=field, value=value):
                    write_frontend_build(self.build, "console.log('new')")
                    self.change_manifest_chunk("src/entries/base.js", field, value)

                    result = self.pack()

                    self.assertEqual(result.returncode, 1)
                    self.assertIn(
                        f"Error: .vite/manifest.json chunk 'src/entries/base.js' has a {field}", result.stderr
                    )
                    self.assertFalse(self.artifact.exists())

    def test_unpack_rejects_an_archive_whose_manifest_imports_a_chunk_it_does_not_list(self):
        manifest = json.dumps({"src/entries/base.js": {"file": "assets/base-1a2b.js", "imports": ["_gone.js"]}})
        self.write_artifact([(".vite/manifest.json", manifest.encode()), ("assets/base-1a2b.js", b"export {}")])

        self.assert_rejected(self.unpack(), "_gone.js")

    def test_unpack_rejects_an_artifact_built_from_another_commit(self):
        write_frontend_build(self.build, "console.log('new')")
        self.assertEqual(self.pack().returncode, 0)

        self.assert_rejected(self.unpack(commit=self.OTHER_COMMIT), f"not from {self.OTHER_COMMIT}")

    def test_unpack_rejects_an_archive_that_differs_from_its_recorded_checksum(self):
        write_frontend_build(self.build, "console.log('new')")
        self.assertEqual(self.pack().returncode, 0)
        with open(self.archive, "ab") as archive:
            archive.write(b"\0")

        self.assert_rejected(self.unpack(), "records another")

    def test_unpack_rejects_an_artifact_with_a_file_missing(self):
        for missing in ("frontend-build.tar.gz", "frontend-build.json"):
            with self.subTest(missing=missing):
                shutil.rmtree(self.artifact, ignore_errors=True)
                write_frontend_build(self.build, "console.log('new')")
                self.assertEqual(self.pack().returncode, 0)
                (self.artifact / missing).unlink()

                self.assert_rejected(self.unpack(), f"cannot open {missing}")

    def test_unpack_rejects_an_archive_delivered_as_a_symlink(self):
        write_frontend_build(self.build, "console.log('new')")
        self.assertEqual(self.pack().returncode, 0)
        elsewhere = self.artifact.parent / "elsewhere.tar.gz"
        self.archive.rename(elsewhere)
        self.archive.symlink_to(elsewhere)

        self.assert_rejected(self.unpack(), "cannot open frontend-build.tar.gz")

    def test_unpack_rejects_an_archive_without_a_manifest(self):
        self.write_artifact([("assets/base-1a2b.js", b"console.log('new')")])

        self.assert_rejected(self.unpack(), "the build has no .vite/manifest.json")

    def test_unpack_rejects_an_archive_whose_manifest_references_a_missing_file(self):
        manifest = json.dumps({"src/entries/base.js": {"file": "assets/base-1a2b.js"}}).encode()
        self.write_artifact([(".vite/manifest.json", manifest)])

        self.assert_rejected(self.unpack(), "assets/base-1a2b.js")

    def test_unpack_rejects_archive_members_that_leave_the_target(self):
        link = tarfile.TarInfo("assets/link.js")
        link.type = tarfile.SYMTYPE
        link.linkname = "/etc/hostname"
        for name, member in (
            ("parent directory", "../escaped.js"),
            ("absolute path", "/tmp/cinemata-escaped.js"),
            ("symlink", link),
        ):
            with self.subTest(name):
                shutil.rmtree(self.artifact, ignore_errors=True)
                self.write_artifact([(member, b"")])

                self.assert_rejected(self.unpack(), "Error: ")
                self.assertFalse((self.target.parent / "escaped.js").exists())

    def test_unpack_replaces_a_target_left_by_an_interrupted_run(self):
        files = write_frontend_build(self.build, "console.log('new')")
        self.assertEqual(self.pack().returncode, 0)
        (self.target / "assets").mkdir(parents=True)
        (self.target / "assets/stale.js").write_text("stale")

        result = self.unpack()

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(read_tree(self.target), files)

    def test_unpacked_files_are_newer_than_files_collected_before_the_deploy(self):
        # collectstatic leaves a collected file alone when it is not older than its source, so a file
        # that kept the build time of an earlier commit would never replace the copy served now.
        members = []
        for name, content in (
            (".vite/manifest.json", json.dumps({"src/entries/base.js": {"file": "lib/video.js"}}).encode()),
            ("lib/video.js", b"video"),
        ):
            member = tarfile.TarInfo(name)
            member.size = len(content)
            member.mtime = 0
            members.append((member, content))
        self.write_artifact(members)
        collected_before_the_deploy = time.time() - 60

        result = self.unpack()

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertGreater((self.target / "lib/video.js").stat().st_mtime, collected_before_the_deploy)


class StaticFilesSettingsTests(unittest.TestCase):
    PRINTS_WHAT_DJANGO_READS_FROM_THE_SETTINGS = (
        "import json; "
        "from django.conf import settings; "
        "print(json.dumps({"
        "'collected': settings.STATIC_ROOT, "
        "'sources': settings.STATICFILES_DIRS, "
        "'manifest': settings.DJANGO_VITE['default']['manifest_path']"
        "}))"
    )

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.test_root = Path(self.temp_dir.name)

    def collect_static_files(self, *, collectstatic, served_build=str(FRONTEND_BUILD)):
        fake_bin = self.test_root / "bin"
        fake_bin.mkdir()
        python = fake_bin / "python"
        python.write_text(f"#!/bin/sh\n{collectstatic}\n")
        python.chmod(0o755)
        temporary_files = self.test_root / "tmp"
        temporary_files.mkdir()
        env = os.environ.copy()
        env.update(
            {
                "PATH": f"{fake_bin}:{env['PATH']}",
                "SECRET_KEY": "placeholder-for-tests",
                "TMPDIR": str(temporary_files),
            }
        )
        result = subprocess.run(
            [
                "bash",
                "-c",
                'source "$1"; FRONTEND_BUILD=$2; collect_static_files /srv/release/build /srv/release/collected',
                "restart-test",
                str(RESTART_SCRIPT),
                served_build,
            ],
            cwd=PROJECT_ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        return result, list(temporary_files.iterdir())

    def django_reads_the_settings(self):
        return f"exec {shlex.quote(sys.executable)} -c {shlex.quote(self.PRINTS_WHAT_DJANGO_READS_FROM_THE_SETTINGS)}"

    def test_collect_run_reads_the_build_and_writes_the_destination_that_it_names(self):
        result, left_behind = self.collect_static_files(collectstatic=self.django_reads_the_settings())

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            json.loads(result.stdout.strip().splitlines()[-1]),
            {
                "collected": "/srv/release/collected",
                "sources": ["/srv/release/build", str(PROJECT_ROOT / "static")],
                "manifest": "/srv/release/build/.vite/manifest.json",
            },
        )
        self.assertEqual(left_behind, [])

    def test_collect_run_stops_when_the_settings_do_not_collect_the_served_build(self):
        # The run would otherwise collect the served build into the release.
        result, left_behind = self.collect_static_files(
            collectstatic=self.django_reads_the_settings(), served_build="frontend/build/elsewhere"
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn(f"does not name {PROJECT_ROOT / 'frontend/build/elsewhere'}", result.stderr)
        self.assertNotIn("/srv/release", result.stdout)
        self.assertEqual(left_behind, [])

    def test_collect_run_reports_a_collectstatic_that_failed(self):
        result, left_behind = self.collect_static_files(collectstatic="exit 7")

        self.assertEqual(result.returncode, 7)
        self.assertEqual(left_behind, [])


class RestartScriptTests(unittest.TestCase):
    # The mediacms unit of the uWSGI releases. Their restart_script.sh restarts it when a
    # deploy to this release stops before apply-release-config.sh installs the gunicorn unit.
    UWSGI_RELEASE_EXEC_START = "/home/cinemata/bin/uwsgi --ini /home/cinemata/cinematacms/uwsgi.ini"

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.test_root = Path(self.temp_dir.name)

    def test_a_deploy_from_a_uwsgi_release_that_stops_early_can_restart_uwsgi(self):
        installed_ini = Path(self.UWSGI_RELEASE_EXEC_START.split(" --ini ")[1])
        ini = PROJECT_ROOT / installed_ini.relative_to("/home/cinemata/cinematacms")
        settings = {
            tuple(part.strip() for part in line.split("=", 1))
            for line in ini.read_text().splitlines()
            if "=" in line and not line.startswith("#")
        }

        self.assertIn(("module", "cms.wsgi"), settings)
        self.assertIn(("socket", "127.0.0.1:9000"), settings)

    def run_restart_functions(self, arguments, *, then=""):
        fake_bin = self.test_root / "bin"
        fake_bin.mkdir(exist_ok=True)
        command_log = self.test_root / "commands.log"
        git = fake_bin / "git"
        git.write_text('#!/bin/sh\nprintf \'%s\\n\' "git $*" >> "$FAKE_COMMAND_LOG"\n')
        git.chmod(git.stat().st_mode | stat.S_IXUSR)
        env = os.environ.copy()
        env.update(
            {
                "FAKE_COMMAND_LOG": str(command_log),
                "PATH": f"{fake_bin}:{env['PATH']}",
            }
        )
        command = 'source "$1"; shift; parse_restart_args "$@"'
        if then:
            command += f"; {then}"
        result = subprocess.run(
            ["bash", "-c", command, "restart-test", str(RESTART_SCRIPT), *arguments],
            cwd=PROJECT_ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        commands = command_log.read_text().splitlines() if command_log.exists() else []
        return result, commands

    def git(self, directory, *arguments):
        return subprocess.run(
            ["git", "-C", str(directory), *arguments],
            env=GIT_ENVIRONMENT,
            capture_output=True,
            text=True,
            check=True,
        ).stdout.strip()

    def host_clone_two_commits_behind_its_origin(self):
        origin = self.test_root / "origin"
        origin.mkdir()
        self.git(origin, "init", "--quiet")
        self.git(origin, "config", "uploadpack.allowAnySHA1InWant", "true")

        def commit(subject):
            self.git(origin, "commit", "--quiet", "--allow-empty", "--message", subject)
            return self.git(origin, "rev-parse", "HEAD")

        first = commit("first")
        host = self.test_root / "host"
        self.git(self.test_root, "clone", "--quiet", str(origin), str(host))
        return host, [first, commit("second"), commit("third")]

    def select_release_on(self, host, revision):
        return subprocess.run(
            [
                "bash",
                "-c",
                'source "$1"; shift; parse_restart_args "$@"; select_release; echo "restart continued"',
                "restart-test",
                str(RESTART_SCRIPT),
                "--revision",
                revision,
            ],
            cwd=host,
            env=GIT_ENVIRONMENT,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_restart_installs_frontend_dependencies_from_lockfile(self):
        fake_bin = self.test_root / "bin"
        fake_bin.mkdir(exist_ok=True)
        command_log = self.test_root / "commands.log"
        npm = fake_bin / "npm"
        npm.write_text('#!/bin/sh\nprintf \'%s\\n\' "npm $*" >> "$FAKE_COMMAND_LOG"\n')
        npm.chmod(npm.stat().st_mode | stat.S_IXUSR)
        env = os.environ.copy()
        env.update(
            {
                "FAKE_COMMAND_LOG": str(command_log),
                "PATH": f"{fake_bin}:{env['PATH']}",
            }
        )

        result = subprocess.run(
            ["bash", "-c", 'source "$1"; install_frontend_dependencies', "restart-test", str(RESTART_SCRIPT)],
            cwd=PROJECT_ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(command_log.read_text().splitlines(), ["npm ci --no-fund --no-audit"])

    def test_restart_installs_and_starts_every_application_unit(self):
        script = RESTART_SCRIPT.read_text()
        units = "mediacms celery_long celery_short celery_whisper celery_email celery_beat"

        self.assertIn("set -e", script)
        self.assertIn("deploy/apply-release-config.sh --no-restart", script)
        configure_position = script.index("deploy/apply-release-config.sh --no-restart")
        load_position = script.index("source /etc/cinematacms/app.env")
        migrate_position = script.index("python manage.py migrate")
        self.assertLess(configure_position, load_position)
        self.assertLess(load_position, migrate_position)
        self.assertIn(f"for unit in {units}; do", script)
        self.assertIn('install -m 0644 "deploy/$unit.service" "/etc/systemd/system/$unit.service"', script)
        self.assertIn(f"systemctl enable {units}", script)
        self.assertIn(f"systemctl restart {units}", script)

    def _reset_app_ownership(self, *, group_exists):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "logs").mkdir()
            fake_bin = root / "bin"
            fake_bin.mkdir()
            command_log = root / "commands.log"
            for name in ("chown", "chgrp", "find"):
                fake = fake_bin / name
                fake.write_text(f'#!/bin/sh\necho "{name} $*" >> "{command_log}"\n')
                fake.chmod(0o755)
            getent = fake_bin / "getent"
            getent.write_text(f"#!/bin/sh\nexit {0 if group_exists else 2}\n")
            getent.chmod(0o755)
            env = os.environ.copy()
            env["PATH"] = f"{fake_bin}:{env['PATH']}"
            subprocess.run(
                ["bash", "-c", 'source "$1"; reset_app_ownership', "restart-test", str(RESTART_SCRIPT)],
                cwd=root,
                env=env,
                check=True,
            )
            return command_log.read_text().splitlines()

    def test_ownership_reset_never_takes_the_collector_group_off_the_logs(self):
        # The Collector rereads a log from its first line after losing read access to it,
        # so handing the logs to www-data's group, even for the length of a recursive chown, duplicates them.
        commands = self._reset_app_ownership(group_exists=True)

        self.assertEqual(len(commands), 2)
        self.assertRegex(
            commands[0], r"^find /home/cinemata/ -path \S+/logs -prune -o -exec chown -h www-data: \{\} \+$"
        )
        self.assertEqual(commands[1], "chown -R www-data:cinematacms-observability logs")

    def test_ownership_reset_without_the_observability_stack(self):
        self.assertEqual(self._reset_app_ownership(group_exists=False), ["chown -R www-data. /home/cinemata/"])

    def test_rollback_never_takes_the_collector_group_off_the_logs(self):
        script = (PROJECT_ROOT / "rollback.sh").read_text()

        self.assertIn(
            'find "$CINEMATA_HOME/" -path "$REPO_DIR/logs" -prune -o -exec chown -h www-data: {} +',
            script,
        )
        self.assertIn('chown -R www-data:cinematacms-observability "$REPO_DIR/logs"', script)
        self.assertNotIn("chgrp -R", script)

    def test_rollback_restarts_every_unit_a_deploy_restarts(self):
        rollback = (PROJECT_ROOT / "rollback.sh").read_text()

        self.assertIn('source "$REPO_DIR/restart_script.sh"', rollback)
        self.assertLess(rollback.index('source "$REPO_DIR/restart_script.sh"'), rollback.index("git checkout"))
        self.assertIn("\nrestart_application_services\n", rollback)
        self.assertNotRegex(rollback, r"(?m)^\s*systemctl restart (?!nginx$)")

    def test_deploy_scripts_link_a_legacy_virtualenv_before_they_activate_the_link(self):
        for script in ("restart_script.sh", "rollback.sh"):
            with self.subTest(script=script):
                text = (PROJECT_ROOT / script).read_text()

                self.assertNotIn("/home/cinemata/bin/", text)
                self.assertLess(
                    text.index("deploy/migrate-python-runtime.sh --adopt-legacy-venv\n"),
                    text.index("/venv/bin/activate"),
                )

    def test_rollback_to_a_commit_without_versioned_virtualenvs_needs_the_legacy_virtualenv(self):
        rollback = (PROJECT_ROOT / "rollback.sh").read_text()
        guard = 'if ! git cat-file -e "${TARGET_SHA}:deploy/migrate-python-runtime.sh" 2>/dev/null &&\n'
        guard += '  [ ! "${CINEMATA_HOME}/venv" -ef "$CINEMATA_HOME" ]; then\n'

        self.assertIn(guard, rollback)
        self.assertIn("migrate-python-runtime.sh --rollback", rollback[rollback.index(guard) :])
        self.assertLess(rollback.index(guard), rollback.index('if [ "$DRY_RUN" -eq 1 ]'))
        self.assertLess(rollback.index(guard), rollback.index("git checkout --detach"))

    def test_required_checks_pass_only_when_every_python_passes(self):
        jobs = yaml.safe_load(CI_WORKFLOW.read_text())["jobs"]

        for required, per_python in (
            ("pre-commit", "pre-commit-per-python"),
            ("backend-tests", "backend-tests-per-python"),
        ):
            with self.subTest(required=required):
                matrix = jobs[per_python]["strategy"]["matrix"]
                pythons = matrix.get("python") or [leg["python"] for leg in matrix["include"]]
                self.assertEqual(pythons, ["3.10", "3.14"])
                self.assertIs(jobs[per_python]["strategy"]["fail-fast"], False)
                self.assertEqual(jobs[per_python]["env"]["UV_PYTHON"], "${{ matrix.python }}")
                self.assertEqual(jobs[required]["needs"], per_python)
                self.assertEqual(jobs[required]["if"], "always()")
                (step,) = jobs[required]["steps"]
                self.assertEqual(step["env"], {"RESULT": f"${{{{ needs.{per_python}.result }}}}"})
                self.assertEqual(step["run"], 'test "$RESULT" = success')
        self.assertEqual(jobs["pre-commit"]["name"], "Pre-commit (lint & format)")
        self.assertEqual(jobs["backend-tests"]["name"], "Backend Tests")
        self.assertIn("backend-tests", jobs["deploy-dev"]["needs"])
        self.assertIn("pre-commit", jobs["deploy-dev"]["needs"])

    def test_backend_coverage_comes_from_one_python(self):
        job = yaml.safe_load(CI_WORKFLOW.read_text())["jobs"]["backend-tests-per-python"]
        (upload,) = (step for step in job["steps"] if step.get("uses", "").startswith("actions/upload-artifact@"))

        self.assertEqual(upload["if"], "matrix.uploads-coverage")
        self.assertEqual(upload["with"]["name"], "backend-coverage-${{ github.sha }}")
        self.assertEqual(
            [leg["python"] for leg in job["strategy"]["matrix"]["include"] if leg["uploads-coverage"]], ["3.10"]
        )

    def run_with_service_restart_armed(self, command):
        fake_bin = self.test_root / "bin"
        fake_bin.mkdir(exist_ok=True)
        command_log = self.test_root / "commands.log"
        systemctl = fake_bin / "systemctl"
        systemctl.write_text('#!/bin/sh\nprintf \'%s\\n\' "systemctl $*" >> "$FAKE_COMMAND_LOG"\n')
        systemctl.chmod(systemctl.stat().st_mode | stat.S_IXUSR)
        env = os.environ.copy()
        env.update({"FAKE_COMMAND_LOG": str(command_log), "PATH": f"{fake_bin}:{env['PATH']}"})
        result = subprocess.run(
            [
                "bash",
                "-c",
                f'source "$1"; trap restart_application_services_after_interrupted_deploy EXIT; {command}',
                "restart-test",
                str(RESTART_SCRIPT),
            ],
            cwd=self.test_root,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        commands = command_log.read_text().splitlines() if command_log.exists() else []
        return result, commands

    def test_deploy_that_stops_after_packages_change_restarts_every_application_unit(self):
        # A process that keeps running mixes the modules it already imported with the new packages on disk.
        units = "mediacms celery_long celery_short celery_whisper celery_email celery_beat"
        expected = ["systemctl daemon-reload", f"systemctl restart {units}"]

        signalled_during_a_step = "sh -c 'kill -{} $PPID; sleep 1'"
        for command, status in (
            ("exit 7", 7),
            ("false", 1),
            (signalled_during_a_step.format("TERM"), -15),
            (signalled_during_a_step.format("HUP"), -1),
        ):
            with self.subTest(command=command):
                (self.test_root / "commands.log").unlink(missing_ok=True)

                result, commands = self.run_with_service_restart_armed(command)

                self.assertEqual(result.returncode, status, result.stderr)
                self.assertEqual(commands, expected)

    def test_signal_to_the_deploy_shell_restarts_services_after_the_installer_finishes(self):
        # A signal can reach the deploy shell alone, for example its own kill, while pip keeps writing packages.
        pip = self.test_root / "bin" / "pip"
        pip.parent.mkdir(exist_ok=True)
        pip.write_text(
            '#!/bin/sh\nkill -"$FAKE_SIGNAL" "$PPID"\nsleep 1\nprintf \'%s\\n\' "pip finished" >> "$FAKE_COMMAND_LOG"\n'
        )
        pip.chmod(pip.stat().st_mode | stat.S_IXUSR)
        units = "mediacms celery_long celery_short celery_whisper celery_email celery_beat"

        for signal_name, status in (("TERM", -15), ("HUP", -1)):
            with self.subTest(signal=signal_name):
                (self.test_root / "commands.log").unlink(missing_ok=True)
                os.environ["FAKE_SIGNAL"] = signal_name
                self.addCleanup(os.environ.pop, "FAKE_SIGNAL", None)

                result, commands = self.run_with_service_restart_armed("install_python_requirements")

                self.assertEqual(result.returncode, status, result.stderr)
                self.assertEqual(commands, ["pip finished", "systemctl daemon-reload", f"systemctl restart {units}"])

    def test_deploy_restarts_services_once_packages_may_have_changed(self):
        script = RESTART_SCRIPT.read_text()
        main = script[script.index("main() {") :]
        arm = "trap restart_application_services_after_interrupted_deploy EXIT\n"

        self.assertLess(main.index("\nselect_release\n"), main.index(arm))
        self.assertLess(main.index(arm), main.index("\ninstall_python_requirements\n"))
        self.assertNotIn("pip install", main)
        self.assertLess(main.index("\nrestart_application_services\n"), main.index("trap - EXIT"))
        self.assertLess(main.index("trap - EXIT"), main.index("systemctl restart nginx"))
        self.assertNotIn("systemctl restart mediacms", main)

    def test_rollback_loads_the_runtime_environment_before_it_changes_anything(self):
        # cms/settings.py reads SECRET_KEY from app.env. Without it collectstatic is unknown to manage.py.
        rollback = (PROJECT_ROOT / "rollback.sh").read_text()
        loads_environment = rollback.index("\nsource /etc/cinematacms/app.env\nset +a\n")

        self.assertLess(loads_environment, rollback.index('\ngit checkout --detach "$TARGET_SHA"\n'))
        self.assertLess(loads_environment, rollback.index('\nroll_back_static_release "$TARGET_SHA"\n'))

    def test_rollback_restarts_services_once_packages_may_have_changed(self):
        rollback = (PROJECT_ROOT / "rollback.sh").read_text()
        arm = "trap restart_application_services_after_interrupted_deploy EXIT\n"

        # A refused checkout changes no package, so it restarts nothing.
        self.assertLess(rollback.index('\ngit checkout --detach "$TARGET_SHA"\n'), rollback.index(arm))
        self.assertLess(rollback.index(arm), rollback.index("\ninstall_python_requirements\n"))
        self.assertNotIn("pip install", rollback)
        self.assertLess(rollback.index("\nrestart_application_services\n"), rollback.index("trap - EXIT"))
        self.assertLess(rollback.index("trap - EXIT"), rollback.index("systemctl restart nginx"))

    def rollback_progress_on(self, host, *, head, served, target, deployed):
        self.git(host, "checkout", "--quiet", "--detach", head)
        release = host / "static_releases" / "release.test"
        release.mkdir(parents=True, exist_ok=True)
        (release / "REVISION").write_text(f"{served}\n")
        current = host / "static_releases" / "current"
        current.unlink(missing_ok=True)
        current.symlink_to("release.test")
        return subprocess.run(
            ["bash", "-c", 'source "$1"; shift; rollback_progress "$@"', "rollback-test", str(RESTART_SCRIPT)]
            + [target, deployed],
            cwd=host,
            env=GIT_ENVIRONMENT,
            capture_output=True,
            text=True,
            check=False,
        )

    def test_rollback_progress_from_the_checkout_and_the_served_frontend(self):
        host, (target, deployed, elsewhere) = self.host_clone_two_commits_behind_its_origin()
        self.git(host, "fetch", "--quiet", "origin", deployed, elsewhere)

        for head, served, progress in (
            (deployed, deployed, "pending"),
            # The checkout moved, then the frontend restore stopped, for example on a failed build.
            (target, deployed, "interrupted"),
            (target, target, "complete"),
            (elsewhere, deployed, "diverged"),
        ):
            with self.subTest(progress=progress):
                result = self.rollback_progress_on(host, head=head, served=served, target=target, deployed=deployed)

                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout.strip(), progress)

    def test_rollback_resumes_an_interrupted_rollback(self):
        rollback = (PROJECT_ROOT / "rollback.sh").read_text()
        decision = rollback[rollback.index('case "$(rollback_progress') :]
        decision = decision[: decision.index("esac")]

        self.assertRegex(decision, r"complete\)[^;]*exit 0")
        self.assertRegex(decision, r"diverged\)[^;]*exit 1")
        self.assertNotRegex(decision, r"interrupted\)[^;]*exit")

    def test_restart_can_deploy_an_exact_revision(self):
        host, (_, second, _) = self.host_clone_two_commits_behind_its_origin()

        result = self.select_release_on(host, second)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("restart continued", result.stdout)
        self.assertEqual(self.git(host, "rev-parse", "HEAD"), second)

    def test_restart_refuses_a_revision_that_the_checkout_already_contains(self):
        # `git merge --ff-only` succeeds here and moves nothing, so the deploy would report the
        # requested commit while the server runs a later one.
        host, (_, second, third) = self.host_clone_two_commits_behind_its_origin()
        self.git(host, "pull", "--quiet", "--ff-only")

        result = self.select_release_on(host, second)

        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("restart continued", result.stdout)
        self.assertIn(second, result.stderr)
        self.assertIn(third, result.stderr)
        self.assertEqual(self.git(host, "rev-parse", "HEAD"), third)

    def test_restart_rejects_invalid_revision(self):
        result, commands = self.run_restart_functions(["--revision", "not-a-commit"])

        self.assertEqual(result.returncode, 2)
        self.assertIn("full 40-character lowercase commit SHA", result.stderr)
        self.assertEqual(commands, [])

    def test_restart_rejects_trailing_arguments_for_each_mode(self):
        revision = "a" * 40

        for arguments in (["--no-pull", "extra"], ["--revision", revision, "extra"]):
            with self.subTest(arguments=arguments):
                result, commands = self.run_restart_functions(arguments)

                self.assertEqual(result.returncode, 2)
                self.assertEqual(commands, [])

    def test_restart_accepts_a_frontend_artifact_only_for_an_exact_revision(self):
        revision = "a" * 40

        result, _ = self.run_restart_functions(
            ["--revision", revision, "--frontend-artifact", "/srv/artifact"],
            then='printf "%s\\n" "$DEPLOY_REVISION" "$FRONTEND_ARTIFACT_DIR"',
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.splitlines(), [revision, "/srv/artifact"])

        for arguments in (
            ["--frontend-artifact", "/srv/artifact"],
            ["--no-pull", "--frontend-artifact", "/srv/artifact"],
            ["--revision", revision, "--frontend-artifact"],
            ["--revision", revision, "--frontend-artifact", "relative/artifact"],
            ["--revision", revision, "--frontend-artifact", "/srv/artifact", "extra"],
        ):
            with self.subTest(arguments=arguments):
                result, commands = self.run_restart_functions(arguments)

                self.assertEqual(result.returncode, 2)
                self.assertEqual(commands, [])

    def test_restart_builds_from_source_when_no_artifact_is_given(self):
        for arguments in ([], ["--no-pull"], ["--revision", "a" * 40]):
            with self.subTest(arguments=arguments):
                result, _ = self.run_restart_functions(arguments, then='printf "[%s]\\n" "$FRONTEND_ARTIFACT_DIR"')

                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout, "[]\n")

    def run_deploy_step(self, *, host_has_option="0", restart_exit="0", transfer_directory=None):
        sha = "c" * 40
        workflow = yaml.safe_load(CI_WORKFLOW.read_text())
        (step,) = (step for step in workflow["jobs"]["deploy-dev"]["steps"] if step["name"] == "Deploy via SSH")
        self.assertEqual(
            step["env"], {"DEPLOY_TARGET": "${{ secrets.DEPLOY_DEV_USER }}@${{ secrets.DEPLOY_DEV_HOST }}"}
        )
        fake_bin = self.test_root / "bin"
        fake_bin.mkdir()
        command_log = self.test_root / "commands.log"
        ssh = fake_bin / "ssh"
        ssh.write_text(
            textwrap.dedent(
                """\
                #!/bin/sh
                shift
                printf '%s\\n' "ssh $*" >> "$FAKE_COMMAND_LOG"
                case "$*" in
                    "grep -q -- \\"--frontend-artifact\\""*) exit "$FAKE_HOST_HAS_OPTION" ;;
                    "mktemp -d "*) echo "$FAKE_TRANSFER_DIRECTORY" ;;
                    *restart_script.sh*) exit "$FAKE_RESTART_EXIT" ;;
                esac
                """
            )
        )
        scp = fake_bin / "scp"
        scp.write_text('#!/bin/sh\nprintf \'%s\\n\' "scp $*" >> "$FAKE_COMMAND_LOG"\n')
        for fake in (ssh, scp):
            fake.chmod(0o755)
        env = os.environ.copy()
        env.update(
            {
                "DEPLOY_SHA": sha,
                "DEPLOY_TARGET": "deployer@dev.example.org",
                "RUNNER_TEMP": "/runner",
                "FAKE_COMMAND_LOG": str(command_log),
                "FAKE_HOST_HAS_OPTION": host_has_option,
                "FAKE_RESTART_EXIT": restart_exit,
                "FAKE_TRANSFER_DIRECTORY": transfer_directory or "/tmp/cinemata-frontend-artifact.Ab12Cd34",
                "PATH": f"{fake_bin}:{env['PATH']}",
            }
        )
        result = subprocess.run(
            ["bash", "--noprofile", "--norc", "-eo", "pipefail", "-c", step["run"].replace("${{ github.sha }}", sha)],
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )
        return result, command_log.read_text().splitlines()

    def test_deployer_sends_the_artifact_and_restarts_with_it(self):
        result, commands = self.run_deploy_step()

        directory = "/tmp/cinemata-frontend-artifact.Ab12Cd34"
        restart = "sudo /home/cinemata/cinematacms/restart_script.sh"
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            commands[1:],
            [
                "ssh mktemp -d /tmp/cinemata-frontend-artifact.XXXXXXXX",
                "scp /runner/frontend-artifact/frontend-build.tar.gz /runner/frontend-artifact/frontend-build.json"
                f" deployer@dev.example.org:{directory}/",
                f"ssh {restart} --revision {'c' * 40} --frontend-artifact {directory}",
                f"ssh rm -rf -- {directory}",
            ],
        )

    def test_deployer_removes_the_transferred_artifact_after_a_failed_restart(self):
        result, commands = self.run_deploy_step(restart_exit="1")

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(commands[-1], "ssh rm -rf -- /tmp/cinemata-frontend-artifact.Ab12Cd34")

    def test_deployer_builds_on_a_host_whose_restart_script_predates_the_artifact(self):
        result, commands = self.run_deploy_step(host_has_option="1")

        after_the_probe = "\n".join(commands[1:])
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn(f"sudo /home/cinemata/cinematacms/restart_script.sh --revision {'c' * 40};", after_the_probe)
        self.assertNotIn("--frontend-artifact", after_the_probe)
        self.assertNotIn("scp ", after_the_probe)

    def test_deployer_does_not_build_on_the_host_after_a_failed_connection(self):
        result, commands = self.run_deploy_step(host_has_option="255")

        self.assertEqual(result.returncode, 255)
        self.assertEqual(len(commands), 1)

    def test_deployer_rejects_an_unexpected_transfer_directory(self):
        result, commands = self.run_deploy_step(transfer_directory="/home/cinemata/cinematacms; reboot")

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(len(commands), 2)

    def test_frontend_artifact_is_published_only_for_a_push_to_main(self):
        steps = yaml.safe_load(CI_WORKFLOW.read_text())["jobs"]["frontend-build"]["steps"]
        names = [step["name"] for step in steps]
        package = steps[names.index("Package frontend build")]
        upload = steps[names.index("Upload frontend build")]

        self.assertLess(names.index("Build frontend"), names.index("Package frontend build"))
        self.assertLess(names.index("Package frontend build"), names.index("Upload frontend build"))
        self.assertNotIn("if", package)
        self.assertIn('--commit "$GITHUB_SHA"', package["run"])
        self.assertEqual(upload["if"], "github.event_name == 'push' && github.ref == 'refs/heads/main'")
        self.assertEqual(upload["with"]["name"], "frontend-build-${{ github.sha }}")
        self.assertEqual(upload["with"]["if-no-files-found"], "error")

    def test_deployer_verifies_the_artifact_of_the_deployed_commit_before_it_connects(self):
        steps = yaml.safe_load(CI_WORKFLOW.read_text())["jobs"]["deploy-dev"]["steps"]
        names = [step["name"] for step in steps]
        download = steps[names.index("Download frontend build")]
        verify = steps[names.index("Verify frontend build")]

        self.assertEqual(download["with"]["name"], "frontend-build-${{ github.sha }}")
        self.assertIn("deploy/frontend-artifact.py unpack", verify["run"])
        self.assertIn('--commit "$DEPLOY_SHA"', verify["run"])
        self.assertLess(names.index("Download frontend build"), names.index("Verify frontend build"))
        self.assertLess(names.index("Verify frontend build"), names.index("Setup SSH"))

    def test_workflow_grants_no_permission_for_the_artifact(self):
        workflow = yaml.safe_load(CI_WORKFLOW.read_text())
        job_permissions = {name: job["permissions"] for name, job in workflow["jobs"].items() if "permissions" in job}
        (checkout,) = (
            step
            for step in workflow["jobs"]["deploy-dev"]["steps"]
            if step.get("uses", "").startswith("actions/checkout@")
        )

        self.assertEqual(workflow["permissions"], {"contents": "read"})
        self.assertEqual(job_permissions, {"deploy-dev": {"contents": "read", "deployments": "write"}})
        self.assertIs(checkout["with"]["persist-credentials"], False)

    def test_deployer_uses_the_authorized_restart_boundary(self):
        workflow = CI_WORKFLOW.read_text()
        restart = "sudo /home/cinemata/cinematacms/restart_script.sh"

        self.assertEqual(workflow.count(restart), 3)
        self.assertIn(f"{restart} --revision ${{{{ github.sha }}}}", workflow)
        self.assertIn(f'{restart} --revision "$DEPLOY_SHA" --frontend-artifact "$artifact_dir"', workflow)
        self.assertNotIn("sudo git", workflow)
        self.assertNotIn("sudo env", workflow)
        self.assertNotIn("local_settings_example.py", workflow)
        self.assertNotIn("Materialize CI local_settings", workflow)


only_linux_swaps_a_directory_for_a_link = unittest.skipUnless(
    sys.platform == "linux", "exchange-paths.py needs renameat2, which only Linux has"
)


class StaticReleaseTests(unittest.TestCase):
    OLD_REVISION = "0" * 40
    NEW_REVISION = "a" * 40
    UNITS = "mediacms celery_long celery_short celery_whisper celery_email celery_beat"
    # Changes nothing on a host whose /home/cinemata/venv exists.
    LINKS_A_LEGACY_VENV = "deploy/migrate-python-runtime.sh --adopt-legacy-venv"
    ACTIVATE = (
        "adopt_served_frontend\nnew_static_release\nunpack_frontend_artifact\n"
        "collect_static_release\nactivate_static_release"
    )
    # rollback.sh never reads the arguments of a deploy, and it stops at an unset variable.
    ROLL_BACK = textwrap.dedent(
        """\
        export DEPLOY_SHELL=$$
        source "$1"; shift
        set -Eeuo pipefail
        trap 'echo "Error at ${BASH_SOURCE[0]}:${LINENO}" >&2; exit 1' ERR
        adopt_served_frontend
        roll_back_static_release "$1"
        echo "rollback continued"
        """
    )
    OLD_COLLECTED = {
        "assets/base-1a2b.js": "console.log('old')",
        "assets/retired-0f0f.js": "export {}",
        "admin/css/base.css": "admin",
    }

    # cms/settings.py names the directories that are served, as the one of every commit does.
    SETTINGS = textwrap.dedent(
        """\
        import os

        BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        STATIC_ROOT = os.path.join(BASE_DIR, "static_collected")
        STATICFILES_DIRS = [
            os.path.join(BASE_DIR, "frontend", "build", "production", "static"),
            os.path.join(BASE_DIR, "static"),
        ]
        DJANGO_VITE = {"default": {"manifest_path": os.path.join(STATICFILES_DIRS[0], ".vite", "manifest.json")}}
        """
    )
    # Django takes the destination and the build from the settings module that the run names.
    COLLECTSTATIC_READS_THE_SETTINGS = (
        "import importlib, os, shlex\n"
        'settings = importlib.import_module(os.environ.get("DJANGO_SETTINGS_MODULE", "cms.settings"))\n'
        'print("STATIC_ROOT=" + shlex.quote(settings.STATIC_ROOT))\n'
        'print("FRONTEND_BUILD_DIR=" + shlex.quote(settings.STATICFILES_DIRS[0]))\n'
    )
    # collectstatic copies the visible files of the build into STATIC_ROOT.
    COLLECTSTATIC_COLLECTS_THE_BUILD = 'cp -R "$FRONTEND_BUILD_DIR/assets" "$FRONTEND_BUILD_DIR/lib" "$STATIC_ROOT/"'
    # Vite writes into build.outDir of vite.config.js unless the command names another directory.
    NPM_RUNS_VITE = textwrap.dedent(
        """\
        [ "$1 $2" = "run build" ] || exit 0
        out_dir=build/production/static
        while [ "$#" -gt 0 ]; do
          [ "$1" != --outDir ] || out_dir=$2
          shift
        done
        """
    )
    VITE_BUILDS_THE_SOURCE = 'mkdir -p "$out_dir" && cp -R "$FAKE_SERVER_HOME/source-build/." "$out_dir/"'
    # collectstatic can collect what this build leaves, so only the exit status stops the deploy.
    VITE_STOPS_HALFWAY = textwrap.dedent(
        """\
        mkdir -p "$out_dir/assets" "$out_dir/lib"
        printf 'console.l' > "$out_dir/assets/base-1a2b.js"
        exit 1
        """
    )
    # The run stops here until the test lets it go on. It then writes to the paths that it got
    # when it started, as text, so each write resolves the links as they are at that moment.
    WAITS_FOR_A_LATER_DEPLOY = textwrap.dedent(
        """\
        touch "$FAKE_SERVER_HOME/writer-waits"
        read -r _ < "$FAKE_SERVER_HOME/resume-writer"
        """
    )
    COLLECTSTATIC_FINISHES_AFTER_A_LATER_DEPLOY = WAITS_FOR_A_LATER_DEPLOY + textwrap.dedent(
        """\
        rm -f "$STATIC_ROOT/lib/Inter/inter.woff2"
        mkdir -p "$STATIC_ROOT/assets"
        printf late > "$STATIC_ROOT/assets/late.js"
        touch "$FAKE_SERVER_HOME/writer-finished"
        """
    )
    VITE_FINISHES_AFTER_A_LATER_DEPLOY = WAITS_FOR_A_LATER_DEPLOY + textwrap.dedent(
        """\
        mkdir -p "$out_dir/.vite" "$out_dir/assets"
        printf '{}' > "$out_dir/.vite/manifest.json"
        printf late > "$out_dir/assets/late.js"
        touch "$FAKE_SERVER_HOME/writer-finished"
        """
    )
    # collectstatic deletes each changed file in STATIC_ROOT and writes it again, so a run that
    # stops halfway, on a full disk for example, leaves a file missing and another cut short.
    COLLECTSTATIC_LEAVES_ITS_DESTINATION_INCOMPLETE = textwrap.dedent(
        """\
        rm -f "$STATIC_ROOT/assets/retired-0f0f.js"
        printf 'console.l' > "$STATIC_ROOT/assets/base-1a2b.js"
        """
    )
    COLLECTSTATIC_STOPS_HALFWAY = COLLECTSTATIC_LEAVES_ITS_DESTINATION_INCOMPLETE + "exit 1"
    COLLECTSTATIC_WRITES_AFTER_THE_DEPLOY_GOT_A_SIGNAL = (
        COLLECTSTATIC_LEAVES_ITS_DESTINATION_INCOMPLETE
        + textwrap.dedent(
            """\
        kill -{signal} "$DEPLOY_SHELL"
        sleep 1
        printf late > "$STATIC_ROOT/assets/late.js"
        """
        )
    )
    COLLECTSTATIC_WRITES_WHILE_THE_NEXT_DEPLOY_RUNS = textwrap.dedent(
        """\
        (
          sleep 2
          mkdir -p "$STATIC_ROOT/assets"
          printf late > "$STATIC_ROOT/assets/late.js"
          touch "$FAKE_SERVER_HOME/late-write-done"
        ) > /dev/null 2>&1 &
        kill -KILL "$DEPLOY_SHELL"
        """
    )
    KILLS_THE_DEPLOY_AFTER_THE_CHOSEN_STEP = textwrap.dedent(
        """\
        echo step >> "$FAKE_STEP_LOG"
        [ "$(grep -c step "$FAKE_STEP_LOG")" != "$KILL_DEPLOY_AFTER_STEP" ] || kill -KILL "$DEPLOY_SHELL"
        """
    )
    # main() names these paths of a real server. Every other step is a command that PATH resolves.
    RUN_MAIN_OFF_THE_SERVER = textwrap.dedent(
        """\
        export DEPLOY_SHELL=$$
        source "$1"; shift
        cd() { if [ "$1" = /home/cinemata ]; then builtin cd "$FAKE_SERVER_HOME"; else builtin cd "$@"; fi; }
        source() { case "$1" in /home/cinemata/venv/bin/activate | /etc/cinematacms/app.env) ;; *) builtin source "$@" ;; esac; }
        mkdir() { [ "$*" = "-p /var/log/cinemata" ] || command mkdir "$@"; }
        main "$@"
        """
    )

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.test_root = Path(self.temp_dir.name)

    def write_stand_in(self, path, name, body):
        # A run that still waits keeps reading the file that it started from.
        replacement = path.with_name(f"{path.name}.replacement")
        replacement.write_text(f'#!/bin/sh\nprintf \'%s\\n\' "{name} $*" >> "$FAKE_COMMAND_LOG"\n{body}\n')
        replacement.chmod(0o755)
        replacement.replace(path)

    def collectstatic_becomes(self, body):
        read_the_settings = (
            f"settings=$({shlex.quote(sys.executable)} -c {shlex.quote(self.COLLECTSTATIC_READS_THE_SETTINGS)})"
        )
        self.write_stand_in(
            self.test_root / "bin" / "python",
            "python",
            f'[ "$2" = collectstatic ] || exit 0\n{read_the_settings} || exit 64\neval "$settings"\n{body}',
        )

    def vite_becomes(self, body):
        self.write_stand_in(self.test_root / "bin" / "npm", "npm", self.NPM_RUNS_VITE + body)

    def host_checkout(self, **other_commands):
        checkout = self.test_root / "cinematacms"
        (checkout / "deploy").mkdir(parents=True)
        for tool in (FRONTEND_ARTIFACT_TOOL, PATH_EXCHANGE_TOOL):
            shutil.copy(tool, checkout / "deploy")
        (checkout / "frontend").mkdir()
        write_tree(checkout / "cms", {"__init__.py": "", "settings.py": self.SETTINGS})
        (self.test_root / "tmp").mkdir()
        os.mkfifo(self.test_root / "resume-writer")
        self.addCleanup(self.let_a_writer_that_still_waits_go_on, self.test_root / "resume-writer")
        self.source_build = write_frontend_build(self.test_root / "source-build", "console.log('source')")
        fake_bin = self.test_root / "bin"
        fake_bin.mkdir()
        commands = {
            "git": '[ "$*" != "rev-parse HEAD" ] || echo "$FAKE_HEAD"',
            "id": "echo 0",
            **dict.fromkeys(("make", "pip", "chown", "sync", "install", "systemctl"), "exit 0"),
            **other_commands,
        }
        for name, body in commands.items():
            self.write_stand_in(fake_bin / name, name, body)
        self.collectstatic_becomes(self.COLLECTSTATIC_COLLECTS_THE_BUILD)
        self.vite_becomes(self.VITE_BUILDS_THE_SOURCE)
        for script in ("deploy/apply-release-config.sh", "deploy/migrate-python-runtime.sh"):
            self.write_stand_in(checkout / script, script, "exit 0")
        return checkout

    def host_whose_deploy_can_be_killed_after_each_step(self):
        real_commands = ("mkdir", "rm", "mv", "mktemp", "chmod", "ln", "readlink", "cp", "cat", "python3")
        steps = {
            name: f'{shutil.which(name)} "$@" || exit\n{self.KILLS_THE_DEPLOY_AFTER_THE_CHOSEN_STEP}'
            for name in real_commands
        }
        stand_ins = dict.fromkeys(("chown", "sync"), self.KILLS_THE_DEPLOY_AFTER_THE_CHOSEN_STEP)
        checkout = self.host_checkout(**steps, **stand_ins)
        self.collectstatic_becomes(
            f"{self.COLLECTSTATIC_COLLECTS_THE_BUILD}\n{self.KILLS_THE_DEPLOY_AFTER_THE_CHOSEN_STEP}"
        )
        return checkout

    def serve_from_directories(self, checkout):
        old_build = write_frontend_build(checkout / FRONTEND_BUILD, "console.log('old')")
        write_tree(checkout / COLLECTED_STATIC, self.OLD_COLLECTED)
        return self.OLD_COLLECTED, old_build

    def serve_from_a_release(self, checkout):
        release = checkout / STATIC_RELEASES / "release.old"
        old_build = write_frontend_build(release / "build", "console.log('old')")
        write_tree(release / "collected", self.OLD_COLLECTED)
        (release / "REVISION").write_text(f"{self.OLD_REVISION}\n")
        (checkout / STATIC_RELEASES / "current").symlink_to("release.old")
        (checkout / COLLECTED_STATIC).symlink_to(STATIC_RELEASES / "current/collected")
        (checkout / FRONTEND_BUILD).parent.mkdir(parents=True)
        (checkout / FRONTEND_BUILD).symlink_to(Path("../../..") / STATIC_RELEASES / "current/build")
        return self.OLD_COLLECTED, old_build

    def served(self, checkout):
        return read_tree(checkout / COLLECTED_STATIC), read_tree(checkout / FRONTEND_BUILD)

    def served_after_a_deploy_of(self, build, *, over=OLD_COLLECTED):
        collected = {name: content for name, content in build.items() if not name.startswith(".vite/")}
        return over | collected, build

    def linked_release(self, checkout, link):
        return os.readlink(checkout / STATIC_RELEASES / link)

    def assert_host_keeps_only_the_releases_it_links_to(self, checkout):
        releases = sorted(path.name for path in (checkout / STATIC_RELEASES).glob("release.*"))
        links = sorted(path.name for path in (checkout / STATIC_RELEASES).iterdir() if path.is_symlink())
        self.assertEqual(releases, sorted({self.linked_release(checkout, link) for link in links}))
        self.assertEqual(list(checkout.rglob("*.new")), [])
        self.assertTrue((checkout / COLLECTED_STATIC).is_symlink())
        self.assertTrue((checkout / FRONTEND_BUILD).is_symlink())

    def environment(self, **changes):
        env = os.environ.copy()
        for inherited in ("CINEMATA_PREV_SHA", "DJANGO_SETTINGS_MODULE", "PYTHONPATH"):
            env.pop(inherited, None)
        env.update(
            {
                "FAKE_COMMAND_LOG": str(self.test_root / "commands.log"),
                "FAKE_SERVER_HOME": str(self.test_root),
                "FAKE_STEP_LOG": os.devnull,
                "KILL_DEPLOY_AFTER_STEP": "never",
                "PATH": f"{self.test_root / 'bin'}:{env['PATH']}",
                "TMPDIR": str(self.test_root / "tmp"),
                **changes,
            }
        )
        return env

    def bash(self, command, arguments):
        return ["bash", "-c", command, "restart-test", str(RESTART_SCRIPT), *arguments]

    def run_bash(self, command, arguments, *, cwd, **environment):
        command_log = self.test_root / "commands.log"
        command_log.unlink(missing_ok=True)
        result = subprocess.run(
            self.bash(command, arguments),
            cwd=cwd,
            env=self.environment(**environment),
            capture_output=True,
            text=True,
            check=False,
        )
        commands = command_log.read_text().splitlines() if command_log.exists() else []
        return result, [command.rstrip() for command in commands]

    def start_bash(self, command, arguments, *, cwd, **environment):
        # A writer that outlives the run would keep a pipe open, so the output goes to a file.
        with (self.test_root / "interrupted-run.log").open("w") as output:
            return subprocess.Popen(
                self.bash(command, arguments),
                cwd=cwd,
                env=self.environment(**environment),
                stdout=output,
                stderr=subprocess.STDOUT,
            )

    def run_restart_functions(self, checkout, steps, *arguments, **environment):
        command = (
            f'export DEPLOY_SHELL=$$\nsource "$1"; shift; parse_restart_args "$@"\n{steps}\necho "restart continued"'
        )
        return self.run_bash(command, arguments, cwd=checkout, **environment)

    def run_restart_main(self, *arguments, checked_out=NEW_REVISION):
        result, commands = self.run_bash(
            self.RUN_MAIN_OFF_THE_SERVER, arguments, cwd=self.test_root, FAKE_HEAD=checked_out
        )
        git_commands = [command for command in commands if command.startswith("git ")]
        steps = [command for command in commands if not command.startswith(("git ", "id "))]
        return result, steps, git_commands

    def start_restart_main(self, *arguments):
        return self.start_bash(self.RUN_MAIN_OFF_THE_SERVER, arguments, cwd=self.test_root, FAKE_HEAD="b" * 40)

    def roll_back(self, checkout, revision, **environment):
        return self.run_bash(self.ROLL_BACK, [revision], cwd=checkout, **environment)

    def start_rollback(self, checkout, revision):
        return self.start_bash(self.ROLL_BACK, [revision], cwd=checkout)

    def wait_for(self, path):
        deadline = time.monotonic() + 30
        while not path.exists():
            if time.monotonic() > deadline:
                self.fail(f"{path.name} never appeared:\n{(self.test_root / 'interrupted-run.log').read_text()}")
            time.sleep(0.01)

    def let_a_writer_that_still_waits_go_on(self, gate):
        # Opening the gate fails while no writer reads from it.
        try:
            opened = os.open(gate, os.O_WRONLY | os.O_NONBLOCK)
        except OSError as no_writer_reads:
            if no_writer_reads.errno != errno.ENXIO:
                raise
            return False
        with os.fdopen(opened, "w") as resume:
            resume.write("go on\n")
        return True

    def let_the_waiting_writer_finish(self):
        deadline = time.monotonic() + 30
        while not self.let_a_writer_that_still_waits_go_on(self.test_root / "resume-writer"):
            if time.monotonic() > deadline:
                self.fail("No writer waited.")
            time.sleep(0.01)
        self.wait_for(self.test_root / "writer-finished")

    def kill_the_run_while_its_writer_waits(self, run):
        self.wait_for(self.test_root / "writer-waits")
        run.kill()
        run.wait()

    def release(self, checkout, link):
        release = checkout / STATIC_RELEASES / link
        return read_tree(release / "collected"), read_tree(release / "build")

    def pack_frontend(self, script="console.log('new')", *, built_from=NEW_REVISION):
        build = self.test_root / "ci-build"
        artifact = self.test_root / "artifact"
        for earlier in (build, artifact):
            shutil.rmtree(earlier, ignore_errors=True)
        files = write_frontend_build(build, script)
        pack_frontend_artifact(build, built_from, artifact)
        return artifact, files

    def deploy_artifact(self, checkout, script="console.log('new')", *, revision=NEW_REVISION, **environment):
        artifact, build = self.pack_frontend(script, built_from=revision)
        result, commands = self.run_restart_functions(
            checkout, self.ACTIVATE, "--revision", revision, "--frontend-artifact", str(artifact), **environment
        )
        return result, commands, build

    def test_prebuilt_frontend_is_served_from_a_new_release_without_npm(self):
        checkout = self.host_checkout()
        old_frontend = self.serve_from_a_release(checkout)

        result, commands, new_build = self.deploy_artifact(checkout)

        releases = checkout / STATIC_RELEASES
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("restart continued", result.stdout)
        self.assertEqual(self.served(checkout), self.served_after_a_deploy_of(new_build))
        self.assertEqual((releases / "current/REVISION").read_text().strip(), self.NEW_REVISION)
        self.assertEqual(
            commands,
            [
                "python manage.py collectstatic --noinput",
                f"chown -R www-data: {STATIC_RELEASES / self.linked_release(checkout, 'current')}",
                "sync",
            ],
        )
        self.assertEqual(self.linked_release(checkout, "previous"), "release.old")
        self.assertEqual(
            (read_tree(releases / "release.old/collected"), read_tree(releases / "release.old/build")), old_frontend
        )
        self.assert_host_keeps_only_the_releases_it_links_to(checkout)

    def test_new_release_keeps_the_bundles_that_open_pages_still_request(self):
        checkout = self.host_checkout()
        self.serve_from_a_release(checkout)
        # collectstatic skips a source that is older than its collected copy, so a copy with a new
        # time would hide a file that the checkout changed a moment before the deploy copied it.
        collected_an_hour_ago = int(time.time()) - 3600
        admin_styles = checkout / STATIC_RELEASES / "release.old/collected/admin/css/base.css"
        os.utime(admin_styles, (collected_an_hour_ago, collected_an_hour_ago))

        result, _, new_build = self.deploy_artifact(checkout)

        served = checkout / COLLECTED_STATIC
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("assets/retired-0f0f.js", new_build)
        self.assertEqual((served / "assets/retired-0f0f.js").read_text(), "export {}")
        self.assertEqual(int((served / "admin/css/base.css").stat().st_mtime), collected_an_hour_ago)

    def test_release_belongs_to_the_web_server_and_is_on_disk_before_it_is_served(self):
        records_the_served_release = 'echo "serving $(readlink static_releases/current)" >> "$FAKE_COMMAND_LOG"'
        checkout = self.host_checkout(chown=records_the_served_release, sync=records_the_served_release)
        self.serve_from_a_release(checkout)

        result, commands, _ = self.deploy_artifact(checkout)

        new_release = checkout / STATIC_RELEASES / self.linked_release(checkout, "current")
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotEqual(new_release.name, "release.old")
        self.assertEqual(
            commands[1:],
            [
                f"chown -R www-data: {STATIC_RELEASES / new_release.name}",
                "serving release.old",
                "sync",
                "serving release.old",
            ],
        )
        self.assertEqual(stat.S_IMODE(new_release.stat().st_mode), 0o755)

    def test_copy_of_the_served_directories_is_on_disk_before_they_become_links(self):
        checkout = self.host_checkout(
            sync='[ -L static_collected ] || echo "static_collected is a directory" >> "$FAKE_COMMAND_LOG"'
        )
        self.serve_from_directories(checkout)

        _, commands, _ = self.deploy_artifact(checkout)

        copied = next(index for index, command in enumerate(commands) if command.startswith("chown "))
        self.assertEqual(commands[copied + 1 : copied + 3], ["sync", "static_collected is a directory"])

    def test_web_server_can_enter_the_releases_whatever_the_umask_of_the_deploy(self):
        checkout = self.host_checkout()
        artifact, _ = self.pack_frontend()

        result, _ = self.run_restart_functions(
            checkout,
            f"umask 077\n{self.ACTIVATE}",
            "--revision",
            self.NEW_REVISION,
            "--frontend-artifact",
            str(artifact),
        )

        releases = checkout / STATIC_RELEASES
        self.assertEqual(result.returncode, 0, result.stderr)
        for entered in (releases, releases / "current", releases / "previous"):
            self.assertEqual(stat.S_IMODE(entered.stat().st_mode), 0o755, entered)

    def test_rejected_artifact_leaves_the_served_frontend_unchanged(self):
        checkout = self.host_checkout()
        old_frontend = self.serve_from_a_release(checkout)
        artifact, _ = self.pack_frontend(built_from="b" * 40)

        result, commands = self.run_restart_functions(
            checkout, self.ACTIVATE, "--revision", self.NEW_REVISION, "--frontend-artifact", str(artifact)
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("restart continued", result.stdout)
        self.assertIn(f"not from {self.NEW_REVISION}", result.stderr)
        self.assertEqual(commands, [])
        self.assertEqual(self.served(checkout), old_frontend)
        self.assertEqual(self.linked_release(checkout, "current"), "release.old")

    def test_failed_collectstatic_leaves_the_served_frontend_unchanged(self):
        checkout = self.host_checkout()
        old_frontend = self.serve_from_a_release(checkout)
        self.collectstatic_becomes(self.COLLECTSTATIC_STOPS_HALFWAY)

        result, _, _ = self.deploy_artifact(checkout)

        self.assertNotEqual(result.returncode, 0)
        self.assertNotIn("restart continued", result.stdout)
        self.assertEqual(self.served(checkout), old_frontend)
        self.assertEqual(self.linked_release(checkout, "current"), "release.old")

    def test_deploy_deletes_the_release_that_a_stopped_deploy_left_unfinished(self):
        checkout = self.host_checkout()
        self.serve_from_a_release(checkout)
        self.collectstatic_becomes(self.COLLECTSTATIC_STOPS_HALFWAY)
        self.deploy_artifact(checkout)
        self.assertEqual(len(list((checkout / STATIC_RELEASES).glob("release.*"))), 2)
        self.collectstatic_becomes(self.COLLECTSTATIC_COLLECTS_THE_BUILD)

        result, _, new_build = self.deploy_artifact(checkout)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.served(checkout), self.served_after_a_deploy_of(new_build))
        self.assert_host_keeps_only_the_releases_it_links_to(checkout)

    def test_host_keeps_the_served_release_and_the_one_before_it(self):
        checkout = self.host_checkout()
        self.serve_from_a_release(checkout)

        for script in ("console.log('second')", "console.log('third')"):
            result, _, _ = self.deploy_artifact(checkout, script)
            self.assertEqual(result.returncode, 0, result.stderr)

        releases = checkout / STATIC_RELEASES
        self.assertEqual((releases / "current/build/assets/base-1a2b.js").read_text(), "console.log('third')")
        self.assertEqual((releases / "previous/build/assets/base-1a2b.js").read_text(), "console.log('second')")
        self.assertFalse((releases / "release.old").exists())
        self.assert_host_keeps_only_the_releases_it_links_to(checkout)

    def assert_run_killed_at_any_step_serves_one_whole_frontend(self, prepare, run):
        every_host = self.test_root
        for step in range(1, 100):
            with self.subTest(killed_after_step=step):
                self.test_root = every_host / f"killed-after-step-{step}"
                self.test_root.mkdir()
                checkout = self.host_whose_deploy_can_be_killed_after_each_step()
                frontend_before, frontend_after = prepare(checkout)

                killed, _ = run(
                    checkout, FAKE_STEP_LOG=str(self.test_root / "steps.log"), KILL_DEPLOY_AFTER_STEP=str(step)
                )
                if killed.returncode == 0:
                    break
                self.assertEqual(killed.returncode, -signal.SIGKILL, killed.stderr)
                self.assertIn(self.served(checkout), [frontend_before, frontend_after])

                retried, _ = run(checkout)

                self.assertEqual(retried.returncode, 0, retried.stderr)
                self.assertEqual(self.served(checkout), frontend_after)
                self.assert_host_keeps_only_the_releases_it_links_to(checkout)
        else:
            self.fail("The run was still killed after 99 steps.")
        self.assertGreater(step, 10, "Too few steps killed the run.")

    def assert_deploy_killed_at_any_step_serves_one_whole_frontend(self, serve):
        def serve_the_old_frontend(checkout):
            old_frontend = serve(checkout)
            _, new_build = self.pack_frontend()
            return old_frontend, self.served_after_a_deploy_of(new_build)

        self.assert_run_killed_at_any_step_serves_one_whole_frontend(
            serve_the_old_frontend, lambda checkout, **kill: self.deploy_artifact(checkout, **kill)[:2]
        )

    def test_deploy_killed_at_any_step_serves_the_old_frontend_or_the_new_one(self):
        self.assert_deploy_killed_at_any_step_serves_one_whole_frontend(self.serve_from_a_release)

    def test_rollback_killed_at_any_step_serves_the_reverted_frontend_or_the_restored_one(self):
        def serve_the_frontend_that_the_rollback_reverts(checkout):
            old_collected, old_build = self.serve_from_a_release(checkout)
            deployed, _, _ = self.deploy_artifact(checkout)
            self.assertEqual(deployed.returncode, 0, deployed.stderr)
            reverted_collected, reverted_build = self.served(checkout)
            return (reverted_collected, reverted_build), (reverted_collected | old_collected, old_build)

        self.assert_run_killed_at_any_step_serves_one_whole_frontend(
            serve_the_frontend_that_the_rollback_reverts,
            lambda checkout, **kill: self.roll_back(checkout, self.OLD_REVISION, **kill),
        )

    def test_collectstatic_that_outlives_a_killed_deploy_cannot_change_the_served_frontend(self):
        checkout = self.host_checkout()
        old_frontend = self.serve_from_a_release(checkout)
        self.collectstatic_becomes(self.COLLECTSTATIC_WRITES_AFTER_THE_DEPLOY_GOT_A_SIGNAL.format(signal="KILL"))

        killed, _, _ = self.deploy_artifact(checkout)

        self.assertEqual(killed.returncode, -signal.SIGKILL, killed.stderr)
        self.assertEqual(len(list((checkout / STATIC_RELEASES).glob("release.*/collected/assets/late.js"))), 1)
        self.assertEqual(self.served(checkout), old_frontend)

    def test_deploy_of_the_same_commit_does_not_serve_what_a_killed_deploy_collected(self):
        checkout = self.host_checkout()
        self.serve_from_a_release(checkout)
        self.collectstatic_becomes(self.COLLECTSTATIC_WRITES_WHILE_THE_NEXT_DEPLOY_RUNS)
        killed, _, _ = self.deploy_artifact(checkout)
        self.collectstatic_becomes(self.COLLECTSTATIC_COLLECTS_THE_BUILD)

        retried, _, new_build = self.deploy_artifact(checkout)
        late_write_done = self.test_root / "late-write-done"
        for _ in range(100):
            if late_write_done.exists():
                break
            time.sleep(0.1)

        self.assertEqual(killed.returncode, -signal.SIGKILL, killed.stderr)
        self.assertEqual(retried.returncode, 0, retried.stderr)
        self.assertTrue(late_write_done.exists())
        self.assertEqual(self.served(checkout), self.served_after_a_deploy_of(new_build))

    def assert_writer_that_outlives_its_run_cannot_change_a_later_release(self, checkout, start_run):
        old_frontend = self.release(checkout, "current")
        run = start_run()
        self.kill_the_run_while_its_writer_waits(run)
        self.collectstatic_becomes(self.COLLECTSTATIC_COLLECTS_THE_BUILD)
        self.vite_becomes(self.VITE_BUILDS_THE_SOURCE)

        deployed, _, new_build = self.deploy_artifact(checkout)
        self.let_the_waiting_writer_finish()

        new_frontend = self.served_after_a_deploy_of(new_build)
        self.assertEqual(deployed.returncode, 0, deployed.stderr)
        self.assertEqual(self.served(checkout), new_frontend)
        self.assertEqual((checkout / STATIC_RELEASES / "current/REVISION").read_text().strip(), self.NEW_REVISION)
        self.assertEqual(self.release(checkout, "previous"), old_frontend)

        # The writer made its directory again after the deploy deleted it.
        deployed_again, _, newer_build = self.deploy_artifact(checkout, "console.log('newer')", revision="d" * 40)

        self.assertEqual(deployed_again.returncode, 0, deployed_again.stderr)
        self.assertEqual(self.served(checkout), self.served_after_a_deploy_of(newer_build, over=new_frontend[0]))
        self.assertEqual(self.release(checkout, "previous"), new_frontend)
        self.assert_host_keeps_only_the_releases_it_links_to(checkout)

    def test_collectstatic_that_outlives_a_source_deploy_cannot_change_a_later_release(self):
        checkout = self.host_checkout()
        self.serve_from_a_release(checkout)
        self.collectstatic_becomes(self.COLLECTSTATIC_FINISHES_AFTER_A_LATER_DEPLOY)

        self.assert_writer_that_outlives_its_run_cannot_change_a_later_release(
            checkout, lambda: self.start_restart_main("--no-pull")
        )

    def test_vite_that_outlives_a_source_deploy_cannot_change_a_later_release(self):
        checkout = self.host_checkout()
        self.serve_from_a_release(checkout)
        self.vite_becomes(self.VITE_FINISHES_AFTER_A_LATER_DEPLOY)

        self.assert_writer_that_outlives_its_run_cannot_change_a_later_release(
            checkout, lambda: self.start_restart_main("--no-pull")
        )

    def test_collectstatic_that_outlives_a_rollback_cannot_change_a_later_release(self):
        checkout = self.host_checkout()
        self.serve_from_a_release(checkout)
        self.collectstatic_becomes(self.COLLECTSTATIC_FINISHES_AFTER_A_LATER_DEPLOY)

        self.assert_writer_that_outlives_its_run_cannot_change_a_later_release(
            checkout, lambda: self.start_rollback(checkout, "c" * 40)
        )

    def test_restart_with_a_prebuilt_frontend_keeps_every_other_step(self):
        before_the_frontend = [
            self.LINKS_A_LEGACY_VENV,
            "pip install -r requirements.txt",
            "deploy/apply-release-config.sh --no-restart",
        ]
        after_the_frontend = [
            "python manage.py migrate",
            "python manage.py backfill_media_storage_usage",
            "chown -R www-data. /home/cinemata/",
            *(
                f"install -m 0644 deploy/{unit}.service /etc/systemd/system/{unit}.service"
                for unit in self.UNITS.split()
            ),
            "systemctl daemon-reload",
            f"systemctl enable {self.UNITS}",
            f"systemctl restart {self.UNITS}",
            "systemctl restart nginx",
        ]
        checkout = self.host_checkout()
        self.serve_from_a_release(checkout)
        artifact, new_build = self.pack_frontend()

        source_build, source_build_steps, _ = self.run_restart_main("--revision", self.NEW_REVISION)
        source_release = STATIC_RELEASES / self.linked_release(checkout, "current")
        prebuilt, prebuilt_steps, _ = self.run_restart_main(
            "--revision", self.NEW_REVISION, "--frontend-artifact", str(artifact)
        )

        self.assertEqual(source_build.returncode, 0, source_build.stderr)
        self.assertEqual(
            source_build_steps,
            [
                *before_the_frontend,
                "npm ci --no-fund --no-audit",
                f"npm run build -- --outDir {checkout / source_release / 'build'} --emptyOutDir",
                "python manage.py collectstatic --noinput",
                f"chown -R www-data: {source_release}",
                "sync",
                *after_the_frontend,
            ],
        )
        self.assertEqual(prebuilt.returncode, 0, prebuilt.stderr)
        self.assertEqual(
            prebuilt_steps,
            [
                *before_the_frontend,
                "python manage.py collectstatic --noinput",
                f"chown -R www-data: {STATIC_RELEASES / self.linked_release(checkout, 'current')}",
                "sync",
                *after_the_frontend,
            ],
        )
        self.assertEqual(self.served(checkout), self.served_after_a_deploy_of(new_build))

    def test_restart_changes_nothing_when_the_checkout_does_not_reach_the_revision(self):
        checkout = self.host_checkout()
        old_frontend = self.serve_from_a_release(checkout)
        artifact, _ = self.pack_frontend()

        result, steps, _ = self.run_restart_main(
            "--revision", self.NEW_REVISION, "--frontend-artifact", str(artifact), checked_out="b" * 40
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(steps, [self.LINKS_A_LEGACY_VENV])
        self.assertEqual(self.served(checkout), old_frontend)

    def test_restart_checks_the_artifact_before_it_moves_the_checkout(self):
        checkout = self.host_checkout()
        old_frontend = self.serve_from_a_release(checkout)
        artifact, _ = self.pack_frontend(built_from="b" * 40)

        result, steps, git_commands = self.run_restart_main(
            "--revision", self.NEW_REVISION, "--frontend-artifact", str(artifact)
        )

        self.assertNotEqual(result.returncode, 0)
        self.assertIn(f"not from {self.NEW_REVISION}", result.stderr)
        self.assertEqual(git_commands, [])
        self.assertEqual(steps, [self.LINKS_A_LEGACY_VENV])
        self.assertEqual(self.served(checkout), old_frontend)

    def test_deploy_signalled_during_collectstatic_restarts_the_services_on_the_old_frontend(self):
        records_the_frontend_at_the_restart = textwrap.dedent(
            """\
            if [ "$1" = restart ]; then
              cp -RL static_collected "$FAKE_SERVER_HOME/collected-at-restart"
              cp -RL frontend/build/production/static "$FAKE_SERVER_HOME/build-at-restart"
            fi
            """
        )
        every_host = self.test_root
        for name in ("TERM", "HUP"):
            with self.subTest(signal=name):
                self.test_root = every_host / name
                self.test_root.mkdir()
                checkout = self.host_checkout(systemctl=records_the_frontend_at_the_restart)
                old_frontend = self.serve_from_a_release(checkout)
                self.collectstatic_becomes(self.COLLECTSTATIC_WRITES_AFTER_THE_DEPLOY_GOT_A_SIGNAL.format(signal=name))
                artifact, _ = self.pack_frontend()

                result, steps, _ = self.run_restart_main(
                    "--revision", self.NEW_REVISION, "--frontend-artifact", str(artifact)
                )

                self.assertEqual(result.returncode, -getattr(signal, f"SIG{name}"), result.stderr)
                self.assertEqual(steps[-2:], ["systemctl daemon-reload", f"systemctl restart {self.UNITS}"])
                self.assertEqual(
                    (
                        read_tree(self.test_root / "collected-at-restart"),
                        read_tree(self.test_root / "build-at-restart"),
                    ),
                    old_frontend,
                )
                self.assertEqual(self.served(checkout), old_frontend)

    def test_first_prebuilt_frontend_on_a_new_host_is_served_from_a_release(self):
        checkout = self.host_checkout()

        result, _, new_build = self.deploy_artifact(checkout)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.served(checkout), self.served_after_a_deploy_of(new_build, over={}))
        self.assert_host_keeps_only_the_releases_it_links_to(checkout)

    @only_linux_swaps_a_directory_for_a_link
    def test_first_prebuilt_frontend_moves_the_served_directories_into_releases(self):
        checkout = self.host_checkout()
        old_frontend = self.serve_from_directories(checkout)

        result, _, new_build = self.deploy_artifact(checkout)

        releases = checkout / STATIC_RELEASES
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.served(checkout), self.served_after_a_deploy_of(new_build))
        self.assertEqual(
            (read_tree(releases / "previous/collected"), read_tree(releases / "previous/build")), old_frontend
        )
        self.assertFalse((releases / "previous/REVISION").exists())
        self.assertEqual(stat.S_IMODE((releases / "previous").stat().st_mode), 0o755)
        self.assert_host_keeps_only_the_releases_it_links_to(checkout)

    @only_linux_swaps_a_directory_for_a_link
    def test_first_prebuilt_frontend_killed_at_any_step_serves_the_old_frontend_or_the_new_one(self):
        self.assert_deploy_killed_at_any_step_serves_one_whole_frontend(self.serve_from_directories)

    @only_linux_swaps_a_directory_for_a_link
    def test_failed_first_prebuilt_frontend_keeps_serving_what_the_directories_held(self):
        checkout = self.host_checkout()
        old_frontend = self.serve_from_directories(checkout)
        self.collectstatic_becomes(self.COLLECTSTATIC_STOPS_HALFWAY)

        result, _, _ = self.deploy_artifact(checkout)

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.served(checkout), old_frontend)

    def test_host_that_cannot_swap_its_directories_is_left_as_it_was(self):
        cannot_swap = f'[ "$1" != deploy/exchange-paths.py ] || exit 1\nexec {shutil.which("python3")} "$@"'
        for frontend in ("source", "prebuilt"):
            with self.subTest(frontend=frontend):
                self.test_root = Path(self.temp_dir.name) / frontend
                self.test_root.mkdir()
                checkout = self.host_checkout(python3=cannot_swap)
                old_frontend = self.serve_from_directories(checkout)
                artifact, _ = self.pack_frontend()
                prebuilt = ["--frontend-artifact", str(artifact)] if frontend == "prebuilt" else []

                result, steps, git_commands = self.run_restart_main("--revision", self.NEW_REVISION, *prebuilt)

                self.assertNotEqual(result.returncode, 0)
                self.assertIn(f"Error: {COLLECTED_STATIC} is still a directory.", result.stderr)
                self.assertIn("deploy/README.md", result.stderr)
                self.assertEqual(git_commands, [])
                self.assertEqual([step for step in steps if step.startswith(("pip ", "npm ", "systemctl "))], [])
                self.assertEqual(self.served(checkout), old_frontend)
                self.assertFalse((checkout / COLLECTED_STATIC).is_symlink())
                self.assertFalse((checkout / FRONTEND_BUILD).is_symlink())

    @only_linux_swaps_a_directory_for_a_link
    def test_deploy_keeps_serving_a_directory_that_replaced_a_link(self):
        # `make frontend-clean` deletes the link, and the build after it writes a directory in its place.
        checkout = self.host_checkout()
        _, old_build = self.serve_from_a_release(checkout)
        built_by_hand = {"assets/base-9f9f.js": "console.log('by hand')"}
        (checkout / COLLECTED_STATIC).unlink()
        write_tree(checkout / COLLECTED_STATIC, built_by_hand)
        self.collectstatic_becomes(self.COLLECTSTATIC_STOPS_HALFWAY)

        result, _, _ = self.deploy_artifact(checkout)

        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.served(checkout), (built_by_hand, old_build))
        self.assertTrue((checkout / COLLECTED_STATIC).is_symlink())

    @only_linux_swaps_a_directory_for_a_link
    def test_path_exchange_swaps_a_directory_and_a_link(self):
        (self.test_root / "release").mkdir()
        (self.test_root / "served").mkdir()
        (self.test_root / "served.new").symlink_to("release")

        result = subprocess.run(
            [sys.executable, str(PATH_EXCHANGE_TOOL), "served.new", "served"],
            cwd=self.test_root,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(os.readlink(self.test_root / "served"), "release")
        self.assertFalse((self.test_root / "served.new").is_symlink())
        self.assertTrue((self.test_root / "served.new").is_dir())

    def test_path_exchange_reports_a_path_it_cannot_swap(self):
        (self.test_root / "served").mkdir()

        result = subprocess.run(
            [sys.executable, str(PATH_EXCHANGE_TOOL), "served.new", "served"],
            cwd=self.test_root,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 1)
        self.assertIn("Error: ", result.stderr)
        self.assertTrue((self.test_root / "served").is_dir())

    def test_source_build_is_served_from_a_new_release(self):
        checkout = self.host_checkout()
        old_frontend = self.serve_from_a_release(checkout)

        result, steps, _ = self.run_restart_main("--revision", self.NEW_REVISION)

        releases = checkout / STATIC_RELEASES
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn("make quick-build", steps)
        self.assertEqual(self.served(checkout), self.served_after_a_deploy_of(self.source_build))
        self.assertEqual(self.linked_release(checkout, "previous"), "release.old")
        self.assertEqual(self.release(checkout, "previous"), old_frontend)
        self.assertEqual((releases / "previous/REVISION").read_text().strip(), self.OLD_REVISION)
        # Only a checked artifact proves which commit a build came from.
        self.assertFalse((releases / "current/REVISION").exists())
        self.assert_host_keeps_only_the_releases_it_links_to(checkout)

    @only_linux_swaps_a_directory_for_a_link
    def test_source_build_moves_the_served_directories_into_releases(self):
        checkout = self.host_checkout()
        old_frontend = self.serve_from_directories(checkout)

        result, _, _ = self.run_restart_main("--revision", self.NEW_REVISION)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.served(checkout), self.served_after_a_deploy_of(self.source_build))
        self.assertEqual(self.release(checkout, "previous"), old_frontend)
        self.assert_host_keeps_only_the_releases_it_links_to(checkout)

    def test_source_build_that_stops_halfway_is_never_served(self):
        for stops_halfway in ("vite", "collectstatic"):
            with self.subTest(stops_halfway=stops_halfway):
                self.test_root = Path(self.temp_dir.name) / stops_halfway
                self.test_root.mkdir()
                checkout = self.host_checkout()
                old_frontend = self.serve_from_a_release(checkout)
                if stops_halfway == "vite":
                    self.vite_becomes(self.VITE_STOPS_HALFWAY)
                else:
                    self.collectstatic_becomes(self.COLLECTSTATIC_STOPS_HALFWAY)

                result, steps, _ = self.run_restart_main("--revision", self.NEW_REVISION)

                self.assertNotEqual(result.returncode, 0)
                self.assertNotIn("python manage.py migrate", steps)
                self.assertEqual(self.served(checkout), old_frontend)
                self.assertEqual(self.linked_release(checkout, "current"), "release.old")

    def host_after_a_deploy(self):
        checkout = self.host_checkout()
        old_frontend = self.serve_from_a_release(checkout)
        deployed, _, _ = self.deploy_artifact(checkout)
        self.assertEqual(deployed.returncode, 0, deployed.stderr)
        return checkout, old_frontend, self.served(checkout), self.linked_release(checkout, "current")

    def test_rollback_serves_the_build_of_the_release_before_the_deploy_without_a_build(self):
        checkout, (_, old_build), _, reverted_release = self.host_after_a_deploy()

        result, commands = self.roll_back(checkout, self.OLD_REVISION)

        releases = checkout / STATIC_RELEASES
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("rollback continued", result.stdout)
        self.assertEqual(read_tree(checkout / FRONTEND_BUILD), old_build)
        self.assertEqual((releases / "current/REVISION").read_text().strip(), self.OLD_REVISION)
        self.assertEqual(self.linked_release(checkout, "previous"), reverted_release)
        self.assertEqual(
            commands, [f"chown -R www-data: {STATIC_RELEASES / self.linked_release(checkout, 'current')}", "sync"]
        )
        self.assert_host_keeps_only_the_releases_it_links_to(checkout)

    def test_rollback_keeps_the_bundles_that_the_running_services_still_render(self):
        # A service renders the bundle names of the manifest that it read until it restarts.
        checkout, (old_collected, _), (reverted_collected, _), _ = self.host_after_a_deploy()
        only_in_the_reverted_release = "assets/player-7a8b.js"
        in_both_releases = "assets/base-1a2b.js"
        self.assertNotIn(only_in_the_reverted_release, old_collected)
        self.assertNotEqual(reverted_collected[in_both_releases], old_collected[in_both_releases])

        self.roll_back(checkout, self.OLD_REVISION)

        served_collected = read_tree(checkout / COLLECTED_STATIC)
        self.assertEqual(served_collected, reverted_collected | old_collected)
        self.assertIn(only_in_the_reverted_release, served_collected)
        self.assertEqual(served_collected[in_both_releases], old_collected[in_both_releases])

    def test_rollback_of_a_rollback_serves_the_reverted_release_again(self):
        checkout, _, (reverted_collected, reverted_build), _ = self.host_after_a_deploy()
        self.roll_back(checkout, self.OLD_REVISION)
        rolled_back_collected, _ = self.served(checkout)

        result, _ = self.roll_back(checkout, self.NEW_REVISION)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.served(checkout), (rolled_back_collected | reverted_collected, reverted_build))
        self.assertEqual((checkout / STATIC_RELEASES / "current/REVISION").read_text().strip(), self.NEW_REVISION)
        self.assert_host_keeps_only_the_releases_it_links_to(checkout)

    def test_rollback_to_the_served_commit_changes_no_link(self):
        checkout, _, served, served_release = self.host_after_a_deploy()

        result, commands = self.roll_back(checkout, self.NEW_REVISION)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(commands, [])
        self.assertEqual(self.served(checkout), served)
        self.assertEqual(self.linked_release(checkout, "current"), served_release)
        self.assertEqual(self.linked_release(checkout, "previous"), "release.old")

    def test_rollback_of_a_deploy_that_never_served_its_frontend_keeps_the_served_release(self):
        checkout = self.host_checkout()
        old_frontend = self.serve_from_a_release(checkout)
        self.collectstatic_becomes(self.COLLECTSTATIC_STOPS_HALFWAY)
        self.deploy_artifact(checkout)

        result, _ = self.roll_back(checkout, self.OLD_REVISION)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.served(checkout), old_frontend)
        self.assertEqual(self.linked_release(checkout, "current"), "release.old")
        self.assert_host_keeps_only_the_releases_it_links_to(checkout)

    def test_rollback_builds_from_source_without_a_release_of_its_target(self):
        checkout, _, reverted_frontend, reverted_release = self.host_after_a_deploy()

        result, commands = self.roll_back(checkout, "c" * 40)

        releases = checkout / STATIC_RELEASES
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(
            self.served(checkout), self.served_after_a_deploy_of(self.source_build, over=reverted_frontend[0])
        )
        self.assertEqual(self.linked_release(checkout, "previous"), reverted_release)
        self.assertEqual(self.release(checkout, "previous"), reverted_frontend)
        self.assertFalse((releases / "current/REVISION").exists())
        self.assertRegex(commands[0], r"^npm run build -- --outDir \S+/build --emptyOutDir$")
        self.assertEqual(commands[1], "python manage.py collectstatic --noinput")
        self.assert_host_keeps_only_the_releases_it_links_to(checkout)

    @only_linux_swaps_a_directory_for_a_link
    def test_rollback_on_a_host_that_serves_from_directories_builds_into_a_release(self):
        checkout = self.host_checkout()
        old_frontend = self.serve_from_directories(checkout)

        result, _ = self.roll_back(checkout, "c" * 40)

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.served(checkout), self.served_after_a_deploy_of(self.source_build))
        self.assertEqual(self.release(checkout, "previous"), old_frontend)
        self.assert_host_keeps_only_the_releases_it_links_to(checkout)

    def test_rollback_that_stops_halfway_serves_the_frontend_that_it_found(self):
        cannot_copy_every_file = textwrap.dedent(
            f"""\
            if [ "$2" = static_releases/previous/collected/. ]; then
              printf 'console.l' > "$3/assets/base-1a2b.js"
              exit 1
            fi
            exec {shutil.which("cp")} "$@"
            """
        )
        for stops_halfway, revision in (("cp", self.OLD_REVISION), ("vite", "c" * 40), ("collectstatic", "c" * 40)):
            with self.subTest(stops_halfway=stops_halfway):
                self.test_root = Path(self.temp_dir.name) / stops_halfway
                self.test_root.mkdir()
                checkout, _, reverted_frontend, reverted_release = self.host_after_a_deploy()
                if stops_halfway == "cp":
                    self.write_stand_in(self.test_root / "bin" / "cp", "cp", cannot_copy_every_file)
                elif stops_halfway == "vite":
                    self.vite_becomes(self.VITE_STOPS_HALFWAY)
                else:
                    self.collectstatic_becomes(self.COLLECTSTATIC_STOPS_HALFWAY)

                result, _ = self.roll_back(checkout, revision)

                self.assertEqual(result.returncode, 1, result.stderr)
                self.assertNotIn("rollback continued", result.stdout)
                self.assertEqual(self.served(checkout), reverted_frontend)
                self.assertEqual(self.linked_release(checkout, "current"), reverted_release)
                self.assertEqual(self.linked_release(checkout, "previous"), "release.old")

    def test_rollback_restores_the_frontend_between_the_packages_and_the_restart(self):
        rollback = (PROJECT_ROOT / "rollback.sh").read_text()
        # A plain statement: `set -e` does not stop a failed step of a function that an `if` tests.
        restore = '\nroll_back_static_release "$TARGET_SHA"\n'

        self.assertLess(rollback.index("\nadopt_served_frontend\n"), rollback.index("\ngit checkout "))
        self.assertLess(rollback.index("\ninstall_python_requirements\n"), rollback.index(restore))
        self.assertLess(rollback.index(restore), rollback.index("\nrestart_application_services\n"))
        self.assertNotIn("make quick-build", rollback)

    def test_restart_links_the_directory_that_django_collects_into_and_nginx_serves(self):
        result, _ = self.run_restart_functions(self.test_root, 'printf "%s\\n" "$COLLECTED_STATIC" "$FRONTEND_BUILD"')
        collected_static, frontend_build = result.stdout.splitlines()[:2]
        settings = (PROJECT_ROOT / "cms" / "settings.py").read_text()

        self.assertEqual((collected_static, frontend_build), (str(COLLECTED_STATIC), str(FRONTEND_BUILD)))
        self.assertIn(f'os.path.join(BASE_DIR, "{collected_static}")', settings)
        self.assertIn('BASE_DIR, "' + '", "'.join(Path(frontend_build).parts) + '"', settings)
        self.assertIn(
            f"alias /home/cinemata/cinematacms/{collected_static}/;",
            (PROJECT_ROOT / "deploy" / "mediacms.io").read_text(),
        )


class LocalGrafanaInstallerTests(unittest.TestCase):
    def test_installer_help_documents_the_public_url(self):
        result = subprocess.run(
            ["bash", str(LOCAL_GRAFANA_INSTALLER), "--help"],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn("--public-url URL", result.stdout)
        self.assertIn("127.0.0.1:3000", result.stdout)

        installer = LOCAL_GRAFANA_INSTALLER.read_text()
        self.assertIn("admin reset-admin-password --password-from-stdin", installer)
        self.assertIn("EnvironmentFile=-${bootstrap_env}", installer)
        self.assertNotIn("GF_SECURITY_ADMIN_PASSWORD__FILE", installer)

    def test_dashboard_queries_use_documented_metrics(self):
        dashboard = json.loads((PROJECT_ROOT / "deploy/grafana/overview.json").read_text())
        coverage = json.loads((PROJECT_ROOT / "config/observability/coverage.json").read_text())
        queries = "\n".join(target["expr"] for panel in dashboard["panels"] for target in panel["targets"])

        for metric in (
            "cinematacms_http_requests_total",
            "cinematacms_http_request_duration_seconds",
            "cinematacms_celery_queue_depth",
            "cinematacms_celery_beat_freshness_timestamp_seconds",
        ):
            self.assertIn(metric, coverage["metric_schemas"])
            self.assertIn(metric, queries)

    def test_nginx_example_keeps_loopback_metrics_outside_https_redirect(self):
        nginx_config = (PROJECT_ROOT / "deploy/grafana/nginx.conf.example").read_text()

        self.assertIn(
            "listen 127.0.0.1:8081;",
            nginx_config,
        )
        self.assertIn(
            "include /etc/nginx/snippets/cinematacms-metrics.conf;",
            nginx_config,
        )
        self.assertIn("ssl_ecdh_curve X25519:P-256:P-384;", nginx_config)


if __name__ == "__main__":
    unittest.main()
