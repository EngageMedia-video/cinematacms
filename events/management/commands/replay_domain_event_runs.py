import uuid
from datetime import datetime

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime

from events.models import EventHandlerRun, HandlerRunStatus
from events.service import enqueue_run


def _moment(value: str) -> datetime:
    moment = parse_datetime(value)
    if moment is None:
        day = parse_date(value)
        if day is None:
            raise CommandError(f"{value!r} is not a date or an ISO 8601 date and time")
        moment = datetime.combine(day, datetime.min.time())
    if timezone.is_naive(moment):
        moment = timezone.make_aware(moment)
    return moment


def _event_id(value: str) -> uuid.UUID:
    try:
        return uuid.UUID(value)
    except ValueError:
        raise CommandError(f"{value!r} is not an event id") from None


class Command(BaseCommand):
    help = (
        "Run failed domain event handler runs again from their first attempt. "
        "Select them by event id, or by when the event occurred."
    )

    def add_arguments(self, parser):
        parser.add_argument("--event-id", action="append", type=_event_id, default=[], help="Repeat for several")
        parser.add_argument("--since", type=_moment, help="Events that occurred at or after this time")
        parser.add_argument("--until", type=_moment, help="Events that occurred before this time")
        parser.add_argument("--handler", help="Only this handler, by its dotted name")
        parser.add_argument("--dry-run", action="store_true", help="Count the runs without changing them")

    def handle(self, *args, event_id, since, until, handler, dry_run, **options):
        if not event_id and since is None:
            raise CommandError("Pass --event-id or --since, so a replay never selects every failed run by accident")
        if since is not None and until is not None and until <= since:
            raise CommandError("--until must be later than --since")

        runs = EventHandlerRun.objects.filter(status=HandlerRunStatus.FAILED)
        if event_id:
            runs = runs.filter(event_id__in=event_id)
        if since is not None:
            runs = runs.filter(event__occurred_at__gte=since)
        if until is not None:
            runs = runs.filter(event__occurred_at__lt=until)
        if handler:
            runs = runs.filter(handler=handler)

        if dry_run:
            self.stdout.write(f"{runs.count()} failed handler runs would be replayed")
            return

        with transaction.atomic():
            selected = list(runs.select_for_update().order_by("pk"))
            EventHandlerRun.objects.filter(pk__in=[run.pk for run in selected]).update(
                status=HandlerRunStatus.PENDING,
                attempt_count=0,
                reason_code="",
                celery_task_id="",
                updated_at=timezone.now(),
            )
            for run in selected:
                transaction.on_commit(lambda run=run: enqueue_run(run))
        self.stdout.write(self.style.SUCCESS(f"Replaying {len(selected)} failed handler runs"))
