import logging
import socket
import time

from celery.signals import task_postrun, task_prerun, worker_ready, worker_shutdown
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
    ["task_name", "state"],
)
CELERY_TASK_DURATION_SECONDS = Histogram(
    "cinemata_celery_task_duration_seconds",
    "Celery task duration by task name",
    ["task_name"],
    buckets=(0.1, 0.5, 1, 5, 15, 30, 60, 120, 300, 600, 1800, 3600, 7200),
)
CELERY_TASK_ACTIVE = Gauge(
    "cinemata_celery_task_active",
    "Currently running Celery tasks by task name",
    ["task_name"],
)
CELERY_WORKER_UP = Gauge(
    "cinemata_celery_worker_up",
    "Celery worker process seen as ready",
    ["worker"],
)
CELERY_QUEUE_DEPTH = Gauge(
    "cinemata_celery_queue_depth",
    "Redis broker queue length by queue name",
    ["queue"],
)

MEDIA_ENCODING_PROFILE_TOTAL = Counter(
    "cinemata_media_encoding_profile_total",
    "Encoding completions by profile and result",
    ["resolution", "codec", "extension", "status"],
)
MEDIA_FILE_SIZE_BYTES = Histogram(
    "cinemata_media_file_size_bytes",
    "Original media file size by media type",
    ["media_type"],
    buckets=(1_000_000, 10_000_000, 50_000_000, 100_000_000, 500_000_000, 1_000_000_000, 5_000_000_000),
)
MEDIA_DURATION_SECONDS = Histogram(
    "cinemata_media_duration_seconds",
    "Media duration by media type",
    ["media_type"],
    buckets=(30, 60, 300, 600, 1200, 1800, 3600, 7200, 14400),
)
TRANSCRIPTION_REQUESTS = Gauge(
    "cinemata_transcription_requests",
    "Current transcription request rows",
    ["translate_to_english"],
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
)
CACHE_OPERATIONS_TOTAL = Counter(
    "cinemata_cache_operations_total",
    "Explicit project cache helper operations",
    ["cache", "operation", "result"],
)

_task_start_times: dict[str, float] = {}
_stalled_encoding_label_values: set[tuple[str, str, str]] = set()


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


def _on_task_prerun(sender=None, task_id=None, **kwargs):
    name = _task_name(sender=sender, **kwargs)
    if task_id:
        _task_start_times[task_id] = time.monotonic()
    CELERY_TASKS_TOTAL.labels(task_name=name, state="started").inc()
    CELERY_TASK_ACTIVE.labels(task_name=name).inc()


def _on_task_postrun(sender=None, task_id=None, state=None, **kwargs):
    name = _task_name(sender=sender, **kwargs)
    if task_id and task_id in _task_start_times:
        CELERY_TASK_DURATION_SECONDS.labels(task_name=name).observe(time.monotonic() - _task_start_times.pop(task_id))
    if state in {"SUCCESS", "FAILURE"}:
        CELERY_TASKS_TOTAL.labels(task_name=name, state=state.lower()).inc()
    CELERY_TASK_ACTIVE.labels(task_name=name).dec()


def _worker_label(sender=None) -> str:
    if sender is not None and getattr(sender, "hostname", None):
        return str(sender.hostname)
    return socket.gethostname()


def _on_worker_ready(sender=None, **kwargs):
    CELERY_WORKER_UP.labels(worker=_worker_label(sender)).set(1)


def _on_worker_shutdown(sender=None, **kwargs):
    CELERY_WORKER_UP.labels(worker=_worker_label(sender)).set(0)


def _on_user_login_failed(sender=None, **kwargs):
    AUTH_FAILURES_TOTAL.labels(source="django").inc()


def connect_signal_handlers() -> None:
    task_prerun.connect(_on_task_prerun, dispatch_uid="cinemata_metrics_task_prerun", weak=False)
    task_postrun.connect(_on_task_postrun, dispatch_uid="cinemata_metrics_task_postrun", weak=False)
    worker_ready.connect(_on_worker_ready, dispatch_uid="cinemata_metrics_worker_ready", weak=False)
    worker_shutdown.connect(_on_worker_shutdown, dispatch_uid="cinemata_metrics_worker_shutdown", weak=False)
    user_login_failed.connect(_on_user_login_failed, dispatch_uid="cinemata_metrics_login_failed", weak=False)


def record_cache_operation(cache_name: str, operation: str, hit: bool | None = None, ok: bool = True) -> None:
    if not ok:
        result = "error"
    elif hit is None:
        result = "ok"
    else:
        result = "hit" if hit else "miss"
    CACHE_OPERATIONS_TOTAL.labels(cache=cache_name, operation=operation, result=result).inc()


def _profile_labels(profile) -> dict[str, str]:
    return {
        "resolution": str(getattr(profile, "resolution", None) or "unknown"),
        "codec": str(getattr(profile, "codec", None) or "unknown"),
        "extension": str(getattr(profile, "extension", None) or "unknown"),
    }


def observe_media_pipeline(media, profile, status: str) -> None:
    MEDIA_ENCODING_PROFILE_TOTAL.labels(status=status, **_profile_labels(profile)).inc()
    media_type = str(getattr(media, "media_type", None) or "unknown")
    duration = getattr(media, "duration", 0) or 0
    if duration > 0:
        MEDIA_DURATION_SECONDS.labels(media_type=media_type).observe(duration)
    try:
        if getattr(media, "media_file", None):
            MEDIA_FILE_SIZE_BYTES.labels(media_type=media_type).observe(media.media_file.size)
    except Exception:
        logger.debug("Could not observe media file size", exc_info=True)


def record_stale_encoding(encoding) -> None:
    ENCODING_STALE_TOTAL.labels(**_profile_labels(encoding.profile)).inc()


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
