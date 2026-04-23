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
    # REMOTE_ADDR is set by the TCP socket and cannot be spoofed by the client.
    # X-Forwarded-For is intentionally NOT trusted here because /health/ready is
    # public + unauthenticated, and typical nginx setups preserve the client-
    # supplied XFF value before appending the real peer address — letting an
    # attacker send "X-Forwarded-For: 127.0.0.1" to escalate into the detailed
    # response branch. Operators who want non-localhost privileged access should
    # log in as staff.
    remote_addr = request.META.get("REMOTE_ADDR", "")
    is_localhost = remote_addr in ("127.0.0.1", "::1")
    is_staff = (
        hasattr(request, "user")
        and request.user.is_authenticated
        and request.user.is_staff
    )
    return is_localhost or is_staff


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
    except (AttributeError, KeyError, TypeError) as e:
        logger.warning("health: DJANGO_VITE config missing", exc_info=True)
        return False, "not_configured"
    if os.path.exists(path):
        return True, "ok"
    logger.warning("health: static manifest missing at %s", path)
    return False, "missing"


@require_GET
def live(request):
    return JsonResponse({"status": "ok"}, status=200)


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

    return JsonResponse(body, status=200 if all_ok else 503)
