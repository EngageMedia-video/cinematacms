import logging
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock, call, patch

from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase, override_settings

from cms.http_telemetry import classify_request
from cms.observability import (
    OpenTelemetryLogFilter,
    OperationAwareSampler,
    SafeSpanExporter,
    _credentialed_endpoint_is_secure,
    inject_trace_headers,
    start_span,
)
from cms.observability_middleware import ObservabilityMetricsMiddleware
from cms.urls import metrics_view


class ObservabilityConfigTests(SimpleTestCase):
    @override_settings(
        OBSERVABILITY_SLOW_REQUEST_SECONDS=0.3,
        OBSERVABILITY_SLOW_QUERY_SECONDS=1.0,
        OBSERVABILITY_SLOW_CACHE_SECONDS=0.1,
    )
    def test_diagnostic_threshold_must_match_histogram_bucket(self):
        from files.metrics import validate_telemetry_settings

        with self.assertRaisesMessage(ValueError, "OBSERVABILITY_SLOW_REQUEST_SECONDS"):
            validate_telemetry_settings()

    def test_credentialed_otlp_endpoint_requires_https_or_loopback(self):
        headers = {"authorization": "secret"}
        self.assertFalse(_credentialed_endpoint_is_secure("http://collector.internal:4318/v1/traces", headers))
        self.assertTrue(_credentialed_endpoint_is_secure("https://collector.internal:4318/v1/traces", headers))
        self.assertTrue(_credentialed_endpoint_is_secure("http://127.0.0.1:4318/v1/traces", headers))
        self.assertTrue(_credentialed_endpoint_is_secure("http://[::1]:4318/v1/traces", headers))
        self.assertTrue(_credentialed_endpoint_is_secure("http://localhost:4318/v1/traces", headers))
        self.assertTrue(_credentialed_endpoint_is_secure("http://collector.internal:4318/v1/traces", None))

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
        observability._redis_instrumented = True
        observability._requests_instrumented = True
        with patch("cms.observability.configure_celery_observability") as configure:
            observability.configure_celery_worker_process()
        self.assertFalse(observability._tracer_configured)
        self.assertFalse(observability._celery_instrumented)
        self.assertFalse(observability._redis_instrumented)
        self.assertFalse(observability._requests_instrumented)
        configure.assert_called_once_with()

    @override_settings(OTEL_ENABLED=True)
    def test_celery_child_instruments_redis_and_outbound_http_without_psycopg2(self):
        from cms import observability

        observability._celery_instrumented = False
        observability._redis_instrumented = False
        observability._requests_instrumented = False
        with (
            patch("cms.observability._configure_tracer_provider", return_value=True),
            patch("opentelemetry.instrumentation.celery.CeleryInstrumentor.instrument") as celery,
            patch("opentelemetry.instrumentation.redis.RedisInstrumentor.instrument") as redis,
            patch("opentelemetry.instrumentation.requests.RequestsInstrumentor.instrument") as requests,
            patch("opentelemetry.instrumentation.psycopg2.Psycopg2Instrumentor.instrument") as psycopg2,
        ):
            observability.configure_celery_observability()

        celery.assert_called_once_with()
        redis.assert_called_once_with()
        requests.assert_called_once_with()
        psycopg2.assert_not_called()

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

    @override_settings(OTEL_ENABLED=True)
    def test_span_start_failure_does_not_change_application_behavior(self):
        tracer = Mock()
        tracer.start_as_current_span.side_effect = RuntimeError("tracer unavailable")
        with (
            patch("cms.observability.get_tracer", return_value=tracer),
            patch("files.metrics.record_telemetry_failure") as failure,
        ):
            with start_span("safe.operation", {"token": "secret"}) as span:
                result = "application-result"

        self.assertIsNone(span)
        self.assertEqual(result, "application-result")
        failure.assert_called_once_with("traces", "span", "start")

    def test_export_failure_is_reported_without_raising(self):
        from opentelemetry.sdk.trace.export import SpanExportResult

        exporter = Mock()
        exporter.export.side_effect = RuntimeError("collector unavailable")
        with patch("files.metrics.record_telemetry_failure") as failures:
            result = SafeSpanExporter(exporter).export([])
        self.assertEqual(result, SpanExportResult.FAILURE)
        failures.assert_called_once_with("traces", "exporter", "export")

    def test_priority_operations_can_sample_above_ordinary_web_requests(self):
        from opentelemetry.sdk.trace.sampling import Decision

        sampler = OperationAwareSampler(default_ratio=0, priority_ratio=1)
        self.assertEqual(sampler.should_sample(None, 1, "GET /about").decision, Decision.DROP)
        self.assertEqual(sampler.should_sample(None, 1, "email.delivery").decision, Decision.RECORD_AND_SAMPLE)


class EndpointGroupingTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_endpoint_grouping_uses_resolved_operation_not_raw_path(self):
        request = self.factory.get("/ignored-sensitive-value")
        request.resolver_match = SimpleNamespace(
            url_name="api_get_media",
            namespace="",
            func=SimpleNamespace(__module__="files.views"),
            route="^api/v1/media/(?P<friendly_token>[\\w]+(-[\\w]+)*)$",
        )

        self.assertEqual(classify_request(request), ("media_api", "media_detail"))

    def test_unresolved_request_has_dedicated_operation(self):
        request = self.factory.get("/missing-sensitive-value")
        request.resolver_match = None

        self.assertEqual(classify_request(request), ("unmatched", "not_found"))

    def test_third_party_request_is_separate_from_application_routes(self):
        request = self.factory.post("/ignored-sensitive-value")
        request.resolver_match = SimpleNamespace(
            url_name="login",
            namespace="rest_framework",
            func=SimpleNamespace(__module__="django.contrib.auth.views"),
            route="api-auth/login/",
        )

        self.assertEqual(classify_request(request), ("third_party", "third_party"))


class ObservabilityMiddlewareTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_middleware_records_request_without_raw_path_label(self):
        request = self.factory.get("/api/v1/media/sensitive-token")
        request.resolver_match = SimpleNamespace(
            url_name="api_get_media",
            namespace="",
            func=SimpleNamespace(__module__="files.views"),
            route="^api/v1/media/(?P<friendly_token>[\\w]+(-[\\w]+)*)$",
        )
        response = HttpResponse("ok", status=201)

        with (
            patch("cms.observability_middleware.HTTP_REQUESTS_TOTAL") as requests_total,
            patch("cms.observability_middleware.HTTP_REQUEST_DURATION_SECONDS") as duration,
        ):
            requests_total.labels.return_value.inc = Mock()
            duration.labels.return_value.observe = Mock()
            result = ObservabilityMetricsMiddleware(lambda _request: response)(request)

        self.assertIs(result, response)
        requests_total.labels.assert_called_once_with(
            route_group="media_api", operation="media_detail", method="GET", status_code="201"
        )
        duration.labels.assert_called_once_with(
            route_group="media_api", operation="media_detail", method="GET", status_class="2xx"
        )

    def test_metric_failure_cannot_change_successful_response(self):
        request = self.factory.get("/metrics")
        request.resolver_match = SimpleNamespace(
            url_name=None,
            namespace="",
            func=SimpleNamespace(__module__="cms.urls", __name__="metrics_view"),
            route="metrics",
        )
        response = HttpResponse("ok")
        with patch("cms.observability_middleware.HTTP_REQUESTS_TOTAL.labels", side_effect=RuntimeError("down")):
            result = ObservabilityMetricsMiddleware(lambda _request: response)(request)

        self.assertIs(result, response)

    def test_method_and_status_values_are_bounded(self):
        request = self.factory.generic("BREW", "/missing/path")
        request.resolver_match = None
        response = SimpleNamespace(status_code=700)
        with (
            patch("cms.observability_middleware.HTTP_REQUESTS_TOTAL") as requests_total,
            patch("cms.observability_middleware.HTTP_REQUEST_DURATION_SECONDS") as duration,
        ):
            ObservabilityMetricsMiddleware(lambda _request: response)(request)

        requests_total.labels.assert_called_once_with(
            route_group="unmatched", operation="not_found", method="OTHER", status_code="other"
        )
        duration.labels.assert_called_once_with(
            route_group="unmatched", operation="not_found", method="OTHER", status_class="other"
        )


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
        from cms import cache_telemetry
        from files import cache_utils

        with (
            patch.object(
                cache_telemetry.owned_cache.backend,
                "get",
                side_effect=lambda key, default=None, **kwargs: default,
            ),
            patch.object(cache_telemetry, "CACHE_OPERATIONS_TOTAL") as operations,
        ):
            self.assertIsNone(cache_utils.get_cached_permission("permission-key"))

        operations.labels.assert_called_once_with(family="permission", operation="read", result="miss")

    def test_query_cache_hit_is_recorded(self):
        from cms import cache_telemetry
        from files import query_cache

        with (
            patch.object(cache_telemetry.owned_cache.backend, "get", return_value={"ok": True}),
            patch.object(cache_telemetry, "CACHE_OPERATIONS_TOTAL") as operations,
        ):
            self.assertEqual(query_cache.get_cached_result("query-key"), {"ok": True})

        operations.labels.assert_called_once_with(family="query", operation="read", result="hit")


class MetricFailureIsolationTests(SimpleTestCase):
    def test_telemetry_failure_warnings_are_rate_limited_and_include_suppressed_count(self):
        from files import metrics

        metrics._telemetry_warning_state.clear()
        with (
            patch("files.metrics.time.monotonic", side_effect=[0, 10, 61]),
            patch("files.metrics.TELEMETRY_EMISSION_FAILURES_TOTAL") as total,
            patch("files.metrics.logger.warning") as warning,
        ):
            metrics.record_telemetry_failure("metrics", "http", "emit")
            metrics.record_telemetry_failure("metrics", "http", "emit")
            metrics.record_telemetry_failure("metrics", "http", "emit")

        self.assertEqual(total.labels.return_value.inc.call_count, 3)
        self.assertEqual(warning.call_count, 2)
        self.assertEqual(warning.call_args.kwargs["extra"]["suppressed_count"], 1)

    def test_cache_fallback_survives_metric_failure(self):
        from cms import cache_telemetry
        from files import cache_utils

        with (
            patch.object(cache_telemetry.owned_cache.backend, "get", return_value=True),
            patch.object(
                cache_telemetry, "CACHE_OPERATIONS_TOTAL", labels=Mock(side_effect=RuntimeError("metrics unavailable"))
            ),
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


class AuthenticationMetricTests(SimpleTestCase):
    def test_django_login_failure_uses_bounded_contract(self):
        from files import metrics

        with patch("files.metrics.AUTH_FAILURES_TOTAL") as failures:
            metrics._on_user_login_failed()

        failures.labels.assert_called_once_with(
            surface="account_login", mechanism="password", reason="invalid_credentials"
        )


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
    def test_task_names_are_normalized_to_bounded_families(self):
        from files.metrics import normalize_task_family

        self.assertEqual(normalize_task_family("files.tasks.encode_media"), "encoding")
        self.assertEqual(normalize_task_family("email_delivery.tasks.deliver_email"), "email_delivery")
        self.assertEqual(normalize_task_family("tenant.dynamic.task"), "unknown")

    def test_every_registered_application_task_has_a_known_family(self):
        from files.metrics import TASK_FAMILY_BY_NAME, normalize_task_family

        expected_tasks = {
            "chunkize_media",
            "encode_media",
            "whisper_transcribe",
            "produce_sprite_from_video",
            "create_hls",
            "media_init",
            "refresh_media_storage_usage",
            "check_running_states",
            "check_media_states",
            "check_pending_states",
            "check_missing_profiles",
            "clear_sessions",
            "save_user_action",
            "get_list_of_popular_media",
            "update_listings_thumbnails",
            "start_missing_encodings",
            "sum_two_numbers",
            "sum_two_numbers_two",
            "beat_test",
            "remove_media_file",
            "cleanup_orphaned_uploads",
            "cleanup_orphaned_draft_media",
            "subscribe_user",
            "dispatch_deferred_encodings",
            "apply_visibility_schedules",
            "deliver_email",
            "recover_stale_email_deliveries",
            "cleanup_email_delivery_receipts",
            "notify_followers_new_media",
            "record_beat_freshness",
            "cms.celery.debug_task",
        }
        self.assertEqual(set(TASK_FAMILY_BY_NAME), expected_tasks)
        for task_name in expected_tasks:
            with self.subTest(task_name=task_name):
                self.assertNotEqual(normalize_task_family(task_name), "unknown")

    @override_settings(
        OTEL_SERVICE_ROLE="long-task",
        TELEMETRY_WORKER_ID="long-1",
        TELEMETRY_WORKER_HMAC_KEY="test-only-secret",
    )
    def test_worker_reference_is_stable_and_hides_infrastructure_identity(self):
        from files.metrics import worker_reference

        first = worker_reference()
        second = worker_reference()
        self.assertEqual(first, second)
        self.assertTrue(first.startswith("v1:"))
        self.assertNotIn("long-1", first)
        self.assertNotIn("hostname", first)

    @override_settings(TELEMETRY_WORKER_ID="", TELEMETRY_WORKER_HMAC_KEY="")
    def test_missing_worker_identity_emits_reserved_role_level_reference(self):
        from files import metrics

        with patch("files.metrics.record_contract_violation") as violation:
            reference = metrics.worker_reference()

        self.assertEqual(reference, "v1:" + "0" * 32)
        violation.assert_called_once_with("celery", "worker_ref")

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

        task_total.labels.assert_any_call(task_family="encoding", queue="long_tasks", event="started", outcome="none")
        task_total.labels.assert_any_call(
            task_family="encoding", queue="long_tasks", event="completed", outcome="succeeded"
        )
        task_active.labels.assert_called_with(task_family="encoding", queue="long_tasks")
        duration.labels.assert_called_once_with(task_family="encoding", queue="long_tasks", outcome="succeeded")

    def test_queue_normalization_and_terminal_states_are_bounded(self):
        from files import metrics

        unknown = SimpleNamespace(name="custom", request=SimpleNamespace(delivery_info={"routing_key": "tenant-42"}))
        self.assertEqual(metrics.normalize_queue(sender=unknown), "default")
        with patch("files.metrics.CELERY_TASKS_TOTAL") as task_total:
            task_total.labels.return_value.inc = Mock()
            metrics._on_task_failure(sender=unknown, task_id="failed-1")
            metrics._on_task_retry(sender=unknown, request=SimpleNamespace(id="retry-1"))
            metrics._on_task_revoked(sender=unknown, request=SimpleNamespace(id="revoked-1"))
        states = {call.kwargs["outcome"] for call in task_total.labels.call_args_list}
        self.assertEqual(states, {"failed", "retried", "revoked"})

    def test_terminal_event_reuses_cached_labels_without_normalizing_again(self):
        from files import metrics

        metrics._task_labels["cached-task"] = ("encoding", "long_tasks")
        try:
            with (
                patch("files.metrics.normalize_task_family") as family,
                patch("files.metrics.normalize_queue") as queue,
                patch("files.metrics.CELERY_TASKS_TOTAL") as task_total,
            ):
                metrics._terminal_task_event("failed", task_id="cached-task")
        finally:
            metrics._task_labels.pop("cached-task", None)

        family.assert_not_called()
        queue.assert_not_called()
        task_total.labels.assert_called_once_with(
            task_family="encoding", queue="long_tasks", event="completed", outcome="failed"
        )

    def test_domain_outcome_normalizes_unbounded_values_without_raising(self):
        from files import metrics

        with (
            patch("files.metrics.DOMAIN_OUTCOMES_TOTAL") as total,
            patch("files.metrics.record_contract_violation") as violation,
        ):
            metrics.record_domain_outcome("tenant-operation", "user-supplied", "secret-reason")

        total.labels.assert_called_once_with(operation="other", outcome="failed", reason_code="other")
        self.assertEqual(violation.call_count, 3)

    def test_unregistered_queue_reports_contract_violation(self):
        from files import metrics

        sender = SimpleNamespace(request=SimpleNamespace(delivery_info={"routing_key": "tenant-42"}))
        with patch("files.metrics.record_contract_violation") as violation:
            self.assertEqual(metrics.normalize_queue(sender=sender), "default")
        violation.assert_called_once_with("celery", "queue")

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
        task_total.labels.assert_called_with(
            task_family="encoding", queue="short_tasks", event="completed", outcome="succeeded"
        )
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
