from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from prometheus_client import REGISTRY

from events.models import DomainEvent, EventHandlerRun
from events.registry import EventSpec, isolated_registry

THING_HAPPENED = EventSpec("thing.happened", 1, ("thing_id", "title"))
PAYLOAD = {"thing_id": 7, "title": "Private title"}


class EventTestMixin:
    """Give each test an empty registry that knows one event type, ``thing.happened``."""

    def setUp(self):
        super().setUp()
        self.registry = self.enterContext(isolated_registry())
        self.registry.define(THING_HAPPENED)

    def emit_and_commit(self, actor=None, payload=None):
        from events.service import emit

        with self.captureOnCommitCallbacks(execute=True), transaction.atomic():
            return emit("thing.happened", actor=actor, payload=dict(payload or PAYLOAD))

    def make_run(self, *, handler, status, attempt_count=0, age=timedelta(0), occurred_age=timedelta(0)):
        """Store an event and one run directly, as if they had been left in this state ``age`` ago."""

        occurred_at = timezone.now() - occurred_age
        event = DomainEvent.objects.create(
            type=THING_HAPPENED.name,
            version=THING_HAPPENED.version,
            payload=dict(PAYLOAD),
            occurred_at=occurred_at,
            dispatched_at=occurred_at,
        )
        run = EventHandlerRun.objects.create(event=event, handler=handler, status=status, attempt_count=attempt_count)
        EventHandlerRun.objects.filter(pk=run.pk).update(updated_at=timezone.now() - age)
        run.refresh_from_db()
        return run


def handler_name(func) -> str:
    return f"{func.__module__}.{func.__qualname__}"


def handler_results(outcome: str, reason_code: str = "none") -> float:
    return (
        REGISTRY.get_sample_value(
            "cinematacms_domain_event_handler_runs_total", {"outcome": outcome, "reason_code": reason_code}
        )
        or 0.0
    )
