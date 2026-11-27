import logging

from django.utils import timezone
from prometheus_client import Counter, Histogram

from cms.observability import current_trace_ids

logger = logging.getLogger("events")

QUEUE = "short_tasks"

HANDLER_RUNS_TOTAL = Counter(
    "cinematacms_domain_event_handler_runs_total",
    "Domain event handler attempt results",
    ["outcome", "reason_code"],
)
DISPATCH_LAG_SECONDS = Histogram(
    "cinematacms_domain_event_dispatch_lag_seconds",
    "Time from a domain event to the first attempt of each of its handlers",
    buckets=(0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600, 1800),
)


def _log(name: str, event_id, event_type: str, **fields) -> None:
    try:
        trace_id, span_id = current_trace_ids()
        logger.info(
            name,
            extra={
                "domain_event_id": str(event_id),
                "domain_event_type": event_type,
                "queue": QUEUE,
                "trace_id": trace_id,
                "span_id": span_id,
                **fields,
            },
        )
    except Exception:
        logger.debug("Could not record domain event telemetry", exc_info=True)


def record_emitted(event) -> None:
    _log("cinematacms.domain_event.emitted", event.id, event.type, event_version=event.version)


def record_dispatched(event, handler_count: int, *, queued: bool) -> None:
    _log(
        "cinematacms.domain_event.dispatched",
        event.id,
        event.type,
        handler_count=handler_count,
        outcome="queued" if queued else "not_queued",
        reason_code="" if queued else "queue_publish_failed",
    )


def record_dispatch_not_queued(event_id) -> None:
    _log(
        "cinematacms.domain_event.dispatched",
        event_id,
        "",
        outcome="not_queued",
        reason_code="queue_publish_failed",
    )


def record_run_not_queued(run) -> None:
    _log(
        "cinematacms.domain_event.handler_run",
        run.event_id,
        "",
        event_handler=run.handler,
        attempt=run.attempt_count,
        outcome="not_queued",
        reason_code="queue_publish_failed",
    )


def observe_dispatch_lag(event) -> None:
    try:
        DISPATCH_LAG_SECONDS.observe(max(0.0, (timezone.now() - event.occurred_at).total_seconds()))
    except Exception:
        logger.debug("Could not record the domain event dispatch lag", exc_info=True)


def record_handler_result(run, event_type: str, outcome: str, reason_code: str = "") -> None:
    """Count one attempt that ended as succeeded, retried or failed, and log it."""

    try:
        HANDLER_RUNS_TOTAL.labels(outcome=outcome, reason_code=reason_code or "none").inc()
    except Exception:
        logger.debug("Could not count the domain event handler result", exc_info=True)
    _log(
        "cinematacms.domain_event.handler_run",
        run.event_id,
        event_type,
        event_handler=run.handler,
        attempt=run.attempt_count,
        # The log filter sets task_id to the task writing the line, which for recovery is not the handler's.
        handler_task_id=run.celery_task_id,
        outcome=outcome,
        reason_code=reason_code,
    )
