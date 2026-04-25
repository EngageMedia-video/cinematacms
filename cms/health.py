import logging
import os
import tempfile

from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from files.cache_utils import health_check as cache_health_check

logger = logging.getLogger(__name__)


def _client_is_privileged(request) -> bool:
    # Two gates for the detailed branch:
    #   1. Direct-localhost request (operator shell on the host running uwsgi).
    #      REMOTE_ADDR is localhost AND no X-Forwarded-For header is present.
    #      Behind nginx, REMOTE_ADDR is always 127.0.0.1, so requiring XFF to be
    #      absent is what distinguishes a direct curl on the box from proxied
    #      external traffic (nginx adds XFF via $proxy_add_x_forwarded_for).
    #      XFF is never *trusted* — we only check whether it exists — so this
    #      cannot be bypassed by spoofing a header value.
    #   2. Authenticated staff session (the supported way to get detail from
    #      behind the proxy).
    #
    # Note: this is intentionally stricter than `metrics_view` in `cms/urls.py`,
    # which trusts the leftmost XFF entry as the client IP. /health/ready is
    # public and unauthenticated, so we don't trust XFF at all here. When
    # `cms.request_utils.get_client_ip()` lands (PR #503), revisit whether to
    # share a helper while preserving this no-XFF-trust posture for the public
    # health path.
    remote_addr = request.META.get("REMOTE_ADDR", "")
    has_xff = bool(request.META.get("HTTP_X_FORWARDED_FOR", "").strip())
    is_direct_localhost = remote_addr in ("127.0.0.1", "::1") and not has_xff
    is_staff = (
        hasattr(request, "user")
        and request.user.is_authenticated
        and request.user.is_staff
    )
    return is_direct_localhost or is_staff


def _safe_detail(exc: BaseException) -> str:
    # Return only the exception class name in the response. Full message and
    # traceback are logged server-side so operators can still diagnose via logs
    # without exposing stack-trace-style information over HTTP (CodeQL py/stack-
    # trace-exposure).
    return exc.__class__.__name__


def _check_db() -> tuple[bool, str]:
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        return True, "ok"
    except Exception as e:
        logger.warning("health: database check failed", exc_info=True)
        return False, _safe_detail(e)


def _check_cache() -> tuple[bool, str]:
    try:
        result = cache_health_check()
    except Exception as e:
        logger.warning("health: cache check raised", exc_info=True)
        return False, _safe_detail(e)
    if result.get("status") == "healthy":
        return True, "ok"
    logger.warning("health: cache reported unhealthy: %s", result.get("error"))
    return False, "unhealthy"


def _check_filesystem() -> tuple[bool, str]:
    try:
        with tempfile.NamedTemporaryFile(
            dir=settings.MEDIA_ROOT, prefix=".healthz_", delete=True
        ) as f:
            f.write(b"ok")
            f.flush()
        return True, "ok"
    except Exception as e:
        logger.warning("health: filesystem check failed", exc_info=True)
        return False, _safe_detail(e)


def _check_static_manifest() -> tuple[bool, str]:
    try:
        cfg = settings.DJANGO_VITE["default"]
        if cfg.get("dev_mode"):
            # Vite dev server serves assets; no build manifest is expected.
            return True, "ok (dev_mode)"
        path = cfg["manifest_path"]
    except (AttributeError, KeyError, TypeError):
        logger.warning("health: DJANGO_VITE config missing", exc_info=True)
        return False, "not_configured"
    if os.path.exists(path):
        return True, "ok"
    logger.warning("health: static manifest missing at %s", path)
    return False, "missing"


@require_GET
def live(request):
    # Cache-Control: no-store on both probes — if a CDN, corporate proxy, or a
    # mis-enabled nginx proxy_cache ever sat in front, a stale 200 could mask a
    # dead process and defeat the point of the probe.
    response = JsonResponse({"status": "ok"}, status=200)
    response["Cache-Control"] = "no-store"
    return response


@require_GET
def ready(request):
    privileged = _client_is_privileged(request)
    checks = {
        "database": _check_db(),
        "cache": _check_cache(),
        "filesystem": _check_filesystem(),
        "static_manifest": _check_static_manifest(),
    }
    all_ok = all(ok for ok, _ in checks.values())

    if privileged:
        body = {
            "status": "ok" if all_ok else "fail",
            "checks": {name: {"ok": ok, "detail": detail} for name, (ok, detail) in checks.items()},
        }
    else:
        body = {
            "status": "ok" if all_ok else "fail",
            "checks": {name: ("ok" if ok else "fail") for name, (ok, _) in checks.items()},
        }

    response = JsonResponse(body, status=200 if all_ok else 503)
    response["Cache-Control"] = "no-store"
    return response
