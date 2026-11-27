from unittest.mock import patch

from django.test import TestCase

from events.models import DomainEvent, EventHandlerRun, HandlerRunStatus
from events.registry import handles
from events.tasks import dispatch_domain_event, run_domain_event_handler
from users.models import User

from .helpers import EventTestMixin, handler_name, handler_results


class DispatchTests(EventTestMixin, TestCase):
    def test_every_handler_runs_once_with_the_event(self):
        seen = []

        @handles("thing.happened")
        def notify(event):
            seen.append(("notify", event.id, event.payload["thing_id"]))

        @handles("thing.happened")
        def audit(event):
            seen.append(("audit", event.id, event.payload["thing_id"]))

        event = self.emit_and_commit()

        self.assertCountEqual(seen, [("notify", event.id, 7), ("audit", event.id, 7)])
        self.assertIsNotNone(DomainEvent.objects.get(pk=event.pk).dispatched_at)
        self.assertCountEqual(
            EventHandlerRun.objects.values_list("handler", "status", "attempt_count", "reason_code"),
            [
                (handler_name(notify), HandlerRunStatus.SUCCEEDED, 1, ""),
                (handler_name(audit), HandlerRunStatus.SUCCEEDED, 1, ""),
            ],
        )

    def test_an_event_without_handlers_is_dispatched_with_no_runs(self):
        event = self.emit_and_commit()
        self.assertIsNotNone(DomainEvent.objects.get(pk=event.pk).dispatched_at)
        self.assertFalse(EventHandlerRun.objects.exists())

    def test_a_failing_handler_retries_four_times_and_does_not_block_the_others(self):
        calls = {"broken": 0, "healthy": 0}

        @handles("thing.happened")
        def broken(event):
            calls["broken"] += 1
            raise ValueError("handler bug")

        @handles("thing.happened")
        def healthy(event):
            calls["healthy"] += 1

        retried, failed = handler_results("retried", "handler_error"), handler_results("failed", "handler_error")
        self.emit_and_commit()

        self.assertEqual(calls, {"broken": 4, "healthy": 1})
        runs = dict(EventHandlerRun.objects.values_list("handler", "status"))
        self.assertEqual(runs[handler_name(broken)], HandlerRunStatus.FAILED)
        self.assertEqual(runs[handler_name(healthy)], HandlerRunStatus.SUCCEEDED)
        broken_run = EventHandlerRun.objects.get(handler=handler_name(broken))
        self.assertEqual((broken_run.attempt_count, broken_run.reason_code), (4, "handler_error"))
        self.assertEqual(handler_results("retried", "handler_error") - retried, 3)
        self.assertEqual(handler_results("failed", "handler_error") - failed, 1)

    def test_retries_back_off_between_attempts(self):
        @handles("thing.happened")
        def broken(event):
            raise ValueError("handler bug")

        cases = [(0, 30), (1, 60), (2, 120)]
        for attempts_before, countdown in cases:
            with self.subTest(attempt=attempts_before + 1):
                run = self.make_run(
                    handler=handler_name(broken), status=HandlerRunStatus.RETRYING, attempt_count=attempts_before
                )
                with (
                    patch("events.tasks.random.randint", return_value=0),
                    patch("events.tasks.enqueue_run") as enqueue,
                ):
                    run_domain_event_handler(run.pk)
                enqueue.assert_called_once()
                self.assertEqual(enqueue.call_args.kwargs, {"countdown": countdown})
                run.refresh_from_db()
                self.assertEqual(run.status, HandlerRunStatus.RETRYING)

    def test_a_handler_that_fails_once_succeeds_on_its_next_attempt(self):
        attempts = []

        @handles("thing.happened")
        def flaky(event):
            attempts.append(event.id)
            if len(attempts) == 1:
                raise ConnectionError("database blip")

        self.emit_and_commit()
        run = EventHandlerRun.objects.get()
        self.assertEqual((run.status, run.attempt_count, len(attempts)), (HandlerRunStatus.SUCCEEDED, 2, 2))

    def test_a_failed_attempt_rolls_back_the_handlers_writes(self):
        @handles("thing.happened")
        def half_done(event):
            User.objects.create_user(username=f"made-by-{event.id}", email="made@example.org", password="pw")
            raise ValueError("failed after writing")

        self.emit_and_commit()
        self.assertFalse(User.objects.filter(username__startswith="made-by-").exists())

    def test_a_repeated_dispatch_or_delivery_runs_each_handler_once(self):
        calls = []

        @handles("thing.happened")
        def once(event):
            calls.append(event.id)

        event = self.emit_and_commit()
        dispatch_domain_event(str(event.id))
        run = EventHandlerRun.objects.get()
        self.assertEqual(run_domain_event_handler(run.pk), "not_claimed")
        self.assertEqual(calls, [event.id])
        self.assertEqual(EventHandlerRun.objects.count(), 1)

    def test_a_run_whose_handler_was_removed_fails_without_retrying(self):
        run = self.make_run(handler="consumer.event_handlers.removed", status=HandlerRunStatus.PENDING)
        before = handler_results("failed", "handler_missing")
        run_domain_event_handler(run.pk)
        run.refresh_from_db()
        self.assertEqual((run.status, run.reason_code, run.attempt_count), ("failed", "handler_missing", 1))
        self.assertEqual(handler_results("failed", "handler_missing") - before, 1)

    def test_dispatch_of_a_deleted_event_does_nothing(self):
        self.assertEqual(dispatch_domain_event("00000000-0000-4000-8000-000000000000"), "missing")

    def test_handler_results_are_logged_without_the_payload(self):
        @handles("thing.happened")
        def ok(event):
            pass

        with self.assertLogs("events", "INFO") as logs:
            event = self.emit_and_commit()
        messages = [record.getMessage() for record in logs.records]
        self.assertEqual(
            messages,
            [
                "cinematacms.domain_event.emitted",
                "cinematacms.domain_event.handler_run",
                "cinematacms.domain_event.dispatched",
            ],
        )
        result = logs.records[1]
        self.assertEqual(
            (result.domain_event_id, result.event_handler, result.outcome, result.attempt),
            (str(event.id), handler_name(ok), "succeeded", 1),
        )
        for record in logs.records:
            self.assertNotIn("Private title", str(vars(record)))
