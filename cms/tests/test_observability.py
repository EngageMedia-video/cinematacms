import json
import logging
import math
import os
import shutil
import subprocess
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock, call, patch

from celery.signals import worker_process_shutdown
from django.core.cache import cache
from django.http import HttpResponse
from django.test import RequestFactory, SimpleTestCase, override_settings
from prometheus_client import CollectorRegistry
from prometheus_client.multiprocess import MultiProcessCollector

from cms.http_telemetry import classify_request
from cms.observability import (
    OpenTelemetryLogFilter,
    OperationAwareSampler,
    SafeSpanExporter,
    _credentialed_endpoint_is_secure,
    configure_celery_worker_process,
    configure_django_observability,
    current_actor_ref,
    inject_trace_headers,
    media_reference,
    start_span,
)
from cms.observability_middleware import ObservabilityActorMiddleware, ObservabilityMetricsMiddleware
from cms.redis_telemetry import BROKER_SOCKET_TIMEOUT_SECONDS, ObservabilityRedisAdapter
from cms.urls import _reference_lookup_rate_limited, metrics_view, observability_reference_lookup

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


class ObservabilityConfigTests(SimpleTestCase):
    def tearDown(self):
        cache.clear()

    @override_settings(
        OBSERVABILITY_REFERENCE_LOOKUP_TOKEN="lookup-secret",
        OBSERVABILITY_REFERENCE_HMAC_KEY="reference-secret",
        EMAIL_RECIPIENT_HMAC_KEY="email-secret",
    )
    def test_reference_lookup_resolves_actor_and_media_without_returning_input(self):
        factory = RequestFactory()
        for kind, value in (("actor", "Person@Example.com"), ("media", "public-video-token")):
            request = factory.post(
                "/internal/observability/references",
                data=json.dumps({"kind": kind, "value": value}),
                content_type="application/json",
                HTTP_AUTHORIZATION="Bearer lookup-secret",
            )
            response = observability_reference_lookup(request)
            payload = json.loads(response.content)

            self.assertEqual(response.status_code, 200)
            self.assertEqual(payload["kind"], kind)
            self.assertTrue(payload["references"])
            self.assertEqual(payload["references"][0]["log_field"], f"{kind}_ref")
            self.assertEqual(payload["references"][0]["span_field"], f"cinematacms.{kind}_ref")
            self.assertNotIn(value.lower(), response.content.decode().lower())

    @override_settings(OBSERVABILITY_REFERENCE_LOOKUP_TOKEN="lookup-secret")
    def test_reference_lookup_rejects_missing_token_and_unknown_kind(self):
        factory = RequestFactory()
        unauthorized = observability_reference_lookup(
            factory.post(
                "/internal/observability/references",
                data='{"kind":"actor","value":"person@example.com"}',
                content_type="application/json",
            )
        )
        unknown = observability_reference_lookup(
            factory.post(
                "/internal/observability/references",
                data='{"kind":"other","value":"opaque"}',
                content_type="application/json",
                HTTP_AUTHORIZATION="Bearer lookup-secret",
            )
        )

        self.assertEqual(unauthorized.status_code, 403)
        self.assertEqual(unknown.status_code, 400)

    @override_settings(
        OBSERVABILITY_REFERENCE_LOOKUP_TOKEN="lookup-secret",
        OBSERVABILITY_REFERENCE_ALLOWED_IPS=["127.0.0.1", "::1"],
    )
    def test_reference_lookup_rejects_public_and_forwarded_clients(self):
        factory = RequestFactory()
        body = '{"kind":"actor","value":"person@example.com"}'

        public = factory.post(
            "/internal/observability/references",
            data=body,
            content_type="application/json",
            HTTP_AUTHORIZATION="Bearer lookup-secret",
            REMOTE_ADDR="203.0.113.10",
        )
        forwarded = factory.post(
            "/internal/observability/references",
            data=body,
            content_type="application/json",
            HTTP_AUTHORIZATION="Bearer lookup-secret",
            REMOTE_ADDR="127.0.0.1",
            HTTP_X_FORWARDED_FOR="203.0.113.10",
        )

        self.assertEqual(observability_reference_lookup(public).status_code, 403)
        self.assertEqual(observability_reference_lookup(forwarded).status_code, 403)

    @override_settings(
        OBSERVABILITY_REFERENCE_LOOKUP_TOKEN="lookup-secret",
        OBSERVABILITY_REFERENCE_ALLOWED_IPS=["127.0.0.1"],
        OBSERVABILITY_REFERENCE_RATE_LIMIT=1,
    )
    def test_reference_lookup_rate_limits_trusted_callers(self):
        factory = RequestFactory()

        def request():
            return factory.post(
                "/internal/observability/references",
                data='{"kind":"other","value":"opaque"}',
                content_type="application/json",
                HTTP_AUTHORIZATION="Bearer lookup-secret",
                REMOTE_ADDR="127.0.0.1",
            )

        self.assertEqual(observability_reference_lookup(request()).status_code, 400)
        self.assertEqual(observability_reference_lookup(request()).status_code, 429)

    @override_settings(OBSERVABILITY_REFERENCE_RATE_LIMIT=1)
    def test_reference_lookup_rate_limit_fails_closed_when_cache_is_unavailable(self):
        request = RequestFactory().post(
            "/internal/observability/references",
            REMOTE_ADDR="127.0.0.1",
        )

        with patch("cms.urls.lookup_rate_cache.adapter._call", side_effect=RuntimeError("cache unavailable")):
            self.assertTrue(_reference_lookup_rate_limited(request))

        with (
            patch("cms.urls.lookup_rate_cache.add", return_value=False),
            patch("cms.urls.lookup_rate_cache.adapter._call", side_effect=RuntimeError("cache unavailable")),
        ):
            self.assertTrue(_reference_lookup_rate_limited(request))

    @override_settings(
        OBSERVABILITY_REFERENCE_LOOKUP_TOKEN="lookup-secret",
        OBSERVABILITY_REFERENCE_ALLOWED_IPS=["127.0.0.1"],
    )
    def test_reference_lookup_audit_does_not_log_reported_value(self):
        request = RequestFactory().post(
            "/internal/observability/references",
            data='{"kind":"actor","value":"person@example.com"}',
            content_type="application/json",
            HTTP_AUTHORIZATION="Bearer wrong-token",
            REMOTE_ADDR="127.0.0.1",
        )

        with self.assertLogs("cms.observability.lookup", level="WARNING") as captured:
            response = observability_reference_lookup(request)

        self.assertEqual(response.status_code, 403)
        self.assertNotIn("person@example.com", " ".join(captured.output))
        self.assertNotIn("wrong-token", " ".join(captured.output))

    @override_settings(
        OBSERVABILITY_REFERENCE_LOOKUP_TOKEN="lookup-secret",
        OBSERVABILITY_REFERENCE_ALLOWED_IPS=["127.0.0.1"],
        OBSERVABILITY_REFERENCE_MAX_BODY_BYTES=128,
    )
    def test_reference_lookup_rejects_oversized_body(self):
        request = RequestFactory().post(
            "/internal/observability/references",
            data=json.dumps({"kind": "media", "value": "x" * 256}),
            content_type="application/json",
            HTTP_AUTHORIZATION="Bearer lookup-secret",
            REMOTE_ADDR="127.0.0.1",
        )

        self.assertEqual(observability_reference_lookup(request).status_code, 413)

    @override_settings(OBSERVABILITY_REFERENCE_HMAC_KEY="reference-secret")
    def test_media_reference_is_normalized_versioned_and_keyed(self):
        self.assertEqual(media_reference(" Video-Token "), media_reference("video-token"))
        self.assertTrue(media_reference("video-token").startswith("v1:"))
        self.assertNotIn("video-token", media_reference("video-token"))

    @override_settings(OBSERVABILITY_REFERENCE_HMAC_KEY="")
    def test_missing_media_reference_key_does_not_break_application_work(self):
        self.assertEqual(media_reference("video-token"), "")

    @override_settings(OTEL_ENABLED=True)
    def test_media_span_adds_reference_to_logs_within_the_operation(self):
        record = logging.LogRecord("test", logging.INFO, __file__, 1, "msg", (), None)
        span = Mock()
        context = Mock()
        context.__enter__ = Mock(return_value=span)
        context.__exit__ = Mock(return_value=False)
        tracer = Mock()
        tracer.start_as_current_span.return_value = context

        with patch("cms.observability.get_tracer", return_value=tracer):
            with start_span("media.encode", {"cinematacms.media_ref": "v1:opaque"}):
                OpenTelemetryLogFilter().filter(record)

        self.assertEqual(record.media_ref, "v1:opaque")

    @override_settings(
        FFMPEG_COMMAND="ffmpeg",
        OBSERVABILITY_REFERENCE_HMAC_KEY="reference-secret",
        TEMP_DIRECTORY=None,
        WHISPER_CPP_COMMAND="whisper",
        WHISPER_CPP_MODEL="model",
    )
    def test_whisper_failure_logs_run_before_the_media_span_closes(self):
        from files import tasks

        active_span = []
        error_spans = []

        class TrackedSpan:
            def __init__(self, name):
                self.name = name

            def __enter__(self):
                active_span.append(self.name)

            def __exit__(self, *_args):
                active_span.pop()

        media = SimpleNamespace(
            friendly_token="video-token",
            media_type="video",
            media_file=SimpleNamespace(path="/media/video.mp4", name="video.mp4"),
        )
        request = Mock()

        def capture_error(*_args, **_kwargs):
            error_spans.append(active_span[-1] if active_span else None)

        common_patches = (
            patch("files.tasks.os.path.exists", return_value=True),
            patch("files.tasks.Media.objects.get", return_value=media),
            patch("files.tasks.Language.objects.filter", return_value=Mock(first=Mock(return_value=Mock()))),
            patch("files.tasks._claim_transcription_request", return_value=request),
            patch("files.tasks.tempfile.TemporaryDirectory", return_value=tempfile.TemporaryDirectory()),
            patch("files.tasks.start_span", side_effect=lambda name, _attributes: TrackedSpan(name)),
            patch("files.tasks.logger.error", side_effect=capture_error),
        )

        with (
            common_patches[0],
            common_patches[1],
            common_patches[2],
            common_patches[3],
            common_patches[4],
            common_patches[5],
            common_patches[6],
            patch(
                "files.tasks.subprocess.run",
                return_value=SimpleNamespace(returncode=1, stdout=b"", stderr=b"failed"),
            ),
        ):
            self.assertFalse(tasks.whisper_transcribe.run("video-token"))

        self.assertEqual(error_spans, ["media.whisper.ffmpeg_extract"])

    @override_settings(OBSERVABILITY_REFERENCE_HMAC_KEY="reference-secret")
    def test_sprite_failure_log_runs_before_the_media_span_closes(self):
        from files import tasks

        active = []

        class TrackedSpan:
            def __enter__(self):
                active.append(True)

            def __exit__(self, *_args):
                active.pop()

        media = SimpleNamespace(friendly_token="video-token", media_type="video")

        with (
            patch("files.tasks.Media.objects.get", return_value=media),
            patch("files.tasks.start_span", return_value=TrackedSpan()),
            patch("files.tasks.generate_sprite_for_media", return_value={"ok": False, "reason": "failed"}),
            patch("files.tasks.logger.error", side_effect=lambda *_args, **_kwargs: self.assertTrue(active)),
        ):
            result = tasks.produce_sprite_from_video.run("video-token")

        self.assertFalse(result["ok"])

    @override_settings(OTEL_ENABLED=True)
    def test_authenticated_request_adds_pseudonymous_actor_ref_to_logs_and_trace(self):
        record = logging.LogRecord("test", logging.INFO, __file__, 1, "msg", (), None)
        span = Mock()
        request = RequestFactory().get("/upload")
        request.user = SimpleNamespace(is_authenticated=True, email="person@example.com")

        def response(_request):
            OpenTelemetryLogFilter().filter(record)
            return HttpResponse("ok")

        with (
            patch("cms.observability_middleware.recipient_reference", return_value="v7:opaque"),
            patch("opentelemetry.trace.get_current_span", return_value=span),
        ):
            result = ObservabilityActorMiddleware(response)(request)

        self.assertEqual(result.status_code, 200)
        self.assertEqual(record.actor_ref, "v7:opaque")
        self.assertEqual(current_actor_ref(), "")
        span.set_attribute.assert_called_once_with("cinematacms.actor_ref", "v7:opaque")

    @override_settings(OBSERVABILITY_SLOW_REQUEST_SECONDS=0)
    def test_actor_context_is_active_when_request_diagnostic_is_logged(self):
        request = RequestFactory().get("/health/ready")
        request.user = SimpleNamespace(is_authenticated=True, email="person@example.com")
        observed_actor_refs = []

        def capture_warning(*_args, **_kwargs):
            observed_actor_refs.append(current_actor_ref())

        metrics = ObservabilityMetricsMiddleware(lambda _request: HttpResponse("ok"))
        middleware = ObservabilityActorMiddleware(metrics)
        with (
            patch("cms.observability_middleware.recipient_reference", return_value="v7:opaque"),
            patch("cms.observability_middleware.logger.warning", side_effect=capture_warning),
        ):
            response = middleware(request)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(observed_actor_refs, ["v7:opaque"])

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


@override_settings(OTEL_ENABLED=True, OTEL_SERVICE_ROLE="transcription")
class TracingConfigurationStateTests(SimpleTestCase):
    def setUp(self):
        from files import metrics

        metrics.TRACING_CONFIGURED.clear()
        process_state = patch.multiple(
            "cms.observability",
            _tracer_configured=False,
            _django_instrumented=False,
            _celery_instrumented=False,
            _redis_instrumented=False,
            _requests_instrumented=False,
        )
        process_state.start()
        self.addCleanup(process_state.stop)

    def tracing_configured(self, role="transcription"):
        from prometheus_client import REGISTRY

        return REGISTRY.get_sample_value("cinematacms_tracing_configured", {"service_role": role})

    def test_worker_reports_tracing_configured(self):
        with (
            patch("opentelemetry.trace.set_tracer_provider"),
            patch("opentelemetry.instrumentation.celery.CeleryInstrumentor.instrument"),
            patch("opentelemetry.instrumentation.redis.RedisInstrumentor.instrument"),
            patch("opentelemetry.instrumentation.requests.RequestsInstrumentor.instrument"),
        ):
            configure_celery_worker_process()

        self.assertEqual(self.tracing_configured(), 1)

    def test_worker_that_cannot_import_celery_instrumentation_reports_tracing_unconfigured(self):
        # A worker that outlived a pip install fails this import once it mixes two opentelemetry-api versions.
        with (
            patch("opentelemetry.trace.set_tracer_provider"),
            patch.dict(sys.modules, {"opentelemetry.instrumentation.celery": None}),
            patch("cms.observability.capture_unexpected_exception"),
        ):
            configure_celery_worker_process()

        self.assertEqual(self.tracing_configured(), 0)

    def test_worker_that_cannot_import_the_tracing_sdk_reports_tracing_unconfigured(self):
        with patch.dict(sys.modules, {"opentelemetry.sdk.trace": None}):
            configure_celery_worker_process()

        self.assertEqual(self.tracing_configured(), 0)

    def test_worker_whose_tracer_provider_raises_reports_tracing_unconfigured(self):
        # Celery logs and swallows an exception from a worker_process_init receiver, so the child keeps running.
        with (
            patch("opentelemetry.sdk.resources.Resource.create", side_effect=AttributeError),
            self.assertRaises(AttributeError),
        ):
            configure_celery_worker_process()

        self.assertEqual(self.tracing_configured(), 0)

    @override_settings(
        OTEL_EXPORTER_OTLP_ENDPOINT="http://collector.internal:4318/v1/traces",
        OTEL_EXPORTER_OTLP_HEADERS="authorization=secret",
    )
    def test_worker_with_an_insecure_credentialed_endpoint_reports_tracing_unconfigured(self):
        with patch("opentelemetry.trace.set_tracer_provider") as set_provider:
            configure_celery_worker_process()

        set_provider.assert_not_called()
        self.assertEqual(self.tracing_configured(), 0)

    @override_settings(OTEL_SERVICE_ROLE="web")
    def test_web_process_that_cannot_instrument_django_reports_tracing_unconfigured(self):
        with (
            patch("opentelemetry.trace.set_tracer_provider"),
            patch("opentelemetry.instrumentation.django.DjangoInstrumentor.instrument", side_effect=RuntimeError),
            patch("cms.observability.capture_unexpected_exception"),
        ):
            configure_django_observability()

        self.assertEqual(self.tracing_configured("web"), 0)

    @override_settings(OTEL_ENABLED=False)
    def test_disabled_tracing_reports_no_state(self):
        configure_celery_worker_process()
        configure_django_observability()

        self.assertIsNone(self.tracing_configured())
        self.assertIsNone(self.tracing_configured("web"))


class TracingConfiguredAcrossProcessesTests(SimpleTestCase):
    def setUp(self):
        self.metrics_dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.metrics_dir)

    def record_in_new_process(self, configured):
        script = (
            "import os\n"
            "from files.metrics import TRACING_CONFIGURED\n"
            f"TRACING_CONFIGURED.labels(service_role='transcription').set({configured})\n"
            "print(os.getpid())\n"
        )
        result = subprocess.run(
            [sys.executable, "-c", script],
            cwd=REPOSITORY_ROOT,
            env={**os.environ, "PROMETHEUS_MULTIPROC_DIR": self.metrics_dir},
            capture_output=True,
            text=True,
            check=True,
            timeout=60,
        )
        return int(result.stdout)

    def exported_tracing_configured(self):
        registry = CollectorRegistry()
        MultiProcessCollector(registry, path=self.metrics_dir)
        return registry.get_sample_value("cinematacms_tracing_configured", {"service_role": "transcription"})

    def test_a_failed_worker_child_keeps_its_role_unconfigured_until_it_exits(self):
        failed_child = self.record_in_new_process(0)
        self.record_in_new_process(1)

        self.assertEqual(self.exported_tracing_configured(), 0, "a healthy sibling hid the failed child")

        with patch.dict(os.environ, {"PROMETHEUS_MULTIPROC_DIR": self.metrics_dir}):
            worker_process_shutdown.send(sender=None, pid=failed_child, exitcode=0)

        self.assertEqual(self.exported_tracing_configured(), 1, "the exited child still counts")

    def test_worker_child_exit_without_a_multiprocess_directory_is_a_no_op(self):
        with patch.dict(os.environ):
            os.environ.pop("PROMETHEUS_MULTIPROC_DIR", None)
            os.environ.pop("prometheus_multiproc_dir", None)
            responses = worker_process_shutdown.send(sender=None, pid=os.getpid(), exitcode=0)

        # Celery's Signal.send logs and returns a receiver's exception instead of raising it.
        failures = [response for _, response in responses if isinstance(response, Exception)]
        self.assertEqual(failures, [])


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


class QueueDepthTests(SimpleTestCase):
    @override_settings(CELERY_BROKER_URL="redis://broker.test:6379/3")
    def test_queue_depth_reads_the_broker_over_one_connection_and_not_the_cache(self):
        broker = Mock()
        broker.llen.side_effect = lambda name: {"short_tasks": 7, "long_tasks": 2}.get(name, 0)
        adapter = ObservabilityRedisAdapter()

        with (
            patch("cms.redis_telemetry.Redis.from_url", return_value=broker) as connect,
            patch("django_redis.get_redis_connection") as cache_connection,
        ):
            depths = [adapter.queue_depth("short_tasks"), adapter.queue_depth("long_tasks")]

        self.assertEqual(depths, [7, 2])
        connect.assert_called_once_with(
            "redis://broker.test:6379/3",
            socket_connect_timeout=BROKER_SOCKET_TIMEOUT_SECONDS,
            socket_timeout=BROKER_SOCKET_TIMEOUT_SECONDS,
        )
        cache_connection.assert_not_called()

    def test_queue_depth_counts_messages_sent_with_a_priority(self):
        # Celery's Redis transport keeps each priority step of a queue in its own list
        lists = {"long_tasks": 2, "long_tasks\x06\x166": 5, "long_tasks\x06\x169": 1}
        broker = Mock()
        broker.llen.side_effect = lambda name: lists.get(name, 0)

        with patch("cms.redis_telemetry.Redis.from_url", return_value=broker):
            depth = ObservabilityRedisAdapter().queue_depth("long_tasks")

        self.assertEqual(depth, 8)


class QueueDepthRefreshTests(SimpleTestCase):
    @override_settings(OBSERVABILITY_CELERY_QUEUES=["short_tasks", "long_tasks"])
    def test_an_unreadable_broker_blanks_every_queue_and_records_the_failure(self):
        from files import metrics

        with (
            patch("cms.redis_telemetry.observability_redis.queue_depth", side_effect=[7, ConnectionError()]),
            patch("files.metrics.CELERY_QUEUE_DEPTH") as depth,
            patch("files.metrics.record_telemetry_failure") as failure,
        ):
            metrics._refresh_queue_depths()

        self.assertEqual(
            depth.labels.call_args_list,
            [call(queue="short_tasks"), call(queue="long_tasks")],
        )
        written = [args.args[0] for args in depth.labels.return_value.set.call_args_list]
        self.assertTrue(all(math.isnan(value) for value in written), written)
        failure.assert_called_once_with("metrics", "celery", "record")

    @override_settings(OBSERVABILITY_CELERY_QUEUES=["short_tasks"])
    def test_a_readable_broker_writes_the_depth(self):
        from files import metrics

        with (
            patch("cms.redis_telemetry.observability_redis.queue_depth", return_value=7),
            patch("files.metrics.CELERY_QUEUE_DEPTH") as depth,
        ):
            metrics._refresh_queue_depths()

        depth.labels.return_value.set.assert_called_once_with(7)


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
            "clear_sessions",
            "save_user_action",
            "get_list_of_popular_media",
            "update_listings_thumbnails",
            "sum_two_numbers_two",
            "cleanup_orphaned_uploads",
            "cleanup_orphaned_draft_media",
            "subscribe_user",
            "dispatch_deferred_encodings",
            "apply_visibility_schedules",
            "recover_stalled_chunk_groups",
            "deliver_email",
            "recover_stale_email_deliveries",
            "cleanup_email_delivery_receipts",
            "notify_followers_new_media",
            "record_beat_freshness",
            "purge_playback_summaries",
            "cleanup_media_action_ips",
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

    def test_lost_worker_is_recorded_as_a_failed_outcome_of_the_tool_operation(self):
        from celery.exceptions import WorkerLostError

        from files import metrics

        lost = WorkerLostError("Worker exited prematurely: signal 9 (SIGKILL) Job: 3.")
        for task_name, operation in (
            ("encode_media", "encoding"),
            ("create_hls", "hls"),
            ("whisper_transcribe", "transcription"),
            ("chunkize_media", "chunking"),
        ):
            with self.subTest(task_name=task_name):
                with (
                    patch("files.metrics.CELERY_TASKS_TOTAL"),
                    patch("files.metrics.record_domain_outcome") as domain,
                ):
                    metrics._on_task_failure(sender=SimpleNamespace(name=task_name), task_id="lost-1", exception=lost)
                domain.assert_called_once_with(operation, "failed", "worker_lost")

    def test_task_that_already_recorded_its_failed_outcome_is_not_counted_again(self):
        from files import metrics

        for task_name in ("encode_media", "create_hls"):
            with self.subTest(task_name=task_name):
                with (
                    patch("files.metrics.CELERY_TASKS_TOTAL"),
                    patch("files.metrics.record_domain_outcome") as domain,
                ):
                    metrics._on_task_failure(
                        sender=SimpleNamespace(name=task_name), task_id="raised-1", exception=OSError("disk")
                    )
                domain.assert_not_called()

    def test_raised_error_of_a_signal_recorded_task_keeps_its_task_exception_reason(self):
        from files import metrics

        with patch("files.metrics.CELERY_TASKS_TOTAL"), patch("files.metrics.record_domain_outcome") as domain:
            metrics._on_task_failure(
                sender=SimpleNamespace(name="whisper_transcribe"), task_id="raised-2", exception=OSError("disk")
            )
        domain.assert_called_once_with("transcription", "failed", "task_exception")

    def test_hls_command_that_cannot_run_is_recorded_as_a_failed_outcome(self):
        import tempfile

        from files import tasks

        media = SimpleNamespace(
            uid=SimpleNamespace(hex="a" * 32),
            is_encrypted=False,
            encodings=Mock(filter=Mock(return_value=[SimpleNamespace(media_file=SimpleNamespace(path="/in.mp4"))])),
        )
        with tempfile.TemporaryDirectory() as directory:
            with (
                override_settings(MP4HLS_COMMAND=__file__, HLS_DIR=directory),
                patch("files.tasks.Media.objects.get", return_value=media),
                patch("files.tasks.hls_coordination_cache") as coordination_cache,
                patch("files.tasks.subprocess.run", side_effect=PermissionError("not executable")),
                patch("files.tasks.record_domain_outcome") as domain,
            ):
                coordination_cache.add.return_value = True
                coordination_cache.get.return_value = None
                with self.assertRaises(PermissionError):
                    tasks.create_hls.run("video-token")

        domain.assert_called_once_with("hls", "failed", "task_exception")

    def test_whisper_failures_are_recorded_as_transcription_outcomes(self):
        from files import metrics

        sender = SimpleNamespace(
            name="whisper_transcribe", request=SimpleNamespace(delivery_info={"routing_key": "whisper_tasks"})
        )
        with (
            patch("files.metrics.CELERY_TASKS_TOTAL"),
            patch("files.metrics.CELERY_TASK_ACTIVE"),
            patch("files.metrics.record_domain_outcome") as domain,
        ):
            # whisper_transcribe returns False for a missing binary, a failed subprocess and an exception.
            metrics._on_task_postrun(sender=sender, task_id="whisper-false", state="SUCCESS", retval=False)
            metrics._on_task_postrun(sender=sender, task_id="whisper-true", state="SUCCESS", retval=True)
            metrics._on_task_postrun(
                sender=sender,
                task_id="whisper-gone",
                state="SUCCESS",
                retval={"outcome": "skipped", "reason_code": "media_not_found"},
            )
            # A lost worker or a hard time limit never reaches postrun and arrives as a task failure.
            metrics._on_task_failure(sender=sender, task_id="whisper-lost")

        self.assertEqual(
            domain.call_args_list,
            [
                call("transcription", "failed", "returned_false"),
                call("transcription", "succeeded", "none"),
                call("transcription", "skipped", "media_not_found"),
                call("transcription", "failed", "task_exception"),
            ],
        )

    def test_whisper_skips_keep_their_reason_codes(self):
        from files import metrics, tasks

        for skipped in (tasks.WHISPER_SKIPPED_MEDIA_GONE, tasks.WHISPER_SKIPPED_ALREADY_REQUESTED):
            with self.subTest(**skipped), patch("files.metrics.DOMAIN_OUTCOMES_TOTAL") as outcomes:
                metrics.record_domain_outcome("transcription", skipped["outcome"], skipped["reason_code"])

                outcomes.labels.assert_called_once_with(operation="transcription", **skipped)

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
