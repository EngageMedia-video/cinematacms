import logging
import time

from django.conf import settings
from django.urls import Resolver404, resolve

from cms.db_backend.telemetry import database_context
from cms.http_telemetry import classify_request, normalize_method, normalize_status_class, normalize_status_code
from files.metrics import HTTP_REQUEST_DURATION_SECONDS, HTTP_REQUESTS_TOTAL, record_telemetry_failure

logger = logging.getLogger(__name__)


class ObservabilityMetricsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.monotonic()
        if getattr(request, "resolver_match", None) is None:
            try:
                request.resolver_match = resolve(request.path_info)
            except Resolver404:
                request.resolver_match = None
        route_group, _operation = classify_request(request)
        try:
            with database_context("web", route_group):
                response = self.get_response(request)
        except Exception:
            duration = time.monotonic() - start
            self._record(request, 500, duration)
            raise

        duration = time.monotonic() - start
        self._record(request, response.status_code, duration)
        return response

    def _record(self, request, status_code, duration):
        route_group, operation = classify_request(request)
        method = normalize_method(request.method)
        labels = {"route_group": route_group, "operation": operation, "method": method}
        try:
            HTTP_REQUESTS_TOTAL.labels(**labels, status_code=normalize_status_code(status_code)).inc()
            HTTP_REQUEST_DURATION_SECONDS.labels(
                **labels,
                status_class=normalize_status_class(status_code),
            ).observe(duration)
        except Exception:
            record_telemetry_failure("metrics", "http", "emit")
            logger.warning(
                "cinematacms.telemetry.emission_failed",
                extra={"signal": "metrics", "component": "http", "stage": "emit"},
                exc_info=True,
            )
            return

        event_name = None
        if 500 <= status_code <= 599:
            event_name = "cinematacms.http.request.failed"
        elif duration >= getattr(settings, "OBSERVABILITY_SLOW_REQUEST_SECONDS", 2.0):
            event_name = "cinematacms.http.request.slow"
        if event_name:
            try:
                logger.warning(event_name, extra={**labels, "status_code": normalize_status_code(status_code)})
            except Exception:
                pass
