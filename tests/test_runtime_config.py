import os
import unittest
from unittest.mock import patch

from cms.runtime_config import env_bool, env_csv, env_float, env_int, env_optional_bool


class RuntimeConfigTests(unittest.TestCase):
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

    def test_optional_boolean_distinguishes_unset_from_false(self):
        with patch.dict(os.environ, {}, clear=True):
            self.assertIsNone(env_optional_bool("OPTIONAL_VALUE"))
        with patch.dict(os.environ, {"OPTIONAL_VALUE": "false"}, clear=True):
            self.assertFalse(env_optional_bool("OPTIONAL_VALUE"))
