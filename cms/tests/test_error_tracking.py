import ast
import importlib
import json
import logging
import sys
from io import StringIO
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.error import HTTPError

from celery.exceptions import TimeoutError as CeleryTimeoutError
from django.conf import settings
from django.core.cache import cache
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import RequestFactory, SimpleTestCase, override_settings

from cms.error_tracking import (
    ErrorTrackingDiagnosticError,
    capture_unexpected_exception,
    configure_error_tracking,
    sanitize_event,
)
from cms.observability import OpenTelemetryLogFilter, sanitize_django_request_span
from cms.urls import _error_tracking_diagnostic_rate_limited, error_tracking_diagnostic


class LoggingPrivacyConfigurationTests(SimpleTestCase):
    def test_overriding_logging_handlers_attach_the_sanitizing_filter(self):
        logging_config = importlib.import_module("cms.test_settings").LOGGING

        self.assertEqual(
            logging_config["filters"]["otel_trace"]["()"],
            "cms.observability.OpenTelemetryLogFilter",
        )
        for handler_name, handler in logging_config["handlers"].items():
            with self.subTest(handler_name=handler_name):
                self.assertIn("otel_trace", handler.get("filters", []))


class ErrorTrackingPrivacyTests(SimpleTestCase):
    @override_settings(OTEL_SERVICE_ROLE="long-task")
    def test_sensitive_values_are_removed_without_destroying_diagnostic_context(self):
        event = {
            "message": (
                "Failed processing media for person@example.com from 203.0.113.42 "
                "token=diagnostic-secret at https://person:pass@example.org/private-token?secret=value "
                "SELECT email FROM private_data"
            ),
            "release": "cinematacms@abc123",
            "environment": "staging",
            "tags": {
                "access_token": "raw-secret-value",
                "media_id": "private-media-id",
                "host": "private-host.example.org",
                "harmless": "caller-controlled-value",
            },
            "request": {
                "url": "https://video.example.org/view/private-token?email=person@example.com",
                "headers": {"Authorization": "Bearer diagnostic-secret"},
                "data": {"email": "person@example.com"},
            },
            "user": {"email": "person@example.com", "ip_address": "203.0.113.42"},
            "breadcrumbs": [{"message": "person@example.com opened 203.0.113.42"}],
            "extra": {"password": "diagnostic-secret", "sql": "select private_data"},
            "transaction": "/view/private-token",
            "fingerprint": ["caller-controlled-group"],
            "spans": [{"description": "GET /view/private-token?secret=value"}],
            "contexts": {
                "trace": {
                    "trace_id": "0123456789abcdef0123456789abcdef",
                    "span_id": "0123456789abcdef",
                    "op": "celery.task",
                },
                "runtime": {"name": "CPython", "raw_description": "private-host"},
            },
            "exception": {
                "values": [
                    {
                        "type": "RuntimeError",
                        "value": "Encoding failed for person@example.com at 2001:db8::1",
                        "stacktrace": {
                            "frames": [
                                {
                                    "filename": "files/tasks.py",
                                    "abs_path": "/srv/cinematacms/files/tasks.py",
                                    "function": "encode_media",
                                    "lineno": 412,
                                    "context_line": "raise RuntimeError('Encoding failed')",
                                    "vars": {"email": "person@example.com", "token": "diagnostic-secret"},
                                }
                            ]
                        },
                    }
                ]
            },
        }

        hint = {"attachments": [b"private-attachment"]}
        sanitized = sanitize_event(event, hint)
        serialized = json.dumps(sanitized).lower()

        for canary in (
            "person@example.com",
            "203.0.113.42",
            "2001:db8::1",
            "diagnostic-secret",
            "private-token",
            "select private_data",
            "private-host",
            "person:pass",
            "select email",
            "private-attachment",
            "raw-secret-value",
            "private-media-id",
            "private-host.example.org",
            "caller-controlled-value",
        ):
            self.assertNotIn(canary, serialized)

        self.assertNotIn("attachments", hint)

        self.assertNotIn("request", sanitized)
        self.assertNotIn("user", sanitized)
        self.assertNotIn("breadcrumbs", sanitized)
        self.assertNotIn("extra", sanitized)
        self.assertNotIn("fingerprint", sanitized)
        self.assertNotIn("spans", sanitized)
        self.assertNotIn("transaction", sanitized)
        self.assertEqual(sanitized["release"], "cinematacms@abc123")
        self.assertEqual(sanitized["environment"], "staging")
        self.assertEqual(sanitized["tags"], {"service_role": "long-task"})
        self.assertEqual(
            sanitized["contexts"]["trace"]["trace_id"],
            "0123456789abcdef0123456789abcdef",
        )

        exception = sanitized["exception"]["values"][0]
        self.assertEqual(exception["type"], "RuntimeError")
        self.assertIn("Encoding failed", exception["value"])
        frame = exception["stacktrace"]["frames"][0]
        self.assertEqual(frame["filename"], "files/tasks.py")
        self.assertEqual(frame["function"], "encode_media")
        self.assertNotIn("vars", frame)


class ErrorTrackingConfigurationTests(SimpleTestCase):
    def test_error_tracking_and_diagnostics_are_disabled_by_default(self):
        self.assertEqual(settings.SENTRY_DSN, "")
        self.assertFalse(settings.ERROR_TRACKING_DIAGNOSTICS_ENABLED)
        self.assertEqual(settings.ERROR_TRACKING_DIAGNOSTICS_TOKEN, "")

    @override_settings(SENTRY_DSN="")
    def test_missing_dsn_disables_error_tracking_without_initializing_the_sdk(self):
        with (
            patch("cms.error_tracking._configured", False),
            patch("sentry_sdk.init") as initialize,
        ):
            self.assertFalse(configure_error_tracking())

        initialize.assert_not_called()

    @override_settings(
        SENTRY_DSN="https://public@example.invalid/1",
        SENTRY_ENVIRONMENT="staging",
        SENTRY_RELEASE="cinematacms@abc123",
        SENTRY_SAMPLE_RATE=1.0,
    )
    def test_enabled_configuration_captures_errors_without_logs_traces_profiles_or_pii(self):
        with (
            patch("cms.error_tracking._configured", False),
            patch("sentry_sdk.init") as initialize,
        ):
            self.assertTrue(configure_error_tracking())

        options = initialize.call_args.kwargs
        self.assertEqual(options["dsn"], "https://public@example.invalid/1")
        self.assertEqual(options["environment"], "staging")
        self.assertEqual(options["release"], "cinematacms@abc123")
        self.assertEqual(options["sample_rate"], 1.0)
        self.assertEqual(options["traces_sample_rate"], 0.0)
        self.assertEqual(options["profiles_sample_rate"], 0.0)
        self.assertFalse(options["enable_logs"])
        self.assertFalse(options["send_default_pii"])
        self.assertFalse(options["include_local_variables"])
        self.assertEqual(options["max_request_body_size"], "never")
        self.assertEqual(options["max_breadcrumbs"], 0)
        self.assertFalse(options["auto_session_tracking"])
        self.assertEqual(options["server_name"], "")
        self.assertIs(options["before_send"], sanitize_event)

        logging_integration = options["integrations"][0]
        self.assertIsNone(logging_integration._handler)
        self.assertIsNone(logging_integration._breadcrumb_handler)
        self.assertIsNone(logging_integration._sentry_logs_handler)

    @override_settings(SENTRY_DSN="not-a-dsn")
    def test_invalid_explicit_configuration_stops_startup(self):
        with (
            patch("cms.error_tracking._configured", False),
            patch("sentry_sdk.init", side_effect=ValueError("invalid DSN")),
        ):
            with self.assertRaisesMessage(ValueError, "invalid DSN"):
                configure_error_tracking()

    def test_wsgi_initializes_error_tracking_before_building_the_application(self):
        calls = []
        original_wsgi = sys.modules.pop("cms.wsgi", None)
        if original_wsgi is None:
            self.addCleanup(sys.modules.pop, "cms.wsgi", None)
        else:
            self.addCleanup(sys.modules.__setitem__, "cms.wsgi", original_wsgi)
        with (
            patch("cms.error_tracking.configure_error_tracking", side_effect=lambda: calls.append("error_tracking")),
            patch("cms.observability.configure_django_observability", side_effect=lambda: calls.append("otel")),
            patch("django.core.wsgi.get_wsgi_application", side_effect=lambda: calls.append("application") or Mock()),
        ):
            importlib.import_module("cms.wsgi")

        self.assertEqual(calls, ["error_tracking", "otel", "application"])

    def test_celery_initializes_error_tracking_when_the_application_module_loads(self):
        original_celery = sys.modules.pop("cms.celery", None)
        if original_celery is None:
            self.addCleanup(sys.modules.pop, "cms.celery", None)
        else:
            self.addCleanup(sys.modules.__setitem__, "cms.celery", original_celery)
        with patch("cms.error_tracking.configure_error_tracking") as initialize:
            importlib.import_module("cms.celery")

        initialize.assert_called_once_with()

    @override_settings(SENTRY_DSN="")
    def test_manual_capture_is_a_noop_when_error_tracking_is_disabled(self):
        with patch("sentry_sdk.capture_exception") as capture:
            self.assertIsNone(capture_unexpected_exception(RuntimeError("ignored")))
        capture.assert_not_called()

    @override_settings(SENTRY_DSN="https://public@example.invalid/1")
    def test_manual_capture_is_fail_soft_when_delivery_fails(self):
        error = RuntimeError("application failure")
        with patch("sentry_sdk.capture_exception", side_effect=RuntimeError("transport failed")) as capture:
            self.assertIsNone(capture_unexpected_exception(error))
        capture.assert_called_once_with(error)


class ErrorTrackingLogPrivacyTests(SimpleTestCase):
    def test_redaction_removes_urls_while_preserving_surrounding_context(self):
        from cms.error_tracking import redact_text

        message = "Request https://video.example.org/media/42 failed"

        self.assertEqual(redact_text(message), "Request [redacted-url] failed")
        self.assertEqual(
            redact_text("Request https://operator:private@video.example.org/media/42 failed"),
            "Request [redacted-url] failed",
        )

    @override_settings(OTEL_ENABLED=False)
    def test_log_redaction_preserves_incident_context_and_sanitized_traceback(self):
        try:
            raise RuntimeError("Database write failed for person@example.com from 203.0.113.42")
        except RuntimeError:
            exception_info = sys.exc_info()

        correlation_id = "01f45ee5-30f1-4c81-9a94-50c03da85ac8"
        record = logging.LogRecord(
            "files.tasks",
            logging.ERROR,
            __file__,
            120,
            "Encoding failed correlation_id=%s user=%s token=%s",
            (correlation_id, "person@example.com", "diagnostic-secret"),
            exception_info,
        )
        record.authorization = "Bearer diagnostic-secret"
        record.context = {
            "operation": "encode_media",
            "client_ip": "2001:db8::1",
            "email": "person@example.com",
        }

        self.assertTrue(OpenTelemetryLogFilter().filter(record))
        rendered = f"{record.getMessage()}\n{record.exc_text}\n{record.context}".lower()

        for canary in (
            "person@example.com",
            "203.0.113.42",
            "2001:db8::1",
            "diagnostic-secret",
        ):
            self.assertNotIn(canary, rendered)
        self.assertIn("encoding failed", rendered)
        self.assertIn("runtimeerror", rendered)
        self.assertIn("test_error_tracking.py", rendered)
        self.assertIn("encode_media", rendered)
        self.assertIn(correlation_id, rendered)
        self.assertEqual(record.authorization, "[redacted]")


class OpenTelemetryRequestPrivacyTests(SimpleTestCase):
    def test_django_request_hook_overwrites_url_query_and_client_address_attributes(self):
        span = Mock()
        environ = {
            "QUERY_STRING": "email=person@example.com",
            "REMOTE_ADDR": "203.0.113.42",
            "HTTP_X_FORWARDED_FOR": "2001:db8::1",
            "PATH_INFO": "/view/private-media-token",
        }

        sanitize_django_request_span(span, environ)

        attributes = dict(call.args for call in span.set_attribute.call_args_list)
        self.assertEqual(attributes["url.query"], "")
        for key in ("client.address", "http.client_ip", "http.target", "http.url", "net.peer.ip", "url.full"):
            self.assertEqual(attributes[key], "[redacted]")
        serialized = json.dumps(attributes).lower()
        self.assertNotIn("person@example.com", serialized)
        self.assertNotIn("203.0.113.42", serialized)
        self.assertNotIn("2001:db8::1", serialized)
        self.assertNotIn("private-media-token", serialized)


@override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})
class ErrorTrackingDiagnosticTests(SimpleTestCase):
    def tearDown(self):
        cache.clear()

    def request(self, *, method="post", token=None, remote_addr="127.0.0.1", **extra):
        factory = RequestFactory()
        request_method = getattr(factory, method)
        supplied_token = settings.ERROR_TRACKING_DIAGNOSTICS_TOKEN if token is None else token
        request_options = {
            "HTTP_AUTHORIZATION": f"Bearer {supplied_token}",
            "REMOTE_ADDR": remote_addr,
            **extra,
        }
        if method == "post":
            request_options.update(
                data=b"caller-controlled secret@example.com token=caller-secret",
                content_type="text/plain",
            )
        return request_method("/internal/observability/error-probe", **request_options)

    @override_settings(
        ERROR_TRACKING_DIAGNOSTICS_ENABLED=False,
        ERROR_TRACKING_DIAGNOSTICS_TOKEN="diagnostic-token",
        SENTRY_ENVIRONMENT="staging",
    )
    def test_disabled_diagnostic_is_not_discoverable(self):
        self.assertEqual(error_tracking_diagnostic(self.request()).status_code, 404)

    @override_settings(
        ERROR_TRACKING_DIAGNOSTICS_ENABLED=True,
        ERROR_TRACKING_DIAGNOSTICS_TOKEN="diagnostic-token",
        SENTRY_ENVIRONMENT="production",
    )
    def test_diagnostic_is_staging_only(self):
        self.assertEqual(error_tracking_diagnostic(self.request()).status_code, 404)

    @override_settings(
        ERROR_TRACKING_DIAGNOSTICS_ENABLED=True,
        ERROR_TRACKING_DIAGNOSTICS_TOKEN="diagnostic-token",
        SENTRY_ENVIRONMENT="staging",
    )
    def test_diagnostic_rejects_untrusted_forwarded_clients_wrong_methods_and_tokens(self):
        public = self.request(remote_addr="203.0.113.10")
        forwarded = self.request(HTTP_X_FORWARDED_FOR="203.0.113.10")
        get_request = self.request(method="get")
        wrong_token = self.request(token="wrong-token")

        self.assertEqual(error_tracking_diagnostic(public).status_code, 403)
        self.assertEqual(error_tracking_diagnostic(forwarded).status_code, 403)
        self.assertEqual(error_tracking_diagnostic(get_request).status_code, 405)
        self.assertEqual(error_tracking_diagnostic(wrong_token).status_code, 403)

    @override_settings(
        ERROR_TRACKING_DIAGNOSTICS_ENABLED=True,
        ERROR_TRACKING_DIAGNOSTICS_TOKEN="diagnostic-token",
        ERROR_TRACKING_DIAGNOSTICS_RATE_LIMIT=50,
        SENTRY_ENVIRONMENT="staging",
    )
    def test_authorized_diagnostic_raises_only_the_fixed_exception(self):
        for _ in range(50):
            with self.assertRaisesRegex(ErrorTrackingDiagnosticError, "staging error tracking diagnostic") as raised:
                error_tracking_diagnostic(self.request())
            self.assertNotIn("caller-secret", str(raised.exception))
            self.assertNotIn("secret@example.com", str(raised.exception))

        self.assertEqual(error_tracking_diagnostic(self.request()).status_code, 429)

    @override_settings(ERROR_TRACKING_DIAGNOSTICS_RATE_LIMIT=1)
    def test_diagnostic_rate_limit_fails_closed_when_cache_is_unavailable(self):
        with patch(
            "cms.urls.error_tracking_diagnostic_rate_cache.adapter._call",
            side_effect=RuntimeError("cache unavailable"),
        ):
            self.assertTrue(_error_tracking_diagnostic_rate_limited(self.request()))

    @override_settings(
        ERROR_TRACKING_DIAGNOSTICS_ENABLED=True,
        ERROR_TRACKING_DIAGNOSTICS_TOKEN="diagnostic-token",
        SENTRY_ENVIRONMENT="staging",
    )
    def test_diagnostic_audit_never_logs_credentials_or_body(self):
        with self.assertLogs("cms.observability.error_tracking", level="WARNING") as captured:
            response = error_tracking_diagnostic(self.request(token="wrong-token"))

        rendered = " ".join(captured.output)
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("wrong-token", rendered)
        self.assertNotIn("secret@example.com", rendered)
        self.assertNotIn("caller-secret", rendered)


class VerifyErrorTrackingCommandTests(SimpleTestCase):
    enabled_settings = override_settings(
        ERROR_TRACKING_DIAGNOSTICS_ENABLED=True,
        ERROR_TRACKING_DIAGNOSTICS_TOKEN="diagnostic-token",
        SENTRY_DSN="http://public@127.0.0.1:8001/1",
        SENTRY_ENVIRONMENT="staging",
    )

    @enabled_settings
    def test_command_posts_through_loopback_and_dispatches_fixed_celery_failure(self):
        output = StringIO()
        http_error = HTTPError(
            "http://127.0.0.1/internal/observability/error-probe",
            500,
            "Internal Server Error",
            {},
            None,
        )
        with (
            patch("files.management.commands.verify_error_tracking.urlopen", side_effect=http_error) as post,
            patch("files.management.commands.verify_error_tracking.add_two.delay") as dispatch,
        ):
            dispatch.return_value.id = "diagnostic-task-id"
            dispatch.return_value.get.return_value = TypeError("unsupported operand type(s) for +: 'int' and 'str'")
            call_command("verify_error_tracking", stdout=output)

        request = post.call_args.args[0]
        self.assertEqual(request.full_url, "http://127.0.0.1/internal/observability/error-probe")
        self.assertEqual(request.method, "POST")
        self.assertEqual(request.headers["Authorization"], "Bearer diagnostic-token")
        self.assertEqual(request.data, b"")
        dispatch.assert_called_once_with(1, "diagnostic")
        dispatch.return_value.get.assert_called_once_with(timeout=60, propagate=False)
        self.assertIn("web_requests=1", output.getvalue())
        self.assertIn("celery_task_id=diagnostic-task-id", output.getvalue())
        self.assertNotIn("diagnostic-token", output.getvalue())

    @enabled_settings
    def test_command_rejects_celery_success_timeout_and_unexpected_failure(self):
        http_error = HTTPError(
            "http://127.0.0.1/internal/observability/error-probe",
            500,
            "Internal Server Error",
            {},
            None,
        )
        cases = (
            ("success", 3, None, "unexpectedly succeeded"),
            ("timeout", None, CeleryTimeoutError(), "timed out"),
            ("unexpected failure", RuntimeError("diagnostic boom"), None, "unexpected RuntimeError"),
        )

        for name, result, side_effect, expected_message in cases:
            with self.subTest(name=name):
                with (
                    patch("files.management.commands.verify_error_tracking.urlopen", side_effect=http_error),
                    patch("files.management.commands.verify_error_tracking.add_two.delay") as dispatch,
                ):
                    dispatch.return_value.get.return_value = result
                    dispatch.return_value.get.side_effect = side_effect
                    with self.assertRaisesRegex(CommandError, expected_message):
                        call_command("verify_error_tracking")

    @enabled_settings
    def test_command_caps_repeat_at_fifty(self):
        with self.assertRaisesRegex(CommandError, "between 1 and 50"):
            call_command("verify_error_tracking", repeat=51)

    def test_command_refuses_disabled_non_staging_or_unconfigured_use(self):
        configurations = (
            {
                "ERROR_TRACKING_DIAGNOSTICS_ENABLED": False,
                "ERROR_TRACKING_DIAGNOSTICS_TOKEN": "diagnostic-token",
                "SENTRY_DSN": "http://public@127.0.0.1:8001/1",
                "SENTRY_ENVIRONMENT": "staging",
            },
            {
                "ERROR_TRACKING_DIAGNOSTICS_ENABLED": True,
                "ERROR_TRACKING_DIAGNOSTICS_TOKEN": "diagnostic-token",
                "SENTRY_DSN": "http://public@127.0.0.1:8001/1",
                "SENTRY_ENVIRONMENT": "production",
            },
            {
                "ERROR_TRACKING_DIAGNOSTICS_ENABLED": True,
                "ERROR_TRACKING_DIAGNOSTICS_TOKEN": "",
                "SENTRY_DSN": "",
                "SENTRY_ENVIRONMENT": "staging",
            },
        )
        for configuration in configurations:
            with self.subTest(configuration=configuration), override_settings(**configuration):
                with self.assertRaises(CommandError):
                    call_command("verify_error_tracking")

    @enabled_settings
    def test_command_rejects_non_500_responses(self):
        with (
            patch("files.management.commands.verify_error_tracking.urlopen") as post,
            patch("files.management.commands.verify_error_tracking.add_two.delay"),
        ):
            post.return_value.__enter__.return_value.status = 204
            with self.assertRaisesRegex(CommandError, "expected HTTP 500"):
                call_command("verify_error_tracking")


class ManualCaptureCoverageTests(SimpleTestCase):
    def test_broad_logged_exceptions_are_captured_or_reraised(self):
        project_root = Path(__file__).resolve().parents[2]
        missing = []
        for package in ("cms", "email_delivery", "files", "notifications", "uploader", "users"):
            for source_path in (project_root / package).rglob("*.py"):
                if "tests" in source_path.parts or "migrations" in source_path.parts:
                    continue
                tree = ast.parse(source_path.read_text(encoding="utf-8"))
                for handler in (node for node in ast.walk(tree) if isinstance(node, ast.ExceptHandler)):
                    if not isinstance(handler.type, ast.Name) or handler.type.id != "Exception":
                        continue
                    calls = [
                        node for statement in handler.body for node in ast.walk(statement) if isinstance(node, ast.Call)
                    ]
                    logs_exception = any(
                        isinstance(call.func, ast.Attribute)
                        and isinstance(call.func.value, ast.Name)
                        and call.func.value.id.endswith("logger")
                        and (
                            call.func.attr == "exception"
                            or (
                                call.func.attr == "error"
                                and any(
                                    keyword.arg == "exc_info"
                                    and isinstance(keyword.value, ast.Constant)
                                    and keyword.value.value is True
                                    for keyword in call.keywords
                                )
                            )
                        )
                        for call in calls
                    )
                    captures = any(
                        isinstance(call.func, ast.Name) and call.func.id == "capture_unexpected_exception"
                        for call in calls
                    )
                    reraises = any(
                        isinstance(node, ast.Raise) for statement in handler.body for node in ast.walk(statement)
                    )
                    if logs_exception and not captures and not reraises:
                        missing.append(f"{source_path.relative_to(project_root)}:{handler.lineno}")

        self.assertEqual(missing, [], f"Broad swallowed exceptions need explicit capture: {missing}")
