import hashlib
import hmac
import logging
import os
from contextlib import contextmanager
from contextvars import ContextVar
from ipaddress import ip_address
from typing import Any
from urllib.parse import urlparse

from django.conf import settings

from cms.error_tracking import capture_unexpected_exception

logger = logging.getLogger(__name__)

_tracer_configured = False
_django_instrumented = False
_celery_instrumented = False
_redis_instrumented = False
_requests_instrumented = False
_actor_ref: ContextVar[str] = ContextVar("cinematacms_actor_ref", default="")
_media_ref: ContextVar[str] = ContextVar("cinematacms_media_ref", default="")

ALLOWED_SERVICE_ROLES = frozenset({"web", "long-task", "short-task", "transcription", "email", "beat"})
SENSITIVE_ATTRIBUTE_PARTS = ("email", "authorization", "secret", "password", "body", "filename", "url")
RESTRICTED_EMAIL_ATTRIBUTES = frozenset({"email.delivery_id", "email.recipient_ref", "email.kind", "email.attempt"})
RESTRICTED_REFERENCE_ATTRIBUTES = frozenset({"cinematacms.actor_ref", "cinematacms.media_ref"})
SEMCONV_STABILITY_OPT_IN = "OTEL_SEMCONV_STABILITY_OPT_IN"
STABLE_HTTP_SEMCONV_MODES = frozenset({"http", "http/dup"})
EXPORTED_SPAN_ATTRIBUTES = frozenset(
    {
        "cinematacms.actor_ref",
        "cinematacms.media_ref",
        "domain.operation",
        "domain.outcome",
        "domain.reason_code",
        "email.delivery_id",
        "email.recipient_ref",
        "email.kind",
        "email.attempt",
        "media.type",
        "encoding.profile_id",
        "encoding.resolution",
        "encoding.codec",
        "encoding.extension",
        "cinematacms.db.workload",
        "cinematacms.db.context_group",
        "cinematacms.db.operation",
        "cinematacms.db.outcome",
        "db.query.fingerprint",
        "cinematacms.cache.family",
        "cinematacms.cache.operation",
        "cinematacms.cache.result",
        "service_role",
        "task_id",
        "celery.task_id",
        "celery.task_name",
        "queue",
        "messaging.destination.name",
        "delivery_uuid",
        "recipient_ref",
        "operation",
        "outcome",
        "reason_code",
        "route_group",
        "http.route",
        "http.request.method",
        "http.response.status_code",
    }
)
EXPORTED_SPAN_EVENT_ATTRIBUTES = frozenset(
    {
        "exception.type",
        "domain.operation",
        "domain.outcome",
        "domain.reason_code",
        "task_id",
        "delivery_uuid",
        "recipient_ref",
        "operation",
        "outcome",
        "reason_code",
    }
)
EXPORTED_RESOURCE_ATTRIBUTES = frozenset(
    {
        "service.name",
        "service.namespace",
        "service.instance.id",
        "deployment.environment.name",
    }
)


def _exported_attributes(attributes, allowed: frozenset[str]) -> dict[str, Any]:
    return {key: value for key, value in (attributes or {}).items() if key in allowed}


def _without_trace_state(context):
    from opentelemetry.trace import SpanContext

    if context is None:
        return None
    return SpanContext(context.trace_id, context.span_id, context.is_remote, context.trace_flags)


def anonymise_span(span):
    """Rebuild a finished span from the fields that may leave the process.

    Status text is dropped because instrumentations copy the raw exception message into it.
    Trace state is dropped because it arrives from callers in the `tracestate` header.
    """
    from opentelemetry.sdk.resources import Resource
    from opentelemetry.sdk.trace import Event, ReadableSpan
    from opentelemetry.trace import Link, Status

    return ReadableSpan(
        name=span.name,
        context=_without_trace_state(span.context),
        parent=_without_trace_state(span.parent),
        resource=Resource(_exported_attributes(span.resource.attributes, EXPORTED_RESOURCE_ATTRIBUTES)),
        attributes=_exported_attributes(span.attributes, EXPORTED_SPAN_ATTRIBUTES),
        events=[
            Event(event.name, _exported_attributes(event.attributes, EXPORTED_SPAN_EVENT_ATTRIBUTES), event.timestamp)
            for event in span.events
        ],
        links=[Link(_without_trace_state(link.context)) for link in span.links],
        kind=span.kind,
        status=Status(span.status.status_code),
        start_time=span.start_time,
        end_time=span.end_time,
        instrumentation_scope=span.instrumentation_scope,
    )


def _anonymise_spans(spans) -> list:
    anonymised = []
    for span in spans:
        try:
            anonymised.append(anonymise_span(span))
        except Exception:
            _record_telemetry_failure("traces", "exporter", "prepare")
    return anonymised


class SafeSpanExporter:
    def __init__(self, exporter):
        self.exporter = exporter

    def export(self, spans):
        from opentelemetry.sdk.trace.export import SpanExportResult

        try:
            result = self.exporter.export(_anonymise_spans(spans))
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


def _service_role() -> str:
    role = getattr(settings, "OTEL_SERVICE_ROLE", "web")
    return role if role in ALLOWED_SERVICE_ROLES else "web"


def _record_tracing_configured(configured: bool) -> None:
    try:
        from files.metrics import TRACING_CONFIGURED

        TRACING_CONFIGURED.labels(service_role=_service_role()).set(1 if configured else 0)
    except Exception:
        _record_telemetry_failure("metrics", "application", "emit")


def _configure_tracer_provider() -> bool:
    global _tracer_configured

    if _tracer_configured:
        return True

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

    role = _service_role()
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


# Each instrument() call passes raise_exception_on_conflict=True. Without it, an
# instrumentor that finds an unsupported dependency version logs and skips itself,
# and the process would report tracing as configured.
def _configure_dependency_instrumentation() -> None:
    global _redis_instrumented, _requests_instrumented

    if not _redis_instrumented:
        from opentelemetry.instrumentation.redis import RedisInstrumentor

        RedisInstrumentor().instrument(raise_exception_on_conflict=True)
        _redis_instrumented = True
    if not _requests_instrumented:
        from opentelemetry.instrumentation.requests import RequestsInstrumentor

        RequestsInstrumentor().instrument(raise_exception_on_conflict=True)
        _requests_instrumented = True


def sanitize_django_request_span(span, environ) -> None:
    del environ
    if span is None:
        return
    try:
        if hasattr(span, "is_recording") and not span.is_recording():
            return
        for attribute in (
            "client.address",
            "http.client_ip",
            "http.target",
            "http.url",
            "net.peer.ip",
            "url.full",
        ):
            span.set_attribute(attribute, "[redacted]")
        span.set_attribute("url.query", "")
    except Exception:
        _record_telemetry_failure("traces", "http", "attribute")


def _instrument_django() -> bool:
    global _django_instrumented

    try:
        if not _django_instrumented:
            from opentelemetry.instrumentation.django import DjangoInstrumentor

            DjangoInstrumentor().instrument(request_hook=sanitize_django_request_span, raise_exception_on_conflict=True)
            _django_instrumented = True
        _configure_dependency_instrumentation()
    except Exception as error:
        logger.exception("Failed to configure Django observability")
        capture_unexpected_exception(error)
        return False
    return True


def _instrument_celery() -> bool:
    global _celery_instrumented

    try:
        if not _celery_instrumented:
            from opentelemetry.instrumentation.celery import CeleryInstrumentor

            CeleryInstrumentor().instrument(raise_exception_on_conflict=True)
            _celery_instrumented = True
        _configure_dependency_instrumentation()
    except Exception as error:
        logger.exception("Failed to configure Celery observability")
        capture_unexpected_exception(error)
        return False
    return True


def _opt_in_to_stable_http_semantic_conventions() -> None:
    """Make the HTTP instrumentations emit the attribute names that EXPORTED_SPAN_ATTRIBUTES keeps.

    The instrumentations read this variable once, on the first instrument() call in the process.
    """
    opted_in = [signal.strip() for signal in os.environ.get(SEMCONV_STABILITY_OPT_IN, "").split(",") if signal.strip()]
    if not STABLE_HTTP_SEMCONV_MODES & set(opted_in):
        os.environ[SEMCONV_STABILITY_OPT_IN] = ",".join([*opted_in, "http"])


def _configure_tracing(instrument) -> None:
    if not observability_enabled():
        return
    _opt_in_to_stable_http_semantic_conventions()
    configured = False
    try:
        configured = _configure_tracer_provider() and instrument()
    finally:
        _record_tracing_configured(configured)


def configure_django_observability() -> None:
    _configure_tracing(_instrument_django)


def configure_celery_observability() -> None:
    _configure_tracing(_instrument_celery)


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


@contextmanager
def actor_reference_context(actor_ref: str):
    token = _actor_ref.set(actor_ref)
    try:
        yield
    finally:
        _actor_ref.reset(token)


def current_actor_ref() -> str:
    return _actor_ref.get()


def current_media_ref() -> str:
    return _media_ref.get()


def media_reference(value: str) -> str:
    key = getattr(settings, "OBSERVABILITY_REFERENCE_HMAC_KEY", "")
    if not key:
        return ""
    version = str(getattr(settings, "OBSERVABILITY_REFERENCE_HMAC_VERSION", "v1"))
    normalized = value.strip().lower()
    digest = hmac.new(key.encode(), normalized.encode(), hashlib.sha256).hexdigest()
    return f"{version}:{digest}"


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
        record.actor_ref = current_actor_ref()
        record.media_ref = current_media_ref()
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
        from cms.error_tracking import sanitize_log_record

        sanitize_log_record(record)
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
    media_token = _media_ref.set(str((attributes or {}).get("cinematacms.media_ref", "")))
    try:
        if attributes:
            for key, value in attributes.items():
                normalized_key = key.lower()
                safe = normalized_key in RESTRICTED_EMAIL_ATTRIBUTES | RESTRICTED_REFERENCE_ATTRIBUTES or not any(
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
    finally:
        _media_ref.reset(media_token)
