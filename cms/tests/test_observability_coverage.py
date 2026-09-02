import copy
import json
from pathlib import Path

from django.test import SimpleTestCase

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
