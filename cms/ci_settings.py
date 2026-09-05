"""CI-only settings overrides for GitHub Actions test runner."""

from .settings import *  # noqa: F401,F403

SECRET_KEY = "ci-test-key-not-for-production"
EMAIL_RECIPIENT_HMAC_KEY = "ci-test-email-hmac-key-not-for-production"
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
