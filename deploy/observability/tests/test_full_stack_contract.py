import json
import re
import subprocess
import unittest
from pathlib import Path

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
        self.assertIn('install -d -m 0750 -o www-data -g cinematacms-observability "$APP_SERVICE_LOG_DIR"', installer)
        self.assertIn("--connect-timeout 5 --max-time 15", installer)
        self.assertIn("GRAFANA_URL must use loopback HTTP or HTTPS", installer)
        self.assertIn("postgres-exporter.env", installer)
        self.assertIn("redis-exporter.env", installer)
        self.assertIn("celery-exporter.env", installer)

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
