"""PostgreSQL backend that wraps every application cursor execution."""

from django.db.backends.postgresql.base import DatabaseWrapper as PostgreSQLDatabaseWrapper

from cms.db_backend.telemetry import DatabaseTelemetryCursor


class DatabaseWrapper(PostgreSQLDatabaseWrapper):
    """Use Django's PostgreSQL backend while observing cursor executions."""

    def make_cursor(self, cursor):
        return super().make_cursor(DatabaseTelemetryCursor(cursor, self.alias))

    def make_debug_cursor(self, cursor):
        return super().make_debug_cursor(DatabaseTelemetryCursor(cursor, self.alias))
