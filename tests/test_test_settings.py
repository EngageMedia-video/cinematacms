import json
import os
import subprocess
import sys
import unittest
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]


class TestSettingsContractTests(unittest.TestCase):
    def test_shared_test_settings_use_an_isolated_database(self):
        env = os.environ.copy()
        env["DJANGO_SETTINGS_MODULE"] = "cms.test_settings"
        env.update(
            {
                "TEST_DATABASE_HOST": "test-db.example",
                "TEST_DATABASE_NAME": "test-fixture",
                "TEST_DATABASE_PASSWORD": "fixture-password",
                "TEST_DATABASE_PORT": "55432",
                "TEST_DATABASE_USER": "fixture-user",
            }
        )
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                (
                    "import json; "
                    "from django.conf import settings; "
                    "print(json.dumps({"
                    "'database': {key: settings.DATABASES['default'][key] "
                    "for key in ('HOST', 'NAME', 'PASSWORD', 'PORT', 'USER')}, "
                    "'database_test': settings.DATABASES['default']['TEST'], "
                    "'email_verification': settings.ACCOUNT_EMAIL_VERIFICATION, "
                    "'vite_dev_mode': settings.DJANGO_VITE['default']['dev_mode'], "
                    "'celery_eager': settings.CELERY_TASK_ALWAYS_EAGER"
                    "}))"
                ),
            ],
            cwd=PROJECT_ROOT,
            env=env,
            capture_output=True,
            text=True,
            check=False,
        )

        self.assertEqual(result.returncode, 0, result.stderr)
        contract = json.loads(result.stdout.strip().splitlines()[-1])
        self.assertEqual(
            contract["database"],
            {
                "HOST": "test-db.example",
                "NAME": "test-fixture",
                "PASSWORD": "fixture-password",
                "PORT": "55432",
                "USER": "fixture-user",
            },
        )
        self.assertEqual(contract["database_test"], {})
        self.assertEqual(contract["email_verification"], "none")
        self.assertTrue(contract["vite_dev_mode"])
        self.assertTrue(contract["celery_eager"])

    def test_make_test_targets_pin_the_shared_test_settings(self):
        for target in ("test", "test-ci"):
            with self.subTest(target=target):
                result = subprocess.run(
                    ["make", "--dry-run", target],
                    cwd=PROJECT_ROOT,
                    capture_output=True,
                    text=True,
                    check=False,
                )

                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertIn("DJANGO_SETTINGS_MODULE=cms.test_settings", result.stdout)
                self.assertIn("TEST_DATABASE_PORT=5433", result.stdout)


if __name__ == "__main__":
    unittest.main()
