import logging
from contextlib import contextmanager
from ipaddress import ip_address
from typing import Any
from urllib.parse import urlparse

from django.conf import settings

logger = logging.getLogger(__name__)

_tracer_configured = False
_django_instrumented = False
_celery_instrumented = False
_redis_instrumented = False
_requests_instrumented = False

ALLOWED_SERVICE_ROLES = frozenset({"web", "long-task", "short-task", "transcription", "email", "beat"})
SENSITIVE_ATTRIBUTE_PARTS = ("email", "authorization", "secret", "password", "body", "filename", "url")
RESTRICTED_EMAIL_ATTRIBUTES = frozenset({"email.delivery_id", "email.recipient_ref", "email.kind", "email.attempt"})


class SafeSpanExporter:
    def __init__(self, exporter):
        self.exporter = exporter

    def export(self, spans):
        from opentelemetry.sdk.trace.export import SpanExportResult

        try:
            result = self.exporter.export(spans)
        except Exception:
            from files.metrics import record_telemetry_failure

            record_telemetry_failure("traces", "exporter", "export")
            return SpanExportResult.FAILURE
        if result is not SpanExportResult.SUCCESS:
            from files.metrics import record_telemetry_failure

            record_telemetry_failure("traces", "exporter", "export")
        return result

    def shutdown(self):
        try:
            return self.exporter.shutdown()
        except Exception:
            return None

    def force_flush(self, timeout_millis=30000):
        try:
            return self.exporter.force_flush(timeout_millis)
        except Exception:
            return False


class OperationAwareSampler:
    PRIORITY_TERMS = ("celery", "task", "media", "encode", "transcri", "sprite", "hls", "email")

    def __init__(self, default_ratio: float, priority_ratio: float):
        from opentelemetry.sdk.trace.sampling import TraceIdRatioBased

        self.default_sampler = TraceIdRatioBased(default_ratio)
        self.priority_sampler = TraceIdRatioBased(priority_ratio)

    def should_sample(self, parent_context, trace_id, name, kind=None, attributes=None, links=None, trace_state=None):
        sampler = (
            self.priority_sampler if any(term in name.lower() for term in self.PRIORITY_TERMS) else self.default_sampler
        )
        return sampler.should_sample(parent_context, trace_id, name, kind, attributes, links, trace_state)

    def get_description(self):
        return "OperationAwareSampler"


def observability_enabled() -> bool:
    return bool(getattr(settings, "OTEL_ENABLED", False))


def _parse_otlp_headers(value: str | dict[str, str] | None) -> dict[str, str] | None:
    if not value:
        return None
    if isinstance(value, dict):
        return value

    headers = {}
    for item in value.split(","):
        item = item.strip()
        if not item:
            continue
        key, sep, header_value = item.partition("=")
        if sep:
            headers[key.strip()] = header_value.strip()
    return headers or None


def _credentialed_endpoint_is_secure(endpoint: str, headers: dict[str, str] | None) -> bool:
    if not headers:
        return True
    parsed = urlparse(endpoint)
    if parsed.scheme == "https":
        return True
    if parsed.scheme != "http" or not parsed.hostname:
        return False
    if parsed.hostname.lower() == "localhost":
        return True
    try:
        return ip_address(parsed.hostname).is_loopback
    except ValueError:
        return False


def _configure_tracer_provider() -> bool:
    global _tracer_configured

    if _tracer_configured:
        return True
    if not observability_enabled():
        return False

    try:
        from opentelemetry import trace
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
        from opentelemetry.sdk.resources import SERVICE_NAME, Resource
        from opentelemetry.sdk.trace import TracerProvider
        from opentelemetry.sdk.trace.export import BatchSpanProcessor
        from opentelemetry.sdk.trace.sampling import ParentBased
    except ImportError:
        logger.exception("OpenTelemetry packages are not installed")
        return False

    role = getattr(settings, "OTEL_SERVICE_ROLE", "web")
    if role not in ALLOWED_SERVICE_ROLES:
        role = "web"
    namespace = getattr(settings, "OTEL_SERVICE_NAMESPACE", "CinemataCMS")
    resource = Resource.create(
        {
            SERVICE_NAME: f"{namespace}/{role}",
            "service.namespace": namespace,
            "deployment.environment.name": getattr(settings, "OTEL_ENVIRONMENT", "development"),
            "service.instance.id": getattr(settings, "OTEL_INSTANCE_ID", "unknown"),
        }
    )
    sampler = ParentBased(
        OperationAwareSampler(
            float(getattr(settings, "OTEL_TRACES_SAMPLER_ARG", 1.0)),
            float(getattr(settings, "OTEL_PRIORITY_TRACES_SAMPLER_ARG", 1.0)),
        )
    )
    provider = TracerProvider(resource=resource, sampler=sampler)
    endpoint = getattr(settings, "OTEL_EXPORTER_OTLP_ENDPOINT", "http://127.0.0.1:4318/v1/traces")
    headers = _parse_otlp_headers(getattr(settings, "OTEL_EXPORTER_OTLP_HEADERS", ""))
    if not _credentialed_endpoint_is_secure(endpoint, headers):
        logger.error("Credentialed OTLP endpoints require HTTPS unless the endpoint is loopback")
        return False
    exporter = OTLPSpanExporter(endpoint=endpoint, headers=headers)
    provider.add_span_processor(BatchSpanProcessor(SafeSpanExporter(exporter)))
    trace.set_tracer_provider(provider)
    _tracer_configured = True
    return True


def _configure_dependency_instrumentation() -> None:
    global _redis_instrumented, _requests_instrumented

    if not _redis_instrumented:
        from opentelemetry.instrumentation.redis import RedisInstrumentor

        RedisInstrumentor().instrument()
        _redis_instrumented = True
    if not _requests_instrumented:
        from opentelemetry.instrumentation.requests import RequestsInstrumentor

        RequestsInstrumentor().instrument()
        _requests_instrumented = True


def configure_django_observability() -> None:
    global _django_instrumented

    if not _configure_tracer_provider():
        return

    try:
        if not _django_instrumented:
            from opentelemetry.instrumentation.django import DjangoInstrumentor

            DjangoInstrumentor().instrument()
            _django_instrumented = True
        _configure_dependency_instrumentation()
    except Exception:
        logger.exception("Failed to configure Django observability")


def configure_celery_observability() -> None:
    global _celery_instrumented

    if not _configure_tracer_provider():
        return

    try:
        if not _celery_instrumented:
            from opentelemetry.instrumentation.celery import CeleryInstrumentor

            CeleryInstrumentor().instrument()
            _celery_instrumented = True
        _configure_dependency_instrumentation()
    except Exception:
        logger.exception("Failed to configure Celery observability")


def configure_celery_worker_process() -> None:
    """Configure tracing in a prefork child instead of the parent process."""
    global _tracer_configured, _celery_instrumented, _redis_instrumented, _requests_instrumented
    _tracer_configured = False
    _celery_instrumented = False
    _redis_instrumented = False
    _requests_instrumented = False
    configure_celery_observability()


def inject_trace_headers(headers: dict[str, Any] | None = None) -> dict[str, Any]:
    merged = dict(headers or {})
    if not observability_enabled():
        return merged
    try:
        from opentelemetry.propagate import inject

        inject(merged)
    except Exception:
        logger.debug("Failed to inject trace headers", exc_info=True)
    return merged


def current_trace_ids() -> tuple[str, str]:
    if not observability_enabled():
        return "", ""
    try:
        from opentelemetry import trace

        context = trace.get_current_span().get_span_context()
        if not context or not context.is_valid:
            return "", ""
        return f"{context.trace_id:032x}", f"{context.span_id:016x}"
    except Exception:
        return "", ""


class OpenTelemetryLogFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        trace_id, span_id = current_trace_ids()
        record.trace_id = trace_id
        record.span_id = span_id
        try:
            from celery import current_task

            request = getattr(current_task, "request", None)
            record.task_id = getattr(request, "id", "") or ""
            record.task_name = getattr(current_task, "name", "") or ""
            delivery = getattr(request, "delivery_info", None) or {}
            queue = delivery.get("routing_key", "default")
            record.queue = (
                queue
                if queue in {"long_tasks", "short_tasks", "whisper_tasks", "email_tasks", "default"}
                else "default"
            )
        except Exception:
            record.task_id = ""
            record.task_name = ""
            record.queue = "default"
        return True


def get_tracer(name: str):
    try:
        from opentelemetry import trace

        return trace.get_tracer(name)
    except Exception:
        return None


def _record_telemetry_failure(signal: str, component: str, stage: str) -> None:
    try:
        from files.metrics import record_telemetry_failure

        record_telemetry_failure(signal, component, stage)
    except Exception:
        pass


@contextmanager
def start_span(name: str, attributes: dict[str, Any] | None = None):
    tracer = get_tracer("cinematacms")
    if not observability_enabled() or tracer is None:
        yield None
        return
    try:
        manager = tracer.start_as_current_span(name)
        span = manager.__enter__()
    except Exception:
        _record_telemetry_failure("traces", "span", "start")
        yield None
        return
    try:
        if attributes:
            for key, value in attributes.items():
                normalized_key = key.lower()
                safe = normalized_key in RESTRICTED_EMAIL_ATTRIBUTES or not any(
                    part in normalized_key for part in SENSITIVE_ATTRIBUTE_PARTS
                )
                if value is not None and safe:
                    try:
                        span.set_attribute(key, value)
                    except Exception:
                        _record_telemetry_failure("traces", "span", "attribute")
        yield span
    except BaseException as error:
        try:
            manager.__exit__(type(error), error, error.__traceback__)
        except Exception:
            _record_telemetry_failure("traces", "span", "finish")
        raise
    else:
        try:
            manager.__exit__(None, None, None)
        except Exception:
            _record_telemetry_failure("traces", "span", "finish")
