import logging
from contextlib import contextmanager
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock, call, patch

from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase, override_settings

from cms.observability import (
    OpenTelemetryLogFilter,
    OperationAwareSampler,
    SafeSpanExporter,
    inject_trace_headers,
    start_span,
)
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

    def test_worker_process_initialization_resets_inherited_state(self):
        from cms import observability

        observability._tracer_configured = True
        observability._celery_instrumented = True
        with patch("cms.observability.configure_celery_observability") as configure:
            observability.configure_celery_worker_process()
        self.assertFalse(observability._tracer_configured)
        self.assertFalse(observability._celery_instrumented)
        configure.assert_called_once_with()

    @override_settings(OTEL_ENABLED=True)
    def test_span_filter_keeps_receipt_refs_and_drops_sensitive_content(self):
        span = Mock()
        context = Mock()
        context.__enter__ = Mock(return_value=span)
        context.__exit__ = Mock(return_value=False)
        tracer = Mock()
        tracer.start_as_current_span.return_value = context
        with patch("cms.observability.get_tracer", return_value=tracer):
            with start_span(
                "privacy",
                {
                    "email.recipient_ref": "v1:opaque",
                    "request.authorization": "secret",
                    "media.filename": "private.mp4",
                },
            ):
                pass
        span.set_attribute.assert_called_once_with("email.recipient_ref", "v1:opaque")

    def test_export_failure_is_reported_without_raising(self):
        from opentelemetry.sdk.trace.export import SpanExportResult

        exporter = Mock()
        exporter.export.side_effect = RuntimeError("collector unavailable")
        with patch("cms.observability.TELEMETRY_EXPORT_FAILURES_TOTAL") as failures:
            failures.labels.return_value.inc = Mock()
            result = SafeSpanExporter(exporter).export([])
        self.assertEqual(result, SpanExportResult.FAILURE)
        failures.labels.assert_called_once_with(signal="traces")

    def test_priority_operations_can_sample_above_ordinary_web_requests(self):
        from opentelemetry.sdk.trace.sampling import Decision

        sampler = OperationAwareSampler(default_ratio=0, priority_ratio=1)
        self.assertEqual(sampler.should_sample(None, 1, "GET /about").decision, Decision.DROP)
        self.assertEqual(sampler.should_sample(None, 1, "email.delivery").decision, Decision.RECORD_AND_SAMPLE)


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


class MetricFailureIsolationTests(SimpleTestCase):
    def test_cache_fallback_survives_metric_failure(self):
        from files import cache_utils

        with (
            patch.object(cache_utils.cache, "get", return_value=True),
            patch("files.metrics.CACHE_OPERATIONS_TOTAL.labels", side_effect=RuntimeError("metrics unavailable")),
        ):
            self.assertTrue(cache_utils.get_cached_permission("permission-key"))

    def test_media_observation_survives_profile_metric_failure(self):
        from files.metrics import observe_media_pipeline

        media = SimpleNamespace(media_type="video", duration=120, media_file=SimpleNamespace(size=123456))
        profile = SimpleNamespace(resolution=720, codec="h264", extension="mp4")
        with (
            patch("files.metrics.MEDIA_ENCODING_PROFILE_TOTAL.labels", side_effect=RuntimeError("metrics unavailable")),
            patch("files.metrics.MEDIA_DURATION_SECONDS") as duration,
            patch("files.metrics.MEDIA_FILE_SIZE_BYTES") as file_size,
        ):
            duration.labels.return_value.observe = Mock()
            file_size.labels.return_value.observe = Mock()

            observe_media_pipeline(media, profile, "success")

        duration.labels.return_value.observe.assert_called_once_with(120)
        file_size.labels.return_value.observe.assert_called_once_with(123456)

    def test_stale_encoding_recovery_survives_metric_failure(self):
        from files.metrics import record_stale_encoding

        encoding = SimpleNamespace(
            profile=SimpleNamespace(resolution=720, codec="h264", extension="mp4"),
        )
        with patch("files.metrics.ENCODING_STALE_TOTAL.labels", side_effect=RuntimeError("metrics unavailable")):
            record_stale_encoding(encoding)


class RuntimeGaugeTests(SimpleTestCase):
    def test_runtime_snapshot_gauges_use_mostrecent_multiprocess_mode(self):
        from files import metrics

        snapshot_gauges = {
            "celery queue depth": metrics.CELERY_QUEUE_DEPTH,
            "transcription database staleness": metrics.TRANSCRIPTION_REQUESTS,
            "stalled encodings": metrics.ENCODING_STALLED,
        }
        for name, gauge in snapshot_gauges.items():
            with self.subTest(metric=name):
                self.assertEqual(gauge._multiprocess_mode, "mostrecent")


class CeleryAndMediaMetricTests(SimpleTestCase):
    def test_celery_task_signal_helpers_record_lifecycle(self):
        from files import metrics

        sender = SimpleNamespace(
            name="encode_media", request=SimpleNamespace(delivery_info={"routing_key": "long_tasks"})
        )
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

        task_total.labels.assert_any_call(task_name="encode_media", queue="long_tasks", state="started")
        task_total.labels.assert_any_call(task_name="encode_media", queue="long_tasks", state="succeeded")
        task_active.labels.assert_called_with(task_name="encode_media", queue="long_tasks")
        duration.labels.assert_called_once_with(task_name="encode_media", queue="long_tasks")

    def test_queue_normalization_and_terminal_states_are_bounded(self):
        from files import metrics

        unknown = SimpleNamespace(name="custom", request=SimpleNamespace(delivery_info={"routing_key": "tenant-42"}))
        self.assertEqual(metrics.normalize_queue(sender=unknown), "default")
        with patch("files.metrics.CELERY_TASKS_TOTAL") as task_total:
            task_total.labels.return_value.inc = Mock()
            metrics._on_task_failure(sender=unknown, task_id="failed-1")
            metrics._on_task_retry(sender=unknown, request=SimpleNamespace(id="retry-1"))
            metrics._on_task_revoked(sender=unknown, request=SimpleNamespace(id="revoked-1"))
        states = {call.kwargs["state"] for call in task_total.labels.call_args_list}
        self.assertEqual(states, {"failed", "retried", "revoked"})

    def test_domain_outcome_rejects_unbounded_state(self):
        from files.metrics import record_domain_outcome

        with self.assertRaises(ValueError):
            record_domain_outcome("encoding", "user-supplied")

    def test_returned_domain_failure_is_separate_from_celery_success(self):
        from files import metrics

        sender = SimpleNamespace(
            name="chunkize_media", request=SimpleNamespace(delivery_info={"routing_key": "short_tasks"})
        )
        with (
            patch("files.metrics.CELERY_TASKS_TOTAL") as task_total,
            patch("files.metrics.CELERY_TASK_ACTIVE"),
            patch("files.metrics.record_domain_outcome") as domain,
        ):
            task_total.labels.return_value.inc = Mock()
            metrics._on_task_postrun(sender=sender, task_id="domain-failure", state="SUCCESS", retval=False)
        task_total.labels.assert_called_with(task_name="chunkize_media", queue="short_tasks", state="succeeded")
        domain.assert_called_once_with("chunking", "failed", "returned_false")

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
            outcome="succeeded",
            reason_code="none",
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
