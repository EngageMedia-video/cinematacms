import os

from django.conf import settings
from django.contrib import admin
from django.http import HttpResponse
from django.urls import include, path
from prometheus_client import CollectorRegistry, generate_latest
from prometheus_client import multiprocess as prom_multiprocess


def metrics_view(request):
    # Allow localhost (Prometheus scraper) or authenticated staff
    remote_ip = request.META.get("REMOTE_ADDR", "")
    if remote_ip not in ("127.0.0.1", "::1") and not (hasattr(request, "user") and request.user.is_staff):
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
