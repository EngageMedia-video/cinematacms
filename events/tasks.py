import random
from datetime import timedelta

from celery import shared_task
from django.db import transaction
from django.db.models import Exists, F, OuterRef, Q
from django.utils import timezone

from cms.error_tracking import capture_unexpected_exception

from . import telemetry
from .models import ACTIVE_STATUSES, MAX_ATTEMPTS, DomainEvent, EventHandlerRun, HandlerRunStatus
from .registry import get_registry
from .service import enqueue_dispatch, enqueue_run

# An event is dispatched within seconds of its commit, so one still waiting after this lost its task.
STALE_DISPATCH_AFTER = timedelta(minutes=2)
# Longer than the handler's hard time limit plus the longest retry countdown.
STALE_RUN_AFTER = timedelta(minutes=10)
RETENTION = timedelta(days=30)
RECOVERY_BATCH_SIZE = 500


def _retry_countdown(attempt: int) -> int:
    return min(240, 30 * (2 ** (attempt - 1))) + random.randint(0, 10)


@shared_task(name="dispatch_domain_event", queue="short_tasks", acks_late=True)
def dispatch_domain_event(event_id: str):
    """Create one run per handler of the event, then queue every run that has not started."""

    event = DomainEvent.objects.filter(pk=event_id).first()
    if event is None:
        return "missing"
    handlers = get_registry().handlers_for(event.type)
    with transaction.atomic():
        EventHandlerRun.objects.bulk_create(
            [EventHandlerRun(event=event, handler=handler.name) for handler in handlers],
            ignore_conflicts=True,
        )
        DomainEvent.objects.filter(pk=event.pk, dispatched_at__isnull=True).update(dispatched_at=timezone.now())
    queued = [enqueue_run(run) for run in EventHandlerRun.objects.filter(event=event, status=HandlerRunStatus.PENDING)]
    telemetry.record_dispatched(event, len(handlers), queued=all(queued))
    return "dispatched"


@shared_task(
    bind=True,
    name="run_domain_event_handler",
    queue="short_tasks",
    soft_time_limit=120,
    time_limit=150,
    acks_late=True,
)
def run_domain_event_handler(self, run_id: int):
    """Run one handler for one event. Up to four attempts, then the run fails and waits for a replay."""

    # A run is queued again by recovery and by a repeated dispatch, so only one delivery may claim it.
    claimed = EventHandlerRun.objects.filter(
        pk=run_id,
        status__in=(HandlerRunStatus.PENDING, HandlerRunStatus.RETRYING),
        attempt_count__lt=MAX_ATTEMPTS,
    ).update(
        status=HandlerRunStatus.RUNNING,
        attempt_count=F("attempt_count") + 1,
        celery_task_id=self.request.id or "",
        reason_code="",
        updated_at=timezone.now(),
    )
    if not claimed:
        return "not_claimed"
    run = EventHandlerRun.objects.select_related("event").get(pk=run_id)
    event = run.event
    if run.attempt_count == 1:
        telemetry.observe_dispatch_lag(event)

    handler = get_registry().handler(event.type, run.handler)
    if handler is None:
        _finish(run, event, HandlerRunStatus.FAILED, "handler_missing")
        return run.status

    try:
        # The handler's writes and its success commit together, so a crash after the handler cannot
        # leave a finished run marked as running.
        with transaction.atomic():
            handler.func(event)
            EventHandlerRun.objects.filter(pk=run.pk).update(
                status=HandlerRunStatus.SUCCEEDED, updated_at=timezone.now()
            )
    except Exception as error:
        capture_unexpected_exception(error)
        if EventHandlerRun.objects.filter(pk=run.pk, status=HandlerRunStatus.SUCCEEDED).exists():
            # The success committed, then a callback the handler queued with on_commit() raised. Another
            # attempt would repeat the committed writes, so the run stays succeeded.
            run.status = HandlerRunStatus.SUCCEEDED
            telemetry.record_handler_result(run, event.type, "succeeded")
            return run.status
        if run.attempt_count < MAX_ATTEMPTS:
            _finish(run, event, HandlerRunStatus.RETRYING, "handler_error")
            enqueue_run(run, countdown=_retry_countdown(run.attempt_count))
        else:
            _finish(run, event, HandlerRunStatus.FAILED, "handler_error")
        return run.status

    run.status = HandlerRunStatus.SUCCEEDED
    telemetry.record_handler_result(run, event.type, "succeeded")
    return run.status


def _finish(run, event, status, reason_code):
    run.status = status
    run.reason_code = reason_code
    run.save(update_fields=["status", "reason_code", "updated_at"])
    telemetry.record_handler_result(
        run, event.type, "retried" if status == HandlerRunStatus.RETRYING else "failed", reason_code
    )


@shared_task(name="recover_domain_events", queue="short_tasks")
def recover_domain_events(batch_size=RECOVERY_BATCH_SIZE):
    """Queue again the events and runs whose task was lost, and settle runs whose worker died."""

    now = timezone.now()
    undispatched = list(
        DomainEvent.objects.filter(dispatched_at__isnull=True, occurred_at__lt=now - STALE_DISPATCH_AFTER)
        .order_by("occurred_at")
        .values_list("pk", flat=True)[:batch_size]
    )
    for event_id in undispatched:
        enqueue_dispatch(event_id)

    stale_runs = list(
        EventHandlerRun.objects.select_related("event")
        .filter(status__in=ACTIVE_STATUSES, updated_at__lt=now - STALE_RUN_AFTER)
        .order_by("updated_at")[:batch_size]
    )
    changed = 0
    for run in stale_runs:
        if run.status == HandlerRunStatus.RUNNING:
            status = HandlerRunStatus.RETRYING if run.attempt_count < MAX_ATTEMPTS else HandlerRunStatus.FAILED
            reason_code = "worker_lost"
        else:
            status, reason_code = run.status, run.reason_code
        # The run may have moved on since it was read; only change it if it has not.
        if not EventHandlerRun.objects.filter(pk=run.pk, status=run.status, updated_at=run.updated_at).update(
            status=status, reason_code=reason_code, updated_at=timezone.now()
        ):
            continue
        changed += 1
        if run.status == HandlerRunStatus.RUNNING:
            run.status, run.reason_code = status, reason_code
            telemetry.record_handler_result(
                run, run.event.type, "retried" if status == HandlerRunStatus.RETRYING else "failed", reason_code
            )
        if status != HandlerRunStatus.FAILED:
            enqueue_run(run)

    return {
        "outcome": "succeeded",
        "processed": len(undispatched) + len(stale_runs),
        "changed": len(undispatched) + changed,
    }


@shared_task(name="cleanup_domain_events", queue="short_tasks")
def cleanup_domain_events(batch_size=1000):
    """Delete events whose every handler run ended more than the retention period ago."""

    cutoff = timezone.now() - RETENTION
    unfinished_or_recent = EventHandlerRun.objects.filter(event=OuterRef("pk")).filter(
        Q(status__in=ACTIVE_STATUSES) | Q(updated_at__gte=cutoff)
    )
    # An event is dispatched after it occurs, so the occurred_at bound only narrows the scan to its index.
    ids = list(
        DomainEvent.objects.filter(occurred_at__lt=cutoff, dispatched_at__lt=cutoff)
        .filter(~Exists(unfinished_or_recent))
        .values_list("pk", flat=True)[:batch_size]
    )
    deleted = _delete_ended_events(ids, cutoff) if ids else 0
    return {"outcome": "succeeded", "processed": len(ids), "changed": deleted}


def _delete_ended_events(event_ids, cutoff) -> int:
    """Delete the events whose runs all still ended before the cutoff, and return how many were deleted."""

    with transaction.atomic():
        # replay_domain_event_runs locks the runs it resets, so a replay either finishes first and its run
        # fails the check below, or waits and finds its run deleted.
        runs = (
            EventHandlerRun.objects.select_for_update()
            .filter(event_id__in=event_ids)
            .order_by("pk")
            .values_list("event_id", "status", "updated_at")
        )
        kept = {event_id for event_id, status, updated_at in runs if status in ACTIVE_STATUSES or updated_at >= cutoff}
        ended = [event_id for event_id in event_ids if event_id not in kept]
        if ended:
            DomainEvent.objects.filter(pk__in=ended).delete()
    return len(ended)
