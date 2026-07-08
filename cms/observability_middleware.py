import time

from django.conf import settings
from django.db import connection

from files.metrics import (
    HTTP_REQUEST_DURATION_SECONDS,
    HTTP_REQUESTS_TOTAL,
    SLOW_DB_QUERIES_TOTAL,
    SLOW_REQUESTS_TOTAL,
    classify_endpoint_group,
)


class ObservabilityMetricsMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        start = time.monotonic()
        endpoint_group = classify_endpoint_group(request.path)
        slow_query_count = 0

        def execute_wrapper(execute, sql, params, many, context):
            nonlocal slow_query_count
            query_start = time.monotonic()
            try:
                return execute(sql, params, many, context)
            finally:
                duration = time.monotonic() - query_start
                if duration >= getattr(settings, "OBSERVABILITY_SLOW_QUERY_SECONDS", 1.0):
                    slow_query_count += 1

        try:
            with connection.execute_wrapper(execute_wrapper):
                response = self.get_response(request)
        except Exception:
            duration = time.monotonic() - start
            self._record(request, endpoint_group, 500, duration, slow_query_count)
            raise

        duration = time.monotonic() - start
        self._record(request, endpoint_group, response.status_code, duration, slow_query_count)
        return response

    def _record(self, request, endpoint_group, status_code, duration, slow_query_count):
        method = request.method.upper()
        status_class = f"{status_code // 100}xx"
        HTTP_REQUESTS_TOTAL.labels(endpoint_group=endpoint_group, method=method, status_class=status_class).inc()
        HTTP_REQUEST_DURATION_SECONDS.labels(
            endpoint_group=endpoint_group,
            method=method,
            status_class=status_class,
        ).observe(duration)
        if duration >= getattr(settings, "OBSERVABILITY_SLOW_REQUEST_SECONDS", 2.0):
            SLOW_REQUESTS_TOTAL.labels(endpoint_group=endpoint_group, method=method).inc()
        if slow_query_count:
            SLOW_DB_QUERIES_TOTAL.labels(endpoint_group=endpoint_group).inc(slow_query_count)
