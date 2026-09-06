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
