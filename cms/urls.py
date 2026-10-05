import hashlib
import hmac
import ipaddress
import json
import logging
import os

from django.apps import apps
from django.conf import settings
from django.contrib import admin
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.http import HttpResponse, JsonResponse
from django.urls import include, path
from django.views.decorators.csrf import csrf_exempt
from prometheus_client import CollectorRegistry, generate_latest
from prometheus_client import multiprocess as prom_multiprocess

from cms.analytics import platform_analytics, record_segment_event, segment_report
from cms.cache_telemetry import owned_cache
from cms.error_tracking import ErrorTrackingDiagnosticError, capture_unexpected_exception
from cms.health import live as health_live
from cms.health import ready as health_ready
from cms.playback_analytics import record_playback
from cms.request_utils import get_client_ip
from files.metrics import refresh_runtime_metrics
from users import views as user_views

lookup_logger = logging.getLogger("cms.observability.lookup")
lookup_rate_cache = owned_cache.bind("incident_lookup_rate_limit")
error_tracking_logger = logging.getLogger("cms.observability.error_tracking")
error_tracking_diagnostic_rate_cache = owned_cache.bind("error_tracking_diagnostic_rate_limit")


def _error_tracking_diagnostic_source_allowed(request):
    client_ip = get_client_ip(request)
    try:
        return ipaddress.ip_address(client_ip).is_loopback
    except ValueError:
        return False


def _error_tracking_diagnostic_rate_limited(request):
    client_ip = get_client_ip(request)
    fingerprint = hashlib.sha256(client_ip.encode()).hexdigest()[:24]
    key = f"error-tracking-diagnostic:{fingerprint}"
    limit = min(50, max(1, getattr(settings, "ERROR_TRACKING_DIAGNOSTICS_RATE_LIMIT", 50)))
    window = max(1, getattr(settings, "ERROR_TRACKING_DIAGNOSTICS_RATE_WINDOW_SECONDS", 3600))
    try:
        if error_tracking_diagnostic_rate_cache.add(key, 1, timeout=window, raise_on_error=True):
            return False
        return error_tracking_diagnostic_rate_cache.incr(key, raise_on_error=True) > limit
    except Exception as error:
        error_tracking_logger.error(
            "cinematacms.observability.error_tracking_diagnostic.denied",
            extra={"outcome": "denied", "reason": "rate_limit_unavailable"},
        )
        capture_unexpected_exception(error)
        return True


def _audit_error_tracking_diagnostic(level, outcome, reason):
    getattr(error_tracking_logger, level)(
        "cinematacms.observability.error_tracking_diagnostic.%s",
        outcome,
        extra={"outcome": outcome, "reason": reason},
    )


@csrf_exempt
def error_tracking_diagnostic(request):
    enabled = getattr(settings, "ERROR_TRACKING_DIAGNOSTICS_ENABLED", False)
    environment = getattr(settings, "SENTRY_ENVIRONMENT", "")
    if not enabled or environment != "staging":
        return HttpResponse(status=404)
    if not _error_tracking_diagnostic_source_allowed(request):
        _audit_error_tracking_diagnostic("warning", "denied", "untrusted_source")
        return JsonResponse({"error": "forbidden"}, status=403)
    if request.method != "POST":
        _audit_error_tracking_diagnostic("warning", "denied", "method_not_allowed")
        return JsonResponse({"error": "method_not_allowed"}, status=405)
    if _error_tracking_diagnostic_rate_limited(request):
        _audit_error_tracking_diagnostic("warning", "denied", "rate_limited")
        response = JsonResponse({"error": "rate_limited"}, status=429)
        response["Retry-After"] = str(getattr(settings, "ERROR_TRACKING_DIAGNOSTICS_RATE_WINDOW_SECONDS", 3600))
        return response
    expected_token = getattr(settings, "ERROR_TRACKING_DIAGNOSTICS_TOKEN", "")
    supplied_token = request.headers.get("Authorization", "").removeprefix("Bearer ")
    if not expected_token or not hmac.compare_digest(supplied_token, expected_token):
        _audit_error_tracking_diagnostic("warning", "denied", "invalid_credentials")
        return JsonResponse({"error": "forbidden"}, status=403)

    _audit_error_tracking_diagnostic("info", "triggered", "authorized")
    raise ErrorTrackingDiagnosticError("staging error tracking diagnostic")


def _reference_lookup_source_allowed(request):
    client_ip = get_client_ip(request)
    try:
        address = ipaddress.ip_address(client_ip)
    except ValueError:
        return False
    for configured in getattr(settings, "OBSERVABILITY_REFERENCE_ALLOWED_IPS", ("127.0.0.1", "::1")):
        try:
            if address in ipaddress.ip_network(configured, strict=False):
                return True
        except ValueError:
            continue
    return False


def _reference_lookup_rate_limited(request):
    client_ip = get_client_ip(request)
    fingerprint = hashlib.sha256(client_ip.encode()).hexdigest()[:24]
    key = f"observability-reference-lookup:{fingerprint}"
    limit = max(1, getattr(settings, "OBSERVABILITY_REFERENCE_RATE_LIMIT", 30))
    window = max(1, getattr(settings, "OBSERVABILITY_REFERENCE_RATE_WINDOW_SECONDS", 60))
    try:
        if lookup_rate_cache.add(key, 1, timeout=window, raise_on_error=True):
            return False
        return lookup_rate_cache.incr(key, raise_on_error=True) > limit
    except Exception as error:
        lookup_logger.exception(
            "cinematacms.observability.reference_lookup.denied",
            extra={"outcome": "denied", "reason": "rate_limit_unavailable"},
        )
        capture_unexpected_exception(error)
        return True


def _audit_reference_lookup(level, outcome, reason, kind=""):
    getattr(lookup_logger, level)(
        "cinematacms.observability.reference_lookup.%s",
        outcome,
        extra={"outcome": outcome, "reason": reason, "lookup_kind": kind},
    )


@csrf_exempt
def observability_reference_lookup(request):
    if not _reference_lookup_source_allowed(request):
        _audit_reference_lookup("warning", "denied", "untrusted_source")
        return JsonResponse({"error": "forbidden"}, status=403)
    if _reference_lookup_rate_limited(request):
        _audit_reference_lookup("warning", "denied", "rate_limited")
        response = JsonResponse({"error": "rate_limited"}, status=429)
        response["Retry-After"] = str(getattr(settings, "OBSERVABILITY_REFERENCE_RATE_WINDOW_SECONDS", 60))
        return response
    token = getattr(settings, "OBSERVABILITY_REFERENCE_LOOKUP_TOKEN", "")
    supplied = request.headers.get("Authorization", "").removeprefix("Bearer ")
    if not token or not hmac.compare_digest(supplied, token):
        _audit_reference_lookup("warning", "denied", "invalid_credentials")
        return JsonResponse({"error": "forbidden"}, status=403)
    if request.method != "POST":
        _audit_reference_lookup("warning", "denied", "method_not_allowed")
        return JsonResponse({"error": "method_not_allowed"}, status=405)
    max_body_bytes = max(1, getattr(settings, "OBSERVABILITY_REFERENCE_MAX_BODY_BYTES", 1024))
    if len(request.body) > max_body_bytes:
        _audit_reference_lookup("warning", "denied", "body_too_large")
        return JsonResponse({"error": "request_too_large"}, status=413)
    try:
        payload = json.loads(request.body)
        kind = payload["kind"]
        value = payload["value"]
        if not isinstance(value, str) or not value.strip():
            raise ValueError
    except (json.JSONDecodeError, KeyError, TypeError, ValueError):
        _audit_reference_lookup("warning", "denied", "invalid_request")
        return JsonResponse({"error": "invalid_request"}, status=400)

    if kind == "actor":
        from email_delivery.service import recipient_reference_candidates

        try:
            validate_email(value)
        except ValidationError:
            _audit_reference_lookup("warning", "denied", "invalid_actor", kind)
            return JsonResponse({"error": "invalid_actor"}, status=400)
        try:
            references = recipient_reference_candidates(value)
        except ValidationError:
            _audit_reference_lookup("error", "failed", "reference_unavailable", kind)
            return JsonResponse({"error": "reference_unavailable"}, status=503)
        log_field = "actor_ref"
        span_field = "cinematacms.actor_ref"
    elif kind == "media":
        from cms.observability import media_reference

        if len(value) > 255 or not all(character.isalnum() or character in "-_" for character in value):
            _audit_reference_lookup("warning", "denied", "invalid_media", kind)
            return JsonResponse({"error": "invalid_media"}, status=400)
        reference = media_reference(value)
        if not reference:
            _audit_reference_lookup("error", "failed", "reference_unavailable", kind)
            return JsonResponse({"error": "reference_unavailable"}, status=503)
        references = (reference,)
        log_field = "media_ref"
        span_field = "cinematacms.media_ref"
    else:
        _audit_reference_lookup("warning", "denied", "unsupported_kind")
        return JsonResponse({"error": "unsupported_kind"}, status=400)
    _audit_reference_lookup("info", "resolved", "success", kind)
    return JsonResponse(
        {
            "kind": kind,
            "references": [
                {"reference": value, "log_field": log_field, "span_field": span_field} for value in references
            ],
        }
    )


def metrics_view(request):
    # Primary access control: nginx should restrict /metrics to localhost.
    # This Django check is defense-in-depth using the real client IP.
    client_ip = get_client_ip(request)
    is_localhost = client_ip in ("127.0.0.1", "::1")
    is_staff = hasattr(request, "user") and request.user.is_staff
    if not is_localhost and not is_staff:
        from django.http import HttpResponseForbidden

        return HttpResponseForbidden()

    refresh_runtime_metrics()

    # Use multiprocess registry when PROMETHEUS_MULTIPROC_DIR is set (production),
    # fall back to default in-process registry (dev with CELERY_TASK_ALWAYS_EAGER)
    if os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
        registry = CollectorRegistry()
        prom_multiprocess.MultiProcessCollector(registry)
        data = generate_latest(registry)
    else:
        data = generate_latest()

    return HttpResponse(data, content_type="text/plain; version=0.0.4; charset=utf-8")


def robots_txt(request):
    return HttpResponse("User-agent: *\nDisallow:\n", content_type="text/plain; charset=utf-8")


urlpatterns = [
    path("analytics", user_views.view_analytics, name="creator_analytics"),
    path("analytics/export", user_views.export_analytics, name="export_analytics"),
    path("analytics/playback", record_playback, name="record_playback"),
    path("analytics/segment-event", record_segment_event, name="record_segment_event"),
    path("analytics/segments", segment_report, name="segment_report"),
    path("robots.txt", robots_txt),
    path("metrics", metrics_view),
    path("internal/observability/references", observability_reference_lookup),
    path("internal/observability/error-probe", error_tracking_diagnostic),
    path("health/live", health_live),
    path("health/ready", health_ready),
    path(
        f"{settings.DJANGO_ADMIN_URL}analytics/", admin.site.admin_view(platform_analytics), name="platform_analytics"
    ),
    path(settings.DJANGO_ADMIN_URL, admin.site.urls),
    path("", include("files.urls")),
    path("", include("users.urls")),
    path("accounts/", include("allauth.urls")),
    path("api-auth/", include("rest_framework.urls")),
    path("tinymce/", include("tinymce.urls")),
]

if apps.is_installed("notifications"):
    urlpatterns.insert(4, path("", include("notifications.urls")))

# Only add debug toolbar URLs when DEBUG is True
if settings.DEBUG:
    import debug_toolbar
    from django.conf.urls.static import static

    urlpatterns = [
        path("__debug__/", include(debug_toolbar.urls)),  # Updated for 6.0.0 - using path() instead of re_path()
    ] + urlpatterns

    # Serve static files in development
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    if hasattr(settings, "MEDIA_URL") and hasattr(settings, "MEDIA_ROOT"):
        urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
