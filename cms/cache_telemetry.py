"""Application-owned cache access with bounded, fail-soft telemetry.

The rest of the application uses :data:`owned_cache` instead of importing a
Django cache backend.  A logical operation is observed once here, including
operations that use a backend pipeline or several backend commands.
"""

from __future__ import annotations

import logging
import math
import time
from collections.abc import Callable
from contextlib import contextmanager
from typing import Any

from django.conf import settings
from django.core.cache import cache as django_cache

from files.metrics import (
    CACHE_ITEMS_TOTAL,
    CACHE_OPERATION_DURATION_SECONDS,
    CACHE_OPERATIONS_TOTAL,
    record_contract_violation,
    record_telemetry_failure,
)

try:
    from cms.observability import start_span
except Exception:  # pragma: no cover - only reached during partial startup.

    @contextmanager
    def start_span(name: str, attributes: dict[str, Any] | None = None):
        del name, attributes
        yield None


CACHE_FAMILIES = frozenset(
    {
        "permission",
        "query",
        "query_version",
        "media_path",
        "storage_usage",
        "popular_media",
        "maintenance_timing",
        "hls_coordination",
        "scheduled_task_lock",
        "restricted_media_token",
        "restricted_media_rate_limit",
        "cache_probe",
    }
)
CACHE_OPERATIONS = frozenset(
    {"read", "bulk_read", "write", "invalidate", "lock", "probe", "token_validate", "rate_limit", "other"}
)
CACHE_RESULTS = frozenset({"hit", "partial_hit", "miss", "success", "error", "other"})
CACHE_BUCKETS = (0.0005, 0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5)

logger = logging.getLogger("cinematacms.cache")


def _normalize(value: Any, allowed: frozenset[str], *, field: str, fallback: str) -> str:
    if isinstance(value, str) and value in allowed:
        return value
    record_contract_violation("cache", field)
    return fallback


def _slow_threshold() -> float:
    try:
        threshold = float(getattr(settings, "OBSERVABILITY_SLOW_CACHE_SECONDS", 0.1))
    except (TypeError, ValueError):
        return 0.1
    if not math.isfinite(threshold) or threshold < 0:
        return 0.1
    return threshold


@contextmanager
def _safe_cache_span(family: str, operation: str):
    manager = None
    try:
        manager = start_span(
            "cinematacms.cache.operation",
            attributes={
                "cinematacms.cache.family": family,
                "cinematacms.cache.operation": operation,
            },
        )
        span = manager.__enter__()
    except Exception:
        record_telemetry_failure("traces", "cache", "start")
        yield None
        return

    try:
        yield span
    except BaseException as error:
        try:
            manager.__exit__(type(error), error, error.__traceback__)
        except Exception:
            record_telemetry_failure("traces", "cache", "finish")
        raise
    else:
        try:
            manager.__exit__(None, None, None)
        except Exception:
            record_telemetry_failure("traces", "cache", "finish")


def _safe_span_attribute(span: Any, name: str, value: Any) -> None:
    if span is None:
        return
    try:
        span.set_attribute(name, value)
    except Exception:
        record_telemetry_failure("traces", "cache", "attribute")


def _safe_counter(family: str, operation: str, result: str) -> None:
    try:
        CACHE_OPERATIONS_TOTAL.labels(family=family, operation=operation, result=result).inc()
    except Exception:
        record_telemetry_failure("metrics", "cache", "emit")


def _safe_duration(family: str, operation: str, result: str, duration: float) -> None:
    try:
        CACHE_OPERATION_DURATION_SECONDS.labels(family=family, operation=operation, result=result).observe(duration)
    except Exception:
        record_telemetry_failure("metrics", "cache", "emit")


def _safe_items(family: str, result: str, count: int) -> None:
    if count <= 0:
        return
    try:
        CACHE_ITEMS_TOTAL.labels(family=family, result=result).inc(count)
    except Exception:
        record_telemetry_failure("metrics", "cache", "emit")


def _safe_event(event_name: str, family: str, operation: str, result: str, duration: float) -> None:
    try:
        logger.warning(
            event_name,
            extra={
                "family": family,
                "operation": operation,
                "result": result,
                "duration_ms": round(duration * 1000, 3),
            },
        )
    except Exception:
        record_telemetry_failure("logs", "cache", "emit")


class OwnedCacheAdapter:
    """Own the application boundary around Django's configured cache backend."""

    def __init__(self, backend: Any | None = None, *, clock: Callable[[], float] | None = None):
        self.backend = django_cache if backend is None else backend
        self.clock = clock or time.perf_counter

    def bind(self, family: str) -> BoundCacheAdapter:
        return BoundCacheAdapter(self, family)

    def supports(self, method: str) -> bool:
        return callable(getattr(self.backend, method, None))

    def _call(self, method: str, *args: Any, version: int | None = None, **kwargs: Any) -> Any:
        if version is not None:
            kwargs["version"] = version
        return getattr(self.backend, method)(*args, **kwargs)

    def _run(
        self,
        family: Any,
        operation: Any,
        callback: Callable[[Any], Any],
        *,
        fallback: Any,
        classify: Callable[[Any], str],
        item_counts: Callable[[Any], tuple[int, int]] | None = None,
    ) -> Any:
        normalized_family = _normalize(family, CACHE_FAMILIES, field="family", fallback="cache_probe")
        normalized_operation = _normalize(operation, CACHE_OPERATIONS, field="operation", fallback="other")
        value = fallback
        result = "error"
        error = False
        span = None
        try:
            started = self.clock()
        except Exception:
            started = 0.0
            record_telemetry_failure("timing", "cache", "start")

        try:
            with _safe_cache_span(normalized_family, normalized_operation) as span:
                value = callback(span)
                result = _normalize(classify(value), CACHE_RESULTS, field="result", fallback="other")
                _safe_span_attribute(span, "cinematacms.cache.result", result)
        except Exception:
            error = True
            result = "error"

        try:
            duration = max(0.0, self.clock() - started)
        except Exception:
            duration = 0.0
            record_telemetry_failure("timing", "cache", "finish")

        _safe_counter(normalized_family, normalized_operation, result)
        _safe_duration(normalized_family, normalized_operation, result, duration)
        if item_counts is not None and not error:
            try:
                hits, misses = item_counts(value)
            except Exception:
                record_telemetry_failure("metrics", "cache", "emit")
            else:
                _safe_items(normalized_family, "hit", hits)
                _safe_items(normalized_family, "miss", misses)
        if error:
            _safe_event("cinematacms.cache.operation.failed", normalized_family, normalized_operation, result, duration)
        if duration >= _slow_threshold():
            _safe_event("cinematacms.cache.operation.slow", normalized_family, normalized_operation, result, duration)
        return value

    def get(self, family: str, key: str, default: Any = None, *, version: int | None = None) -> Any:
        missing = object()

        def callback(_span: Any) -> Any:
            return self._call("get", key, missing, version=version)

        value = self._run(
            family,
            "read",
            callback,
            fallback=missing,
            classify=lambda value: "miss" if value is missing else "hit",
        )
        return default if value is missing else value

    def get_many(self, family: str, keys: list[str] | tuple[str, ...], *, version: int | None = None) -> dict:
        requested = len(keys)

        def callback(_span: Any) -> dict:
            return dict(self._call("get_many", keys, version=version))

        def classify(values: dict) -> str:
            hits = len(values)
            if hits == 0:
                return "miss"
            if hits == requested:
                return "hit"
            return "partial_hit"

        def item_counts(values: Any) -> tuple[int, int]:
            if isinstance(values, dict):
                hits = len(values)
                return hits, max(0, requested - hits)
            return 0, requested

        values = self._run(
            family,
            "bulk_read",
            callback,
            fallback={},
            classify=classify,
            item_counts=item_counts,
        )
        if isinstance(values, dict):
            return values
        return {}

    def set(self, family: str, key: str, value: Any, timeout: int | None = None, *, version: int | None = None) -> bool:
        def callback(_span: Any) -> bool:
            self._call("set", key, value, timeout, version=version)
            return True

        return bool(self._run(family, "write", callback, fallback=False, classify=lambda _value: "success"))

    def set_many(
        self,
        family: str,
        data: dict,
        timeout: int | None = None,
        *,
        version: int | None = None,
    ) -> bool:
        def callback(_span: Any) -> bool:
            self._call("set_many", data, timeout, version=version)
            return True

        return bool(self._run(family, "write", callback, fallback=False, classify=lambda _value: "success"))

    def add(self, family: str, key: str, value: Any, timeout: int | None = None, *, version: int | None = None) -> bool:
        def callback(_span: Any) -> bool:
            return bool(self._call("add", key, value, timeout, version=version))

        return bool(
            self._run(family, "lock", callback, fallback=False, classify=lambda added: "success" if added else "miss")
        )

    def incr(self, family: str, key: str, delta: int = 1, *, version: int | None = None) -> int:
        def callback(_span: Any) -> int:
            return int(self._call("incr", key, delta, version=version))

        return int(self._run(family, "write", callback, fallback=0, classify=lambda _value: "success"))

    def delete(self, family: str, key: str, *, version: int | None = None) -> bool:
        def callback(_span: Any) -> bool:
            self._call("delete", key, version=version)
            return True

        return bool(self._run(family, "invalidate", callback, fallback=False, classify=lambda _value: "success"))

    def delete_many(self, family: str, keys: list[str] | tuple[str, ...], *, version: int | None = None) -> bool:
        def callback(_span: Any) -> bool:
            self._call("delete_many", keys, version=version)
            return True

        return bool(self._run(family, "invalidate", callback, fallback=False, classify=lambda _value: "success"))

    def delete_pattern(self, family: str, pattern: str, *, version: int | None = None) -> int:
        def callback(_span: Any) -> int:
            return int(self._call("delete_pattern", pattern, version=version))

        return int(self._run(family, "invalidate", callback, fallback=0, classify=lambda _value: "success"))

    def sadd(self, family: str, key: str, value: Any) -> int:
        def callback(_span: Any) -> int:
            return int(self._call("sadd", key, value))

        return int(self._run(family, "write", callback, fallback=0, classify=lambda _value: "success"))

    def smembers(self, family: str, key: str) -> set:
        def callback(_span: Any) -> set:
            return set(self._call("smembers", key))

        return set(
            self._run(family, "read", callback, fallback=set(), classify=lambda values: "hit" if values else "miss")
        )

    def expire(self, family: str, key: str, timeout: int) -> bool:
        def callback(_span: Any) -> bool:
            return bool(self._call("expire", key, timeout))

        return bool(self._run(family, "write", callback, fallback=False, classify=lambda _value: "success"))

    def get_stats(self) -> dict:
        def callback(_span: Any) -> dict:
            getter = getattr(self.backend, "get_stats", None)
            if not callable(getter):
                return {"message": "Cache statistics not available"}
            return dict(getter())

        return self._run(
            "cache_probe", "probe", callback, fallback={"error": "cache unavailable"}, classify=lambda _value: "success"
        )

    def probe(self, key: str, value: Any = "probe", timeout: int = 30) -> dict[str, Any]:
        def callback(_span: Any) -> bool:
            self._call("set", key, value, timeout)
            retrieved = self._call("get", key, None)
            self._call("delete", key)
            return retrieved == value

        healthy = self._run(
            "cache_probe", "probe", callback, fallback=False, classify=lambda ok: "success" if ok else "miss"
        )
        return {"status": "healthy" if healthy else "unhealthy"}


class BoundCacheAdapter:
    """Family-bound facade used by application modules."""

    def __init__(self, adapter: OwnedCacheAdapter, family: str):
        self.adapter = adapter
        self.family = family

    def get(self, key: str, default: Any = None, *, version: int | None = None) -> Any:
        return self.adapter.get(self.family, key, default, version=version)

    def get_many(self, keys: list[str] | tuple[str, ...], *, version: int | None = None) -> dict:
        return self.adapter.get_many(self.family, keys, version=version)

    def set(self, key: str, value: Any, timeout: int | None = None, *, version: int | None = None) -> bool:
        return self.adapter.set(self.family, key, value, timeout, version=version)

    def set_many(self, data: dict, timeout: int | None = None, *, version: int | None = None) -> bool:
        return self.adapter.set_many(self.family, data, timeout, version=version)

    def add(self, key: str, value: Any, timeout: int | None = None, *, version: int | None = None) -> bool:
        return self.adapter.add(self.family, key, value, timeout, version=version)

    def incr(self, key: str, delta: int = 1, *, version: int | None = None) -> int:
        return self.adapter.incr(self.family, key, delta, version=version)

    def delete(self, key: str, *, version: int | None = None) -> bool:
        return self.adapter.delete(self.family, key, version=version)

    def delete_many(self, keys: list[str] | tuple[str, ...], *, version: int | None = None) -> bool:
        return self.adapter.delete_many(self.family, keys, version=version)

    def delete_pattern(self, pattern: str, *, version: int | None = None) -> int:
        return self.adapter.delete_pattern(self.family, pattern, version=version)

    def sadd(self, key: str, value: Any) -> int:
        return self.adapter.sadd(self.family, key, value)

    def smembers(self, key: str) -> set:
        return self.adapter.smembers(self.family, key)

    def expire(self, key: str, timeout: int) -> bool:
        return self.adapter.expire(self.family, key, timeout)

    def supports(self, method: str) -> bool:
        return self.adapter.supports(method)


owned_cache = OwnedCacheAdapter()
