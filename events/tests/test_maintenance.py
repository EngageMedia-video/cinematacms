from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from events.models import DomainEvent, EventHandlerRun, HandlerRunStatus
from events.registry import handles
from events.tasks import cleanup_domain_events, recover_domain_events

from .helpers import PAYLOAD, EventTestMixin, handler_name, handler_results

S = HandlerRunStatus


class RecoveryTests(EventTestMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.calls = []

        @handles("thing.happened")
        def record(event):
            self.calls.append(event.id)

        self.handler = handler_name(record)

    def test_stale_runs_are_settled_or_run_again(self):
        cases = [
            # label, status, attempts, age, expected status, expected reason, handler calls
            ("lost worker, attempts left", S.RUNNING, 2, timedelta(minutes=11), S.SUCCEEDED, "", 1),
            ("lost worker, last attempt", S.RUNNING, 4, timedelta(minutes=11), S.FAILED, "worker_lost", 0),
            ("lost pending task", S.PENDING, 0, timedelta(minutes=11), S.SUCCEEDED, "", 1),
            ("lost retry task", S.RETRYING, 1, timedelta(minutes=11), S.SUCCEEDED, "", 1),
            ("still running", S.RUNNING, 1, timedelta(minutes=5), S.RUNNING, "", 0),
            ("already finished", S.FAILED, 4, timedelta(hours=1), S.FAILED, "", 0),
        ]
        for label, status, attempts, age, expected_status, expected_reason, expected_calls in cases:
            with self.subTest(label):
                self.calls.clear()
                run = self.make_run(handler=self.handler, status=status, attempt_count=attempts, age=age)
                recover_domain_events()
                run.refresh_from_db()
                self.assertEqual((run.status, run.reason_code), (expected_status, expected_reason))
                self.assertEqual(len(self.calls), expected_calls)

    def test_a_lost_worker_on_the_last_attempt_is_counted_as_failed(self):
        self.make_run(handler=self.handler, status=S.RUNNING, attempt_count=4, age=timedelta(minutes=11))
        before = handler_results("failed", "worker_lost")
        recover_domain_events()
        self.assertEqual(handler_results("failed", "worker_lost") - before, 1)

    def test_only_events_left_undispatched_for_two_minutes_are_dispatched_again(self):
        now = timezone.now()
        stale = DomainEvent.objects.create(
            type="thing.happened", version=1, payload=dict(PAYLOAD), occurred_at=now - timedelta(minutes=3)
        )
        fresh = DomainEvent.objects.create(
            type="thing.happened", version=1, payload=dict(PAYLOAD), occurred_at=now - timedelta(seconds=30)
        )
        result = recover_domain_events()

        self.assertIsNotNone(DomainEvent.objects.get(pk=stale.pk).dispatched_at)
        self.assertIsNone(DomainEvent.objects.get(pk=fresh.pk).dispatched_at)
        self.assertEqual(self.calls, [stale.id])
        self.assertEqual(result, {"outcome": "succeeded", "processed": 1, "changed": 1})

    def test_a_dispatched_event_without_handlers_is_not_dispatched_again(self):
        event = DomainEvent.objects.create(
            type="nothing.handled",
            version=1,
            payload={},
            occurred_at=timezone.now() - timedelta(hours=1),
            dispatched_at=timezone.now() - timedelta(hours=1),
        )
        with patch("events.tasks.enqueue_dispatch") as enqueue:
            recover_domain_events()
        enqueue.assert_not_called()
        self.assertFalse(EventHandlerRun.objects.filter(event=event).exists())


class CleanupTests(EventTestMixin, TestCase):
    def test_events_are_deleted_30_days_after_all_their_runs_ended(self):
        day = timedelta(days=1)
        cases = [
            # label, run status (None: no run), run age, event age, dispatched, deleted
            ("succeeded 31 days ago", S.SUCCEEDED, 31 * day, 31 * day, True, True),
            ("failed 31 days ago", S.FAILED, 31 * day, 31 * day, True, True),
            ("no handlers, 31 days old", None, None, 31 * day, True, True),
            ("ended 5 days ago", S.SUCCEEDED, 5 * day, 31 * day, True, False),
            ("still retrying", S.RETRYING, 31 * day, 31 * day, True, False),
            ("still pending", S.PENDING, 31 * day, 31 * day, True, False),
            ("never dispatched", None, None, 31 * day, False, False),
            ("10 days old", S.SUCCEEDED, 10 * day, 10 * day, True, False),
        ]
        for label, status, run_age, event_age, dispatched, deleted in cases:
            with self.subTest(label):
                occurred_at = timezone.now() - event_age
                event = DomainEvent.objects.create(
                    type="thing.happened",
                    version=1,
                    payload=dict(PAYLOAD),
                    occurred_at=occurred_at,
                    dispatched_at=occurred_at if dispatched else None,
                )
                if status is not None:
                    run = EventHandlerRun.objects.create(event=event, handler="consumer.handler", status=status)
                    EventHandlerRun.objects.filter(pk=run.pk).update(updated_at=timezone.now() - run_age)

                result = cleanup_domain_events()

                self.assertEqual(DomainEvent.objects.filter(pk=event.pk).exists(), not deleted)
                self.assertEqual(
                    EventHandlerRun.objects.filter(event_id=event.pk).exists(), bool(status and not deleted)
                )
                self.assertEqual(result["changed"], int(deleted))
                DomainEvent.objects.all().delete()
