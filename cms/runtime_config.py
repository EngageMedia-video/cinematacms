"""Typed access to CinemataCMS runtime environment variables."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)


def env_bool(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    normalized = value.strip().lower()
    if normalized in {"1", "true", "yes", "on"}:
        return True
    if normalized in {"0", "false", "no", "off"}:
        return False
    return default


def env_csv(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    return [item.strip() for item in value.split(",") if item.strip()]


def env_optional_csv(name, default=None):
    value = os.getenv(name)
    if value is None:
        return default
    if value.strip().lower() == "__none__":
        return None
    return [item.strip() for item in value.split(",") if item.strip()]


def env_float(name, default):
    try:
        return float(os.getenv(name, str(default)))
    except ValueError:
        return default


def env_int(name, default):
    try:
        return int(os.getenv(name, str(default)))
    except ValueError:
        return default


def env_optional_bool(name, default=None):
    if name not in os.environ:
        return default
    if os.environ[name].strip().lower() == "__none__":
        return None
    return env_bool(name, False)


def env_optional_str(name, default=None):
    value = os.getenv(name)
    if value is None:
        return default
    if value.strip().lower() == "__none__":
        return None
    return value
