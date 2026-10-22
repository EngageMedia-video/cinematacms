"""Shared settings for local and CI test runs."""

import os

from .settings import *  # noqa: F401,F403

SECRET_KEY = "test-key-not-for-production"
EMAIL_RECIPIENT_HMAC_KEY = "test-email-hmac-key-not-for-production"
MEDIA_ACTION_IP_HMAC_KEY = "test-action-ip-hmac-key-not-for-production"
DEBUG = False
CELERY_TASK_ALWAYS_EAGER = True
SENTRY_DSN = ""
ERROR_TRACKING_DIAGNOSTICS_ENABLED = False
ERROR_TRACKING_DIAGNOSTICS_TOKEN = ""

# Never mirror the development database. Django creates and destroys a
# dedicated test database for every non-keepdb run.
DATABASES["default"]["TEST"] = {}  # noqa: F405

# A local test service can be kept separate from the development database.
# CI doesn't set these variables and continues to use its job-scoped service.
for database_key in ("HOST", "NAME", "PASSWORD", "PORT", "USER"):
    override = os.getenv(f"TEST_DATABASE_{database_key}")
    if override is not None:
        DATABASES["default"][database_key] = override  # noqa: F405

ACCOUNT_EMAIL_VERIFICATION = "none"

DJANGO_VITE = {
    "default": {
        "dev_mode": True,
    },
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {
        "otel_trace": {
            "()": "cms.observability.OpenTelemetryLogFilter",
        },
    },
    "handlers": {
        "console": {
            "level": "ERROR",
            "class": "logging.StreamHandler",
            "filters": ["otel_trace"],
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
