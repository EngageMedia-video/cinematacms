"""CI-only settings overrides for GitHub Actions test runner."""

import sys
import types

# settings.py does `from .local_settings import *` at the bottom.
# local_settings.py is gitignored and absent in CI, so we inject a
# stub module before importing settings to prevent ModuleNotFoundError.
_stub = types.ModuleType("cms.local_settings")
_stub.LOCAL_INSTALL = False
sys.modules["cms.local_settings"] = _stub

from .settings import *  # noqa: E402,F401,F403

SECRET_KEY = "ci-test-key-not-for-production"
DEBUG = False
CELERY_TASK_ALWAYS_EAGER = True

DATABASES["default"]["TEST"] = {}  # noqa: F405

ACCOUNT_EMAIL_VERIFICATION = "none"

DJANGO_VITE = {
    "default": {
        "dev_mode": True,
    },
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "level": "ERROR",
            "class": "logging.StreamHandler",
        },
    },
    "loggers": {
        "django": {
            "handlers": ["console"],
            "level": "ERROR",
            "propagate": True,
        },
    },
}
