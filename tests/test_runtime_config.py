import os
import unittest
from pathlib import Path
from unittest.mock import patch

from cms.runtime_config import env_bool, env_csv, env_float, env_int, env_optional_bool

ROOT = Path(__file__).resolve().parents[1]


class RuntimeConfigTests(unittest.TestCase):
    def test_cookie_security_settings_are_runtime_configurable(self):
        settings = (ROOT / "cms/settings.py").read_text()
        renderer = (ROOT / "deploy/render-app-env.py").read_text()

        for name in (
            "CSRF_COOKIE_DOMAIN",
            "CSRF_COOKIE_SAMESITE",
            "CSRF_COOKIE_SECURE",
            "CSRF_TRUSTED_ORIGINS",
            "SESSION_COOKIE_DOMAIN",
            "SESSION_COOKIE_SAMESITE",
            "SESSION_COOKIE_SECURE",
        ):
            self.assertIn(name, settings)
            self.assertIn(f'"{name}"', renderer)

    def test_actor_observability_runs_after_authentication(self):
        settings = (ROOT / "cms/settings.py").read_text()
        self.assertLess(
            settings.index("django.contrib.auth.middleware.AuthenticationMiddleware"),
            settings.index("cms.observability_middleware.ObservabilityActorMiddleware"),
        )
        self.assertLess(
            settings.index("cms.observability_middleware.ObservabilityActorMiddleware"),
            settings.index("cms.observability_middleware.ObservabilityMetricsMiddleware"),
        )

    def test_environment_values_use_one_typed_parser(self):
        with patch.dict(
            os.environ,
            {"BOOL_VALUE": "yes", "CSV_VALUE": "alpha, beta", "FLOAT_VALUE": "0.25"},
            clear=False,
        ):
            self.assertTrue(env_bool("BOOL_VALUE", False))
            self.assertEqual(env_csv("CSV_VALUE", []), ["alpha", "beta"])
            self.assertEqual(env_float("FLOAT_VALUE", 1.0), 0.25)
            self.assertEqual(env_int("INT_VALUE", 3), 3)

    def test_invalid_float_uses_the_declared_default(self):
        with patch.dict(os.environ, {"FLOAT_VALUE": "0,25"}, clear=False):
            self.assertEqual(env_float("FLOAT_VALUE", 1.0), 1.0)

    def test_invalid_boolean_uses_the_declared_default(self):
        with patch.dict(os.environ, {"EMAIL_USE_TLS": "tru"}, clear=False):
            self.assertTrue(env_bool("EMAIL_USE_TLS", True))
            self.assertFalse(env_bool("EMAIL_USE_TLS", False))

    def test_optional_boolean_distinguishes_unset_from_false(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertIsNone(env_optional_bool("OPTIONAL_VALUE"))
        with patch.dict(os.environ, {"OPTIONAL_VALUE": "false"}, clear=True):
            self.assertFalse(env_optional_bool("OPTIONAL_VALUE"))
