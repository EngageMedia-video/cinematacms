from unittest.mock import Mock, patch

from django.test import SimpleTestCase, override_settings


class _CacheBackend:
    def __init__(self, values=None):
        self.values = dict(values or {})

    def get(self, key, default=None, **kwargs):
        return self.values.get(key, default)

    def set(self, key, value, timeout=None, **kwargs):
        self.values[key] = value
        return True


class OwnedCacheAdapterTests(SimpleTestCase):
    def test_read_records_a_hit_with_bounded_labels(self):
        from cms import cache_telemetry

        backend = _CacheBackend({"opaque-key": "value"})
        adapter = cache_telemetry.OwnedCacheAdapter(backend=backend)

        with (
            patch.object(cache_telemetry.CACHE_OPERATIONS_TOTAL, "labels") as operations,
            patch.object(cache_telemetry.CACHE_OPERATION_DURATION_SECONDS, "labels") as duration,
        ):
            self.assertEqual(adapter.get("permission", "opaque-key"), "value")

        operations.assert_called_once_with(family="permission", operation="read", result="hit")
        duration.assert_called_once_with(family="permission", operation="read", result="hit")

    def test_bulk_read_distinguishes_partial_hits_and_item_counts(self):
        from cms import cache_telemetry

        class BulkBackend(_CacheBackend):
            def get_many(self, keys, **kwargs):
                return {key: self.values[key] for key in keys if key in self.values}

        backend = BulkBackend({"one": 1, "three": 3})
        adapter = cache_telemetry.OwnedCacheAdapter(backend=backend)

        with (
            patch.object(cache_telemetry.CACHE_OPERATIONS_TOTAL, "labels") as operations,
            patch.object(cache_telemetry.CACHE_OPERATION_DURATION_SECONDS, "labels"),
            patch.object(cache_telemetry.CACHE_ITEMS_TOTAL, "labels") as items,
        ):
            self.assertEqual(adapter.get_many("permission", ["one", "two", "three"]), {"one": 1, "three": 3})

        operations.assert_called_once_with(family="permission", operation="bulk_read", result="partial_hit")
        self.assertEqual(
            [call.kwargs for call in items.call_args_list],
            [{"family": "permission", "result": "hit"}, {"family": "permission", "result": "miss"}],
        )
        self.assertEqual(items.return_value.inc.call_count, 2)
        items.return_value.inc.assert_any_call(2)
        items.return_value.inc.assert_any_call(1)

    @override_settings(OBSERVABILITY_SLOW_CACHE_SECONDS=0)
    def test_backend_error_is_fail_soft_and_emits_failed_event(self):
        from cms import cache_telemetry

        backend = Mock()
        backend.get.side_effect = RuntimeError("secret cache backend detail")
        adapter = cache_telemetry.OwnedCacheAdapter(backend=backend)

        with (
            patch.object(cache_telemetry.CACHE_OPERATIONS_TOTAL, "labels") as operations,
            patch.object(cache_telemetry.CACHE_OPERATION_DURATION_SECONDS, "labels"),
            patch.object(cache_telemetry, "record_telemetry_failure") as failure,
            patch.object(cache_telemetry.logger, "warning") as warning,
        ):
            self.assertIsNone(adapter.get("permission", "secret-key"))

        operations.assert_called_once_with(family="permission", operation="read", result="error")
        warning.assert_any_call(
            "cinematacms.cache.operation.failed",
            extra={
                "family": "permission",
                "operation": "read",
                "result": "error",
                "duration_ms": warning.call_args_list[-1].kwargs["extra"]["duration_ms"],
            },
        )
        failure.assert_not_called()


class CacheAccessEnforcementTests(SimpleTestCase):
    def test_application_code_has_no_direct_cache_or_restricted_redis_imports(self):
        import ast
        from pathlib import Path

        root = Path(__file__).resolve().parents[2]
        allowed_cache = {root / "cms" / "cache_telemetry.py"}
        allowed_redis = {root / "cms" / "redis_telemetry.py", root / "files" / "metrics.py"}
        violations = []
        for path in (root / "cms").rglob("*.py"):
            if "/tests/" in str(path) or path in allowed_cache or path in allowed_redis:
                continue
            tree = ast.parse(path.read_text(), filename=str(path))
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and node.module in {"django.core.cache", "django_redis"}:
                    violations.append(f"{path}:{node.lineno}")
        for path in (root / "files").rglob("*.py"):
            if "/tests/" in str(path) or path in allowed_cache or path in allowed_redis:
                continue
            tree = ast.parse(path.read_text(), filename=str(path))
            for node in ast.walk(tree):
                if isinstance(node, ast.ImportFrom) and node.module in {"django.core.cache", "django_redis"}:
                    violations.append(f"{path}:{node.lineno}")
        self.assertEqual(violations, [])
