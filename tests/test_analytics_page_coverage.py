"""Every page a tracked visitor can open must load the Umami tracker or name why it does not."""

import shutil
import tempfile
import time

from allauth.account.forms import default_token_generator
from allauth.account.models import EmailAddress
from allauth.account.utils import user_pk_to_url_str
from allauth.mfa.recovery_codes.internal.auth import RecoveryCodes
from allauth.mfa.totp.internal.auth import TOTP, generate_totp_secret
from django.conf import settings
from django.core.files.base import ContentFile
from django.test import TestCase, override_settings
from django.urls import URLResolver, get_resolver
from waffle.models import Switch

from files.models import ExistingURL, Language, Page, Playlist, Subtitle
from files.tests.helpers import create_test_media, create_test_user

TRACKER_CONFIG = 'id="cinemata-analytics-config"'

JSON_OR_API = "Returns JSON or protocol data to a page that is tracked itself"
FILE = "Serves a file, feed, sitemap or robots.txt, not an HTML page"
BEACON = "Receives the tracker's own beacons"
OPERATIONS = "Operator health, metrics and observability endpoints"
SUPERUSER_REPORT = "Superuser-only JSON report"
DJANGO_ADMIN = "The Django admin is out of scope"
STAFF_ONLY = "Only staff, editors, managers or superusers can open it, and they are never tracked"
DEV_ONLY = "Returns 404 unless DEBUG is on"
REDIRECT_ONLY = "Only redirects to another page, which makes its own decision"
DOWNLOAD = "Returns a file download, not a page"
SOCIAL_LOGIN = "No social login provider is configured, and allauth renders these pages outside root.html"
TOOLING = "Third-party editor, API or debugging tooling"

EXCLUDED_PREFIXES = {
    settings.DJANGO_ADMIN_URL: DJANGO_ADMIN,
    "api/": JSON_OR_API,
    "fu/": JSON_OR_API,
    "api-auth/": TOOLING,
    "tinymce/": TOOLING,
    "__debug__/": TOOLING,
    "accounts/3rdparty/": SOCIAL_LOGIN,
    "accounts/social/": SOCIAL_LOGIN,
    "internal/": OPERATIONS,
    "media/": FILE,
    "static/": FILE,
    "rss": FILE,
}

EXCLUDED_ROUTES = {
    "export_analytics": DOWNLOAD,
    "mfa_download_recovery_codes": DOWNLOAD,
    "record_playback": BEACON,
    "record_segment_event": BEACON,
    "segment_report": SUPERUSER_REPORT,
    "robots.txt": FILE,
    "sitemap_index": FILE,
    "sitemap_section": FILE,
    "metrics": OPERATIONS,
    "health/live": OPERATIONS,
    "health/ready": OPERATIONS,
    "manage_users": STAFF_ONLY,
    "manage_media": STAFF_ONLY,
    "manage_comments": STAFF_ONLY,
    "export_users": STAFF_ONLY,
    "modern_demo": DEV_ONLY,
    "get_user_analytics": REDIRECT_ONLY,
    "user_settings": REDIRECT_ONLY,
}


def _route_patterns(patterns=None, prefix=""):
    for pattern in get_resolver().url_patterns if patterns is None else patterns:
        route = prefix + str(pattern.pattern).replace("^", "").removesuffix("$")
        if isinstance(pattern, URLResolver):
            yield from _route_patterns(pattern.url_patterns, route)
        else:
            yield pattern.name or route, route


def _excluded_prefix(route):
    return next((reason for prefix, reason in EXCLUDED_PREFIXES.items() if route.startswith(prefix)), None)


# waffle caches switches, so a shared Redis could serve a stale upload switch.
@override_settings(
    ANALYTICS_ENABLED=True,
    ANALYTICS_URL="",
    ANALYTICS_WEBSITE_ID="",
    MFA_REQUIRED_ROLES=[],
    CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "page-coverage"}},
)
class PageTrackingCoverageTests(TestCase):
    def setUp(self):
        media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, media_root, ignore_errors=True)
        media_root_override = override_settings(MEDIA_ROOT=media_root)
        media_root_override.enable()
        self.addCleanup(media_root_override.disable)
        Switch.objects.update_or_create(name="upload_media_allowed", defaults={"active": True})

        self.owner = create_test_user(email="owner@example.org", allow_contact=True)
        self.member = create_test_user(email="member@example.org")
        # allauth lets only a verified address add an authenticator.
        EmailAddress.objects.update_or_create(
            user=self.member, email=self.member.email, defaults={"verified": True, "primary": True}
        )
        self.media = create_test_media(self.owner, state="public")
        self.media.existing_urls.add(ExistingURL.objects.create(url="/Members/owner/videos/old"))
        self.page = Page.objects.create(slug="coverage-story", title="Story", description="Text")
        self.playlist = Playlist.objects.create(title="Coverage", user=self.owner)
        self.subtitle = Subtitle.objects.create(
            media=self.media,
            user=self.owner,
            language=Language.objects.create(code="en", title="English"),
            subtitle_file=ContentFile(b"WEBVTT\n", name="coverage.vtt"),
        )
        self.mfa_member = create_test_user(email="mfa@example.org")
        TOTP.activate(self.mfa_member, generate_totp_secret())
        RecoveryCodes.activate(self.mfa_member)

    def _visitors(self):
        return {
            "anonymous": None,
            "member": self.member,
            "owner": self.owner,
            "trusted": create_test_user(advancedUser=True),
            "curator": create_test_user(is_curator=True),
            "no_password": self._passwordless_member(),
            "mfa_member": self.mfa_member,
        }

    def _passwordless_member(self):
        user = create_test_user()
        user.set_unusable_password()
        user.save(update_fields=["password"])
        return user

    def _sign_in(self, user):
        self.client.force_login(user)
        # A real sign-in records this, and allauth's MFA settings pages require it to be recent.
        session = self.client.session
        session["account_authentication_methods"] = [{"method": "password", "at": time.time()}]
        session.save()

    def _password_reset_url(self):
        key = default_token_generator.make_token(self.member)
        return f"/accounts/password/reset/key/{user_pk_to_url_str(self.member)}-{key}/"

    def _tracked_pages(self):
        """Route name to the visitor allowed to open it and the URL that shows it."""
        token = self.media.friendly_token
        owner = self.owner.username
        return {
            "": ("anonymous", "/"),
            "latest": ("anonymous", "/latest"),
            "featured": ("anonymous", "/featured"),
            "recommended": ("anonymous", "/recommended"),
            "popular": ("anonymous", "/popular"),
            "get_page": ("anonymous", f"/p/{self.page.slug}"),
            "terms_of_service": ("anonymous", "/tos"),
            "creative_commons": ("anonymous", "/creative-commons"),
            "categories": ("anonymous", "/categories"),
            "members": ("anonymous", "/members"),
            "tags": ("anonymous", "/tags"),
            "contact": ("anonymous", "/contact"),
            "countries": ("anonymous", "/countries"),
            "languages": ("anonymous", "/languages"),
            "topics": ("anonymous", "/topics"),
            "search": ("anonymous", "/search"),
            "history": ("member", "/history"),
            "liked_media": ("member", "/liked"),
            "notifications": ("member", "/notifications/"),
            "get_media": ("anonymous", f"/view?m={token}"),
            "get_embed": ("anonymous", f"/embed?m={token}"),
            "get_old_media": ("anonymous", "/Members/owner/videos/old"),
            "embed_old_media": ("anonymous", "/Members/owner/videos/old/embed_view"),
            "get_playlist": ("anonymous", f"/playlist/{self.playlist.friendly_token}"),
            "edit_media": ("owner", f"/edit?m={token}"),
            "add_subtitle": ("owner", f"/add_subtitle?m={token}"),
            "edit_subtitle": ("owner", f"/edit_subtitle?id={self.subtitle.id}"),
            "upload_media": ("member", "/upload"),
            "manage_uploads": ("trusted", "/manage/uploads"),
            "manage_film_impact": ("curator", "/manage/film-impact"),
            "manage_film_impact_edit": ("curator", "/manage/film-impact/00000000-0000-4000-8000-000000000001/edit"),
            "creator_analytics": ("owner", "/analytics"),
            "get_user": ("anonymous", f"/user/{owner}"),
            "get_user_media": ("anonymous", f"/user/{owner}/media"),
            "get_user_playlists": ("anonymous", f"/user/{owner}/playlists"),
            "get_user_about": ("anonymous", f"/user/{owner}/about"),
            "get_user_impact": ("anonymous", f"/user/{owner}/impact"),
            "get_user_manage_uploads": ("owner", f"/user/{owner}/uploads"),
            "get_user_notes": ("owner", f"/user/{owner}/notes"),
            "get_user_history": ("owner", f"/user/{owner}/history"),
            "get_user_liked": ("owner", f"/user/{owner}/liked"),
            "get_user_contact": ("member", f"/user/{owner}/contact"),
            "edit_user": ("owner", f"/user/{owner}/edit"),
            "view_channel": ("anonymous", f"/channel/{self.owner.channels.first().friendly_token}"),
            "edit_channel": ("owner", f"/channel/{self.owner.channels.first().friendly_token}/edit"),
            "mfa_success": ("member", "/accounts/2fa/totp/success"),
            "account_login": ("anonymous", "/accounts/login/"),
            "account_logout": ("member", "/accounts/logout/"),
            "account_inactive": ("anonymous", "/accounts/inactive/"),
            "account_signup": ("anonymous", "/accounts/signup/"),
            "account_reauthenticate": ("member", "/accounts/reauthenticate/"),
            "account_email": ("member", "/accounts/email/"),
            "account_email_verification_sent": ("anonymous", "/accounts/confirm-email/"),
            "account_change_password": ("member", "/accounts/password/change/"),
            "account_set_password": ("no_password", "/accounts/password/set/"),
            "account_reset_password": ("anonymous", "/accounts/password/reset/"),
            "account_reset_password_done": ("anonymous", "/accounts/password/reset/done/"),
            "account_reset_password_from_key": ("anonymous", self._password_reset_url()),
            "account_reset_password_from_key_done": ("anonymous", "/accounts/password/reset/key/done/"),
            "account_confirm_email": ("anonymous", "/accounts/confirm-email/unknown-key/"),
            "account_request_login_code": ("anonymous", "/accounts/login/code/"),
            "account_confirm_login_code": ("login_code", "/accounts/login/code/confirm/"),
            "mfa_index": ("member", "/accounts/2fa/"),
            "mfa_authenticate": ("mfa_login", "/accounts/2fa/authenticate/"),
            "mfa_reauthenticate": ("mfa_member", "/accounts/2fa/reauthenticate/"),
            "mfa_activate_totp": ("member", "/accounts/2fa/totp/activate/"),
            "mfa_deactivate_totp": ("mfa_member", "/accounts/2fa/totp/deactivate/"),
            "mfa_view_recovery_codes": ("mfa_member", "/accounts/2fa/recovery-codes/"),
            "mfa_generate_recovery_codes": ("mfa_member", "/accounts/2fa/recovery-codes/generate/"),
        }

    def _open_as(self, visitor, url):
        self.client.logout()
        if visitor == "login_code":
            self.client.post("/accounts/login/code/", {"email": self.member.email})
        elif visitor == "mfa_login":
            self.client.post("/accounts/login/", {"login": self.mfa_member.username, "password": "testpass1234567890"})
        elif self._visitors()[visitor] is not None:
            self._sign_in(self._visitors()[visitor])
        response = self.client.get(url)
        # A valid reset key moves to a key-free URL kept in the session.
        if response.status_code == 302 and url.startswith("/accounts/password/reset/key/"):
            response = self.client.get(response["Location"])
        return response

    def test_every_route_has_a_tracking_decision(self):
        tracked = self._tracked_pages()
        undecided = sorted(
            {
                f"{key} ({route})"
                for key, route in _route_patterns()
                if not _excluded_prefix(route) and key not in EXCLUDED_ROUTES and key not in tracked
            }
        )
        self.assertEqual(undecided, [], "Each route must be tracked or listed with an exclusion reason")

        routes = {key for key, route in _route_patterns() if not _excluded_prefix(route)}
        stale = sorted((set(EXCLUDED_ROUTES) | set(tracked)) - routes)
        self.assertEqual(stale, [], "Remove decisions for routes that no longer exist")

    def test_every_tracked_page_loads_the_tracker_for_a_visitor_allowed_to_open_it(self):
        for key, (visitor, url) in self._tracked_pages().items():
            with self.subTest(route=key, visitor=visitor):
                response = self._open_as(visitor, url)
                self.assertEqual(response.status_code, 200)
                self.assertContains(response, TRACKER_CONFIG)

    def test_mfa_challenge_of_an_excluded_account_loads_no_tracker(self):
        for role in ("is_staff", "is_superuser", "disable_activity_logging"):
            with self.subTest(role=role):
                setattr(self.mfa_member, role, True)
                self.mfa_member.save(update_fields=[role])
                response = self._open_as("mfa_login", "/accounts/2fa/authenticate/")
                self.assertEqual(response.status_code, 200)
                self.assertNotContains(response, TRACKER_CONFIG)
                setattr(self.mfa_member, role, False)
                self.mfa_member.save(update_fields=[role])

    def test_staff_only_pages_turn_away_every_tracked_role(self):
        staff_only = {
            "manage_users": "/manage/users",
            "manage_media": "/manage/media",
            "manage_comments": "/manage/comments",
            "export_users": "/manage/users/export",
        }
        self.assertEqual(set(staff_only), {key for key, reason in EXCLUDED_ROUTES.items() if reason == STAFF_ONLY})
        for visitor in ("anonymous", "member", "trusted", "curator"):
            for key, url in staff_only.items():
                with self.subTest(route=key, visitor=visitor):
                    response = self._open_as(visitor, url)
                    self.assertEqual(response.status_code, 302)
                    self.assertNotContains(response, TRACKER_CONFIG, status_code=302)

    def test_redirect_and_development_routes_render_no_page(self):
        self.assertEqual(self._open_as("member", "/modern-demo").status_code, 404)
        for url in (f"/user/{self.member.username}/analytics", f"/user/{self.member.username}/settings"):
            with self.subTest(url=url):
                self.assertEqual(self._open_as("member", url).status_code, 302)
