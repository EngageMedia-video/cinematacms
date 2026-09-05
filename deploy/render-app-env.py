#!/usr/bin/env python3
"""Create or update the systemd runtime environment without printing secrets."""

import argparse
import ast
import os
import runpy
import secrets
import shlex
import uuid
from pathlib import Path

DIRECT_SETTINGS = (
    "SECRET_KEY",
    "PORTAL_NAME",
    "FRONTEND_HOST",
    "ALLOWED_HOSTS",
    "DEBUG",
    "DEFAULT_FROM_EMAIL",
    "EMAIL_HOST",
    "EMAIL_HOST_PASSWORD",
    "EMAIL_HOST_USER",
    "EMAIL_PORT",
    "EMAIL_USE_TLS",
    "ADMIN_EMAIL_LIST",
    "ACCOUNT_EMAIL_VERIFICATION",
    "LOCAL_INSTALL",
    "REDIS_LOCATION",
    "CELERY_BROKER_URL",
    "CELERY_RESULT_BACKEND",
    "CORS_ALLOW_ALL_ORIGINS",
    "CORS_ALLOWED_ORIGINS",
    "DJANGO_ADMIN_URL",
    "EMAIL_TRANSPORT_BACKEND",
    "EMAIL_RECIPIENT_HMAC_KEY",
    "HEALTH_READY_TOKEN",
    "MFA_REQUIRED_ROLES",
    "MAINTENANCE_MODE",
    "MAINTENANCE_MODE_IGNORE_ADMIN_SITE",
    "MAINTENANCE_MODE_IGNORE_STAFF",
    "MAINTENANCE_MODE_IGNORE_SUPERUSER",
    "MAINTENANCE_MODE_RETRY_AFTER",
    "MAINTENANCE_MODE_TEMPLATE",
    "MP4HLS_COMMAND",
    "RECAPTCHA_PRIVATE_KEY",
    "RECAPTCHA_PUBLIC_KEY",
    "SECURE_CONTENT_TYPE_NOSNIFF",
    "SECURE_HSTS_INCLUDE_SUBDOMAINS",
    "SECURE_HSTS_PRELOAD",
    "SECURE_HSTS_SECONDS",
    "SECURE_SSL_REDIRECT",
    "SERVER_EMAIL",
    "SITE_ID",
    "UI_VARIANT_ALLOWED",
    "UI_VARIANT_DEFAULT",
    "UI_VARIANT_REVAMP_PAGES",
    "UPLOAD_MAX_FILES_NUMBER",
    "UPLOAD_MAX_SIZE",
    "USE_X_ACCEL_REDIRECT",
    "WHISPER_CPP_COMMAND",
    "WHISPER_CPP_DIR",
    "WHISPER_CPP_MODEL",
)

STRUCTURED_SETTINGS = {"CACHES", "DATABASES", "WHISPER_MODEL"}
IGNORED_LEGACY_SETTINGS = {
    "BASE_DIR",  # Derived from the checked-out application path.
    "SECURE_BROWSER_XSS_FILTER",  # Removed from supported Django settings.
    "SILKY_INTERCEPT_PERCENT",
    "SILKY_MAX_RECORDED_REQUESTS",
    "SILKY_MAX_REQUEST_BODY_SIZE",
    "SILKY_MAX_RESPONSE_BODY_SIZE",
    "SILKY_META",
    "SILKY_PYTHON_PROFILER",
    "SILKY_PYTHON_PROFILER_BINARY",  # django-silk is not installed.
    "SSL_FRONTEND_HOST",  # Derived from FRONTEND_HOST.
    "UPLOAD_SUBDOMAIN",  # No application consumer exists.
}


def parse_env(path):
    values = {}
    if not path.is_file():
        return values
    for line in path.read_text().splitlines():
        if line and not line.lstrip().startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key] = value
    return values


def serialize(value):
    if isinstance(value, (list, tuple)):
        value = ",".join(str(item) for item in value)
    elif isinstance(value, bool):
        value = "true" if value else "false"
    return shlex.quote(str(value))


def migrate_local_settings(path):
    if not path.is_file():
        return {}
    source = path.read_text()
    assigned = set()
    for node in ast.walk(ast.parse(source)):
        if isinstance(node, (ast.Assign, ast.AnnAssign)):
            targets = node.targets if isinstance(node, ast.Assign) else [node.target]
            assigned.update(target.id for target in targets if isinstance(target, ast.Name) and target.id.isupper())
    supported = set(DIRECT_SETTINGS) | STRUCTURED_SETTINGS | IGNORED_LEGACY_SETTINGS
    unknown = sorted(name for name in assigned if not name.startswith("_") and name not in supported)
    if unknown:
        raise RuntimeError("unsupported legacy settings: " + ", ".join(unknown))

    settings = runpy.run_path(str(path))
    migrated = {key: serialize(settings[key]) for key in DIRECT_SETTINGS if key in settings}
    database = settings.get("DATABASES", {}).get("default", {})
    for setting_key, env_key in (
        ("NAME", "DATABASE_NAME"),
        ("HOST", "DATABASE_HOST"),
        ("PORT", "DATABASE_PORT"),
        ("USER", "DATABASE_USER"),
        ("PASSWORD", "DATABASE_PASSWORD"),
    ):
        if setting_key in database:
            migrated[env_key] = serialize(database[setting_key])
    cache_location = settings.get("CACHES", {}).get("default", {}).get("LOCATION")
    if cache_location:
        migrated.setdefault("REDIS_LOCATION", serialize(cache_location))
    if "WHISPER_MODEL" in settings:
        migrated["WHISPER_MODEL_SIZE"] = serialize(settings["WHISPER_MODEL"])
    return migrated


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--domain", required=True)
    parser.add_argument("--otel-enabled", choices=("true", "false"), required=True)
    parser.add_argument("--legacy-observability", type=Path)
    parser.add_argument("--legacy-local-settings", type=Path)
    args = parser.parse_args()

    values = parse_env(args.output)
    if args.legacy_observability:
        for key, value in parse_env(args.legacy_observability).items():
            values.setdefault(key, value)
    if args.legacy_local_settings:
        for key, value in migrate_local_settings(args.legacy_local_settings).items():
            values.setdefault(key, value)

    for key in DIRECT_SETTINGS:
        if key in os.environ:
            value = os.environ[key]
            if key == "FRONTEND_HOST" and "://" not in value:
                value = f"https://{value}"
            values[key] = serialize(value)
    if "CINEMATACMS_APP_SECRET_KEY" in os.environ:
        values["SECRET_KEY"] = serialize(os.environ["CINEMATACMS_APP_SECRET_KEY"])
    if "CINEMATACMS_APP_PORTAL_NAME" in os.environ:
        values["PORTAL_NAME"] = serialize(os.environ["CINEMATACMS_APP_PORTAL_NAME"])
    values.setdefault("SECRET_KEY", serialize(secrets.token_urlsafe(50)))
    values.setdefault("FRONTEND_HOST", serialize(f"https://{args.domain}"))
    values.setdefault("ALLOWED_HOSTS", serialize(f"127.0.0.1,localhost,{args.domain}"))
    values.setdefault("DATABASE_NAME", "mediacms")
    values.setdefault("DATABASE_HOST", "127.0.0.1")
    values.setdefault("DATABASE_PORT", "5432")
    values.setdefault("DATABASE_USER", "mediacms")
    values.setdefault("DATABASE_PASSWORD", "mediacms")
    values.setdefault("REDIS_LOCATION", "redis://127.0.0.1:6379/1")
    values.setdefault("TELEMETRY_WORKER_ID", str(uuid.uuid4()))
    values.setdefault("TELEMETRY_WORKER_HMAC_KEY", secrets.token_urlsafe(48))
    values["OTEL_ENABLED"] = args.otel_enabled
    values.setdefault("OTEL_SERVICE_NAME", "cinematacms")
    values.setdefault("OTEL_EXPORTER_OTLP_ENDPOINT", "http://127.0.0.1:4318/v1/traces")
    values.setdefault("OTEL_EXPORTER_OTLP_HEADERS", "")
    values.setdefault("OTEL_TRACES_SAMPLER_ARG", "1.0")
    values.setdefault("OTEL_PRIORITY_TRACES_SAMPLER_ARG", "1.0")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    temporary = args.output.with_name(f".{args.output.name}.{os.getpid()}")
    temporary.write_text("".join(f"{key}={value}\n" for key, value in sorted(values.items())))
    temporary.chmod(0o640)
    temporary.replace(args.output)


if __name__ == "__main__":
    main()
