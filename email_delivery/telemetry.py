import logging

from django.utils import timezone
from prometheus_client import Counter, Histogram

from cms.observability import current_trace_ids, start_span
from files.metrics import record_domain_outcome

logger = logging.getLogger("email_delivery")

DELIVERIES_TOTAL = Counter(
    "cinemata_email_deliveries_total",
    "Email delivery outcomes after queueing",
    ["email_kind", "outcome", "reason_code"],
)
DELIVERY_ATTEMPTS = Histogram(
    "cinemata_email_delivery_attempts",
    "SMTP attempts per terminal email delivery",
    buckets=(1, 2, 3, 4),
)
DELIVERY_LATENCY_SECONDS = Histogram(
    "cinemata_email_delivery_latency_seconds",
    "Time from queueing to terminal email delivery state",
    buckets=(1, 5, 15, 30, 60, 120, 300, 600),
)


def record_terminal_metrics(receipt) -> None:
    try:
        if receipt.attempt_count:
            DELIVERY_ATTEMPTS.observe(receipt.attempt_count)
        DELIVERY_LATENCY_SECONDS.observe((timezone.now() - receipt.created_at).total_seconds())
    except Exception:
        logger.debug("Could not record terminal email metrics", exc_info=True)


def record_event(receipt, outcome: str, reason_code: str = "") -> None:
    try:
        DELIVERIES_TOTAL.labels(email_kind=receipt.email_kind, outcome=outcome, reason_code=reason_code or "none").inc()
        shared_outcome = {
            "smtp_accepted": "succeeded",
            "failed": "failed",
            "skipped": "skipped",
            "retrying": "retried",
            "unknown": "failed",
        }.get(outcome)
        if shared_outcome:
            record_domain_outcome("email_delivery", shared_outcome, reason_code or "none")
        trace_id, span_id = current_trace_ids()
        logger.info(
            "email_delivery",
            extra={
                "delivery_id": str(receipt.delivery_id),
                "recipient_ref": receipt.recipient_ref,
                "task_id": receipt.celery_task_id,
                "task_name": "deliver_email",
                "queue": "email_tasks",
                "trace_id": trace_id,
                "span_id": span_id,
                "attempt": receipt.attempt_count,
                "outcome": outcome,
                "reason_code": reason_code,
            },
        )
    except Exception:
        logger.debug("Could not record email telemetry", exc_info=True)


def delivery_span(receipt):
    return start_span(
        "email.delivery",
        {
            "email.delivery_id": str(receipt.delivery_id),
            "email.recipient_ref": receipt.recipient_ref,
            "email.kind": receipt.email_kind,
            "email.attempt": receipt.attempt_count,
        },
    )
