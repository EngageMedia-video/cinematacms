"""Bounded, privacy-safe database telemetry.

The backend wrapper keeps this seam below Django's request and task code. The
context manager is the small integration point for those callers: middleware
and Celery signals can bind a route group or task family without exposing raw
paths or task names to the database metric.
"""

from __future__ import annotations

import hashlib
import logging
import math
import re
import time
from collections.abc import Iterator
from contextlib import contextmanager
from contextvars import ContextVar, Token
from dataclasses import dataclass
from typing import Any

from django.conf import settings
from prometheus_client import Histogram

try:
    from cms.observability import start_span
except Exception:  # pragma: no cover - only reached during partial startup.

    @contextmanager
    def start_span(name: str, attributes: dict[str, Any] | None = None):
        del name, attributes
        yield None


logger = logging.getLogger(__name__)

DB_QUERY_BUCKETS = (
    0.001,
    0.005,
    0.01,
    0.025,
    0.05,
    0.1,
    0.25,
    0.5,
    1,
    2,
    5,
    10,
    30,
)

DB_QUERY_DURATION_SECONDS = Histogram(
    "cinematacms_db_query_duration_seconds",
    "Database query duration by bounded workload, context, operation, outcome, and database.",
    ["workload", "context_group", "operation", "outcome", "database"],
    buckets=DB_QUERY_BUCKETS,
)

WORKLOADS = frozenset({"web", "celery", "other"})
ROUTE_GROUPS = frozenset(
    {
        "system",
        "pages",
        "web_search",
        "media_delivery",
        "upload_ui",
        "upload_transfer",
        "search_api",
        "media_api",
        "moderation_api",
        "moderation_ui",
        "self_upload_api",
        "notifications_api",
        "users_api",
        "playlists_api",
        "taxonomy_api",
        "task_api",
        "api_other",
        "third_party",
        "unmatched",
    }
)
TASK_FAMILIES = frozenset(
    {
        "encoding",
        "transcription",
        "media_derivative",
        "media_lifecycle",
        "storage_maintenance",
        "discovery",
        "user_activity",
        "email_delivery",
        "platform_maintenance",
        "diagnostic",
    }
)
CONTEXT_GROUPS = ROUTE_GROUPS | TASK_FAMILIES | {"other"}
OPERATIONS = frozenset({"select", "insert", "update", "delete", "transaction", "other"})
OUTCOMES = frozenset({"success", "error"})
DATABASES = frozenset({"default", "other"})

_DEFAULT_CONTEXT = None
_DATABASE_CONTEXT: ContextVar[DatabaseContext | None] = ContextVar(
    "cinematacms_database_context",
    default=_DEFAULT_CONTEXT,
)

_SQL_COMMENT = re.compile(r"(?:--[^\r\n]*|/\*.*?\*/)", re.DOTALL)
_SQL_STRING = re.compile(r"(?:[eEnN]?'(?:''|\\.|[^'])*'|\"(?:\"\"|\\.|[^\"])*\")", re.DOTALL)
_SQL_DOLLAR_STRING = re.compile(r"\$[A-Za-z_][A-Za-z0-9_]*\$.*?\$[A-Za-z_][A-Za-z0-9_]*\$|\$\$.*?\$\$", re.DOTALL)
_SQL_NUMBER = re.compile(r"(?<![A-Za-z_])(?:0x[0-9A-Fa-f]+|\d+(?:\.\d+)?)(?![A-Za-z_])")
_SQL_PARAMETER = re.compile(r"(?:%\([^)]+\)s|%s|\$\d+|\?)")
_SQL_WORD = re.compile(r"[A-Za-z_]+")

_TASK_FAMILY_PREFIXES = {
    "encoding": ("encode_media", "files.tasks.encode", "chunkize_media"),
    "transcription": ("whisper_", "files.tasks.whisper"),
    "media_derivative": ("produce_sprite", "produce_thumbnail"),
    "media_lifecycle": ("files.tasks.media", "files.tasks.delete"),
    "storage_maintenance": ("files.tasks.storage",),
    "discovery": ("files.tasks.index", "files.tasks.discover"),
    "user_activity": ("users.tasks.", "notifications.tasks."),
    "email_delivery": ("email_delivery.tasks.", "deliver_email"),
    "platform_maintenance": ("cms.tasks.", "recover_stale"),
    "diagnostic": ("cms.celery.debug_task",),
}


@dataclass(frozen=True)
class DatabaseContext:
    workload: str = "other"
    context_group: str = "other"


def record_telemetry_failure(signal: str, component: str, stage: str) -> None:
    """Count a failed emission without allowing a second failure to escape."""

    try:
        from files.metrics import record_telemetry_failure as shared_record
    except Exception:
        shared_record = None

    if shared_record is not None and shared_record is not record_telemetry_failure:
        try:
            shared_record(signal, component, stage)
            return
        except Exception:
            pass

    logger.debug("Telemetry failure before shared metrics loaded: %s/%s/%s", signal, component, stage)


def record_contract_violation(component: str, field: str) -> None:
    """Report an unexpected bounded value while retaining application behavior."""

    try:
        from files.metrics import record_contract_violation as shared_record
    except Exception:
        shared_record = None

    if shared_record is not None and shared_record is not record_contract_violation:
        try:
            shared_record(component, field)
            return
        except Exception:
            pass

    record_telemetry_failure("metrics", "telemetry_contract", "emit")


def _normalize_workload(workload: str) -> str:
    value = workload if isinstance(workload, str) else ""
    if value in WORKLOADS:
        return value
    record_contract_violation("database", "workload")
    return "other"


def _normalize_context_group(context_group: str) -> str:
    value = context_group if isinstance(context_group, str) else ""
    if value in CONTEXT_GROUPS:
        return value
    record_contract_violation("database", "context_group")
    return "other"


def _normalize_database(database: str) -> str:
    return database if database in DATABASES else "other"


def _task_family(task_name: str) -> str:
    for family, prefixes in _TASK_FAMILY_PREFIXES.items():
        if task_name.startswith(prefixes) or any(prefix in task_name for prefix in prefixes):
            return family
    record_contract_violation("database", "context_group")
    return "other"


def _automatic_context() -> DatabaseContext:
    """Infer Celery context when no middleware or signal has explicitly bound it."""

    try:
        from celery import current_task

        task = current_task
        request = getattr(task, "request", None)
        task_name = getattr(task, "name", "")
        if request is not None and task_name:
            return DatabaseContext("celery", _task_family(str(task_name)))
    except Exception:
        pass
    return DatabaseContext()


def current_database_context() -> tuple[str, str]:
    context = _DATABASE_CONTEXT.get()
    if context is None:
        context = _automatic_context()
    return context.workload, context.context_group


def set_database_context(workload: str, context_group: str) -> Token:
    """Bind bounded database workload context and return its reset token."""

    context = DatabaseContext(_normalize_workload(workload), _normalize_context_group(context_group))
    return _DATABASE_CONTEXT.set(context)


def reset_database_context(token: Token) -> None:
    """Restore the context represented by a token returned from ``set``."""

    try:
        _DATABASE_CONTEXT.reset(token)
    except Exception:
        record_telemetry_failure("context", "database", "reset")


@contextmanager
def database_context(workload: str, context_group: str) -> Iterator[None]:
    """Record database queries under a bounded web or Celery context."""

    token = set_database_context(workload, context_group)
    try:
        yield
    finally:
        reset_database_context(token)


def _strip_sql(sql: Any) -> str:
    try:
        text = str(sql)
    except Exception:
        return ""
    text = _SQL_COMMENT.sub(" ", text)
    text = _SQL_DOLLAR_STRING.sub("?", text)
    text = _SQL_STRING.sub("?", text)
    text = _SQL_PARAMETER.sub("?", text)
    text = _SQL_NUMBER.sub("?", text)
    return " ".join(text.split())


def sql_fingerprint(sql: Any) -> str:
    """Return an opaque, stable fingerprint without retaining query text."""

    normalized = _strip_sql(sql).lower()
    digest = hashlib.sha256(normalized.encode("utf-8", "replace")).hexdigest()
    return f"v1:{digest[:24]}"


def database_operation(sql: Any) -> str:
    """Map SQL to the fixed operation vocabulary required by the contract."""

    normalized = _strip_sql(sql).upper()
    words = _SQL_WORD.findall(normalized)
    if not words:
        return "other"
    first = words[0]
    if first == "WITH":
        for candidate in words[1:]:
            if candidate in {"SELECT", "INSERT", "UPDATE", "DELETE"}:
                first = candidate
                break
    if first in {"BEGIN", "COMMIT", "ROLLBACK", "SAVEPOINT", "RELEASE"}:
        return "transaction"
    if first.lower() in OPERATIONS:
        return first.lower()
    return "other"


def _slow_query_threshold() -> float:
    try:
        threshold = float(getattr(settings, "OBSERVABILITY_SLOW_QUERY_SECONDS", 1.0))
    except (TypeError, ValueError):
        return 1.0
    return threshold if math.isfinite(threshold) and threshold >= 0 else 1.0


def _safe_metric(labels: dict[str, str], duration: float) -> None:
    try:
        DB_QUERY_DURATION_SECONDS.labels(**labels).observe(duration)
    except Exception:
        record_telemetry_failure("metrics", "database", "emit")


def _event(event_name: str, labels: dict[str, str], duration: float, fingerprint: str, error: Exception | None) -> None:
    payload: dict[str, Any] = {
        **labels,
        "duration_ms": round(duration * 1000, 3),
        "fingerprint": fingerprint,
    }
    if error is not None:
        payload["error_type"] = type(error).__name__[:64]
    try:
        logger.warning(event_name, extra=payload)
    except Exception:
        record_telemetry_failure("logs", "database", "emit")


def record_database_query(
    sql: Any,
    duration: float,
    *,
    outcome: str,
    database: str = "default",
    error: Exception | None = None,
) -> None:
    """Record one query and optional privacy-safe diagnostic events."""

    try:
        workload, context_group = current_database_context()
        operation = database_operation(sql)
        if operation not in OPERATIONS:
            operation = "other"
        if outcome not in OUTCOMES:
            record_contract_violation("database", "outcome")
            outcome = "error" if error is not None else "success"
        labels = {
            "workload": _normalize_workload(workload),
            "context_group": _normalize_context_group(context_group),
            "operation": operation,
            "outcome": outcome,
            "database": _normalize_database(database),
        }
        safe_duration = max(0.0, float(duration))
        fingerprint = sql_fingerprint(sql)
    except Exception:
        record_telemetry_failure("database", "database", "prepare")
        return

    _safe_metric(labels, safe_duration)
    if error is not None:
        _event("cinematacms.db.query.failed", labels, safe_duration, fingerprint, error)
    if safe_duration >= _slow_query_threshold():
        _event("cinematacms.db.query.slow", labels, safe_duration, fingerprint, error)


def _set_span_outcome(span: Any, outcome: str) -> None:
    if span is None:
        return
    try:
        span.set_attribute("cinematacms.db.outcome", outcome)
    except Exception:
        record_telemetry_failure("traces", "database", "attribute")


@contextmanager
def _database_span(operation: str, database: str, workload: str, context_group: str, fingerprint: str):
    attributes = {
        "cinematacms.db.workload": workload,
        "cinematacms.db.context_group": context_group,
        "cinematacms.db.operation": operation,
        "cinematacms.db.database": database,
        "db.query.fingerprint": fingerprint,
    }
    manager = None
    try:
        manager = start_span("cinematacms.db.query", attributes=attributes)
        span = manager.__enter__()
    except Exception:
        record_telemetry_failure("traces", "database", "start")
        yield None
        return

    try:
        yield span
    except BaseException as error:
        try:
            manager.__exit__(type(error), error, error.__traceback__)
        except Exception:
            record_telemetry_failure("traces", "database", "finish")
        raise
    else:
        try:
            manager.__exit__(None, None, None)
        except Exception:
            record_telemetry_failure("traces", "database", "finish")


class DatabaseTelemetryCursor:
    """Delegate cursor behavior while observing execute-like operations."""

    def __init__(self, cursor: Any, database: str):
        self.cursor = cursor
        self.database = _normalize_database(database)

    def execute(self, sql: Any, params: Any = None):
        return self._execute(sql, lambda: self.cursor.execute(sql, params))

    def executemany(self, sql: Any, param_list: Any):
        return self._execute(sql, lambda: self.cursor.executemany(sql, param_list))

    def callproc(self, procname: Any, params: Any = None):
        return self._execute(procname, lambda: self.cursor.callproc(procname, params))

    def copy_expert(self, sql: Any, file: Any, size: int = 8192):
        return self._execute(sql, lambda: self.cursor.copy_expert(sql, file, size=size))

    def copy_from(
        self,
        file: Any,
        table: str,
        sep: str = "\t",
        null: str = r"\N",
        size: int = 8192,
        columns: Any = None,
    ):
        statement = f"COPY {table} FROM STDIN"
        return self._execute(
            statement,
            lambda: self.cursor.copy_from(file, table, sep=sep, null=null, size=size, columns=columns),
        )

    def copy_to(
        self,
        file: Any,
        table: str,
        sep: str = "\t",
        null: str = r"\N",
        columns: Any = None,
    ):
        statement = f"COPY {table}"
        return self._execute(
            statement,
            lambda: self.cursor.copy_to(file, table, sep=sep, null=null, columns=columns),
        )

    def _execute(self, sql: Any, callback):
        workload, context_group = current_database_context()
        operation = database_operation(sql)
        fingerprint = sql_fingerprint(sql)
        start = None
        try:
            start = time.perf_counter()
        except Exception:
            record_telemetry_failure("timing", "database", "start")

        try:
            with _database_span(operation, self.database, workload, context_group, fingerprint) as span:
                result = callback()
                _set_span_outcome(span, "success")
        except Exception as error:
            duration = 0.0
            if start is not None:
                try:
                    duration = max(0.0, time.perf_counter() - start)
                except Exception:
                    record_telemetry_failure("timing", "database", "finish")
            _record_database_query_safely(sql, duration, "error", self.database, error)
            raise

        duration = 0.0
        if start is not None:
            try:
                duration = max(0.0, time.perf_counter() - start)
            except Exception:
                record_telemetry_failure("timing", "database", "finish")
        _record_database_query_safely(sql, duration, "success", self.database, None)
        return result

    def __getattr__(self, name: str):
        return getattr(self.cursor, name)

    def __iter__(self):
        return iter(self.cursor)

    def __enter__(self):
        self.cursor.__enter__()
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return self.cursor.__exit__(exc_type, exc_value, traceback)


def _record_database_query_safely(
    sql: Any,
    duration: float,
    outcome: str,
    database: str,
    error: Exception | None,
) -> None:
    try:
        record_database_query(sql, duration, outcome=outcome, database=database, error=error)
    except Exception:
        record_telemetry_failure("database", "database", "record")
