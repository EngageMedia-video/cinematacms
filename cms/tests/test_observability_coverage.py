import copy
import json
from pathlib import Path

from django.test import SimpleTestCase

from cms.http_telemetry import UPLOAD_ID_PATTERN
from scripts.validate_observability_coverage import validate_matrix

ROOT = Path(__file__).resolve().parents[2]
MATRIX_PATH = ROOT / "config/observability/coverage.json"


def matrix():
    return json.loads(MATRIX_PATH.read_text())


class ObservabilityCoverageContractTests(SimpleTestCase):
    def test_repository_matrix_is_valid(self):
        self.assertEqual(validate_matrix(matrix()), [])

    def test_covered_rows_require_each_evidence_field(self):
        required = (
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
        for field in required:
            with self.subTest(field=field):
                candidate = matrix()
                candidate["coverage"][0][field] = "   "
                errors = validate_matrix(candidate)
                self.assertTrue(
                    any(field in error and "blank" in error for error in errors),
                    errors,
                )

    def test_generic_unknown_values_are_rejected(self):
        candidate = matrix()
        candidate["coverage"][0]["operation"] = "unknown"

        errors = validate_matrix(candidate)

        self.assertTrue(any("generic unknown" in error for error in errors), errors)

    def test_not_applicable_rows_need_a_reason_and_validation_rule(self):
        candidate = matrix()
        row = next(row for row in candidate["coverage"] if row["status"] == "not_applicable")
        row["not_applicable"].pop("reason")
        row["not_applicable"].pop("validation_rule")

        errors = validate_matrix(candidate)

        self.assertTrue(any("not_applicable.reason" in error for error in errors), errors)
        self.assertTrue(any("not_applicable.validation_rule" in error for error in errors), errors)

    def test_fixed_registries_cover_the_required_bounded_values(self):
        registries = matrix()["registries"]
        expected = {
            "http_route_groups": {
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
            },
            "db_workloads": {"web", "celery", "other"},
            "db_operations": {"select", "insert", "update", "delete", "transaction", "other"},
            "db_outcomes": {"success", "error"},
            "cache_families": {
                "permission",
                "query",
                "query_version",
                "media_path",
                "storage_usage",
                "popular_media",
                "maintenance_timing",
                "hls_coordination",
                "scheduled_task_lock",
                "chunk_finalisation",
                "restricted_media_token",
                "restricted_media_rate_limit",
                "cache_probe",
            },
            "auth_surfaces": {"account_login", "api", "restricted_media", "other"},
            "auth_mechanisms": {"password", "basic", "session", "token", "media_password", "media_token", "unknown"},
            "celery_task_families": {
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
                "unknown",
            },
        }
        for name, values in expected.items():
            with self.subTest(registry=name):
                self.assertEqual(set(registries[name]["values"]), values)

    def test_metric_schemas_use_the_required_namespace_and_labels(self):
        schemas = matrix()["metric_schemas"]
        expected = {
            "cinematacms_http_requests_total": ["route_group", "operation", "method", "status_code"],
            "cinematacms_http_request_duration_seconds": [
                "route_group",
                "operation",
                "method",
                "status_class",
            ],
            "cinematacms_db_query_duration_seconds": [
                "workload",
                "context_group",
                "operation",
                "outcome",
                "database",
            ],
            "cinematacms_cache_operations_total": ["family", "operation", "result"],
            "cinematacms_cache_operation_duration_seconds": ["family", "operation", "result"],
            "cinematacms_cache_items_total": ["family", "result"],
            "cinematacms_authentication_failures_total": ["surface", "mechanism", "reason"],
            "cinematacms_celery_worker_heartbeat_timestamp_seconds": ["service_role", "worker_ref"],
            "cinematacms_telemetry_emission_failures_total": ["signal", "component", "stage"],
            "cinematacms_telemetry_contract_violations_total": ["component", "field"],
        }
        for name, labels in expected.items():
            with self.subTest(metric=name):
                self.assertEqual(schemas[name]["labels"], labels)
                self.assertTrue(name.startswith("cinematacms_"))

    def test_validator_rejects_an_unregistered_metric_label(self):
        candidate = copy.deepcopy(matrix())
        candidate["metric_schemas"]["cinematacms_http_requests_total"]["labels"].append("raw_path")

        errors = validate_matrix(candidate)

        self.assertTrue(any("raw_path" in error for error in errors), errors)

    def test_validator_requires_every_inventory_route_to_use_a_bounded_registry(self):
        candidate = matrix()
        candidate["inventory"]["routes"][0]["route_group"] = "generic"

        errors = validate_matrix(candidate)

        self.assertTrue(any("route_group" in error and "registry" in error for error in errors), errors)

    def test_validator_rejects_a_covered_row_with_a_missing_module(self):
        candidate = matrix()
        candidate["coverage"][0]["instrumentation_seam"] = "cms.missing_telemetry.Recorder"

        errors = validate_matrix(candidate)

        self.assertTrue(any("module does not exist" in error for error in errors), errors)

    def test_validator_rejects_registry_drift_from_python_allowlist(self):
        candidate = matrix()
        candidate["registries"]["domain_operations"]["values"].remove("hls")

        errors = validate_matrix(candidate)

        self.assertTrue(any("files.metrics.DOMAIN_OPERATIONS" in error for error in errors), errors)


class UploadCorrelationContractTests(SimpleTestCase):
    def test_upload_ref_contract_is_declared_and_valid(self):
        upload_ref = matrix()["log_correlation"]["upload_ref"]

        self.assertEqual(upload_ref["header"], "X-Upload-Id")
        self.assertEqual(upload_ref["nginx_field"], "uid")
        self.assertEqual(upload_ref["max_length"], 36)
        for event in (
            "cinematacms.http.request.denied",
            "cinematacms.http.request.failed",
            "cinematacms.upload.started",
            "cinematacms.upload.finished",
        ):
            self.assertIn(event, upload_ref["events"])

    def test_every_tier_uses_the_contract_pattern(self):
        pattern = matrix()["log_correlation"]["upload_ref"]["pattern"]

        self.assertEqual(UPLOAD_ID_PATTERN.pattern, pattern)
        nginx = (ROOT / "deploy/nginx/cinematacms-http.conf").read_text()
        self.assertIn(f'"~^{pattern}$" $http_x_upload_id;', nginx)
        self.assertIn("uid=$cinematacms_upload_id", nginx)

    def test_validator_rejects_a_missing_or_unbounded_contract(self):
        cases = {
            "log_correlation: missing": lambda m: m.pop("log_correlation"),
            "pattern": lambda m: m["log_correlation"]["upload_ref"].update(pattern="("),
            "max_length": lambda m: m["log_correlation"]["upload_ref"].update(max_length=0),
            "unknown event": lambda m: m["log_correlation"]["upload_ref"]["events"].append("cinematacms.nope"),
            "metric label": lambda m: m["metric_schemas"]["cinematacms_http_requests_total"]["labels"].append(
                "upload_ref"
            ),
        }
        for expected, mutate in cases.items():
            with self.subTest(expected=expected):
                candidate = matrix()
                mutate(candidate)
                errors = validate_matrix(candidate)
                self.assertTrue(any(expected in error for error in errors), errors)

    def test_validator_reports_a_malformed_matrix_instead_of_raising(self):
        def as_schema_list(candidate):
            candidate["metric_schemas"] = [
                {"name": name, **schema} for name, schema in candidate["metric_schemas"].items()
            ]

        def as_schema_list_with_upload_ref_label(candidate):
            as_schema_list(candidate)
            candidate["metric_schemas"][0]["labels"].append("upload_ref")

        def extra_schema_labels_not_a_list(candidate):
            candidate["metric_schemas"]["cinematacms_extra_total"] = {"labels": None}

        def extra_schema_not_an_object(candidate):
            candidate["metric_schemas"]["cinematacms_extra_total"] = "oops"

        cases = {
            "a schema list": (as_schema_list, None),
            "a schema list with the correlation id as a label": (
                as_schema_list_with_upload_ref_label,
                "unbounded and must not be a metric label",
            ),
            "a non-string pattern": (
                lambda m: m["log_correlation"]["upload_ref"].update(pattern=5),
                "log_correlation.upload_ref.pattern",
            ),
            "an unhashable event": (
                lambda m: m["log_correlation"]["upload_ref"]["events"].append(["cinematacms.nope"]),
                "log_correlation.upload_ref.events: unknown event",
            ),
            "an extra schema whose labels are not a list": (extra_schema_labels_not_a_list, None),
            "an extra schema that is not an object": (
                extra_schema_not_an_object,
                "metric_schemas.cinematacms_extra_total: must be an object",
            ),
        }
        for name, (mutate, expected) in cases.items():
            with self.subTest(malformed=name):
                candidate = matrix()
                mutate(candidate)
                errors = validate_matrix(candidate)
                if expected is None:
                    self.assertEqual(errors, [])
                else:
                    self.assertTrue(any(expected in error for error in errors), errors)
