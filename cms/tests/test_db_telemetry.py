import logging
from contextlib import contextmanager
from types import SimpleNamespace
from unittest.mock import Mock, patch

from django.conf import settings
from django.test import SimpleTestCase, override_settings

from cms.db_backend.postgresql.base import DatabaseWrapper
from cms.db_backend.telemetry import (
    DB_QUERY_DURATION_SECONDS,
    DatabaseTelemetryCursor,
    current_database_context,
    database_context,
)


class DatabaseBackendConfigurationTests(SimpleTestCase):
    def test_default_database_uses_the_owned_telemetry_backend(self):
        self.assertEqual(settings.DATABASES["default"]["ENGINE"], "cms.db_backend.postgresql")


class DatabaseContextTests(SimpleTestCase):
    def test_context_is_bounded_and_is_cleared_after_the_scope(self):
        self.assertEqual(current_database_context(), ("other", "other"))

        with database_context("web", "media_api"):
            self.assertEqual(current_database_context(), ("web", "media_api"))

        self.assertEqual(current_database_context(), ("other", "other"))

    def test_invalid_context_values_use_other_and_report_a_contract_violation(self):
        with patch("cms.db_backend.telemetry.record_contract_violation") as violation:
            with database_context("invalid-workload", "unregistered-route"):
                self.assertEqual(current_database_context(), ("other", "other"))

        self.assertEqual(violation.call_count, 2)
        violation.assert_any_call("database", "workload")
        violation.assert_any_call("database", "context_group")


class DatabaseTelemetryCursorTests(SimpleTestCase):
    def setUp(self):
        self.raw_cursor = Mock()
        self.raw_cursor.execute.return_value = "executed"
        self.raw_cursor.executemany.return_value = "executed-many"
        self.cursor = DatabaseTelemetryCursor(self.raw_cursor, "default")

    @override_settings(OBSERVABILITY_SLOW_QUERY_SECONDS=999)
    def test_successful_web_query_records_bounded_labels_and_no_parameters(self):
        with (
            database_context("web", "media_api"),
            patch.object(DB_QUERY_DURATION_SECONDS, "labels") as labels,
            patch("cms.db_backend.telemetry.start_span") as start_span,
        ):
            labels.return_value.observe = Mock()
            start_span.return_value = _span_context_manager()

            result = self.cursor.execute(
                "SELECT email FROM accounts WHERE password = %s",
                ("user-secret",),
            )

        self.assertEqual(result, "executed")
        labels.assert_called_once_with(
            workload="web",
            context_group="media_api",
            operation="select",
            outcome="success",
            database="default",
        )
        labels.return_value.observe.assert_called_once()
        start_span.assert_called_once()
        attributes = start_span.call_args.kwargs["attributes"]
        self.assertNotIn("email", attributes)
        self.assertNotIn("password", attributes)
        self.assertNotIn("user-secret", repr(attributes))
        self.assertNotIn("SELECT", repr(attributes))
        self.assertIn("db.query.fingerprint", attributes)

    @override_settings(OBSERVABILITY_SLOW_QUERY_SECONDS=0)
    def test_failed_slow_query_emits_privacy_safe_events_and_preserves_error(self):
        sensitive_sql = "SELECT secret_value FROM private_accounts WHERE token = %s"
        sensitive_parameter = "do-not-log-this"
        original_error = RuntimeError("original database failure")
        self.raw_cursor.execute.side_effect = original_error

        with (
            database_context("celery", "encoding"),
            patch.object(DB_QUERY_DURATION_SECONDS, "labels") as labels,
            self.assertLogs("cms.db_backend.telemetry", level=logging.WARNING) as captured,
            self.assertRaises(RuntimeError) as raised,
        ):
            labels.return_value.observe = Mock()
            self.cursor.execute(sensitive_sql, (sensitive_parameter,))

        self.assertIs(raised.exception, original_error)
        labels.assert_called_once_with(
            workload="celery",
            context_group="encoding",
            operation="select",
            outcome="error",
            database="default",
        )
        self.assertTrue(any("cinematacms.db.query.failed" in message for message in captured.output))
        self.assertTrue(any("cinematacms.db.query.slow" in message for message in captured.output))
        joined = "\n".join(captured.output)
        self.assertNotIn(sensitive_sql, joined)
        self.assertNotIn(sensitive_parameter, joined)
        self.assertNotIn(str(original_error), joined)

    @override_settings(OBSERVABILITY_SLOW_QUERY_SECONDS=999)
    def test_executemany_records_update_operation_and_many_is_not_inspected(self):
        with (
            database_context("celery", "storage_maintenance"),
            patch.object(DB_QUERY_DURATION_SECONDS, "labels") as labels,
        ):
            labels.return_value.observe = Mock()
            result = self.cursor.executemany(
                "UPDATE media SET title = %s WHERE id = %s",
                iter([("new-title", "media-1")]),
            )

        self.assertEqual(result, "executed-many")
        labels.assert_called_once_with(
            workload="celery",
            context_group="storage_maintenance",
            operation="update",
            outcome="success",
            database="default",
        )

    def test_metric_failure_cannot_change_query_result(self):
        with (
            patch.object(DB_QUERY_DURATION_SECONDS, "labels", side_effect=RuntimeError("metrics unavailable")),
            patch("cms.db_backend.telemetry.record_telemetry_failure") as failure,
        ):
            result = self.cursor.execute("SELECT 1")

        self.assertEqual(result, "executed")
        failure.assert_called_once_with("metrics", "database", "emit")

    @override_settings(OBSERVABILITY_SLOW_QUERY_SECONDS=999)
    def test_copy_entry_points_record_query_telemetry(self):
        self.raw_cursor.copy_expert.return_value = "copied-from"
        self.raw_cursor.copy_from.return_value = "copied-from-table"
        self.raw_cursor.copy_to.return_value = "copied-to"

        with patch.object(DB_QUERY_DURATION_SECONDS, "labels") as labels:
            labels.return_value.observe = Mock()
            self.assertEqual(self.cursor.copy_expert("COPY media FROM STDIN", object()), "copied-from")
            self.assertEqual(self.cursor.copy_from(object(), "media"), "copied-from-table")
            self.assertEqual(self.cursor.copy_to(object(), "media"), "copied-to")

        self.assertEqual(labels.call_count, 3)
        self.assertTrue(all(call.kwargs["operation"] == "other" for call in labels.call_args_list))


class PostgreSQLCursorFactoryTests(SimpleTestCase):
    def test_normal_and_debug_factories_return_telemetry_cursors_with_copy_methods(self):
        wrapper = DatabaseWrapper.__new__(DatabaseWrapper)
        wrapper.alias = "default"
        raw_cursor = Mock()

        with (
            patch(
                "django.db.backends.postgresql.base.DatabaseWrapper.make_cursor",
                side_effect=lambda cursor: cursor,
            ),
            patch(
                "django.db.backends.postgresql.base.DatabaseWrapper.make_debug_cursor",
                side_effect=lambda cursor: cursor,
            ),
        ):
            cursors = [wrapper.make_cursor(raw_cursor), wrapper.make_debug_cursor(raw_cursor)]

        for cursor in cursors:
            self.assertIsInstance(cursor, DatabaseTelemetryCursor)
            self.assertTrue(callable(cursor.copy_expert))
            self.assertTrue(callable(cursor.copy_from))
            self.assertTrue(callable(cursor.copy_to))


@contextmanager
def _span_context_manager():
    yield SimpleNamespace()
