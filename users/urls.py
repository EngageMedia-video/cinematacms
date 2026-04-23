from django.conf import settings
from django.urls import path, re_path

from . import views

# Shared username pattern: word chars, `@`, `.`, `_`, `-`. Non-empty so
# pathological URLs like `/user//media` 404 instead of silently redirecting.
USERNAME_RE = r"[\w@._-]+"

urlpatterns = [
    # NON API VIEWS
    re_path(rf"^user/(?P<username>{USERNAME_RE})$", views.view_user, name="get_user"),
    re_path(rf"^user/(?P<username>{USERNAME_RE})/$", views.view_user, name="get_user"),
    re_path(
        rf"^user/(?P<username>{USERNAME_RE})/media$",
        views.view_user_media,
        name="get_user_media",
    ),
    re_path(
        rf"^user/(?P<username>{USERNAME_RE})/playlists$",
        views.view_user_playlists,
        name="get_user_playlists",
    ),
    re_path(
        rf"^user/(?P<username>{USERNAME_RE})/about$",
        views.view_user_about,
        name="get_user_about",
    ),
    re_path(rf"^user/(?P<username>{USERNAME_RE})/edit$", views.edit_user, name="edit_user"),
    re_path(
        rf"^user/(?P<username>{USERNAME_RE})/settings$",
        views.legacy_settings_redirect,
        name="user_settings",
    ),
    re_path(r"^channel/(?P<friendly_token>\w+(-\w+)*)$", views.view_channel, name="view_channel"),
    re_path(
        r"^channel/(?P<friendly_token>\w+(-\w+)*)/edit$",
        views.edit_channel,
        name="edit_channel",
    ),
    # API VIEWS
    path("api/v1/users", views.UserList.as_view(), name="api_users"),
    path("api/v1/users/", views.UserList.as_view()),
    re_path(
        rf"^api/v1/users/(?P<username>{USERNAME_RE})$",
        views.UserDetail.as_view(),
        name="api_get_user",
    ),
    re_path(
        rf"^api/v1/users/(?P<username>{USERNAME_RE})/contact",
        views.contact_user,
        name="api_contact_user",
    ),
    # success-mfa
    re_path(r"^accounts/2fa/totp/success", views.mfa_success_message, name="mfa_success"),
]

if settings.DEBUG:
    # DEBUG section cleaned up - no duplicate patterns needed
    pass
