from django.db import transaction
from django.db.transaction import TransactionManagementError

from . import telemetry
from .models import DomainEvent
from .registry import get_registry


def emit(event_type: str, *, actor, payload: dict) -> DomainEvent:
    """Record a Domain event in the caller's transaction and dispatch it once that transaction commits.

    ``actor`` is the user who made the change, or ``None`` for the system. An unauthenticated user
    counts as no actor. Raises ``UnknownEventType`` or ``InvalidEventPayload`` for an event that
    ``events/catalog.py`` does not describe.
    """

    if not transaction.get_connection().in_atomic_block:
        raise TransactionManagementError("emit() must run inside the transaction that makes the change")
    spec = get_registry().spec(event_type)
    spec.validate(payload)
    if actor is not None and not getattr(actor, "is_authenticated", False):
        actor = None
    event = DomainEvent.objects.create(type=spec.name, version=spec.version, actor=actor, payload=payload)
    telemetry.record_emitted(event)
    transaction.on_commit(lambda: enqueue_dispatch(event.id))
    return event


def enqueue_dispatch(event_id) -> None:
    """Queue the dispatch of an event. A failure leaves it to ``recover_domain_events``."""

    from .tasks import dispatch_domain_event

    try:
        dispatch_domain_event.apply_async(args=[str(event_id)], queue=telemetry.QUEUE)
    except Exception:
        telemetry.record_dispatch_not_queued(event_id)


def enqueue_run(run, *, countdown: int | None = None) -> None:
    """Queue one handler run. A failure leaves it to ``recover_domain_events``."""

    from .tasks import run_domain_event_handler

    try:
        run_domain_event_handler.apply_async(args=[run.pk], queue=telemetry.QUEUE, countdown=countdown)
    except Exception:
        telemetry.record_run_not_queued(run)
