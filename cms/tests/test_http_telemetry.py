import logging
from types import SimpleNamespace
from unittest.mock import patch

from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase, override_settings
from django.urls import URLResolver, get_resolver

from cms.http_telemetry import (
    HTTP_ROUTE_METHODS,
    ROUTE_OPERATION_REGISTRY,
    classify_request,
    route_identity,
)
from cms.observability import OpenTelemetryLogFilter, actor_reference_context
from cms.observability_middleware import ObservabilityMetricsMiddleware

OWNED_MODULE_PREFIXES = ("cms.", "files.", "notifications.", "uploader.", "users.")


def _owned_route_identities(patterns, prefix="", namespace=""):
    for pattern in patterns:
        route = getattr(pattern.pattern, "_route", None)
        if route is None:
            route = pattern.pattern.regex.pattern
        if isinstance(pattern, URLResolver):
            child_namespace = namespace + (":" if namespace else "") + (pattern.namespace or "")
            yield from _owned_route_identities(pattern.url_patterns, prefix + route, child_namespace)
            continue

        callback = pattern.callback
        module = getattr(callback, "__module__", "") or ""
        if module.startswith(OWNED_MODULE_PREFIXES):
            yield SimpleNamespace(
                namespace=namespace,
                url_name=pattern.name,
                route=prefix + route,
            )


class HttpRouteRegistryTests(SimpleTestCase):
    def test_every_owned_urlconf_route_has_all_bounded_method_entries(self):
        missing = []
        for match in _owned_route_identities(get_resolver().url_patterns):
            for method in HTTP_ROUTE_METHODS:
                key = (*route_identity(match), method)
                if key not in ROUTE_OPERATION_REGISTRY:
                    missing.append(key)

        self.assertEqual(missing, [])

    def test_registry_is_keyed_by_resolved_route_and_method(self):
        get_match = SimpleNamespace(
            namespace="",
            url_name=None,
            route="api/v1/media",
        )
        post_match = SimpleNamespace(
            namespace="",
            url_name=None,
            route="api/v1/media",
        )

        self.assertEqual(
            classify_request(SimpleNamespace(resolver_match=get_match, method="GET")), ("media_api", "media_list")
        )
        self.assertEqual(
            classify_request(SimpleNamespace(resolver_match=post_match, method="POST")),
            ("upload_transfer", "upload_transfer"),
        )

    def test_resolved_method_not_allowed_keeps_route_operation(self):
        request = SimpleNamespace(
            method="DELETE",
            resolver_match=SimpleNamespace(
                namespace="",
                url_name="notification-list",
                route="api/v1/notifications/",
            ),
        )

        self.assertEqual(classify_request(request), ("notifications_api", "notifications_list"))

    def test_unmatched_and_third_party_routes_are_separate(self):
        self.assertEqual(
            classify_request(SimpleNamespace(method="GET", resolver_match=None)), ("unmatched", "not_found")
        )
        third_party = SimpleNamespace(
            method="GET",
            resolver_match=SimpleNamespace(
                namespace="admin",
                url_name="index",
                route="admin/",
            ),
        )
        self.assertEqual(classify_request(third_party), ("third_party", "third_party"))


class HttpMiddlewareTelemetryTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    @override_settings(OBSERVABILITY_SLOW_REQUEST_SECONDS=0.01)
    def test_slow_and_failed_requests_emit_structured_events_without_raw_path(self):
        request = self.factory.get("/api/v1/media/private-secret-token")
        request.resolver_match = SimpleNamespace(
            namespace="",
            url_name="api_get_media",
            route="^api/v1/media/(?P<friendly_token>[\\w]+(-[\\w]+)*)$",
        )
        response = HttpResponse(status=500)

        with (
            patch("cms.observability_middleware.time.monotonic", side_effect=[0.0, 1.0]),
            patch("cms.observability_middleware.HTTP_REQUESTS_TOTAL") as requests_total,
            patch("cms.observability_middleware.HTTP_REQUEST_DURATION_SECONDS") as duration,
            patch("cms.observability_middleware.logger.warning") as warning,
        ):
            ObservabilityMetricsMiddleware(lambda _request: response)(request)

        events = [call.args[0] for call in warning.call_args_list]
        self.assertIn("cinematacms.http.request.failed", events)
        self.assertNotIn("/api/v1/media/private-secret-token", repr(warning.call_args_list))
        requests_total.labels.assert_called_once_with(
            route_group="media_api",
            operation="media_detail",
            method="GET",
            status_code="500",
        )
        duration.labels.assert_called_once_with(
            route_group="media_api",
            operation="media_detail",
            method="GET",
            status_class="5xx",
        )

    def test_metric_failure_does_not_replace_original_exception(self):
        request = self.factory.get("/health/live")
        request.resolver_match = SimpleNamespace(namespace="", url_name=None, route="health/live")
        original = RuntimeError("application failure")

        with (
            patch("cms.observability_middleware.HTTP_REQUESTS_TOTAL.labels", side_effect=RuntimeError("metrics down")),
            patch("cms.observability_middleware.record_telemetry_failure") as failure,
        ):
            with self.assertRaisesRegex(RuntimeError, "application failure"):
                ObservabilityMetricsMiddleware(lambda _request: (_ for _ in ()).throw(original))(request)

        failure.assert_called_once_with("metrics", "http", "emit")


class _RecordCollector(logging.Handler):
    def __init__(self):
        super().__init__()
        self.records = []
        self.addFilter(OpenTelemetryLogFilter())

    def emit(self, record):
        self.records.append(record)


class UploadDenialLogTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()
        self.collector = _RecordCollector()
        middleware_logger = logging.getLogger("cms.observability_middleware")
        middleware_logger.addHandler(self.collector)
        self.addCleanup(middleware_logger.removeHandler, self.collector)

    def _upload_request(self, *, authenticated):
        request = self.factory.post(
            "/fu/upload/?qquuid=private-upload-id",
            HTTP_COOKIE="sessionid=private-session-cookie",
            REMOTE_ADDR="203.0.113.9",
        )
        request.resolver_match = SimpleNamespace(namespace="uploader", url_name="upload", route="fu/upload/")
        request.user = SimpleNamespace(is_authenticated=authenticated, email="person@example.org")
        return request

    def _denied(self):
        return [r for r in self.collector.records if r.getMessage() == "cinematacms.http.request.denied"]

    def _run(self, status_code, *, authenticated, actor_ref=""):
        request = self._upload_request(authenticated=authenticated)
        with actor_reference_context(actor_ref):
            ObservabilityMetricsMiddleware(lambda _request: HttpResponse(status=status_code))(request)

    def test_anonymous_403_logs_missing_credentials_without_actor(self):
        self._run(403, authenticated=False)

        (record,) = self._denied()
        self.assertEqual(record.reason_code, "missing_credentials")
        self.assertEqual(record.status_code, "403")
        self.assertEqual(record.route_group, "upload_transfer")
        self.assertEqual(record.operation, "upload_transfer")
        self.assertEqual(record.method, "POST")
        self.assertEqual(record.actor_ref, "")
        self.assertTrue(hasattr(record, "trace_id"))

    def test_authenticated_403_carries_actor_ref_and_forbidden_reason(self):
        self._run(403, authenticated=True, actor_ref="v1:" + "a" * 64)

        (record,) = self._denied()
        self.assertEqual(record.reason_code, "forbidden")
        self.assertEqual(record.actor_ref, "v1:" + "a" * 64)

    def test_other_upload_client_errors_use_bounded_reason_codes(self):
        expected = {400: "bad_request", 413: "payload_too_large", 429: "rate_limited", 418: "other"}
        for status_code, reason_code in expected.items():
            with self.subTest(status_code=status_code):
                self.collector.records.clear()
                self._run(status_code, authenticated=True)
                (record,) = self._denied()
                self.assertEqual(record.reason_code, reason_code)
                self.assertEqual(record.status_code, str(status_code))

    def test_denial_log_never_contains_request_secrets(self):
        self._run(403, authenticated=True, actor_ref="v1:" + "b" * 64)

        (record,) = self._denied()
        serialized = repr(vars(record))
        for secret in (
            "person@example.org",
            "203.0.113.9",
            "private-session-cookie",
            "private-upload-id",
            "/fu/upload",
        ):
            self.assertNotIn(secret, serialized)

    def test_successful_chunks_and_other_routes_are_not_logged_as_denied(self):
        self._run(200, authenticated=True)
        other = self.factory.get("/api/v1/media/private-secret-token")
        other.resolver_match = SimpleNamespace(
            namespace="", url_name="api_get_media", route="^api/v1/media/(?P<friendly_token>[\\w]+(-[\\w]+)*)$"
        )
        other.user = SimpleNamespace(is_authenticated=False, email="")
        ObservabilityMetricsMiddleware(lambda _request: HttpResponse(status=403))(other)

        self.assertEqual(self._denied(), [])
