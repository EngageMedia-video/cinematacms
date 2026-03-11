import os

from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path
from prometheus_client import CollectorRegistry, generate_latest
from prometheus_client import multiprocess as prom_multiprocess


def metrics_view(request):
    # Primary access control: nginx should restrict /metrics to localhost.
    # This Django check is defense-in-depth using the real client IP
    # (X-Forwarded-For set by nginx) rather than REMOTE_ADDR which is
    # always 127.0.0.1 behind a reverse proxy.
    client_ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
    if not client_ip:
        client_ip = request.META.get("REMOTE_ADDR", "")
    is_localhost = client_ip in ("127.0.0.1", "::1")
    is_staff = hasattr(request, "user") and request.user.is_staff
    if not is_localhost and not is_staff:
        from django.http import HttpResponseForbidden

        return HttpResponseForbidden()

    # Use multiprocess registry when PROMETHEUS_MULTIPROC_DIR is set (production),
    # fall back to default in-process registry (dev with CELERY_TASK_ALWAYS_EAGER)
    if os.environ.get("PROMETHEUS_MULTIPROC_DIR"):
        registry = CollectorRegistry()
        prom_multiprocess.MultiProcessCollector(registry)
        data = generate_latest(registry)
    else:
        data = generate_latest()

    return HttpResponse(data, content_type="text/plain; version=0.0.4; charset=utf-8")


urlpatterns = [
    path("metrics", metrics_view),
    path(settings.DJANGO_ADMIN_URL, admin.site.urls),
    path("", include("files.urls")),
    path("", include("users.urls")),
    path("accounts/", include("allauth.urls")),
    path("api-auth/", include("rest_framework.urls")),
    path("tinymce/", include("tinymce.urls")),
]

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
