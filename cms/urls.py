from django.contrib import admin
from django.http import HttpResponseRedirect
from django.urls import path, re_path
from django.conf.urls import include
from django.conf import settings

urlpatterns = [
    path(settings.DJANGO_ADMIN_URL, admin.site.urls),
    re_path(r"^", include("files.urls")),
    re_path(r"^", include("users.urls")),
    re_path(r"^accounts/", include("allauth.urls")),
    re_path(r"^api-auth/", include("rest_framework.urls")),
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
    if hasattr(settings, 'MEDIA_URL') and hasattr(settings, 'MEDIA_ROOT'):
        urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)