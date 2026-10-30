import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[3]
OBSERVABILITY = ROOT / "deploy" / "observability"


class FullStackContractTests(unittest.TestCase):
    def test_application_contract_is_the_metric_source_of_truth(self):
        alertability = json.loads((ROOT / "config/observability/alertability.json").read_text())
        coverage = json.loads((ROOT / "config/observability/coverage.json").read_text())
        metric_schemas = coverage["metric_schemas"]

        for condition in alertability["conditions"]:
            self.assertIn(condition["signal"], metric_schemas)

    def test_collector_owns_all_signal_pipelines(self):
        config = (OBSERVABILITY / "templates/otelcol.yml").read_text()
        victoria_unit = (OBSERVABILITY / "templates/victoriametrics.service").read_text()

        self.assertIn("prometheus/cinematacms", config)
        self.assertIn("delta_to_cumulative", config)
        self.assertNotIn("deltattocumulative", config)
        self.assertIn("file_storage", config)
        self.assertIn("directory: /var/lib/otelcol-contrib/cinematacms", config)
        self.assertNotIn("/var/lib/otelcol-contrib/cinemata\n", config)
        self.assertIn("sending_queue", config)
        self.assertIn("otlp_http/victoriametrics", config)
        self.assertIn("/opentelemetry/v1/metrics", config)
        self.assertIn("file_log/cinematacms", config)
        for receiver in (
            "file_log/mediacms",
            "file_log/nginx",
            "file_log/celery_long",
            "file_log/celery_short",
            "file_log/celery_whisper",
            "file_log/celery_email",
            "file_log/celery_beat",
        ):
            self.assertIn(receiver, config)
        self.assertIn("journald/services", config)
        self.assertIn("/insert/opentelemetry/v1/logs", config)
        self.assertIn("tail_sampling", config)
        self.assertIn("sampling_percentage: 10", config)
        self.assertIn("/insert/opentelemetry/v1/traces", config)
        self.assertIn("attributes/privacy", config)
        self.assertNotIn("fluent-bit", config.lower())
        self.assertNotIn("promscrape", victoria_unit)
        installer = (OBSERVABILITY / "install.sh").read_text()
        self.assertIn("export APP_METRICS_PORT APP_LOG_PATH", installer)
        self.assertIn("verify_journal_ingestion", installer)
        self.assertIn("Reloaded A high performance", installer)
        self.assertIn("trap on_error ERR", installer)
        self.assertIn("prepare_application_log", installer)
        self.assertIn('chown www-data:cinematacms-observability "$APP_LOG_PATH"', installer)
        self.assertIn("usermod -a -G adm otelcol-contrib", installer)
        self.assertIn("printf 'APP_SERVICE_LOG_DIR=%q\\n'", installer)
        self.assertIn("prepare_service_logs", installer)
        self.assertIn("errorlog.txt celery_long.log celery_short.log", installer)
        self.assertIn('install -d -m 2750 -o www-data -g cinematacms-observability "$APP_SERVICE_LOG_DIR"', installer)
        self.assertIn("--connect-timeout 5 --max-time 15", installer)
        self.assertIn("GRAFANA_URL must use loopback HTTP or HTTPS", installer)
        self.assertIn("postgres-exporter.env", installer)
        self.assertIn("redis-exporter.env", installer)
        self.assertIn("celery-exporter.env", installer)

    def test_collector_group_is_inherited_by_new_and_rotated_log_files(self):
        installer = (OBSERVABILITY / "install.sh").read_text()
        rotation = (OBSERVABILITY / "templates/app-logs.logrotate").read_text()
        setgid_directory = "install -d -m 2750 -o www-data -g cinematacms-observability"

        self.assertIn(f'{setgid_directory} "$log_directory"', installer)
        self.assertIn(f'{setgid_directory} "$APP_SERVICE_LOG_DIR"', installer)
        self.assertIn("copytruncate", rotation)
        self.assertNotIn("create ", rotation)

    def render_app_log_rotation(self, app_log_path, service_log_dir):
        result = subprocess.run(
            [
                "bash",
                "-c",
                'source "$1"; load_config; render_app_log_rotation',
                "bash",
                str(OBSERVABILITY / "install.sh"),
            ],
            env={
                **os.environ,
                "APP_LOG_PATH": app_log_path,
                "APP_SERVICE_LOG_DIR": service_log_dir,
                "INCIDENT_REFERENCE_LOOKUP_TOKEN": "token",
                "GRAFANA_API_TOKEN": "token",
            },
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout

    def test_rotation_lists_the_collector_log_once_and_only_when_the_patterns_miss_it(self):
        service_patterns = ["/srv/logs/*.log", "/srv/logs/errorlog.txt"]
        for app_log_path, service_log_dir, extra_patterns in (
            ("/srv/logs/app.json.log", "/srv/logs", []),
            ("/srv/logs/app.json.log", "/srv/logs/", []),
            ("/srv/logs/errorlog.txt", "/srv/logs", []),
            ("/var/app/app.json.log", "/srv/logs", ["/var/app/app.json.log"]),
            ("/srv/logs/app.json", "/srv/logs", ["/srv/logs/app.json"]),
            ("/srv/logs/sub/app.json.log", "/srv/logs", ["/srv/logs/sub/app.json.log"]),
            ("/srv/logs/.app.log", "/srv/logs", ["/srv/logs/.app.log"]),
        ):
            with self.subTest(app_log_path=app_log_path, service_log_dir=service_log_dir):
                rendered = self.render_app_log_rotation(app_log_path, service_log_dir)

                self.assertEqual(rendered.split("{")[0].split(), service_patterns + extra_patterns)

    @unittest.skipUnless(shutil.which("logrotate"), "logrotate is not installed")
    def test_rotation_accepts_a_collector_log_outside_the_service_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            service_logs = Path(directory) / "logs"
            collector_logs = Path(directory) / "collector"
            for logs in (service_logs, collector_logs):
                logs.mkdir()
            live = collector_logs / "app.json.log"
            live.write_text("x" * 200)
            config = Path(directory) / "rotate.conf"
            config.write_text(self.render_app_log_rotation(str(live), str(service_logs)))
            config.chmod(0o644)

            subprocess.run(
                ["logrotate", "--force", "--state", str(Path(directory) / "state"), str(config)],
                check=True,
            )

            self.assertEqual((collector_logs / "app.json.log.1").read_text(), "x" * 200)

    @unittest.skipUnless(shutil.which("logrotate"), "logrotate is not installed")
    def test_rotation_keeps_the_live_log_file_and_its_group(self):
        with tempfile.TemporaryDirectory() as directory:
            logs = Path(directory) / "logs"
            logs.mkdir()
            live = logs / "celery_long.log"
            live.write_text("x" * 200)
            live.chmod(0o640)
            before = live.stat()
            config = Path(directory) / "rotate.conf"
            rendered = self.render_app_log_rotation(str(logs / "app.json.log"), str(logs))
            config.write_text(rendered.replace("maxsize 100M", "size 1"))
            config.chmod(0o644)

            subprocess.run(
                ["logrotate", "--force", "--state", str(Path(directory) / "state"), str(config)],
                check=True,
            )

            after = live.stat()
            self.assertEqual(after.st_size, 0, "the live file is truncated in place")
            self.assertEqual(
                (after.st_ino, after.st_gid, after.st_mode), (before.st_ino, before.st_gid, before.st_mode)
            )
            self.assertEqual((logs / "celery_long.log.1").read_text(), "x" * 200)

    def test_installer_installs_logrotate_before_validating_its_config(self):
        installer = (OBSERVABILITY / "install.sh").read_text()
        packages = re.search(r"apt-get install -y (ca-certificates [^\n]+)\n", installer).group(1).split()

        self.assertIn("logrotate --debug", installer)
        self.assertIn("logrotate", packages)

    def test_disk_usage_is_capped_by_journald_logrotate_and_storage_flags(self):
        installer = (OBSERVABILITY / "install.sh").read_text()
        environment = (OBSERVABILITY / "observability.env.example").read_text()
        templates = OBSERVABILITY / "templates"
        journald = (templates / "journald-cinematacms.conf").read_text()
        app_logs = (templates / "app-logs.logrotate").read_text()

        self.assertFalse((ROOT / "deploy/mediacms_logrorate").exists())
        for setting in (
            "SystemMaxUse=${JOURNAL_MAX_USE}",
            "SystemMaxFileSize=${JOURNAL_MAX_FILE}",
            "MaxRetentionSec=${JOURNAL_MAX_RETENTION}",
        ):
            self.assertIn(setting, journald)
        for persistent_cap, volatile_cap in (
            ("SystemMaxUse", "RuntimeMaxUse"),
            ("SystemMaxFileSize", "RuntimeMaxFileSize"),
        ):
            cap_value = re.search(rf"^{persistent_cap}=(.+)$", journald, re.MULTILINE).group(1)
            self.assertRegex(
                journald,
                rf"(?m)^{volatile_cap}={re.escape(cap_value)}$",
                f"{volatile_cap} must mirror {persistent_cap} so the cap holds when journald runs volatile",
            )
        self.assertNotIn("Storage=", journald)
        for variable in ("JOURNAL_MAX_USE", "JOURNAL_MAX_FILE", "JOURNAL_MAX_RETENTION"):
            self.assertIn(f"{variable}=", environment)
            self.assertIn(f'"${{{variable}:-', installer)
        self.assertIn("journalctl --disk-usage", installer)
        for directive in ("maxsize 100M", "copytruncate", "errorlog.txt"):
            self.assertIn(directive, app_logs)
        for target in ("journald.conf.d/cinematacms.conf", "logrotate.d/cinematacms-app-logs"):
            self.assertIn(target, installer)

        policy = installer[installer.index("install_disk_policy() {") :]
        policy = policy[: policy.index("\n}\n")]
        self.assertIn("logrotate --debug /etc/logrotate.d/cinematacms-app-logs", policy)
        self.assertLess(policy.index("logrotate --debug"), policy.index("systemctl restart systemd-journald"))

        for unit, flags in {
            "victoriametrics.service": ("-storage.minFreeDiskSpaceBytes=${STORAGE_MIN_FREE_DISK}",),
            "victorialogs.service": (
                "-retention.maxDiskSpaceUsageBytes=${LOGS_MAX_DISK}",
                "-storage.minFreeDiskSpaceBytes=${STORAGE_MIN_FREE_DISK}",
            ),
            "victoriatraces.service": (
                "-retention.maxDiskSpaceUsageBytes=${TRACES_MAX_DISK}",
                "-storage.minFreeDiskSpaceBytes=${STORAGE_MIN_FREE_DISK}",
            ),
        }.items():
            text = (templates / unit).read_text()
            for flag in flags:
                self.assertIn(flag, text, unit)

        rules = (templates / "alerts.yml").read_text()
        for alert in (
            "CinemataHostFilesystemWarning",
            "CinemataHostFilesystemFreeLow",
            "CinemataMetricsIngestionStalled",
        ):
            self.assertIn(f"alert: {alert}", rules)

    def test_storage_floor_alerts_do_not_depend_on_samples_the_floor_stops(self):
        rules = (OBSERVABILITY / "templates/alerts.yml").read_text()
        environment = (OBSERVABILITY / "observability.env.example").read_text()

        # Below the floor VictoriaMetrics rejects the Collector's writes, so vm_storage_is_read_only never arrives.
        expressions = re.findall(r"(?m)^\s+expr: (.*)$", rules)
        self.assertFalse([expr for expr in expressions if "vm_storage_is_read_only" in expr])
        stalled = re.search(r"alert: CinemataMetricsIngestionStalled\n\s+expr: (.*)\n", rules).group(1)
        self.assertRegex(stalled, r'^absent_over_time\(up\{service\.name="victoriametrics"\}\[\d+m\]\)$')

        floor_gib = int(re.search(r'(?m)^STORAGE_MIN_FREE_DISK="(\d+)GiB"$', environment).group(1))
        free_low = re.search(r"alert: CinemataHostFilesystemFreeLow\n\s+expr: '(.*)'\n", rules).group(1)
        # The threshold follows the floor VictoriaMetrics enforces, so a raised STORAGE_MIN_FREE_DISK moves it.
        threshold = re.search(
            r"< on\(\) group_left\(\) \(max\(vm_free_disk_space_limit_bytes\) \+ (\d+) or on\(\) vector\((\d+)\)\)$",
            free_low,
        )
        self.assertIsNotNone(threshold, free_low)
        margin, fallback = (int(value) for value in threshold.groups())
        self.assertEqual(margin, 4 * 2**30)
        self.assertGreater(fallback, floor_gib * 2**30, "without the series the alert must fire before writes stop")

        # A store reaches its write floor on the mount that holds it, and that mount can be the data path or any
        # ancestor of it, so the alert has to watch the path and every ancestor.
        selector = re.search(r'mountpoint=~"([^"]*)"', free_low).group(1)
        units = sorted((OBSERVABILITY / "templates").glob("victoria*.service"))
        self.assertEqual(len(units), 3, units)
        for unit in units:
            data_path = re.search(r"-storageDataPath=(\S+)", unit.read_text()).group(1)
            candidate_mounts = [data_path, *(str(parent) for parent in PurePosixPath(data_path).parents)]
            for mount in candidate_mounts:
                self.assertIsNotNone(re.fullmatch(selector, mount), f"{unit.name}: {mount} is not in {selector}")

    def test_collector_reads_the_rotated_copy_so_a_restart_across_rotation_loses_no_lines(self):
        collector = (OBSERVABILITY / "templates/otelcol.yml").read_text()
        rotation = (OBSERVABILITY / "templates/app-logs.logrotate").read_text()

        # delaycompress keeps the .1 copy uncompressed, which the collector can only read as plain text.
        for directive in ("copytruncate", "compress", "delaycompress"):
            self.assertRegex(rotation, rf"(?m)^\s+{directive}$")

        def includes(receiver):
            declaration = re.search(rf'(?m)^  {re.escape(receiver)}:\n    include: (\[".*"\])$', collector)
            return json.loads(declaration.group(1))

        service_logs = {
            "file_log/mediacms": "errorlog.txt",
            "file_log/celery_long": "celery_long.log",
            "file_log/celery_short": "celery_short.log",
            "file_log/celery_whisper": "celery_whisper.log",
            "file_log/celery_email": "celery_email.log",
            "file_log/celery_beat": "beatcelery_beat.log",
        }
        for receiver, filename in service_logs.items():
            live = "${env:APP_SERVICE_LOG_DIR}/" + filename
            self.assertEqual(includes(receiver), [live, live + ".1"], receiver)
        self.assertEqual(
            includes("file_log/cinematacms"), ["${env:APP_LOG_PATH}", "${env:APP_LOG_PATH}.1"], "file_log/cinematacms"
        )
        self.assertEqual(includes("file_log/nginx_access"), ["/var/log/nginx/*access.log"])
        self.assertEqual(includes("file_log/nginx_error"), ["/var/log/nginx/*error.log"])

        # copytruncate restarts the live file with the same first bytes, which the default fingerprint
        # check reads as an untouched file, so its new lines would be skipped.
        def reads_whole_file_on_truncate(receiver):
            block = re.search(rf"(?ms)^  {re.escape(receiver)}:\n(.*?)(?=^  \S)", collector).group(1)
            return re.search(r"(?m)^    on_truncate: read_whole_file$", block) is not None

        for receiver in [*service_logs, "file_log/cinematacms"]:
            self.assertTrue(reads_whole_file_on_truncate(receiver), receiver)
        for receiver in ("file_log/nginx_access", "file_log/nginx_error"):
            self.assertFalse(reads_whole_file_on_truncate(receiver), receiver)

    def test_maxsize_is_checked_hourly_by_a_timer_the_installer_runs_and_verifies(self):
        installer = (OBSERVABILITY / "install.sh").read_text()
        templates = OBSERVABILITY / "templates"
        unit = "cinematacms-app-logs-rotate"
        service = (templates / f"{unit}.service").read_text()
        timer = (templates / f"{unit}.timer").read_text()

        self.assertIn("Type=oneshot", service)
        self.assertIn("ExecStart=/usr/sbin/logrotate /etc/logrotate.d/cinematacms-app-logs\n", service)
        self.assertNotIn("--state", service, "the default state file keeps the stock daily run from rotating twice")
        self.assertNotIn("ProtectHome", service, "the application logs live under /home")
        self.assertIn("OnCalendar=hourly", timer)
        self.assertRegex(timer, r"(?m)^RandomizedDelaySec=\d+(min|s)$")
        self.assertIn("WantedBy=timers.target", timer)

        for step, expected in {
            "install_configuration() {": (f"{unit}; do", f"{unit}.timer"),
            "validate_configuration() {": (f"{unit}.service", f"{unit}.timer"),
            "start_services() {": (f"enable --now {unit}.timer",),
            "verify_installation() {": (f"{unit}.timer",),
        }.items():
            body = installer[installer.index(step) :]
            body = body[: body.index("\n}\n")]
            for fragment in expected:
                self.assertIn(fragment, body, step)

    def test_overview_shows_in_flight_work_and_unconsumed_queues(self):
        dashboard = json.loads((OBSERVABILITY / "templates/grafana-overview.json").read_text())
        panels = {panel["title"]: panel for panel in dashboard["panels"]}

        active_work = " ".join(target["expr"] for target in panels["Celery active work and latency"]["targets"])
        self.assertIn("sum by (hostname) (celery_worker_tasks_active)", active_work)
        self.assertNotIn("by (worker)", active_work)
        exporter_queues = " ".join(target["expr"] for target in panels["Celery exporter queues"]["targets"])
        self.assertIn("celery_active_worker_count", exporter_queues)
        self.assertIn('redis_key_size{key="celery"}', exporter_queues)
        self.assertIn('redis_key_size{key="unacked"}', exporter_queues)

    def test_redis_exporter_checks_queue_keys_in_the_broker_database(self):
        installer = (OBSERVABILITY / "install.sh").read_text()
        start = installer.index("redis_database_number() {")
        functions = installer[start : installer.index("prepare_application_log() {")]
        coverage = json.loads((ROOT / "config/observability/coverage.json").read_text())
        contract_queues = coverage["registries"]["celery_queues"]["values"]
        # "default" is the metric label for unrecognised routing keys, not a broker queue.
        expected_keys = ["celery", *(queue for queue in contract_queues if queue != "default"), "unacked"]

        self.assertIn("printf 'REDIS_EXPORTER_CHECK_SINGLE_KEYS=%q\\n' \"$(celery_queue_keys)\"", installer)
        for url, database in {
            "redis://127.0.0.1:6379/1": "db1",
            "redis://127.0.0.1:6379": "db0",
            "redis://127.0.0.1:6379/": "db0",
            "redis://127.0.0.1:6379/3/": "db3",
            "redis://:secret@127.0.0.1:6379/2?timeout=5": "db2",
            "redis://127.0.0.1:6379?timeout=5": "db0",
            "redis://127.0.0.1:6379/notanumber": "db0",
        }.items():
            result = subprocess.run(
                ["bash", "-c", f'{functions}\nREDIS_URL="$1"; celery_queue_keys', "bash", url],
                check=True,
                capture_output=True,
                text=True,
            )
            self.assertEqual(result.stdout, ",".join(f"{database}={key}" for key in expected_keys), url)

    def test_application_metrics_listener_is_loopback_only(self):
        nginx = (OBSERVABILITY / "templates/nginx-app-metrics.conf").read_text()
        installer = (OBSERVABILITY / "install.sh").read_text()

        self.assertIn("listen 127.0.0.1:${APP_METRICS_PORT};", nginx)
        self.assertIn("location = /metrics", nginx)
        self.assertIn("location = /internal/observability/references", nginx)
        self.assertIn("uwsgi_pass 127.0.0.1:9000", nginx)
        self.assertIn("render_nginx_app_metrics", installer)
        self.assertIn('content="${content//\\$\\{APP_METRICS_PORT\\}/$APP_METRICS_PORT}"', installer)
        self.assertIn("http://127.0.0.1:${APP_METRICS_PORT}/metrics", installer)
        self.assertIn("require_managed_application_mode", installer)
        self.assertIn("the local starter Prometheus service is active", installer)
        self.assertIn("rm -f /etc/grafana/provisioning/dashboards/cinematacms.yml", installer)
        self.assertIn("rm -f /etc/grafana/provisioning/datasources/cinematacms.yml", installer)

    def test_postgres_exporter_pins_the_stat_replication_bugfix_release(self):
        manifest = (OBSERVABILITY / "manifest.env").read_text()
        unit = (OBSERVABILITY / "templates/postgres-exporter.service").read_text()

        self.assertIn('POSTGRES_EXPORTER_VERSION="v0.20.1"', manifest)
        self.assertIn(
            'POSTGRES_EXPORTER_AMD64_SHA256="89d4f7e7920cad48fdc3133f789556ef5253c330a9f5fdace3bdb6344c0a8b5a"',
            manifest,
        )
        self.assertIn(
            'POSTGRES_EXPORTER_ARM64_SHA256="d5d86fb98bb1f26b088d1a6fda07fd6b6f035cb5d40492f75ec3bfebb5ddfe9d"',
            manifest,
        )
        self.assertIn('--config.file=""', unit)

    def test_trace_pipeline_keeps_public_incident_context(self):
        collector = (OBSERVABILITY / "templates/otelcol.yml").read_text()
        installer = (OBSERVABILITY / "install.sh").read_text()

        for attribute in (
            '"domain.operation"',
            '"domain.outcome"',
            '"domain.reason_code"',
            '"email.delivery_id"',
            '"email.recipient_ref"',
            '"email.kind"',
            '"email.attempt"',
            '"cinematacms.actor_ref"',
        ):
            self.assertIn(attribute, collector)
        self.assertIn("key: domain.operation", collector)
        self.assertIn("key: domain.outcome", collector)
        self.assertNotIn("key: app.operation", collector)
        self.assertIn("domain.operation", installer)
        self.assertIn("email.recipient_ref", installer)
        self.assertIn("cinematacms.actor_ref", installer)

    def test_every_phase_has_a_service_or_provisioned_artifact(self):
        templates = OBSERVABILITY / "templates"
        required = {
            "victoriametrics.service",
            "victorialogs.service",
            "victoriatraces.service",
            "postgres-exporter.service",
            "redis-exporter.service",
            "nginx-prometheus-exporter.service",
            "celery-exporter.service",
            "alertmanager.service",
            "vmalert.service",
            "cinematacms-app-logs-rotate.service",
            "cinematacms-app-logs-rotate.timer",
            "grafana-datasources.yml",
            "grafana-logs.json",
            "grafana-overview.json",
            "grafana-traces.json",
            "grafana-incidents.json",
            "grafana-server-health.json",
        }
        self.assertTrue(required.issubset({path.name for path in templates.iterdir()}))

    def test_dashboards_cover_required_incident_views_without_addresses(self):
        dashboard = (OBSERVABILITY / "templates/grafana-overview.json").read_text()
        parsed = json.loads(dashboard)
        titles = {panel["title"] for panel in parsed["panels"]}
        self.assertTrue(
            {
                "Celery overview",
                "Media pipeline",
                "Email delivery",
                "Web and API",
                "Scheduled jobs",
                "Telemetry health",
                "External services",
            }.issubset(titles)
        )
        self.assertNotIn("@", dashboard)
        self.assertIn("recipient_ref", dashboard)

        for context in ("$task_id", "$delivery_uuid", "$trace_id", "$recipient_ref", "$actor_ref"):
            self.assertIn(context, dashboard)
        self.assertIn("${__from}", dashboard)
        self.assertIn("${__to}", dashboard)
        self.assertIn("Running logs dashboard", dashboard)
        expressions = [
            target["expr"] for panel in parsed["panels"] for target in panel.get("targets", []) if "expr" in target
        ]
        self.assertTrue(any('queue="whisper_tasks"' in expr for expr in expressions))
        self.assertNotIn('avg(rate({__name__="system.cpu.time"', dashboard)
        self.assertIn("node_filesystem_avail_bytes", dashboard)
        self.assertIn("or vector(0)", dashboard)
        alerts = (OBSERVABILITY / "templates/alerts.yml").read_text()
        self.assertIn("absent_over_time(cinematacms_scheduled_job_last_success_timestamp_seconds[15m])", alerts)
        self.assertIn("clamp_min(sum(pg_settings_max_connections), 1)", alerts)

    def test_dashboard_and_alert_queries_use_contracted_metric_names(self):
        coverage = json.loads((ROOT / "config/observability/coverage.json").read_text())
        query_files = (
            OBSERVABILITY / "templates/grafana-overview.json",
            OBSERVABILITY / "templates/alerts.yml",
        )
        query_text = "\n".join(path.read_text() for path in query_files)

        referenced = set(re.findall(r"cinematacms_[a-z0-9_]+", query_text))
        histogram_suffixes = ("_bucket", "_count", "_sum")
        normalized = {
            next(
                (name[: -len(suffix)] for suffix in histogram_suffixes if name.endswith(suffix)),
                name,
            )
            for name in referenced
        }
        self.assertEqual(normalized, set(coverage["metric_schemas"]))
        for metric in (
            "cinematacms_encoding_input_duration_seconds",
            "cinematacms_encoding_input_file_size_bytes",
        ):
            self.assertIn(metric, normalized)
            self.assertIn(f'"{metric}"', (ROOT / "files/metrics.py").read_text())
        for stale_label in ("service_name", "job_kind", "reason=", "route,", "state)"):
            self.assertNotIn(stale_label, query_text)

    def test_privacy_pipeline_keeps_sanitized_messages_and_allowlisted_context(self):
        collector = (OBSERVABILITY / "templates/otelcol.yml").read_text()

        self.assertIn("keep_keys(log.attributes", collector)
        self.assertIn("keep_keys(resource.attributes", collector)
        self.assertNotIn('set(log.body, "cinematacms.structured_log")', collector)
        self.assertIn('set(log.body, log.attributes["message"])', collector)
        self.assertIn('replace_pattern(log.body, "(?i)authorization', collector)
        self.assertIn('replace_pattern(log.body, "(?i)(password|passwd|token|secret|api[_-]?key)', collector)
        self.assertIn('replace_pattern(log.body, "[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+', collector)
        self.assertIn('set(log.attributes["logger.name"]', collector)
        self.assertIn('set(log.attributes["level"], log.severity_text)', collector)
        self.assertIn('log.attributes["exc_info"]', collector)
        self.assertIn("Substring(log.body, 0, 2048, true)", collector)
        self.assertIn("from: body._SYSTEMD_UNIT", collector)
        self.assertIn('to: attributes["systemd.unit"]', collector)
        self.assertIn("from: body.MESSAGE", collector)
        self.assertIn("to: body", collector)
        self.assertNotIn('"task_name"', collector)
        self.assertNotIn('"message"', re.search(r"keep_keys\(log\.attributes, \[(.*?)\]\)", collector).group(1))

    def test_nginx_access_logs_cover_every_vhost_and_keep_upload_timings(self):
        collector = (OBSERVABILITY / "templates/otelcol.yml").read_text()
        kept = re.search(r"keep_keys\(log\.attributes, \[(.*?)\]\)", collector).group(1)

        self.assertIn('include: ["/var/log/nginx/*access.log"]', collector)
        self.assertIn('include: ["/var/log/nginx/*error.log"]', collector)
        self.assertNotIn('include: ["/var/log/nginx/*.log"]', collector)
        self.assertIn("file_log/nginx_access", collector)
        self.assertIn("file_log/nginx_error", collector)
        for field in ("request_time", "upstream_time", "request_length", "bytes_sent", "http.route"):
            self.assertIn(f'"{field}"', kept)
        for raw_field in ("request_path", "http_method", "remote_addr", "http_user_agent"):
            self.assertNotIn(f'"{raw_field}"', kept)
        self.assertIn('"/$$1/:resource"', collector)
        self.assertIn('set(log.attributes["route_group"], "nginx_upload")', collector)
        self.assertIn('set(log.body, Concat([log.attributes["method"]', collector)

    def test_nginx_access_regex_extracts_timings_from_the_cinematacms_format(self):
        collector = (OBSERVABILITY / "templates/otelcol.yml").read_text()
        pattern = re.search(r"id: parse_nginx_access_request\n.*?regex: '(.*?)'\n", collector, re.S).group(1)
        regex = re.compile(pattern)

        timed_out = (
            '203.0.113.9 - - [30/Oct/2026:10:00:00 +0800] "POST /fu/upload/?qquuid=private-id HTTP/1.1" '
            '408 0 "https://cinemata.org/upload" "Mozilla/5.0 (X11)" "-" rt=300.001 urt=- rl=1048576'
        )
        fields = regex.match(timed_out).groupdict()
        self.assertEqual(fields["http_method"], "POST")
        self.assertEqual(fields["request_path"], "/fu/upload/")
        self.assertEqual(fields["status_code"], "408")
        self.assertEqual(fields["bytes_sent"], "0")
        self.assertEqual(fields["request_time"], "300.001")
        self.assertEqual(fields["upstream_time"], "-")
        self.assertEqual(fields["request_length"], "1048576")
        self.assertNotIn("private-id", "".join(v or "" for v in fields.values()))

        retried_upstream = timed_out.replace("408 0", "200 31").replace("urt=-", "urt=0.010, 0.120")
        self.assertEqual(regex.match(retried_upstream).group("upstream_time"), "0.010, 0.120")

        combined_only = (
            '203.0.113.9 - - [30/Oct/2026:10:00:00 +0800] "POST /fu/upload/ HTTP/1.1" 403 146 "-" "Mozilla/5.0"'
        )
        fields = regex.match(combined_only).groupdict()
        self.assertEqual(fields["status_code"], "403")
        self.assertFalse(fields["request_time"])

    def test_alert_inhibition_cannot_cross_alert_names(self):
        alertmanager = (OBSERVABILITY / "templates/alertmanager.yml").read_text()

        self.assertIn("equal: [alertname, service_name]", alertmanager)

    def test_installer_verifies_the_provisioned_grafana_dashboard(self):
        installer = (OBSERVABILITY / "install.sh").read_text()

        self.assertIn("grafana-server", installer)
        self.assertIn("seq 1 90", installer)
        self.assertIn("/api/dashboards/uid/cinematacms-observability", installer)
        self.assertIn("/api/dashboards/uid/cinematacms-logs", installer)
        self.assertIn("/api/dashboards/uid/cinematacms-traces", installer)
        self.assertIn("/api/dashboards/uid/cinematacms-incidents", installer)
        self.assertIn("/api/dashboards/uid/cinematacms-server-health", installer)

    def test_server_health_dashboard_covers_host_resource_saturation(self):
        dashboard = (OBSERVABILITY / "templates/grafana-server-health.json").read_text()
        parsed = json.loads(dashboard)
        titles = {panel["title"] for panel in parsed["panels"]}

        self.assertEqual(parsed["uid"], "cinematacms-server-health")
        self.assertTrue(
            {
                "CPU usage",
                "Load average",
                "Memory and swap",
                "Filesystem usage",
                "Filesystem space available",
                "Disk I/O throughput",
                "Disk I/O latency",
                "Network throughput",
                "Network errors",
                "Host uptime",
                "Process states",
                "Disk operation rate",
            }.issubset(titles)
        )
        for metric in (
            "system.cpu.time",
            "system.cpu.load_average.1m",
            "system.memory.usage",
            "system.paging.usage",
            "node_filesystem_avail_bytes",
            "node_filesystem_size_bytes",
            "system.disk.io",
            "system.disk.operations",
            "system.disk.operation_time",
            "system.network.io",
            "system.network.errors",
            "system.uptime",
            "system.processes.count",
        ):
            self.assertIn(metric, dashboard)
        self.assertIn("cinematacms-incidents", dashboard)
        self.assertIn("cinematacms-logs", dashboard)
        self.assertIn('state=\\"idle\\"}[$__rate_interval])) / clamp_min(sum(rate(', dashboard)
        self.assertNotIn("system.paging.operations", dashboard)
        self.assertIn('mountpoint=\\"/\\"', dashboard)
        self.assertIn("scalar(clamp_min(sum(rate", dashboard)

        collector = (OBSERVABILITY / "templates/otelcol.yml").read_text()
        self.assertIn("system.filesystem.utilization:", collector)
        self.assertIn('targets: ["127.0.0.1:9100"]', collector)
        for scraper in ("disk", "load", "paging", "processes", "system"):
            self.assertIn(f"      {scraper}: {{}}", collector)
        installer = (OBSERVABILITY / "install.sh").read_text()
        for metric in (
            "system.cpu.time",
            "system.disk.io",
            "node_filesystem_avail_bytes",
            "system.network.io",
            "system.uptime",
        ):
            self.assertIn(metric, installer)

    def test_incident_dashboard_supports_every_operational_entry_point(self):
        dashboard = (OBSERVABILITY / "templates/grafana-incidents.json").read_text()
        parsed = json.loads(dashboard)

        self.assertEqual(parsed["uid"], "cinematacms-incidents")
        variable_names = {variable["name"] for variable in parsed["templating"]["list"]}
        self.assertTrue(
            {
                "lookup_kind",
                "lookup_value",
                "lookup_ref",
                "media_ref",
                "recipient_ref",
                "task_id",
                "delivery_uuid",
                "trace_id",
                "operation",
                "outcome",
                "reason_code",
                "route_group",
                "method",
                "status_code",
                "service",
                "severity",
            }.issubset(variable_names)
        )
        self.assertTrue(next(v for v in parsed["templating"]["list"] if v["name"] == "lookup_value")["skipUrlSync"])
        self.assertIn("yesoreyeram-infinity-datasource", dashboard)
        self.assertIn("actor_ref", dashboard)
        self.assertIn("recipient_ref", dashboard)
        self.assertIn("media_ref", dashboard)
        self.assertIn("systemd.unit", dashboard)
        self.assertNotIn("python manage.py", dashboard)

    def test_trace_dashboard_supports_discovery_and_log_correlation(self):
        dashboard = (OBSERVABILITY / "templates/grafana-traces.json").read_text()
        parsed = json.loads(dashboard)
        panels_by_title = {panel["title"]: panel for panel in parsed["panels"]}

        self.assertEqual(parsed["uid"], "cinematacms-traces")
        self.assertIn("Recent traces by service", panels_by_title)
        self.assertIn("Trace ID lookup", panels_by_title)
        self.assertIn("Correlated logs", dashboard)
        self.assertIn("/d/cinematacms-logs/", dashboard)

        search_target = panels_by_title["Recent traces by service"]["targets"][0]
        self.assertEqual(search_target["queryType"], "search")
        self.assertEqual(search_target["service"], "$service")
        self.assertEqual(search_target["operation"], "$operation")
        self.assertEqual(search_target["tags"], "$tags")

        lookup_target = panels_by_title["Trace ID lookup"]["targets"][0]
        self.assertNotIn("queryType", lookup_target)
        self.assertEqual(lookup_target["query"], "$trace_id")
        self.assertIn("__enter_value__", dashboard)
        self.assertNotIn("@", dashboard)

    def test_logs_dashboard_supports_filtering_and_safe_correlation(self):
        dashboard = (OBSERVABILITY / "templates/grafana-logs.json").read_text()
        parsed = json.loads(dashboard)
        titles = {panel["title"] for panel in parsed["panels"]}

        service_views = {
            "CinemataCMS application logs": 'service.name:"cinematacms"',
            "MediaCMS service logs": 'systemd.unit:"mediacms.service"',
            "Nginx service logs": 'systemd.unit:"nginx.service"',
            "Celery long worker logs": 'systemd.unit:"celery_long.service"',
            "Celery short worker logs": 'systemd.unit:"celery_short.service"',
            "Celery Whisper worker logs": 'systemd.unit:"celery_whisper.service"',
            "Celery email worker logs": 'systemd.unit:"celery_email.service"',
            "Celery beat logs": 'systemd.unit:"celery_beat.service"',
        }

        self.assertEqual(parsed["uid"], "cinematacms-logs")
        self.assertTrue(
            {
                "Log volume by severity",
                "Log volume by service or unit",
                "All services",
                "Errors and critical logs",
                "Correlation lookup",
            }.issubset(titles)
        )
        self.assertIn("${filter:raw}", dashboard)
        self.assertIn("severity_text", dashboard)
        self.assertIn("systemd.unit", dashboard)
        panels_by_title = {panel["title"]: panel for panel in parsed["panels"]}
        for title, service_filter in service_views.items():
            self.assertIn(title, panels_by_title)
            expressions = [target["expr"] for target in panels_by_title[title]["targets"]]
            self.assertTrue(any(service_filter in expression for expression in expressions))
            self.assertTrue(all("${filter:raw}" in expression for expression in expressions))
        self.assertEqual(parsed["refresh"], "5s")
        self.assertIn("ERROR|CRITICAL|FATAL", dashboard)
        self.assertIn("__enter_value__", dashboard)
        for context in ("$task_id", "$delivery_uuid", "$trace_id", "$recipient_ref", "$actor_ref"):
            self.assertIn(context, dashboard)
        self.assertNotIn("@", dashboard)

    def test_host_and_external_health_have_collection_dashboard_and_alerts(self):
        collector = (OBSERVABILITY / "templates/otelcol.yml").read_text()
        dashboard = (OBSERVABILITY / "templates/grafana-overview.json").read_text()
        alerts = (OBSERVABILITY / "templates/alerts.yml").read_text()

        self.assertIn("hostmetrics:", collector)
        self.assertIn("httpcheck/external:", collector)
        self.assertNotIn('avg(rate({__name__="system.cpu.time"', dashboard + alerts)
        self.assertIn("node_filesystem_avail_bytes", dashboard + alerts)
        for metric in (
            '"system.cpu.time"',
            '"system.memory.usage"',
            '"httpcheck.status"',
            '"httpcheck.tls.cert_remaining"',
        ):
            self.assertIn(metric, dashboard + alerts)

    def test_alert_rules_cover_the_public_alertability_contract(self):
        rules = (OBSERVABILITY / "templates/alerts.yml").read_text()
        alertability = json.loads((ROOT / "config/observability/alertability.json").read_text())
        for condition in alertability["conditions"]:
            self.assertIn(condition["signal"], rules)

    def test_all_downloaded_archives_have_two_pinned_checksums(self):
        manifest = (OBSERVABILITY / "manifest.env").read_text()
        for component in (
            "OTELCOL",
            "VICTORIAMETRICS",
            "VICTORIALOGS",
            "VICTORIATRACES",
            "VMUTILS",
            "ALERTMANAGER",
            "POSTGRES_EXPORTER",
            "REDIS_EXPORTER",
            "NGINX_EXPORTER",
        ):
            self.assertIn(f"{component}_AMD64_SHA256", manifest)
            self.assertIn(f"{component}_ARM64_SHA256", manifest)

    def test_celery_exporter_supports_ubuntu_2204_python(self):
        manifest = (OBSERVABILITY / "manifest.env").read_text()
        installer = (OBSERVABILITY / "install.sh").read_text()

        self.assertIn('CELERY_EXPORTER_VERSION="0.10.10"', manifest)
        self.assertIn('CELERY_EXPORTER_COMMIT="041ccf66d337852626acf6310b6b81c6d6165b74"', manifest)
        self.assertIn("sed -n 's/^Version: //p' || true", installer)

    def test_fixture_exposes_every_contracted_metric(self):
        result = subprocess.run(
            ["python3", str(OBSERVABILITY / "tests/serve_metrics_fixture.py"), "--dump"],
            check=True,
            capture_output=True,
            text=True,
        )
        coverage = json.loads((ROOT / "config/observability/coverage.json").read_text())

        for metric in coverage["metric_schemas"]:
            self.assertIn(metric, result.stdout)
        self.assertIn('le="0.025"', result.stdout)
        self.assertIn('queue="whisper_tasks"', result.stdout)

        fixture = (OBSERVABILITY / "tests/serve_metrics_fixture.py").read_text()
        self.assertIn("/internal/observability/references", fixture)
        self.assertIn("INCIDENT_REFERENCE_LOOKUP_TOKEN", fixture)

    def test_incident_lookup_requires_private_transport_and_authenticated_grafana(self):
        installer = (OBSERVABILITY / "install.sh").read_text()
        datasource = (OBSERVABILITY / "templates/grafana-datasources.yml").read_text()

        self.assertIn('[[ -n "$INCIDENT_REFERENCE_LOOKUP_TOKEN" ]]', installer)
        self.assertIn('[[ -n "$GRAFANA_API_TOKEN" ]]', installer)
        self.assertIn("reference lookup URL must use loopback HTTP or HTTPS", installer)
        self.assertIn("anonymous Grafana dashboard access must be disabled", installer)
        self.assertIn("secureJsonData:", datasource)
        self.assertIn("allowedHosts:", datasource)
        self.assertIn("chmod 0640 /etc/grafana/provisioning/datasources", installer)


if __name__ == "__main__":
    unittest.main()
