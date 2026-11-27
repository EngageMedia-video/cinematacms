from datetime import timedelta
from io import StringIO

from django.core.management import CommandError, call_command
from django.test import TestCase

from events.models import HandlerRunStatus
from events.registry import handles

from .helpers import EventTestMixin, handler_name

S = HandlerRunStatus


class ReplayCommandTests(EventTestMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.calls = []

        @handles("thing.happened")
        def record(event):
            self.calls.append(event.id)

        self.handler = handler_name(record)

    def replay(self, *args):
        out = StringIO()
        with self.captureOnCommitCallbacks(execute=True):
            call_command("replay_domain_event_runs", *args, stdout=out)
        return out.getvalue()

    def failed_run(self, occurred_age=timedelta(0), handler=None):
        return self.make_run(
            handler=handler or self.handler,
            status=S.FAILED,
            attempt_count=4,
            age=timedelta(hours=1),
            occurred_age=occurred_age,
        )

    def test_a_replayed_run_starts_again_from_its_first_attempt(self):
        run = self.failed_run()
        output = self.replay("--event-id", str(run.event_id))
        run.refresh_from_db()
        self.assertEqual((run.status, run.attempt_count, run.reason_code), (S.SUCCEEDED, 1, ""))
        self.assertEqual(self.calls, [run.event_id])
        self.assertIn("Replaying 1 failed handler runs", output)

    def test_runs_are_selected_by_event_time_and_handler(self):
        old = self.failed_run(occurred_age=timedelta(days=3))
        inside = self.failed_run(occurred_age=timedelta(days=1))
        recent = self.failed_run(occurred_age=timedelta(hours=1))
        other_handler = self.failed_run(occurred_age=timedelta(days=1), handler="consumer.event_handlers.other")
        since = (inside.event.occurred_at - timedelta(hours=1)).isoformat()
        until = (inside.event.occurred_at + timedelta(hours=1)).isoformat()

        self.replay("--since", since, "--until", until, "--handler", self.handler)

        runs = {"old": old, "inside": inside, "recent": recent, "other": other_handler}
        for run in runs.values():
            run.refresh_from_db()
        self.assertEqual(
            {name: run.status for name, run in runs.items()},
            {"old": S.FAILED, "inside": S.SUCCEEDED, "recent": S.FAILED, "other": S.FAILED},
        )

    def test_only_failed_runs_are_replayed(self):
        run = self.make_run(handler=self.handler, status=S.SUCCEEDED, attempt_count=1)
        output = self.replay("--event-id", str(run.event_id))
        self.assertEqual(self.calls, [])
        self.assertIn("Replaying 0 failed handler runs", output)

    def test_a_dry_run_counts_without_changing_anything(self):
        run = self.failed_run()
        output = self.replay("--event-id", str(run.event_id), "--dry-run")
        run.refresh_from_db()
        self.assertEqual((run.status, run.attempt_count), (S.FAILED, 4))
        self.assertEqual(self.calls, [])
        self.assertIn("1 failed handler runs would be replayed", output)

    def test_invalid_selections_are_refused(self):
        cases = [
            ("no selector", ()),
            ("handler alone", ("--handler", "consumer.handler")),
            ("until before since", ("--since", "2026-02-01", "--until", "2026-01-01")),
            ("bad event id", ("--event-id", "not-a-uuid")),
            ("bad date", ("--since", "yesterday")),
        ]
        for label, args in cases:
            with self.subTest(label), self.assertRaises(CommandError):
                call_command("replay_domain_event_runs", *args, stdout=StringIO())
