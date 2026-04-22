import os
import tempfile

from django.conf import settings
from django.db import connection
from django.http import JsonResponse
from django.views.decorators.http import require_GET

from files.cache_utils import health_check as cache_health_check


def _client_is_privileged(request) -> bool:
    client_ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
    if not client_ip:
        client_ip = request.META.get("REMOTE_ADDR", "")
    is_localhost = client_ip in ("127.0.0.1", "::1")
    is_staff = hasattr(request, "user") and request.user.is_authenticated and request.user.is_staff
    return is_localhost or is_staff


def _check_db() -> tuple[bool, str]:
    try:
        with connection.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        return True, "ok"
    except Exception as e:
        return False, str(e)


def _check_cache() -> tuple[bool, str]:
    try:
        result = cache_health_check()
    except Exception as e:
        return False, str(e)
    if result.get("status") == "healthy":
        return True, "ok"
    return False, result.get("error", "unhealthy")


def _check_filesystem() -> tuple[bool, str]:
    try:
        with tempfile.NamedTemporaryFile(
            dir=settings.MEDIA_ROOT, prefix=".healthz_", delete=True
        ) as f:
            f.write(b"ok")
            f.flush()
        return True, "ok"
    except Exception as e:
        return False, str(e)


def _check_static_manifest() -> tuple[bool, str]:
    try:
        path = settings.DJANGO_VITE["default"]["manifest_path"]
    except (AttributeError, KeyError, TypeError) as e:
        return False, f"manifest_path not configured: {e}"
    if os.path.exists(path):
        return True, "ok"
    return False, f"missing: {path}"


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
