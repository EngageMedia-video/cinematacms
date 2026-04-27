"""CI-only settings overrides for GitHub Actions test runner."""

from .settings import *  # noqa: F401,F403

SECRET_KEY = "ci-test-key-not-for-production"
DEBUG = False
CELERY_TASK_ALWAYS_EAGER = True

DATABASES["default"]["TEST"] = {}
