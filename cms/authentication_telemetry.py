"""Bounded, privacy-safe authentication failure telemetry."""

import base64
import binascii
import logging

from django.http import JsonResponse
from django.views.csrf import csrf_failure as django_csrf_failure
from rest_framework import exceptions
from rest_framework.authentication import (
    BasicAuthentication as DRFBasicAuthentication,
)
from rest_framework.authentication import (
    SessionAuthentication as DRFSessionAuthentication,
)
from rest_framework.authentication import (
    TokenAuthentication as DRFTokenAuthentication,
)

from files import metrics

logger = logging.getLogger(__name__)

AUTH_SURFACES = frozenset({"account_login", "api", "restricted_media", "other"})
AUTH_MECHANISMS = frozenset({"password", "basic", "session", "token", "media_password", "media_token", "unknown"})
AUTH_REASONS = frozenset(
    {
        "invalid_credentials",
        "malformed_credentials",
        "inactive_principal",
        "csrf_rejected",
        "rate_limited",
        "missing_credentials",
        "invalid_token",
        "dependency_unavailable",
        "internal_error",
        "unknown_failure",
        "other",
    }
)


def _bounded(value, allowed, field, fallback):
    if value in allowed:
        return value
    metrics.record_contract_violation("authentication", field)
    return fallback


class AuthenticationFailureRecorder:
    """Record one authentication failure without retaining request data."""

    @staticmethod
    def record(surface, mechanism, reason):
        labels = {
            "surface": _bounded(surface, AUTH_SURFACES, "surface", "other"),
            "mechanism": _bounded(mechanism, AUTH_MECHANISMS, "mechanism", "unknown"),
            "reason": _bounded(reason, AUTH_REASONS, "reason", "unknown_failure"),
        }
        try:
            metrics.AUTH_FAILURES_TOTAL.labels(**labels).inc()
        except Exception:
            metrics.record_telemetry_failure("metrics", "authentication", "emit")
        try:
            logger.warning("cinematacms.authentication.failed", extra=labels)
        except Exception:
            metrics.record_telemetry_failure("logs", "authentication", "emit")


def record_authentication_failure(surface, mechanism, reason):
    AuthenticationFailureRecorder.record(surface, mechanism, reason)


class AuthenticationDependencyUnavailable(exceptions.APIException):
    status_code = 503
    default_detail = "Authentication service is temporarily unavailable."
    default_code = "authentication_dependency_unavailable"


class AuthenticationDependencyMiddleware:
    """Translate authentication dependency failures outside DRF into HTTP 503."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)
        match = getattr(request, "resolver_match", None)
        if (
            request.method == "POST"
            and response.status_code == 429
            and getattr(match, "url_name", "") == "account_login"
        ):
            record_authentication_failure("account_login", "password", "rate_limited")
        return response

    def process_exception(self, request, exception):
        if not isinstance(exception, AuthenticationDependencyUnavailable):
            return None
        return JsonResponse({"detail": str(exception.detail)}, status=exception.status_code)


def csrf_failure(request, reason=""):
    """Record browser CSRF rejection without retaining Django's reason text."""

    record_authentication_failure("account_login", "session", "csrf_rejected")
    return django_csrf_failure(request, reason=reason)


def _basic_failure_reason(request):
    header = request.headers.get("authorization", "")
    parts = header.split()
    if len(parts) != 2:
        return "malformed_credentials"
    try:
        decoded = base64.b64decode(parts[1], validate=True).decode("utf-8")
    except (binascii.Error, UnicodeDecodeError):
        return "malformed_credentials"
    if ":" not in decoded:
        return "malformed_credentials"
    return "invalid_credentials"


class BasicAuthentication(DRFBasicAuthentication):
    def authenticate(self, request):
        attempted = request.headers.get("authorization", "").lower().startswith("basic")
        try:
            return super().authenticate(request)
        except exceptions.AuthenticationFailed:
            if attempted:
                record_authentication_failure("api", "basic", _basic_failure_reason(request))
            raise
        except Exception:
            if attempted:
                record_authentication_failure("api", "basic", "internal_error")
            raise


class SessionAuthentication(DRFSessionAuthentication):
    def enforce_csrf(self, request):
        try:
            return super().enforce_csrf(request)
        except exceptions.PermissionDenied:
            record_authentication_failure("api", "session", "csrf_rejected")
            raise


class TokenAuthentication(DRFTokenAuthentication):
    def authenticate(self, request):
        attempted = request.headers.get("authorization", "").lower().startswith("token")
        try:
            return super().authenticate(request)
        except exceptions.AuthenticationFailed:
            if attempted:
                record_authentication_failure("api", "token", "invalid_token")
            raise
        except Exception:
            if attempted:
                record_authentication_failure("api", "token", "internal_error")
            raise
