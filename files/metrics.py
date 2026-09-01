import logging
import socket
import time

from celery.signals import (
    beat_init,
    heartbeat_sent,
    task_failure,
    task_postrun,
    task_prerun,
    task_retry,
    task_revoked,
    worker_ready,
    worker_shutdown,
)
from django.conf import settings
from django.contrib.auth.signals import user_login_failed
from prometheus_client import Counter, Gauge, Histogram

logger = logging.getLogger(__name__)

ENCODING_QUEUE_WAIT_SECONDS = Histogram(
    "cinemata_encoding_queue_wait_seconds",
    "Time an encoding task waited in the Celery queue before execution",
    buckets=(1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600),
)

HTTP_REQUESTS_TOTAL = Counter(
    "cinemata_http_requests_total",
    "HTTP requests grouped by stable endpoint class",
    ["endpoint_group", "method", "status_class"],
)
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "cinemata_http_request_duration_seconds",
    "HTTP request duration grouped by stable endpoint class",
    ["endpoint_group", "method", "status_class"],
    buckets=(0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30),
)
SLOW_REQUESTS_TOTAL = Counter(
    "cinemata_http_slow_requests_total",
    "HTTP requests exceeding OBSERVABILITY_SLOW_REQUEST_SECONDS",
    ["endpoint_group", "method"],
)
SLOW_DB_QUERIES_TOTAL = Counter(
    "cinemata_db_slow_queries_total",
    "Database queries exceeding OBSERVABILITY_SLOW_QUERY_SECONDS",
    ["endpoint_group"],
)
AUTH_FAILURES_TOTAL = Counter(
    "cinemata_auth_failures_total",
    "Failed authentication attempts",
    ["source"],
)

CELERY_TASKS_TOTAL = Counter(
    "cinemata_celery_tasks_total",
    "Celery task lifecycle events",
    ["task_name", "queue", "state"],
)
CELERY_TASK_DURATION_SECONDS = Histogram(
    "cinemata_celery_task_duration_seconds",
    "Celery task duration by task name",
    ["task_name", "queue"],
    buckets=(0.1, 0.5, 1, 5, 15, 30, 60, 120, 300, 600, 1800, 3600, 7200),
)
CELERY_TASK_ACTIVE = Gauge(
    "cinemata_celery_task_active",
    "Currently running Celery tasks by task name",
    ["task_name", "queue"],
    multiprocess_mode="livesum",
)
CELERY_WORKER_UP = Gauge(
    "cinemata_celery_worker_up",
    "Celery worker process seen as ready",
    ["worker"],
)
CELERY_WORKER_HEARTBEAT_TIMESTAMP = Gauge(
    "cinemata_celery_worker_heartbeat_timestamp_seconds",
    "Unix timestamp of the last Celery worker heartbeat",
    ["worker"],
    multiprocess_mode="mostrecent",
)
CELERY_BEAT_FRESHNESS_TIMESTAMP = Gauge(
    "cinemata_celery_beat_freshness_timestamp_seconds",
    "Unix timestamp when Celery beat initialized",
    multiprocess_mode="mostrecent",
)
DOMAIN_OUTCOMES_TOTAL = Counter(
    "cinemata_domain_outcomes_total",
    "Application operation outcomes",
    ["operation", "outcome", "reason_code"],
)
CELERY_QUEUE_DEPTH = Gauge(
    "cinemata_celery_queue_depth",
    "Redis broker queue length by queue name",
    ["queue"],
    multiprocess_mode="mostrecent",
)

MEDIA_ENCODING_PROFILE_TOTAL = Counter(
    "cinemata_media_encoding_profile_total",
    "Encoding completions by profile and result",
    ["resolution", "codec", "extension", "outcome", "reason_code"],
)
MEDIA_FILE_SIZE_BYTES = Histogram(
    "cinemata_encoding_input_file_size_bytes",
    "Encoding input file size by media type",
    ["media_type"],
    buckets=(1_000_000, 10_000_000, 50_000_000, 100_000_000, 500_000_000, 1_000_000_000, 5_000_000_000),
)
MEDIA_DURATION_SECONDS = Histogram(
    "cinemata_encoding_input_duration_seconds",
    "Encoding input duration by media type",
    ["media_type"],
    buckets=(30, 60, 300, 600, 1200, 1800, 3600, 7200, 14400),
)
TRANSCRIPTION_REQUESTS = Gauge(
    "cinemata_transcription_database_stale",
    "Persisted transcription request rows that have not progressed",
    ["translate_to_english"],
    multiprocess_mode="mostrecent",
)
ENCODING_STALE_TOTAL = Counter(
    "cinemata_encoding_stale_total",
    "Encoding rows considered stale and requeued",
    ["resolution", "codec", "extension"],
)
ENCODING_STALLED = Gauge(
    "cinemata_encoding_stalled",
    "Current running encoding rows older than RUNNING_STATE_STALE",
    ["resolution", "codec", "extension"],
    multiprocess_mode="mostrecent",
)
CACHE_OPERATIONS_TOTAL = Counter(
    "cinemata_cache_operations_total",
    "Explicit project cache helper operations",
    ["cache", "operation", "result"],
)

_task_start_times: dict[str, float] = {}
_task_labels: dict[str, tuple[str, str]] = {}
_stalled_encoding_label_values: set[tuple[str, str, str]] = set()


def _safe_metric(metric_name: str, emit) -> None:
    try:
        emit()
    except Exception:
        logger.debug("Could not record %s metric", metric_name, exc_info=True)


def classify_endpoint_group(path: str) -> str:
    normalized = path.rstrip("/") or "/"
    if normalized in {"/metrics", "/health/live", "/health/ready"}:
        return "system"
    if normalized.startswith("/api/v1/search"):
        return "api_search"
    if normalized.startswith("/api/v1/media"):
        return "api_media"
    if normalized.startswith("/api/v1/manage") or normalized.startswith("/manage"):
        return "api_manage"
    if normalized.startswith("/fu/") or normalized.startswith("/upload"):
        return "uploads"
    if normalized.startswith("/media/") or normalized.startswith("/internal/media/"):
        return "media_serve"
    if normalized.startswith("/api/"):
        return "api_other"
    return "pages"


def _task_name(sender=None, task_id=None, **kwargs) -> str:
    if sender is not None and getattr(sender, "name", None):
        return str(sender.name)
    task = kwargs.get("task")
    if task is not None and getattr(task, "name", None):
        return str(task.name)
    return "unknown"


QUEUE_NAMES = frozenset({"long_tasks", "short_tasks", "whisper_tasks", "email_tasks", "default"})
DOMAIN_OUTCOMES = frozenset({"succeeded", "failed", "skipped", "retried", "cancelled"})
MEDIA_TASK_OPERATIONS = {
    "chunkize_media": "chunking",
    "whisper_transcribe": "transcription",
    "produce_sprite_from_video": "sprites",
}


def normalize_queue(sender=None, **kwargs) -> str:
    request = getattr(sender, "request", None)
    delivery = getattr(request, "delivery_info", None) or kwargs.get("delivery_info") or {}
    queue = delivery.get("routing_key") or delivery.get("exchange") or "default"
    return queue if queue in QUEUE_NAMES else "default"


def record_domain_outcome(operation: str, outcome: str, reason_code: str = "none") -> None:
    if outcome not in DOMAIN_OUTCOMES:
        raise ValueError(f"Unsupported domain outcome: {outcome}")
    _safe_metric(
        "domain outcome",
        lambda: DOMAIN_OUTCOMES_TOTAL.labels(operation=operation, outcome=outcome, reason_code=reason_code).inc(),
    )
    try:
        from opentelemetry import trace

        span = trace.get_current_span()
        if span.is_recording():
            span.set_attribute("domain.operation", operation)
            span.set_attribute("domain.outcome", outcome)
            span.set_attribute("domain.reason_code", reason_code)
    except Exception:
        logger.debug("Could not add the domain outcome to the current span", exc_info=True)


def _record_task_domain_result(name: str, outcome: str, reason_code: str) -> None:
    operation = MEDIA_TASK_OPERATIONS.get(name)
    if operation:
        record_domain_outcome(operation, outcome, reason_code)


def _record_scheduled_result(name: str, outcome: str, reason_code: str, retval=None) -> None:
    try:
        from cms.scheduled_jobs import SCHEDULED_JOBS, record_scheduled_outcome

        if name not in SCHEDULED_JOBS:
            return
        result = retval if isinstance(retval, dict) else {}
        record_scheduled_outcome(
            name,
            result.get("outcome", outcome),
            result.get("reason_code", reason_code),
            processed=result.get("processed", 0),
            changed=result.get("changed", 0),
            failed=result.get("failed", 0),
            timestamp=time.time(),
        )
    except Exception:
        logger.debug("Could not record the scheduled job result", exc_info=True)


def _on_task_prerun(sender=None, task_id=None, **kwargs):
    name = _task_name(sender=sender, **kwargs)
    queue = normalize_queue(sender=sender, **kwargs)
    if task_id:
        _task_start_times[task_id] = time.monotonic()
        _task_labels[task_id] = (name, queue)
    _safe_metric(
        "Celery started", lambda: CELERY_TASKS_TOTAL.labels(task_name=name, queue=queue, state="started").inc()
    )
    _safe_metric("Celery active", lambda: CELERY_TASK_ACTIVE.labels(task_name=name, queue=queue).inc())
    try:
        from cms.scheduled_jobs import record_scheduled_start

        record_scheduled_start(name, time.time())
    except Exception:
        logger.debug("Could not record the scheduled job start", exc_info=True)


def _on_task_postrun(sender=None, task_id=None, state=None, retval=None, **kwargs):
    name = _task_name(sender=sender, **kwargs)
    queue = normalize_queue(sender=sender, **kwargs)
    if task_id in _task_labels:
        name, queue = _task_labels.pop(task_id)
    if task_id and task_id in _task_start_times:
        elapsed = time.monotonic() - _task_start_times.pop(task_id)
        _safe_metric(
            "Celery duration", lambda: CELERY_TASK_DURATION_SECONDS.labels(task_name=name, queue=queue).observe(elapsed)
        )
    if state == "SUCCESS":
        _safe_metric(
            "Celery succeeded", lambda: CELERY_TASKS_TOTAL.labels(task_name=name, queue=queue, state="succeeded").inc()
        )
        domain_outcome = "failed" if retval is False else "succeeded"
        reason = "returned_false" if retval is False else "none"
        _record_task_domain_result(name, domain_outcome, reason)
        _record_scheduled_result(name, domain_outcome, reason, retval)
    _safe_metric("Celery active", lambda: CELERY_TASK_ACTIVE.labels(task_name=name, queue=queue).dec())


def _terminal_task_event(state, sender=None, task_id=None, **kwargs):
    name, queue = _task_labels.get(
        task_id, (_task_name(sender=sender, **kwargs), normalize_queue(sender=sender, **kwargs))
    )
    _safe_metric(f"Celery {state}", lambda: CELERY_TASKS_TOTAL.labels(task_name=name, queue=queue, state=state).inc())


def _on_task_failure(sender=None, task_id=None, **kwargs):
    _terminal_task_event("failed", sender=sender, task_id=task_id, **kwargs)
    name = _task_name(sender=sender, **kwargs)
    _record_task_domain_result(name, "failed", "task_exception")
    _record_scheduled_result(name, "failed", "task_exception")


def _on_task_retry(sender=None, request=None, **kwargs):
    _terminal_task_event("retried", sender=sender, task_id=getattr(request, "id", None), **kwargs)
    name = _task_name(sender=sender, **kwargs)
    _record_task_domain_result(name, "retried", "task_retry")
    _record_scheduled_result(name, "retried", "task_retry")


def _on_task_revoked(sender=None, request=None, **kwargs):
    _terminal_task_event("revoked", sender=sender, task_id=getattr(request, "id", None), **kwargs)
    name = _task_name(sender=sender, **kwargs)
    _record_task_domain_result(name, "cancelled", "task_revoked")
    _record_scheduled_result(name, "cancelled", "task_revoked")


def _worker_label(sender=None) -> str:
    if sender is not None and getattr(sender, "hostname", None):
        return str(sender.hostname)
    return socket.gethostname()


def _on_worker_ready(sender=None, **kwargs):
    CELERY_WORKER_UP.labels(worker=_worker_label(sender)).set(1)


def _on_worker_shutdown(sender=None, **kwargs):
    CELERY_WORKER_UP.labels(worker=_worker_label(sender)).set(0)


def _on_heartbeat(sender=None, **kwargs):
    _safe_metric(
        "worker heartbeat",
        lambda: CELERY_WORKER_HEARTBEAT_TIMESTAMP.labels(worker=_worker_label(sender)).set(time.time()),
    )


def _on_beat_init(sender=None, **kwargs):
    _safe_metric("beat freshness", lambda: CELERY_BEAT_FRESHNESS_TIMESTAMP.set(time.time()))


def _on_user_login_failed(sender=None, **kwargs):
    AUTH_FAILURES_TOTAL.labels(source="django").inc()


def connect_signal_handlers() -> None:
    task_prerun.connect(_on_task_prerun, dispatch_uid="cinemata_metrics_task_prerun", weak=False)
    task_postrun.connect(_on_task_postrun, dispatch_uid="cinemata_metrics_task_postrun", weak=False)
    task_failure.connect(_on_task_failure, dispatch_uid="cinemata_metrics_task_failure", weak=False)
    task_retry.connect(_on_task_retry, dispatch_uid="cinemata_metrics_task_retry", weak=False)
    task_revoked.connect(_on_task_revoked, dispatch_uid="cinemata_metrics_task_revoked", weak=False)
    worker_ready.connect(_on_worker_ready, dispatch_uid="cinemata_metrics_worker_ready", weak=False)
    worker_shutdown.connect(_on_worker_shutdown, dispatch_uid="cinemata_metrics_worker_shutdown", weak=False)
    heartbeat_sent.connect(_on_heartbeat, dispatch_uid="cinemata_metrics_worker_heartbeat", weak=False)
    beat_init.connect(_on_beat_init, dispatch_uid="cinemata_metrics_beat_init", weak=False)
    user_login_failed.connect(_on_user_login_failed, dispatch_uid="cinemata_metrics_login_failed", weak=False)


def record_cache_operation(cache_name: str, operation: str, hit: bool | None = None, ok: bool = True) -> None:
    if not ok:
        result = "error"
    elif hit is None:
        result = "ok"
    else:
        result = "hit" if hit else "miss"
    _safe_metric(
        "cache operation",
        lambda: CACHE_OPERATIONS_TOTAL.labels(cache=cache_name, operation=operation, result=result).inc(),
    )


def _profile_labels(profile) -> dict[str, str]:
    return {
        "resolution": str(getattr(profile, "resolution", None) or "unknown"),
        "codec": str(getattr(profile, "codec", None) or "unknown"),
        "extension": str(getattr(profile, "extension", None) or "unknown"),
    }


def observe_media_pipeline(media, profile, status: str) -> None:
    outcome = "succeeded" if status in {"success", "succeeded"} else "failed"
    reason_code = "none" if outcome == "succeeded" else "encoding_failed"
    _safe_metric(
        "media encoding profile",
        lambda: MEDIA_ENCODING_PROFILE_TOTAL.labels(
            outcome=outcome,
            reason_code=reason_code,
            **_profile_labels(profile),
        ).inc(),
    )
    record_domain_outcome("encoding", outcome, reason_code)
    media_type = str(getattr(media, "media_type", None) or "unknown")
    duration = getattr(media, "duration", 0) or 0
    if duration > 0:
        _safe_metric(
            "media duration",
            lambda: MEDIA_DURATION_SECONDS.labels(media_type=media_type).observe(duration),
        )
    try:
        if getattr(media, "media_file", None):
            _safe_metric(
                "media file size",
                lambda: MEDIA_FILE_SIZE_BYTES.labels(media_type=media_type).observe(media.media_file.size),
            )
    except Exception:
        logger.debug("Could not read media file size", exc_info=True)


def record_stale_encoding(encoding) -> None:
    _safe_metric(
        "stale encoding",
        lambda: ENCODING_STALE_TOTAL.labels(**_profile_labels(encoding.profile)).inc(),
    )


def refresh_runtime_metrics() -> None:
    _refresh_queue_depths()
    _refresh_transcription_requests()
    _refresh_stalled_encodings()


def _refresh_queue_depths() -> None:
    try:
        from django_redis import get_redis_connection

        connection = get_redis_connection("default")
        for queue in getattr(settings, "OBSERVABILITY_CELERY_QUEUES", []):
            CELERY_QUEUE_DEPTH.labels(queue=queue).set(connection.llen(queue))
    except Exception:
        logger.debug("Could not refresh Celery queue depth metrics", exc_info=True)


def _refresh_transcription_requests() -> None:
    try:
        from files.models import TranscriptionRequest

        for translate in (False, True):
            count = TranscriptionRequest.objects.filter(translate_to_english=translate).count()
            TRANSCRIPTION_REQUESTS.labels(translate_to_english=str(translate).lower()).set(count)
    except Exception:
        logger.debug("Could not refresh transcription request metrics", exc_info=True)


def _refresh_stalled_encodings() -> None:
    try:
        from files.models import Encoding

        threshold = time.time() - getattr(settings, "RUNNING_STATE_STALE", 7200)
        by_profile = {}
        for encoding in Encoding.objects.filter(status="running").select_related("profile"):
            if encoding.update_date and encoding.update_date.timestamp() < threshold:
                labels = tuple(_profile_labels(encoding.profile).values())
                by_profile[labels] = by_profile.get(labels, 0) + 1
        for (resolution, codec, extension), count in by_profile.items():
            ENCODING_STALLED.labels(resolution=resolution, codec=codec, extension=extension).set(count)
        for resolution, codec, extension in _stalled_encoding_label_values - set(by_profile):
            ENCODING_STALLED.labels(resolution=resolution, codec=codec, extension=extension).set(0)
        _stalled_encoding_label_values.clear()
        _stalled_encoding_label_values.update(by_profile)
    except Exception:
        logger.debug("Could not refresh stalled encoding metrics", exc_info=True)


connect_signal_handlers()
