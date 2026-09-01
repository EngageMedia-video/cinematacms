import importlib.util
import json
from pathlib import Path

from django.test import SimpleTestCase


class AlertabilityContractTests(SimpleTestCase):
    def test_catalog_covers_critical_conditions_with_bounded_dimensions(self):
        root = Path(__file__).resolve().parents[2]
        catalog = json.loads((root / "config/observability/alertability.json").read_text())
        names = {condition["name"] for condition in catalog["conditions"]}
        required = {
            "media_progress_stuck",
            "queue_saturation",
            "media_terminal_failure",
            "hls_encryption_invalid",
            "email_terminal_failure",
            "email_sending_stale",
            "scheduled_job_stale",
            "beat_stale",
            "worker_health",
            "http_failures",
            "http_latency",
            "telemetry_loss",
        }
        self.assertEqual(names, required)
        forbidden = {"media_id", "user_id", "task_id", "trace_id", "delivery_id", "recipient_ref", "filename", "url"}
        for condition in catalog["conditions"]:
            self.assertFalse(forbidden.intersection(condition["dimensions"]))
            for field in ("signal", "owner", "healthy", "degraded", "unknown", "recovery", "guidance"):
                self.assertTrue(condition[field])

    def test_each_fixture_family_has_all_data_states(self):
        root = Path(__file__).resolve().parents[2]
        fixtures = json.loads((root / "config/observability/fixtures.json").read_text())
        catalog = json.loads((root / "config/observability/alertability.json").read_text())
        states = {}
        for case in fixtures["cases"]:
            states.setdefault(case["condition"], set()).add(case["state"])
        self.assertTrue(states)
        self.assertEqual(set(states), {condition["name"] for condition in catalog["conditions"]})
        for condition_states in states.values():
            self.assertEqual(condition_states, {"healthy", "degraded", "unknown", "recovered"})

    def test_fixture_values_evaluate_to_the_recorded_states(self):
        root = Path(__file__).resolve().parents[2]
        script = root / "scripts/validate_observability_contract.py"
        spec = importlib.util.spec_from_file_location("alert_validator", script)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        errors = module.validate(
            root / "config/observability/alertability.json",
            root / "config/observability/fixtures.json",
        )
        self.assertEqual(errors, [])
