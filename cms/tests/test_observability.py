import logging
from contextlib import contextmanager
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock, call, patch

from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase, override_settings

from cms.observability import OpenTelemetryLogFilter, inject_trace_headers
from cms.observability_middleware import ObservabilityMetricsMiddleware
from cms.urls import metrics_view
from files.metrics import classify_endpoint_group


class ObservabilityConfigTests(SimpleTestCase):
    @override_settings(OTEL_ENABLED=False)
    def test_trace_header_injection_is_noop_when_disabled(self):
        headers = inject_trace_headers({"enqueued_at": 123})
        self.assertEqual(headers, {"enqueued_at": 123})

    @override_settings(OTEL_ENABLED=False)
    def test_log_filter_adds_empty_trace_fields_when_disabled(self):
        record = logging.LogRecord("test", logging.INFO, __file__, 1, "msg", (), None)
        self.assertTrue(OpenTelemetryLogFilter().filter(record))
        self.assertEqual(record.trace_id, "")
        self.assertEqual(record.span_id, "")


class EndpointGroupingTests(SimpleTestCase):
    def test_endpoint_grouping_uses_low_cardinality_labels(self):
        cases = {
            "/metrics": "system",
            "/health/ready": "system",
            "/api/v1/search?q=abc": "api_search",
            "/api/v1/media/abc123": "api_media",
            "/api/v1/manage_media": "api_manage",
            "/manage/media": "api_manage",
            "/fu/upload/": "uploads",
            "/upload": "uploads",
            "/media/original/video.mp4": "media_serve",
            "/api/v1/users": "api_other",
            "/some-page": "pages",
        }
        for path, expected in cases.items():
            with self.subTest(path=path):
                self.assertEqual(classify_endpoint_group(path), expected)


class ObservabilityMiddlewareTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    @contextmanager
    def _fake_execute_wrapper(self):
        yield

    @override_settings(OBSERVABILITY_SLOW_REQUEST_SECONDS=0)
    def test_middleware_records_request_without_raw_path_label(self):
        request = self.factory.get("/api/v1/media/sensitive-token")
        response = HttpResponse("ok", status=201)

        with (
            patch("cms.observability_middleware.connection.execute_wrapper", return_value=self._fake_execute_wrapper()),
            patch("cms.observability_middleware.HTTP_REQUESTS_TOTAL") as requests_total,
            patch("cms.observability_middleware.HTTP_REQUEST_DURATION_SECONDS") as duration,
            patch("cms.observability_middleware.SLOW_REQUESTS_TOTAL") as slow_requests,
        ):
            requests_total.labels.return_value.inc = Mock()
            duration.labels.return_value.observe = Mock()
            slow_requests.labels.return_value.inc = Mock()

            result = ObservabilityMetricsMiddleware(lambda _request: response)(request)

        self.assertIs(result, response)
        requests_total.labels.assert_called_once_with(endpoint_group="api_media", method="GET", status_class="2xx")
        duration.labels.assert_called_once_with(endpoint_group="api_media", method="GET", status_class="2xx")
        slow_requests.labels.assert_called_once_with(endpoint_group="api_media", method="GET")


class MetricsViewTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_metrics_view_refreshes_runtime_metrics_for_localhost(self):
        request = self.factory.get("/metrics", REMOTE_ADDR="127.0.0.1")
        with (
            patch("cms.urls.refresh_runtime_metrics") as refresh,
            patch("cms.urls.generate_latest", return_value=b"metric 1\n"),
        ):
            response = metrics_view(request)

        self.assertEqual(response.status_code, 200)
        refresh.assert_called_once_with()
        self.assertEqual(response.content, b"metric 1\n")

    def test_metrics_view_forbids_external_anonymous_client(self):
        request = self.factory.get("/metrics", REMOTE_ADDR="203.0.113.10")
        with patch("cms.urls.refresh_runtime_metrics") as refresh:
            response = metrics_view(request)

        self.assertEqual(response.status_code, 403)
        refresh.assert_not_called()


class CacheMetricTests(SimpleTestCase):
    def test_permission_cache_miss_is_recorded(self):
        from files import cache_utils

        with (
            patch.object(cache_utils.cache, "get", return_value=None),
            patch("files.cache_utils.record_cache_operation") as record,
        ):
            self.assertIsNone(cache_utils.get_cached_permission("permission-key"))

        record.assert_called_once_with("permission", "get", hit=False)

    def test_query_cache_hit_is_recorded(self):
        from files import query_cache

        with (
            patch.object(query_cache.cache, "get", return_value={"ok": True}),
            patch("files.query_cache.record_cache_operation") as record,
        ):
            self.assertEqual(query_cache.get_cached_result("query-key"), {"ok": True})

        record.assert_called_once_with("query", "get", hit=True)


class CeleryAndMediaMetricTests(SimpleTestCase):
    def test_celery_task_signal_helpers_record_lifecycle(self):
        from files import metrics

        sender = SimpleNamespace(name="encode_media")
        with (
            patch("files.metrics.CELERY_TASKS_TOTAL") as task_total,
            patch("files.metrics.CELERY_TASK_ACTIVE") as task_active,
            patch("files.metrics.CELERY_TASK_DURATION_SECONDS") as duration,
        ):
            task_total.labels.return_value.inc = Mock()
            task_active.labels.return_value.inc = Mock()
            task_active.labels.return_value.dec = Mock()
            duration.labels.return_value.observe = Mock()

            metrics._task_start_times.clear()
            metrics._on_task_prerun(sender=sender, task_id="task-1")
            metrics._on_task_postrun(sender=sender, task_id="task-1", state="SUCCESS")

        task_total.labels.assert_any_call(task_name="encode_media", state="started")
        task_total.labels.assert_any_call(task_name="encode_media", state="success")
        task_active.labels.assert_called_with(task_name="encode_media")
        duration.labels.assert_called_once_with(task_name="encode_media")

    def test_media_pipeline_observation_uses_low_cardinality_profile_labels(self):
        from files.metrics import observe_media_pipeline

        media = SimpleNamespace(media_type="video", duration=120, media_file=SimpleNamespace(size=123456))
        profile = SimpleNamespace(resolution=720, codec="h264", extension="mp4")
        with (
            patch("files.metrics.MEDIA_ENCODING_PROFILE_TOTAL") as profile_total,
            patch("files.metrics.MEDIA_DURATION_SECONDS") as duration,
            patch("files.metrics.MEDIA_FILE_SIZE_BYTES") as file_size,
        ):
            profile_total.labels.return_value.inc = Mock()
            duration.labels.return_value.observe = Mock()
            file_size.labels.return_value.observe = Mock()

            observe_media_pipeline(media, profile, "success")

        profile_total.labels.assert_called_once_with(
            resolution="720",
            codec="h264",
            extension="mp4",
            status="success",
        )
        duration.labels.assert_called_once_with(media_type="video")
        duration.labels.return_value.observe.assert_called_once_with(120)
        file_size.labels.assert_called_once_with(media_type="video")
        file_size.labels.return_value.observe.assert_called_once_with(123456)

    @override_settings(RUNNING_STATE_STALE=10)
    def test_stalled_encoding_refresh_resets_disappeared_labelsets(self):
        from files import metrics

        metrics._stalled_encoding_label_values.clear()
        metrics._stalled_encoding_label_values.add(("720", "h264", "mp4"))
        encoding = SimpleNamespace(
            update_date=datetime.fromtimestamp(80, tz=timezone.utc),
            profile=SimpleNamespace(resolution=1080, codec="h265", extension="webm"),
        )
        queryset = Mock()
        queryset.select_related.return_value = [encoding]

        try:
            with (
                patch("files.models.Encoding") as Encoding,
                patch("files.metrics.time.time", return_value=100),
                patch("files.metrics.ENCODING_STALLED") as stalled,
            ):
                stalled.labels.return_value.set = Mock()
                Encoding.objects.filter.return_value = queryset

                metrics._refresh_stalled_encodings()

            stalled.labels.assert_has_calls(
                [
                    call(resolution="1080", codec="h265", extension="webm"),
                    call(resolution="720", codec="h264", extension="mp4"),
                ],
                any_order=True,
            )
            stalled.labels.return_value.set.assert_has_calls([call(1), call(0)], any_order=True)
            self.assertEqual(metrics._stalled_encoding_label_values, {("1080", "h265", "webm")})
        finally:
            metrics._stalled_encoding_label_values.clear()
