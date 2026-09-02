from unittest.mock import Mock, patch

from django.test import SimpleTestCase

from cms.scheduled_jobs import SCHEDULED_JOBS, record_scheduled_outcome


class ScheduledJobContractTests(SimpleTestCase):
    def test_beat_freshness_runs_on_a_consumed_queue(self):
        from cms.celery import record_beat_freshness

        self.assertEqual(record_beat_freshness.queue, "short_tasks")

    def test_registry_matches_the_production_beat_schedule(self):
        from django.conf import settings

        self.assertEqual(set(SCHEDULED_JOBS), set(settings.CELERY_BEAT_SCHEDULE))
        for job in SCHEDULED_JOBS.values():
            self.assertGreater(job.cadence_seconds, 0)
            self.assertGreaterEqual(job.absence_seconds, job.cadence_seconds)
            self.assertTrue(job.owner)

    def test_success_updates_last_success_but_skip_does_not(self):
        with (
            patch("cms.scheduled_jobs.SCHEDULED_JOB_RUNS_TOTAL") as runs,
            patch("cms.scheduled_jobs.SCHEDULED_JOB_LAST_SUCCESS") as last_success,
            patch("cms.scheduled_jobs.record_domain_outcome") as domain,
        ):
            runs.labels.return_value.inc = Mock()
            last_success.labels.return_value.set = Mock()
            record_scheduled_outcome("clear_sessions", "skipped", "lock_held", timestamp=10)
            last_success.labels.return_value.set.assert_not_called()
            record_scheduled_outcome("clear_sessions", "succeeded", timestamp=20)
        last_success.labels.assert_called_once_with(job="clear_sessions")
        last_success.labels.return_value.set.assert_called_once_with(20)
        domain.assert_any_call("scheduled.clear_sessions", "skipped", "lock_held")

    def test_celery_signal_records_structured_job_result(self):
        from files import metrics

        sender = type("Sender", (), {"name": "clear_sessions", "request": None})()
        result = {"outcome": "skipped", "reason_code": "lock_held", "processed": 3}
        with patch("cms.scheduled_jobs.record_scheduled_outcome") as record:
            metrics._on_task_postrun(sender=sender, task_id="job-1", state="SUCCESS", retval=result)
        record.assert_called_once_with(
            "clear_sessions",
            "skipped",
            "lock_held",
            processed=3,
            changed=0,
            failed=0,
            timestamp=record.call_args.kwargs["timestamp"],
        )
