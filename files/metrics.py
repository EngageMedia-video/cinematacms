import hashlib
import hmac
import logging
import time

from celery.signals import (
    beat_init,
    heartbeat_sent,
    task_failure,
    task_postrun,
    task_prerun,
    task_retry,
    task_revoked,
)
from django.conf import settings
from django.contrib.auth.signals import user_login_failed
from prometheus_client import Counter, Gauge, Histogram

logger = logging.getLogger(__name__)

HTTP_DURATION_BUCKETS = (0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30)
DB_DURATION_BUCKETS = (0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30)
CACHE_DURATION_BUCKETS = (0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5)

ENCODING_QUEUE_WAIT_SECONDS = Histogram(
    "cinematacms_encoding_queue_wait_seconds",
    "Time an encoding task waited in the Celery queue before execution",
    buckets=(1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600),
)

HTTP_REQUESTS_TOTAL = Counter(
    "cinematacms_http_requests_total",
    "HTTP requests grouped by bounded application operation",
    ["route_group", "operation", "method", "status_code"],
)
HTTP_REQUEST_DURATION_SECONDS = Histogram(
    "cinematacms_http_request_duration_seconds",
    "HTTP request duration grouped by bounded application operation",
    ["route_group", "operation", "method", "status_class"],
    buckets=HTTP_DURATION_BUCKETS,
)
AUTH_FAILURES_TOTAL = Counter(
    "cinematacms_authentication_failures_total",
    "Failed authentication attempts",
    ["surface", "mechanism", "reason"],
)

CELERY_TASKS_TOTAL = Counter(
    "cinematacms_celery_tasks_total",
    "Celery task lifecycle events",
    ["task_family", "queue", "event", "outcome"],
)
CELERY_TASK_DURATION_SECONDS = Histogram(
    "cinematacms_celery_task_duration_seconds",
    "Celery task duration by task family",
    ["task_family", "queue", "outcome"],
    buckets=(0.1, 0.5, 1, 5, 15, 30, 60, 120, 300, 600, 1800, 3600, 7200),
)
CELERY_TASK_ACTIVE = Gauge(
    "cinematacms_celery_task_active",
    "Currently running Celery tasks by task family",
    ["task_family", "queue"],
    multiprocess_mode="livesum",
)
CELERY_WORKER_HEARTBEAT_TIMESTAMP = Gauge(
    "cinematacms_celery_worker_heartbeat_timestamp_seconds",
    "Unix timestamp of the last Celery worker heartbeat",
    ["service_role", "worker_ref"],
    multiprocess_mode="mostrecent",
)
CELERY_BEAT_FRESHNESS_TIMESTAMP = Gauge(
    "cinematacms_celery_beat_freshness_timestamp_seconds",
    "Unix timestamp when Celery beat initialized",
    multiprocess_mode="mostrecent",
)
DOMAIN_OUTCOMES_TOTAL = Counter(
    "cinematacms_domain_outcomes_total",
    "Application operation outcomes",
    ["operation", "outcome", "reason_code"],
)
CELERY_QUEUE_DEPTH = Gauge(
    "cinematacms_celery_queue_depth",
    "Redis broker queue length by queue name",
    ["queue"],
    multiprocess_mode="mostrecent",
)

MEDIA_ENCODING_PROFILE_TOTAL = Counter(
    "cinematacms_media_encoding_profile_total",
    "Encoding completions by profile and result",
    ["resolution", "codec", "extension", "outcome", "reason_code"],
)
MEDIA_FILE_SIZE_BYTES = Histogram(
    "cinematacms_encoding_input_file_size_bytes",
    "Encoding input file size by media type",
    ["media_type"],
    buckets=(1_000_000, 10_000_000, 50_000_000, 100_000_000, 500_000_000, 1_000_000_000, 5_000_000_000),
)
MEDIA_DURATION_SECONDS = Histogram(
    "cinematacms_encoding_input_duration_seconds",
    "Encoding input duration by media type",
    ["media_type"],
    buckets=(30, 60, 300, 600, 1200, 1800, 3600, 7200, 14400),
)
TRANSCRIPTION_REQUESTS = Gauge(
    "cinematacms_transcription_database_stale",
    "Persisted transcription request rows that have not progressed",
    ["translate_to_english"],
    multiprocess_mode="mostrecent",
)
ENCODING_STALE_TOTAL = Counter(
    "cinematacms_encoding_stale_total",
    "Encoding rows considered stale and requeued",
    ["resolution", "codec", "extension"],
)
ENCODING_STALLED = Gauge(
    "cinematacms_encoding_stalled",
    "Current running encoding rows older than RUNNING_STATE_STALE",
    ["resolution", "codec", "extension"],
    multiprocess_mode="mostrecent",
)
CACHE_OPERATIONS_TOTAL = Counter(
    "cinematacms_cache_operations_total",
    "Application-owned logical cache operations",
    ["family", "operation", "result"],
)
CACHE_OPERATION_DURATION_SECONDS = Histogram(
    "cinematacms_cache_operation_duration_seconds",
    "Application-owned logical cache operation duration",
    ["family", "operation", "result"],
    buckets=CACHE_DURATION_BUCKETS,
)
CACHE_ITEMS_TOTAL = Counter(
    "cinematacms_cache_items_total",
    "Items returned by logical bulk cache reads",
    ["family", "result"],
)
TELEMETRY_EMISSION_FAILURES_TOTAL = Counter(
    "cinematacms_telemetry_emission_failures_total",
    "Runtime telemetry emission failures",
    ["signal", "component", "stage"],
)
TELEMETRY_CONTRACT_VIOLATIONS_TOTAL = Counter(
    "cinematacms_telemetry_contract_violations_total",
    "Unexpected values normalized by the telemetry contract",
    ["component", "field"],
)

_task_start_times: dict[str, float] = {}
_task_labels: dict[str, tuple[str, str]] = {}
_stalled_encoding_label_values: set[tuple[str, str, str]] = set()
_telemetry_warning_state: dict[tuple[str, str, str], tuple[float, int]] = {}


def validate_telemetry_settings() -> None:
    thresholds = {
        "OBSERVABILITY_SLOW_REQUEST_SECONDS": HTTP_DURATION_BUCKETS,
        "OBSERVABILITY_SLOW_QUERY_SECONDS": DB_DURATION_BUCKETS,
        "OBSERVABILITY_SLOW_CACHE_SECONDS": CACHE_DURATION_BUCKETS,
    }
    for setting_name, buckets in thresholds.items():
        value = getattr(settings, setting_name)
        if value not in buckets:
            raise ValueError(f"{setting_name} must match a telemetry histogram bucket")


def record_telemetry_failure(signal: str, component: str, stage: str) -> None:
    try:
        TELEMETRY_EMISSION_FAILURES_TOTAL.labels(signal=signal, component=component, stage=stage).inc()
    except Exception:
        logger.debug("Could not record telemetry emission failure", exc_info=True)
    key = (signal, component, stage)
    try:
        now = time.monotonic()
        previous = _telemetry_warning_state.get(key)
        if previous is not None and now - previous[0] < 60:
            _telemetry_warning_state[key] = (previous[0], previous[1] + 1)
            return
        suppressed_count = previous[1] if previous is not None else 0
        _telemetry_warning_state[key] = (now, 0)
        logger.warning(
            "cinematacms.telemetry.emission_failed",
            extra={
                "signal": signal,
                "component": component,
                "stage": stage,
                "suppressed_count": suppressed_count,
            },
        )
    except Exception:
        pass


def record_contract_violation(component: str, field: str) -> None:
    try:
        TELEMETRY_CONTRACT_VIOLATIONS_TOTAL.labels(component=component, field=field).inc()
    except Exception:
        record_telemetry_failure("metrics", "telemetry_contract", "emit")


def _safe_metric(metric_name: str, emit, component: str = "application") -> None:
    try:
        emit()
    except Exception:
        record_telemetry_failure("metrics", component, "emit")
        logger.debug("Could not record %s metric", metric_name, exc_info=True)


def _task_name(sender=None, task_id=None, **kwargs) -> str:
    if sender is not None and getattr(sender, "name", None):
        return str(sender.name)
    task = kwargs.get("task")
    if task is not None and getattr(task, "name", None):
        return str(task.name)
    return "unknown"


QUEUE_NAMES = frozenset({"long_tasks", "short_tasks", "whisper_tasks", "email_tasks", "default"})
DOMAIN_OUTCOMES = frozenset({"succeeded", "failed", "skipped", "retried", "cancelled"})
DOMAIN_OPERATIONS = frozenset(
    {
        "encoding",
        "hls",
        "transcription",
        "sprites",
        "email_delivery",
        "chunking",
        "media_derivative",
        "media_lifecycle",
        "storage_maintenance",
        "discovery",
        "user_activity",
        "platform_maintenance",
        "diagnostic",
        "other",
    }
)
DOMAIN_REASON_CODES = frozenset(
    {
        "none",
        "encoding_failed",
        "configuration_error",
        "media_not_found",
        "no_h264_encoding",
        "lock_held",
        "subprocess_timeout",
        "subprocess_failed",
        "missing_playlist",
        "encryption_bypass",
        "lock_expired",
        "returned_false",
        "task_exception",
        "task_retry",
        "task_revoked",
        "queue_publish_failed",
        "preference_changed",
        "smtp_4xx",
        "smtp_5xx",
        "timeout",
        "worker_lost",
        "item_errors",
        "cleanup_failed",
        "dependency_unavailable",
        "invalid_credentials",
        "malformed_credentials",
        "inactive_principal",
        "csrf_rejected",
        "rate_limited",
        "missing_credentials",
        "invalid_token",
        "internal_error",
        "other",
    }
)
MEDIA_TASK_OPERATIONS = {
    "chunkize_media": "chunking",
    "whisper_transcribe": "transcription",
    "produce_sprite_from_video": "sprites",
}
TASK_FAMILY_BY_NAME = {
    "chunkize_media": "encoding",
    "encode_media": "encoding",
    "whisper_transcribe": "transcription",
    "produce_sprite_from_video": "media_derivative",
    "create_hls": "media_derivative",
    "media_init": "media_lifecycle",
    "refresh_media_storage_usage": "storage_maintenance",
    "check_running_states": "media_lifecycle",
    "check_media_states": "media_lifecycle",
    "check_pending_states": "media_lifecycle",
    "check_missing_profiles": "media_lifecycle",
    "clear_sessions": "platform_maintenance",
    "save_user_action": "user_activity",
    "get_list_of_popular_media": "discovery",
    "update_listings_thumbnails": "media_derivative",
    "start_missing_encodings": "encoding",
    "sum_two_numbers": "diagnostic",
    "sum_two_numbers_two": "diagnostic",
    "beat_test": "diagnostic",
    "remove_media_file": "media_lifecycle",
    "cleanup_orphaned_uploads": "storage_maintenance",
    "cleanup_orphaned_draft_media": "media_lifecycle",
    "subscribe_user": "user_activity",
    "dispatch_deferred_encodings": "encoding",
    "apply_visibility_schedules": "media_lifecycle",
    "deliver_email": "email_delivery",
    "recover_stale_email_deliveries": "email_delivery",
    "cleanup_email_delivery_receipts": "email_delivery",
    "notify_followers_new_media": "user_activity",
    "record_beat_freshness": "platform_maintenance",
    "cms.celery.debug_task": "diagnostic",
}


def normalize_task_family(task_name: str) -> str:
    short_name = task_name.rsplit(".", 1)[-1]
    family = TASK_FAMILY_BY_NAME.get(task_name) or TASK_FAMILY_BY_NAME.get(short_name)
    if family:
        return family
    record_contract_violation("celery", "task_family")
    return "unknown"


def worker_reference() -> str:
    worker_id = getattr(settings, "TELEMETRY_WORKER_ID", "")
    secret = getattr(settings, "TELEMETRY_WORKER_HMAC_KEY", "")
    if not worker_id or not secret:
        record_contract_violation("celery", "worker_ref")
        return f"v1:{'0' * 32}"
    digest = hmac.new(secret.encode(), f"v1:{worker_id}".encode(), hashlib.sha256).hexdigest()[:32]
    return f"v1:{digest}"


def normalize_queue(sender=None, **kwargs) -> str:
    request = getattr(sender, "request", None)
    delivery = getattr(request, "delivery_info", None) or kwargs.get("delivery_info") or {}
    queue = delivery.get("routing_key") or delivery.get("exchange") or "default"
    if queue in QUEUE_NAMES:
        return queue
    record_contract_violation("celery", "queue")
    return "default"


def record_domain_outcome(operation: str, outcome: str, reason_code: str = "none") -> None:
    if operation.startswith("scheduled.") or operation in DOMAIN_OPERATIONS:
        normalized_operation = operation
    else:
        record_contract_violation("domain", "operation")
        normalized_operation = "other"
    if outcome not in DOMAIN_OUTCOMES:
        record_contract_violation("domain", "outcome")
        outcome = "failed"
    if reason_code not in DOMAIN_REASON_CODES:
        record_contract_violation("domain", "reason_code")
        reason_code = "other"
    _safe_metric(
        "domain outcome",
        lambda: DOMAIN_OUTCOMES_TOTAL.labels(
            operation=normalized_operation, outcome=outcome, reason_code=reason_code
        ).inc(),
    )
    try:
        from opentelemetry import trace

        span = trace.get_current_span()
        if span.is_recording():
            span.set_attribute("domain.operation", normalized_operation)
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
    family = normalize_task_family(name)
    queue = normalize_queue(sender=sender, **kwargs)
    if task_id:
        _task_start_times[task_id] = time.monotonic()
        _task_labels[task_id] = (family, queue)
    _safe_metric(
        "Celery started",
        lambda: CELERY_TASKS_TOTAL.labels(task_family=family, queue=queue, event="started", outcome="none").inc(),
    )
    _safe_metric("Celery active", lambda: CELERY_TASK_ACTIVE.labels(task_family=family, queue=queue).inc())
    try:
        from cms.scheduled_jobs import record_scheduled_start

        record_scheduled_start(name, time.time())
    except Exception:
        logger.debug("Could not record the scheduled job start", exc_info=True)


def _on_task_postrun(sender=None, task_id=None, state=None, retval=None, **kwargs):
    name = _task_name(sender=sender, **kwargs)
    family = normalize_task_family(name)
    queue = normalize_queue(sender=sender, **kwargs)
    if task_id in _task_labels:
        family, queue = _task_labels.pop(task_id)
    if task_id and task_id in _task_start_times:
        elapsed = time.monotonic() - _task_start_times.pop(task_id)
        duration_outcome = "succeeded" if state == "SUCCESS" else "failed"
        _safe_metric(
            "Celery duration",
            lambda: CELERY_TASK_DURATION_SECONDS.labels(
                task_family=family, queue=queue, outcome=duration_outcome
            ).observe(elapsed),
        )
    if state == "SUCCESS":
        _safe_metric(
            "Celery succeeded",
            lambda: CELERY_TASKS_TOTAL.labels(
                task_family=family, queue=queue, event="completed", outcome="succeeded"
            ).inc(),
        )
        domain_outcome = "failed" if retval is False else "succeeded"
        reason = "returned_false" if retval is False else "none"
        _record_task_domain_result(name, domain_outcome, reason)
        _record_scheduled_result(name, domain_outcome, reason, retval)
    _safe_metric("Celery active", lambda: CELERY_TASK_ACTIVE.labels(task_family=family, queue=queue).dec())


def _terminal_task_event(state, sender=None, task_id=None, **kwargs):
    name = _task_name(sender=sender, **kwargs)
    family, queue = _task_labels.get(task_id, (normalize_task_family(name), normalize_queue(sender=sender, **kwargs)))
    _safe_metric(
        f"Celery {state}",
        lambda: CELERY_TASKS_TOTAL.labels(task_family=family, queue=queue, event="completed", outcome=state).inc(),
    )


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


def _on_heartbeat(sender=None, **kwargs):
    _safe_metric(
        "worker heartbeat",
        lambda: CELERY_WORKER_HEARTBEAT_TIMESTAMP.labels(
            service_role=getattr(settings, "OTEL_SERVICE_ROLE", "unknown"), worker_ref=worker_reference()
        ).set(time.time()),
    )


def _on_beat_init(sender=None, **kwargs):
    _safe_metric("beat freshness", lambda: CELERY_BEAT_FRESHNESS_TIMESTAMP.set(time.time()))


def _on_user_login_failed(sender=None, request=None, **kwargs):
    from cms.authentication_telemetry import record_authentication_failure

    authorization = getattr(request, "META", {}).get("HTTP_AUTHORIZATION", "").lower()
    if authorization.startswith(("basic", "token")):
        return
    record_authentication_failure("account_login", "password", "invalid_credentials")


def connect_signal_handlers() -> None:
    task_prerun.connect(_on_task_prerun, dispatch_uid="cinematacms_metrics_task_prerun", weak=False)
    task_postrun.connect(_on_task_postrun, dispatch_uid="cinematacms_metrics_task_postrun", weak=False)
    task_failure.connect(_on_task_failure, dispatch_uid="cinematacms_metrics_task_failure", weak=False)
    task_retry.connect(_on_task_retry, dispatch_uid="cinematacms_metrics_task_retry", weak=False)
    task_revoked.connect(_on_task_revoked, dispatch_uid="cinematacms_metrics_task_revoked", weak=False)
    heartbeat_sent.connect(_on_heartbeat, dispatch_uid="cinematacms_metrics_worker_heartbeat", weak=False)
    beat_init.connect(_on_beat_init, dispatch_uid="cinematacms_metrics_beat_init", weak=False)
    user_login_failed.connect(_on_user_login_failed, dispatch_uid="cinematacms_metrics_login_failed", weak=False)


def record_cache_operation(cache_name: str, operation: str, hit: bool | None = None, ok: bool = True) -> None:
    if not ok:
        result = "error"
    elif hit is None:
        result = "success"
    else:
        result = "hit" if hit else "miss"
    _safe_metric(
        "cache operation",
        lambda: CACHE_OPERATIONS_TOTAL.labels(family=cache_name, operation=operation, result=result).inc(),
        component="cache",
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
        from cms.redis_telemetry import observability_redis

        for queue in getattr(settings, "OBSERVABILITY_CELERY_QUEUES", []):
            CELERY_QUEUE_DEPTH.labels(queue=queue).set(observability_redis.queue_depth(queue))
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
