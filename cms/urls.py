from django.contrib import admin
from django.urls import path, re_path
from django.conf.urls import include
from django.conf import settings
import debug_toolbar

urlpatterns = [
    re_path(r"^__debug__/", include(debug_toolbar.urls)),
    path(settings.DJANGO_ADMIN_URL, admin.site.urls),
    re_path(r"^", include("files.urls")),
    re_path(r"^", include("users.urls")),
    re_path(r"^accounts/", include("allauth.urls")),
    re_path(r"^api-auth/", include("rest_framework.urls")),
    # for rich text editor
    path('tinymce/', include('tinymce.urls')),
]
