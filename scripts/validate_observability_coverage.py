#!/usr/bin/env python3
"""Validate the application-owned observability coverage matrix."""

import argparse
import ast
import json
import math
import re
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path

NAMESPACE = "cinematacms_"
GENERIC_UNKNOWN_VALUES = {"generic", "tbd", "todo", "unclassified", "unknown", "unspecified"}
REGISTRY_COVERAGE_ALL = "all"
VALID_STATUSES = {"covered", "not_applicable"}
VALID_METRIC_TYPES = {"counter", "gauge", "histogram", "info", "summary"}
PYTHON_ALLOWLISTS = {
    "domain_operations": "DOMAIN_OPERATIONS",
    "domain_reason_codes": "DOMAIN_REASON_CODES",
    "telemetry_signals": "TELEMETRY_SIGNALS",
    "telemetry_components": "TELEMETRY_COMPONENTS",
    "telemetry_stages": "TELEMETRY_STAGES",
}
REQUIRED_ROW_FIELDS = (
    "id",
    "status",
    "domain",
    "operation",
    "outcomes",
    "metric",
    "dimensions",
    "events",
    "instrumentation_seam",
    "privacy_constraints",
    "tests",
    "operator_query",
)
REQUIRED_REGISTRIES = {
    "domains",
    "http_route_groups",
    "http_operations",
    "http_methods",
    "http_status_codes",
    "http_status_classes",
    "db_workloads",
    "db_context_groups",
    "db_operations",
    "db_outcomes",
    "databases",
    "cache_families",
    "cache_operations",
    "cache_results",
    "auth_surfaces",
    "auth_mechanisms",
    "auth_reasons",
    "celery_task_families",
    "celery_queues",
    "celery_events",
    "celery_outcomes",
    "service_roles",
    "domain_operations",
    "domain_outcomes",
    "domain_reason_codes",
    "media_resolutions",
    "media_codecs",
    "media_extensions",
    "media_types",
    "email_kinds",
    "email_outcomes",
    "email_reasons",
    "scheduled_jobs",
    "scheduled_outcomes",
    "telemetry_signals",
    "telemetry_components",
    "telemetry_stages",
    "telemetry_violation_fields",
    "worker_refs",
}
REQUIRED_METRIC_LABELS = {
    "cinematacms_http_requests_total": ("route_group", "operation", "method", "status_code"),
    "cinematacms_http_request_duration_seconds": (
        "route_group",
        "operation",
        "method",
        "status_class",
    ),
    "cinematacms_db_query_duration_seconds": (
        "workload",
        "context_group",
        "operation",
        "outcome",
        "database",
    ),
    "cinematacms_cache_operations_total": ("family", "operation", "result"),
    "cinematacms_cache_operation_duration_seconds": ("family", "operation", "result"),
    "cinematacms_cache_items_total": ("family", "result"),
    "cinematacms_authentication_failures_total": ("surface", "mechanism", "reason"),
    "cinematacms_celery_tasks_total": ("task_family", "queue", "event", "outcome"),
    "cinematacms_celery_task_duration_seconds": ("task_family", "queue", "outcome"),
    "cinematacms_celery_worker_heartbeat_timestamp_seconds": ("service_role", "worker_ref"),
    "cinematacms_celery_queue_depth": ("queue",),
    "cinematacms_domain_outcomes_total": ("operation", "outcome", "reason_code"),
    "cinematacms_media_encoding_profile_total": (
        "resolution",
        "codec",
        "extension",
        "outcome",
        "reason_code",
    ),
    "cinematacms_media_duration_seconds": ("media_type",),
    "cinematacms_media_file_size_bytes": ("media_type",),
    "cinematacms_email_deliveries_total": ("email_kind", "outcome", "reason_code"),
    "cinematacms_email_delivery_attempts": (),
    "cinematacms_email_delivery_latency_seconds": (),
    "cinematacms_scheduled_job_runs_total": ("job", "outcome", "reason_code"),
    "cinematacms_scheduled_job_last_started_timestamp_seconds": ("job",),
    "cinematacms_scheduled_job_last_success_timestamp_seconds": ("job",),
    "cinematacms_celery_beat_freshness_timestamp_seconds": (),
    "cinematacms_telemetry_emission_failures_total": ("signal", "component", "stage"),
    "cinematacms_telemetry_contract_violations_total": ("component", "field"),
}
HISTOGRAM_BUCKETS = {
    "cinematacms_http_request_duration_seconds": (
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
    ),
    "cinematacms_db_query_duration_seconds": (
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
    ),
    "cinematacms_cache_operation_duration_seconds": (
        0.0005,
        0.001,
        0.0025,
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
    ),
}
THRESHOLD_METRICS = {
    "http": ("cinematacms_http_request_duration_seconds", 2),
    "database": ("cinematacms_db_query_duration_seconds", 1),
    "cache": ("cinematacms_cache_operation_duration_seconds", 0.1),
}


def _is_blank(value):
    if value is None or value is False:
        return True
    if isinstance(value, str):
        return not value.strip()
    if isinstance(value, (Mapping, Sequence)) and not isinstance(value, (str, bytes, bytearray)):
        return not value
    return False


def _is_generic_unknown(value):
    return isinstance(value, str) and value.strip().lower() in GENERIC_UNKNOWN_VALUES


def _as_list(value):
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        return value
    return None


def _registry_values(spec):
    if isinstance(spec, list):
        return spec, []
    if not isinstance(spec, Mapping):
        return [], []
    values = list(spec.get("values", [])) if isinstance(spec.get("values", []), list) else []
    ranges = spec.get("ranges", [])
    if isinstance(ranges, list):
        for range_spec in ranges:
            if isinstance(range_spec, Mapping) and {"start", "end"}.issubset(range_spec):
                values.append(f"{range_spec['start']}-{range_spec['end']}")
    fallback_values = spec.get("fallback_values", [])
    return values, fallback_values if isinstance(fallback_values, list) else []


def _registry_has_value(spec, value):
    values, _ = _registry_values(spec)
    if value in values:
        return True
    if not isinstance(value, str):
        return False
    pattern = spec.get("pattern") if isinstance(spec, Mapping) else None
    if pattern and re.fullmatch(pattern, value):
        return True
    for descriptor in values:
        if not isinstance(descriptor, str) or "-" not in descriptor:
            continue
        start, separator, end = descriptor.partition("-")
        if not separator:
            continue
        try:
            if int(start) <= int(value) <= int(end):
                return True
        except (TypeError, ValueError):
            continue
    return False


def _metric_schemas(raw, errors):
    if isinstance(raw, Mapping):
        return dict(raw)
    if isinstance(raw, list):
        schemas = {}
        for index, schema in enumerate(raw):
            if not isinstance(schema, Mapping) or not schema.get("name"):
                errors.append(f"metric_schemas[{index}].name: missing")
                continue
            schemas[schema["name"]] = schema
        return schemas
    errors.append("metric_schemas: missing or not an object")
    return {}


def _validate_registries(matrix, errors):
    registries = matrix.get("registries")
    if not isinstance(registries, Mapping):
        errors.append("registries: missing or not an object")
        return {}
    missing = REQUIRED_REGISTRIES - set(registries)
    errors.extend(f"registries.{name}: missing" for name in sorted(missing))
    for name, spec in registries.items():
        values, fallback_values = _registry_values(spec)
        if not isinstance(spec, (Mapping, list)):
            errors.append(f"registries.{name}: must be an object or list")
            continue
        if isinstance(spec, Mapping) and not values and not spec.get("pattern"):
            errors.append(f"registries.{name}.values: missing")
        if len(values) != len(set(values)):
            errors.append(f"registries.{name}.values: duplicate value")
        if not set(fallback_values).issubset(values):
            errors.append(f"registries.{name}.fallback_values: value is not registered")
        for value in values:
            if _is_blank(value):
                errors.append(f"registries.{name}.values: blank value")
            if _is_generic_unknown(value) and value not in fallback_values:
                errors.append(f"registries.{name}.values: generic unknown value {value!r}")
        if "unknown" in values and "unknown" not in fallback_values:
            errors.append(f"registries.{name}.values: unknown must be fallback-only")
        if isinstance(spec, Mapping) and "pattern" in spec:
            try:
                re.compile(spec["pattern"])
            except (re.error, TypeError):
                errors.append(f"registries.{name}.pattern: invalid regular expression")
    return registries


def _validate_metric_schemas(matrix, registries, errors):
    schemas = _metric_schemas(matrix.get("metric_schemas"), errors)
    for name, labels in REQUIRED_METRIC_LABELS.items():
        schema = schemas.get(name)
        if not isinstance(schema, Mapping):
            errors.append(f"metric_schemas.{name}: missing")
            continue
        actual_labels = schema.get("labels")
        if not isinstance(actual_labels, list):
            errors.append(f"metric_schemas.{name}.labels: must be a list")
            actual_labels = []
        if actual_labels != list(labels):
            errors.append(f"metric_schemas.{name}.labels: expected {list(labels)!r}, got {actual_labels!r}")
        if schema.get("type") not in VALID_METRIC_TYPES:
            errors.append(f"metric_schemas.{name}.type: invalid metric type")
        if _is_blank(schema.get("description")):
            errors.append(f"metric_schemas.{name}.description: blank")
        dimension_registries = schema.get("dimension_registries")
        if not isinstance(dimension_registries, Mapping):
            errors.append(f"metric_schemas.{name}.dimension_registries: missing or not an object")
            dimension_registries = {}
        if set(dimension_registries) != set(actual_labels):
            errors.append(f"metric_schemas.{name}.dimension_registries: must match labels")
        for label in actual_labels:
            registry_name = dimension_registries.get(label)
            if registry_name not in registries:
                errors.append(f"metric_schemas.{name}.{label}: unknown registry {registry_name!r}")
        if name in HISTOGRAM_BUCKETS:
            buckets = schema.get("buckets")
            expected = list(HISTOGRAM_BUCKETS[name])
            if buckets != expected:
                errors.append(f"metric_schemas.{name}.buckets: expected {expected!r}, got {buckets!r}")
    for name, schema in schemas.items():
        if not isinstance(name, str) or not name.startswith(NAMESPACE):
            errors.append(f"metric_schemas.{name}: metric must use the {NAMESPACE!r} namespace")
        if not isinstance(schema, Mapping):
            errors.append(f"metric_schemas.{name}: must be an object")
            continue
        labels = schema.get("labels", [])
        if isinstance(labels, list) and len(labels) != len(set(labels)):
            errors.append(f"metric_schemas.{name}.labels: duplicate label")
        buckets = schema.get("buckets")
        if buckets is not None:
            if not isinstance(buckets, list) or any(
                isinstance(value, bool) or not isinstance(value, (int, float)) for value in buckets
            ):
                errors.append(f"metric_schemas.{name}.buckets: must contain numbers")
            elif any(not math.isfinite(value) or value <= 0 for value in buckets):
                errors.append(f"metric_schemas.{name}.buckets: values must be finite and positive")
            elif buckets != sorted(set(buckets)):
                errors.append(f"metric_schemas.{name}.buckets: values must be strictly increasing")
    return schemas


def _validate_events(matrix, errors):
    events = matrix.get("events")
    if not isinstance(events, list) or not events:
        errors.append("events: missing or empty")
        return set()
    event_names = set()
    for event in events:
        if _is_blank(event):
            errors.append("events: blank event name")
            continue
        if _is_generic_unknown(event):
            errors.append(f"events: generic unknown value {event!r}")
        if not isinstance(event, str) or not event.startswith("cinematacms."):
            errors.append(f"events: invalid event name {event!r}")
        event_names.add(event)
    if len(event_names) != len(events):
        errors.append("events: duplicate event name")
    return event_names


def _validate_inventory(matrix, registries, errors):
    inventory = matrix.get("inventory")
    if not isinstance(inventory, Mapping):
        errors.append("inventory: missing or not an object")
        return {}
    routes = inventory.get("routes")
    if not isinstance(routes, list) or not routes:
        errors.append("inventory.routes: missing or empty")
        return inventory
    route_ids = set()
    for index, route in enumerate(routes):
        path = f"inventory.routes[{index}]"
        if not isinstance(route, Mapping):
            errors.append(f"{path}: must be an object")
            continue
        route_id = route.get("id")
        if _is_blank(route_id):
            errors.append(f"{path}.id: blank")
        elif route_id in route_ids:
            errors.append(f"{path}.id: duplicate value {route_id!r}")
        route_ids.add(route_id)
        for field in ("route", "route_group", "operation"):
            if _is_blank(route.get(field)):
                errors.append(f"{path}.{field}: blank")
            elif _is_generic_unknown(route.get(field)):
                errors.append(f"{path}.{field}: generic unknown value")
        methods = route.get("methods")
        if not isinstance(methods, list) or not methods:
            errors.append(f"{path}.methods: missing or empty")
        else:
            for method in methods:
                if not _registry_has_value(registries.get("http_methods", {}), method):
                    errors.append(f"{path}.methods: unregistered method {method!r}")
        if not _registry_has_value(registries.get("http_route_groups", {}), route.get("route_group")):
            errors.append(f"{path}.route_group: unregistered registry value")
        if not _registry_has_value(registries.get("http_operations", {}), route.get("operation")):
            errors.append(f"{path}.operation: unregistered registry value")
    return inventory


def _validate_thresholds(matrix, schemas, errors):
    thresholds = matrix.get("diagnostic_thresholds")
    if not isinstance(thresholds, Mapping):
        errors.append("diagnostic_thresholds: missing or not an object")
        return
    for name, (metric_name, expected_default) in THRESHOLD_METRICS.items():
        threshold = thresholds.get(name)
        if not isinstance(threshold, Mapping):
            errors.append(f"diagnostic_thresholds.{name}: missing")
            continue
        if threshold.get("metric") != metric_name:
            errors.append(f"diagnostic_thresholds.{name}.metric: expected {metric_name!r}")
        if threshold.get("default") != expected_default:
            errors.append(f"diagnostic_thresholds.{name}.default: expected {expected_default!r}")
        buckets = schemas.get(metric_name, {}).get("buckets", [])
        if threshold.get("default") not in buckets:
            errors.append(f"diagnostic_thresholds.{name}.default: must match a histogram bucket")


def _validate_registry_coverage(matrix, registries, rows, errors):
    covered = {name: set() for name in registries}
    covered_all = set()
    for index, row in enumerate(rows):
        registry_coverage = row.get("registry_coverage")
        if not isinstance(registry_coverage, Mapping):
            errors.append(f"coverage[{index}].registry_coverage: missing or not an object")
            continue
        for name, values in registry_coverage.items():
            if name not in registries:
                errors.append(f"coverage[{index}].registry_coverage.{name}: unknown registry")
                continue
            if values == REGISTRY_COVERAGE_ALL:
                covered_all.add(name)
                continue
            if not isinstance(values, list) or not values:
                errors.append(f"coverage[{index}].registry_coverage.{name}: missing or empty")
                continue
            for value in values:
                if not _registry_has_value(registries[name], value):
                    errors.append(f"coverage[{index}].registry_coverage.{name}: unregistered value {value!r}")
                covered[name].add(value)
    for name, spec in registries.items():
        if name in covered_all:
            continue
        required_values, fallback_values = _registry_values(spec)
        missing = [value for value in required_values if value not in covered[name] and value not in fallback_values]
        if missing:
            errors.append(f"registries.{name}: missing coverage for {', '.join(map(str, missing))}")


def _validate_rows(matrix, registries, schemas, event_names, inventory, errors):
    rows = matrix.get("coverage")
    if not isinstance(rows, list) or not rows:
        errors.append("coverage: missing or empty")
        return []
    row_ids = set()
    for index, row in enumerate(rows):
        path = f"coverage[{index}]"
        if not isinstance(row, Mapping):
            errors.append(f"{path}: must be an object")
            continue
        row_id = row.get("id")
        if _is_blank(row_id):
            errors.append(f"{path}.id: blank")
        elif row_id in row_ids:
            errors.append(f"{path}.id: duplicate value {row_id!r}")
        row_ids.add(row_id)
        status = row.get("status")
        if status not in VALID_STATUSES:
            errors.append(f"{path}.status: expected covered or not_applicable")
        for field in REQUIRED_ROW_FIELDS:
            if field not in row:
                errors.append(f"{path}.{field}: missing")
            elif status != "not_applicable" and _is_blank(row[field]):
                errors.append(f"{path}.{field}: blank")
        for field in REQUIRED_ROW_FIELDS:
            value = row.get(field)
            if status == "not_applicable" and field in {"metric", "events"}:
                continue
            values = value if isinstance(value, list) else [value]
            for item in values:
                if _is_generic_unknown(item) and item not in row.get("allow_fallback_values", []):
                    errors.append(f"{path}.{field}: generic unknown value {item!r}")
        if status == "not_applicable":
            declaration = row.get("not_applicable")
            if not isinstance(declaration, Mapping):
                errors.append(f"{path}.not_applicable: missing or not an object")
            else:
                for field in ("reason", "validation_rule"):
                    value = declaration.get(field)
                    if _is_blank(value):
                        errors.append(f"{path}.not_applicable.{field}: blank")
                    elif _is_generic_unknown(value):
                        errors.append(f"{path}.not_applicable.{field}: generic unknown value")
            continue
        if "not_applicable" in row:
            errors.append(f"{path}.not_applicable: only covered rows may omit this field")
        seam = row.get("instrumentation_seam")
        if isinstance(seam, str) and "." in seam and not _reference_module_exists(seam):
            errors.append(f"{path}.instrumentation_seam: module does not exist for {seam!r}")
        tests = row.get("tests")
        if isinstance(tests, list):
            for test in tests:
                if isinstance(test, str) and not _reference_module_exists(test):
                    errors.append(f"{path}.tests: module does not exist for {test!r}")
        metrics = _as_list(row.get("metric"))
        if metrics is None:
            errors.append(f"{path}.metric: must be a metric name or list")
            metrics = []
        expected_dimensions = set()
        for metric in metrics:
            if metric not in schemas:
                errors.append(f"{path}.metric: unregistered metric {metric!r}")
                continue
            expected_dimensions.update(schemas[metric].get("labels", []))
        dimensions = row.get("dimensions")
        if not isinstance(dimensions, list):
            errors.append(f"{path}.dimensions: must be a list")
            dimensions = []
        if set(dimensions) != expected_dimensions:
            errors.append(
                f"{path}.dimensions: expected {sorted(expected_dimensions)!r}, got {sorted(set(dimensions))!r}"
            )
        events = row.get("events")
        if isinstance(events, list):
            for event in events:
                if event not in event_names:
                    errors.append(f"{path}.events: unregistered event {event!r}")
        inventory_ref = row.get("inventory_ref")
        if inventory_ref is not None and inventory_ref not in inventory:
            errors.append(f"{path}.inventory_ref: unknown inventory {inventory_ref!r}")
    _validate_registry_coverage(matrix, registries, rows, errors)
    return rows


def _reference_module_exists(reference):
    """Return whether a dotted symbol reference starts with a repository module."""

    parts = reference.split(".")
    root = Path(__file__).resolve().parents[1]
    for end in range(len(parts), 1, -1):
        candidate = root.joinpath(*parts[:end])
        if candidate.with_suffix(".py").is_file():
            return True
        if (candidate / "__init__.py").is_file():
            remaining = parts[end:]
            return not remaining or not remaining[0][:1].islower()
    return False


def _python_allowlists():
    source = Path(__file__).resolve().parents[1] / "files" / "metrics.py"
    tree = ast.parse(source.read_text(), filename=str(source))
    wanted = set(PYTHON_ALLOWLISTS.values())
    values = {}
    for node in tree.body:
        if not isinstance(node, ast.Assign) or len(node.targets) != 1 or not isinstance(node.targets[0], ast.Name):
            continue
        name = node.targets[0].id
        if name not in wanted or not isinstance(node.value, ast.Call) or len(node.value.args) != 1:
            continue
        values[name] = set(ast.literal_eval(node.value.args[0]))
    return values


def _validate_python_allowlists(registries, errors):
    source_values = _python_allowlists()
    for registry_name, constant_name in PYTHON_ALLOWLISTS.items():
        expected = source_values.get(constant_name)
        if expected is None:
            errors.append(f"files.metrics.{constant_name}: missing literal frozenset allowlist")
            continue
        actual, fallback = _registry_values(registries.get(registry_name, {}))
        if set(actual) | set(fallback) != expected:
            errors.append(f"registries.{registry_name}: differs from files.metrics.{constant_name}")


def validate_matrix(matrix):
    """Return contract errors for a decoded coverage matrix."""

    if not isinstance(matrix, Mapping):
        return ["matrix: must be an object"]
    errors = []
    if matrix.get("version") != 1:
        errors.append("version: expected 1")
    if matrix.get("namespace") != "cinematacms":
        errors.append("namespace: expected 'cinematacms'")
    registries = _validate_registries(matrix, errors)
    _validate_python_allowlists(registries, errors)
    schemas = _validate_metric_schemas(matrix, registries, errors)
    event_names = _validate_events(matrix, errors)
    inventory = _validate_inventory(matrix, registries, errors)
    _validate_rows(matrix, registries, schemas, event_names, inventory, errors)
    _validate_thresholds(matrix, schemas, errors)
    return errors


def load_matrix(path):
    return json.loads(Path(path).read_text())


def validate(path="config/observability/coverage.json"):
    """Load and validate a matrix at *path*."""

    return validate_matrix(load_matrix(path))


def main(argv=None):
    parser = argparse.ArgumentParser(description="Validate the CinemataCMS observability coverage matrix")
    parser.add_argument("--matrix", default="config/observability/coverage.json")
    args = parser.parse_args(argv)
    try:
        errors = validate(args.matrix)
    except (OSError, json.JSONDecodeError) as error:
        print(f"{args.matrix}: {error}", file=sys.stderr)
        return 1
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1
    print(f"validated observability coverage matrix: {args.matrix}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
