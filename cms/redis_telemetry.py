"""Owned Redis operations for restricted-media token and rate-limit state.

Only this module may acquire the Django Redis connection for application
state.  Higher-level token code supplies opaque storage keys, while this seam
keeps those keys and values out of metrics, logs, and spans.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any

from files.metrics import record_telemetry_failure

from .authentication_telemetry import AuthenticationDependencyUnavailable
from .cache_telemetry import (
    CACHE_FAMILIES,
    CACHE_OPERATIONS,
    CACHE_RESULTS,
    _normalize,
    _safe_cache_span,
    _safe_counter,
    _safe_duration,
    _safe_event,
    _slow_threshold,
)


class RestrictedMediaRedisAdapter:
    """Record one logical operation around each restricted-media Redis workflow."""

    def __init__(self, connection: Any | None = None, *, clock: Callable[[], float] | None = None):
        self.connection = connection
        self.clock = clock or time.perf_counter

    def _connection(self) -> Any:
        if self.connection is None:
            from django_redis import get_redis_connection

            self.connection = get_redis_connection("default")
        return self.connection

    def _run(
        self,
        family: str,
        operation: str,
        callback: Callable[[Any], Any],
        *,
        fallback: Any,
        classify: Callable[[Any], str],
        dependency_required: bool = False,
    ) -> Any:
        normalized_family = _normalize(family, CACHE_FAMILIES, field="family", fallback="cache_probe")
        normalized_operation = _normalize(operation, CACHE_OPERATIONS, field="operation", fallback="other")
        value = fallback
        result = "error"
        is_error = False
        dependency_error = None
        try:
            started = self.clock()
        except Exception:
            started = 0.0
            record_telemetry_failure("timing", "cache", "start")

        try:
            with _safe_cache_span(normalized_family, normalized_operation) as span:
                value = callback(self._connection())
                result = _normalize(classify(value), CACHE_RESULTS, field="result", fallback="other")
                if span is not None:
                    try:
                        span.set_attribute("cinematacms.cache.result", result)
                    except Exception:
                        record_telemetry_failure("traces", "cache", "attribute")
        except Exception as caught_error:
            is_error = True
            result = "error"
            dependency_error = caught_error

        try:
            duration = max(0.0, self.clock() - started)
        except Exception:
            duration = 0.0
            record_telemetry_failure("timing", "cache", "finish")

        _safe_counter(normalized_family, normalized_operation, result)
        _safe_duration(normalized_family, normalized_operation, result, duration)
        if is_error:
            _safe_event("cinematacms.cache.operation.failed", normalized_family, normalized_operation, result, duration)
        if duration >= _slow_threshold():
            _safe_event("cinematacms.cache.operation.slow", normalized_family, normalized_operation, result, duration)
        if is_error and dependency_required:
            raise AuthenticationDependencyUnavailable() from dependency_error
        return value

    def store_token(self, access_key: str, media_set_key: str, payload: str, ttl: int) -> bool:
        def callback(redis: Any) -> bool:
            pipe = redis.pipeline()
            pipe.setex(access_key, ttl, payload)
            pipe.sadd(media_set_key, access_key)
            pipe.expire(media_set_key, ttl)
            pipe.execute()
            return True

        return bool(
            self._run(
                "restricted_media_token",
                "write",
                callback,
                fallback=False,
                classify=lambda _: "success",
                dependency_required=True,
            )
        )

    def get_token(self, access_key: str) -> Any:
        return self._run(
            "restricted_media_token",
            "token_validate",
            lambda redis: redis.get(access_key),
            fallback=None,
            classify=lambda value: "hit" if value is not None else "miss",
            dependency_required=True,
        )

    def invalidate_tokens(self, media_set_key: str, script: str) -> int:
        return int(
            self._run(
                "restricted_media_token",
                "invalidate",
                lambda redis: int(redis.eval(script, 1, media_set_key)),
                fallback=0,
                classify=lambda _: "success",
                dependency_required=True,
            )
        )

    def check_rate_limit(self, key: str, max_attempts: int) -> bool:
        def callback(redis: Any) -> bool:
            attempts = redis.get(key)
            return not (attempts is not None and int(attempts) >= max_attempts)

        return bool(
            self._run(
                "restricted_media_rate_limit",
                "rate_limit",
                callback,
                fallback=False,
                classify=lambda allowed: "miss" if allowed else "hit",
                dependency_required=True,
            )
        )

    def record_failed_attempt(self, key: str, window: int) -> int:
        def callback(redis: Any) -> int:
            pipe = redis.pipeline()
            pipe.incr(key)
            pipe.expire(key, window)
            return int(pipe.execute()[0])

        return int(
            self._run(
                "restricted_media_rate_limit",
                "rate_limit",
                callback,
                fallback=0,
                classify=lambda _: "success",
            )
        )

    def reset_rate_limit(self, key: str) -> bool:
        return bool(
            self._run(
                "restricted_media_rate_limit",
                "invalidate",
                lambda redis: (redis.delete(key), True)[1],
                fallback=False,
                classify=lambda _: "success",
            )
        )


restricted_media_redis = RestrictedMediaRedisAdapter()


class ObservabilityRedisAdapter:
    """Read Redis-backed operational state without exposing queue names as telemetry values."""

    def queue_depth(self, queue: str) -> int:
        from django_redis import get_redis_connection

        return int(get_redis_connection("default").llen(queue))


observability_redis = ObservabilityRedisAdapter()
