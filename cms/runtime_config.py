"""Typed access to CinemataCMS runtime environment variables."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)


def env_bool(name, default):
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def env_csv(name, default):
    value = os.getenv(name)
    if value is None:
        return default
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
    return env_bool(name, False)
