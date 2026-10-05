import csv
import json
import uuid
from datetime import datetime, timedelta
from datetime import timezone as utc_timezone
from io import StringIO
from types import SimpleNamespace
from unittest.mock import patch
from zoneinfo import ZoneInfo

from django.apps import apps
from django.contrib.auth.models import AnonymousUser
from django.core import signing
from django.core.management import call_command
from django.db import connection
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import resolve, reverse
from django.utils import timezone

from cms.analytics import action_events, allow_page_analytics, analytics_context, queue_action
from cms.creator_analytics import AnalyticsUnavailable, creator_analytics
from cms.playback_analytics import measurement_token, playback_figures
from files.management.commands.purge_playback_summaries import twelve_month_cutoff
from files.models import Comment, ExistingURL, Media, Page, PlaybackSummary
from files.tests.helpers import create_test_media, create_test_user
from files.views import _attach_hero_playback_to_first_featured_item


@override_settings(ANALYTICS_ENABLED=True, ANALYTICS_URL="", ANALYTICS_WEBSITE_ID="")
class WorkflowAnalyticsContextTests(SimpleTestCase):
    def test_redirect_events_are_consumed_once_without_form_values(self):
        request = RequestFactory().post("/accounts/login?next=secret", {"password": "secret"})
        request.user = AnonymousUser()
        request.session = {}
        request.resolver_match = SimpleNamespace(url_name="home")
        request.path = "/"
        queue_action(request, "signin_success")
        self.assertEqual(analytics_context(request)["ANALYTICS"]["events"], [{"name": "signin_success"}])
        self.assertEqual(analytics_context(request)["ANALYTICS"]["events"], [])
        self.assertNotIn("secret", json.dumps(request.session))

    def test_server_action_events_respect_staff_opt_out_dnt_and_disabled_collection(self):
        request = RequestFactory().post("/edit?m=secret")
        for fields in (
            {"is_staff": True},
            {"is_editor": True},
            {"is_manager": True},
            {"disable_activity_logging": True},
        ):
            request.user = SimpleNamespace(is_anonymous=False, **fields)
            self.assertEqual(action_events(request, "media_update"), [])
        request.user = AnonymousUser()
        request.META["HTTP_DNT"] = "1"
        self.assertEqual(action_events(request, "media_update"), [])
        request.META.pop("HTTP_DNT")
        with override_settings(ANALYTICS_ENABLED=False):
            self.assertEqual(action_events(request, "media_update"), [])

    def test_authentication_signal_counts_only_completed_eligible_authentication(self):
        from allauth.account.signals import user_logged_in, user_logged_out, user_signed_up

        request = RequestFactory().post("/accounts/signup", {"email": "private@example.org", "subscribe": "on"})
        request.user = AnonymousUser()
        request.session = {}
        user = SimpleNamespace(is_anonymous=False)
        user_signed_up.send(sender=type(user), request=request, user=user)
        user_logged_in.send(sender=type(user), request=request, user=user)
        user_logged_out.send(sender=type(user), request=request, user=user)
        self.assertEqual(
            [event["name"] for event in request.session["analytics_events"]],
            ["signup_success", "newsletter_optin", "signin_success", "signout_success"],
        )
        self.assertNotIn("private@example.org", json.dumps(request.session))
        request.session.clear()
        user.is_staff = True
        user_logged_out.send(sender=type(user), request=request, user=user)
        self.assertEqual(request.session, {})

    def test_access_checked_workflow_uses_generic_path_without_public_role_grant(self):
        request = RequestFactory().get("/edit?m=private-token")
        request.user = SimpleNamespace(is_anonymous=False)
        request.resolver_match = SimpleNamespace(url_name="edit_media")
        request.analytics_workflow = "media_edit"
        config = analytics_context(request)["ANALYTICS"]
        self.assertEqual(config["path"], "/page/media_edit")
        self.assertTrue(config["nonpublic"])
        self.assertNotIn("segment_grant", config)
        self.assertNotIn("private-token", json.dumps(config))

    def test_public_profile_sections_remain_distinct_without_username(self):
        request = RequestFactory().get("/user/somebody/about")
        request.user = AnonymousUser()
        request.resolver_match = SimpleNamespace(url_name="get_user_about")
        self.assertEqual(analytics_context(request)["ANALYTICS"]["path"], "/user/profile/about")


class AnalyticsTemplateTests(TestCase):
    @override_settings(ANALYTICS_ENABLED=True, ANALYTICS_URL="", ANALYTICS_WEBSITE_ID="")
    def test_authorized_edit_page_is_generic_and_denied_edit_page_has_no_tracker(self):
        owner = create_test_user()
        media = create_test_media(owner, state="private")
        self.client.force_login(create_test_user())
        denied = self.client.get(f"/edit?m={media.friendly_token}")
        self.assertEqual(denied.status_code, 302)
        self.assertNotIn("ANALYTICS", denied.context or {})
        self.client.force_login(owner)
        response = self.client.get(f"/edit?m={media.friendly_token}")
        config = response.context["ANALYTICS"]
        self.assertEqual(config["path"], "/page/media_edit")
        self.assertNotIn(media.friendly_token, json.dumps(config))
        self.assertNotIn("segment_grant", config)
        self.assertContains(response, '<meta name="referrer" content="no-referrer">')

    @override_settings(ANALYTICS_ENABLED=True, ANALYTICS_URL="", ANALYTICS_WEBSITE_ID="")
    def test_article_aliases_share_a_canonical_analytics_path(self):
        Page.objects.create(slug="canonical-story", title="Story", description="Text")
        for url in ("/canonical-story", "/p/canonical-story"):
            self.assertEqual(self.client.get(url).context["ANALYTICS"]["path"], "/canonical-story")

    @override_settings(ANALYTICS_ENABLED=True, ANALYTICS_URL="", ANALYTICS_WEBSITE_ID="")
    def test_cms_only_tracking_loads_without_umami_configuration(self):
        media = create_test_media(create_test_user(), state="public")
        response = self.client.get(media.get_absolute_url())

        self.assertContains(response, "cinemata-analytics-config")
        self.assertEqual(response.context["ANALYTICS"]["url"], "")
        self.assertEqual(response.context["ANALYTICS"]["website_id"], "")
        self.assertTrue(response.context["ANALYTICS"]["measurement_token"])

    def test_tracker_is_absent_by_default(self):
        response = self.client.get("/")

        self.assertNotContains(response, "matomo.engagemedia.org")
        self.assertNotContains(response, "analytics.cinemata.org")

    @override_settings(
        ANALYTICS_ENABLED=True,
        ANALYTICS_URL="https://analytics.cinemata.org",
        ANALYTICS_WEBSITE_ID="00000000-0000-4000-8000-000000000001",
    )
    def test_public_page_loads_configured_tracker(self):
        response = self.client.get("/")

        self.assertContains(response, "cinemata-analytics-config")
        self.assertContains(response, "https://analytics.cinemata.org")
        self.assertNotContains(response, "matomo.engagemedia.org")

    @override_settings(
        ANALYTICS_ENABLED=True,
        ANALYTICS_URL="https://analytics.cinemata.org",
        ANALYTICS_WEBSITE_ID="00000000-0000-4000-8000-000000000001",
    )
    def test_new_public_view_can_opt_in_with_a_token_free_route_name(self):
        request = RequestFactory().get("/future/private-token")
        request.user = AnonymousUser()
        request.resolver_match = SimpleNamespace(url_name="future_feature")

        self.assertEqual(analytics_context(request), {})
        allow_page_analytics(request)
        self.assertEqual(analytics_context(request)["ANALYTICS"]["path"], "/page/future_feature")

    @override_settings(
        ANALYTICS_ENABLED=True,
        ANALYTICS_URL="https://analytics.cinemata.org",
        ANALYTICS_WEBSITE_ID="00000000-0000-4000-8000-000000000001",
    )
    def test_text_page_enables_reading_milestones_only_after_page_exists(self):
        Page.objects.create(slug="a-story", title="A story", description="Article body")

        response = self.client.get("/a-story")
        self.assertContains(response, '"text_page": true')
        grant = signing.loads(response.context["ANALYTICS"]["segment_grant"], salt="cinemata.segment.v1")
        self.assertEqual(grant, {"scope": f"page:{Page.objects.get(slug='a-story').pk}"})
        missing = self.client.get("/missing-story")
        self.assertNotContains(missing, "cinemata-analytics-config")


@override_settings(
    ANALYTICS_ENABLED=True,
    ANALYTICS_URL="https://analytics.cinemata.org",
    ANALYTICS_WEBSITE_ID="00000000-0000-4000-8000-000000000001",
)
class SegmentAggregateTests(TestCase):
    @override_settings(MFA_REQUIRED_ROLES=[])
    def test_django_admin_platform_report_keeps_authorization_and_shows_small_counts(self):
        metric_model = apps.get_model("files", "DailySegmentMetric")
        metric_model.objects.create(
            day=timezone.now().date(), segment="regular", scope="home", event="page_view", count=9
        )
        metric_model.objects.create(
            day=timezone.now().date(), segment="anonymous", scope="home", event="page_view", count=15
        )
        owner = create_test_user()
        self.client.force_login(owner)
        report_url = reverse("platform_analytics")
        self.assertEqual(self.client.get(report_url).status_code, 302)
        owner.is_staff = True
        owner.save(update_fields=["is_staff"])
        self.assertEqual(self.client.get(report_url).status_code, 404)
        owner.is_superuser = True
        owner.save(update_fields=["is_superuser"])
        response = self.client.get(report_url)
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "admin/platform_analytics.html")
        self.assertEqual(response.context["analytics_rows"][0]["counts"], [15, 9, 0, 0])
        self.assertNotContains(response, "cinemata-analytics-config")
        self.assertNotContains(response, "Hidden")
        self.assertContains(response, reverse("admin:index"))
        self.assertIn("private", response["Cache-Control"])
        self.assertIn("no-store", response["Cache-Control"])

    @override_settings(MFA_REQUIRED_ROLES=[])
    def test_platform_report_is_linked_only_from_superuser_admin_dashboard(self):
        from django.contrib.auth.models import Permission

        report_url = reverse("platform_analytics")
        self.client.force_login(create_test_user(is_superuser=True, is_staff=True))
        response = self.client.get(reverse("admin:index"))
        self.assertContains(response, f'href="{report_url}"')
        response = self.client.get(reverse("admin:users_user_changelist"))
        self.assertTemplateUsed(response, "admin/nav_sidebar.html")
        sidebar = response.content.decode().split('id="nav-sidebar"', 1)[1].split("</nav>", 1)[0]
        self.assertIn(f'href="{report_url}"', sidebar)
        self.assertIn("Users", sidebar)
        response = self.client.get(report_url)
        self.assertContains(response, f'href="{report_url}" aria-current="page"')

        staff = create_test_user(is_staff=True)
        staff.user_permissions.add(Permission.objects.get(content_type__app_label="users", codename="view_user"))
        self.client.force_login(staff)
        response = self.client.get(reverse("admin:index"))
        self.assertNotContains(response, f'href="{report_url}"')
        response = self.client.get(reverse("admin:users_user_changelist"))
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "admin/nav_sidebar.html")
        self.assertNotContains(response, f'href="{report_url}"')

    @override_settings(MFA_REQUIRED_ROLES=[])
    def test_admin_platform_report_has_an_explicit_empty_state(self):
        self.client.force_login(create_test_user(is_superuser=True, is_staff=True))
        response = self.client.get(reverse("platform_analytics"))
        self.assertContains(response, "No activity recorded in this period.")

    def test_existing_segment_endpoint_stays_json_even_for_html_accept(self):
        self.client.force_login(create_test_user(is_superuser=True, is_staff=True))
        response = self.client.get("/analytics/segments", headers={"accept": "text/html"})
        self.assertEqual(response["Content-Type"], "application/json")
        self.assertEqual(response.json()["rows"], [])

    @override_settings(MFA_REQUIRED_ROLES=[])
    def test_admin_platform_report_is_read_only_and_has_bounded_telemetry(self):
        from cms.http_telemetry import classify_request

        report_url = reverse("platform_analytics")
        request = RequestFactory().get(report_url)
        request.resolver_match = resolve(report_url)
        self.assertEqual(classify_request(request), ("pages", "analytics_segment_report"))
        self.client.force_login(create_test_user(is_superuser=True, is_staff=True))
        self.assertEqual(self.client.post(report_url).status_code, 405)

    def post_event(self, grant, event="page_view", **headers):
        return self.client.post(
            "/analytics/segment-event",
            json.dumps({"grant": grant, "event": event}),
            content_type="application/json",
            HTTP_ORIGIN="http://testserver",
            **headers,
        )

    def test_public_text_page_counts_anonymous_views_without_visitor_identity(self):
        page = Page.objects.create(slug="story", title="Story", description="Text")
        grant = self.client.get("/story").context["ANALYTICS"]["segment_grant"]

        response = self.post_event(grant)

        self.assertEqual(response.status_code, 204)
        metric = apps.get_model("files", "DailySegmentMetric").objects.get()
        self.assertEqual(
            (metric.segment, metric.scope, metric.event, metric.count), ("anonymous", f"page:{page.pk}", "page_view", 1)
        )
        self.assertFalse(hasattr(metric, "user_id"))

    def test_counts_regular_trusted_and_curator_without_sending_role(self):
        Page.objects.create(slug="story", title="Story", description="Text")
        grant = self.client.get("/story").context["ANALYTICS"]["segment_grant"]
        metric_model = apps.get_model("files", "DailySegmentMetric")

        for segment, fields in (
            ("regular", {}),
            ("trusted", {"advancedUser": True}),
            ("curator", {"is_curator": True}),
        ):
            viewer = create_test_user()
            for field, value in fields.items():
                setattr(viewer, field, value)
            viewer.save(update_fields=list(fields)) if fields else None
            self.client.force_login(viewer)
            self.assertEqual(self.post_event(grant, "text_read_15s").status_code, 204)
            self.assertEqual(metric_model.objects.get(segment=segment).count, 1)

    def test_excludes_opted_out_staff_and_dnt_and_rejects_forgery(self):
        grant = self.client.get("/").context["ANALYTICS"]["segment_grant"]
        self.assertEqual(self.post_event(grant, "text_read_15s").status_code, 400)
        self.assertEqual(self.post_event("forged").status_code, 400)
        for malformed_grant in (None, 123, [], {}):
            self.assertEqual(self.post_event(malformed_grant).status_code, 400)
        self.assertEqual(self.post_event(grant, HTTP_DNT="1").status_code, 404)
        self.assertEqual(
            self.client.post(
                "/analytics/segment-event",
                json.dumps({"grant": grant, "event": "page_view"}),
                content_type="application/json",
                headers={"origin": "https://other.example"},
            ).status_code,
            403,
        )
        viewer = create_test_user()
        viewer.disable_activity_logging = True
        viewer.save(update_fields=["disable_activity_logging"])
        self.client.force_login(viewer)
        self.assertEqual(self.post_event(grant).status_code, 404)
        viewer.disable_activity_logging = False
        viewer.is_editor = True
        viewer.save(update_fields=["disable_activity_logging", "is_editor"])
        self.assertEqual(self.post_event(grant).status_code, 404)
        self.assertFalse(apps.get_model("files", "DailySegmentMetric").objects.exists())

    def test_superuser_json_report_includes_small_segment_counts(self):
        metric_model = apps.get_model("files", "DailySegmentMetric")
        today = timezone.now().date()
        page = Page.objects.create(slug="story", title="Story", description="Text")
        metric_model.objects.create(day=today, segment="anonymous", scope="home", event="page_view", count=9)
        metric_model.objects.create(day=today, segment="trusted", scope="home", event="page_view", count=10)
        metric_model.objects.create(
            day=today, segment="curator", scope=f"page:{page.pk}", event="text_read_30s", count=12
        )

        self.assertEqual(self.client.get("/analytics/segments").status_code, 302)
        self.client.force_login(create_test_user())
        self.assertEqual(self.client.get("/analytics/segments").status_code, 404)
        self.client.force_login(create_test_user(is_superuser=True, is_staff=True))
        response = self.client.get("/analytics/segments")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json()["rows"],
            [
                {"segment": "anonymous", "scope": "home", "event": "page_view", "count": 9},
                {"segment": "trusted", "scope": "home", "event": "page_view", "count": 10},
                {
                    "segment": "curator",
                    "scope": f"page:{page.pk}",
                    "path": "/story",
                    "event": "text_read_30s",
                    "count": 12,
                },
            ],
        )
        self.assertEqual(response["Cache-Control"], "private, no-store")

    def test_aggregate_retention_applies_to_command_and_scheduled_task(self):
        metric_model = apps.get_model("files", "DailySegmentMetric")
        old_day = twelve_month_cutoff(timezone.now()).date() - timedelta(days=1)
        current = metric_model.objects.create(
            day=timezone.now().date(), segment="anonymous", scope="home", event="page_view", count=1
        )
        old = metric_model.objects.create(day=old_day, segment="anonymous", scope="home", event="page_view", count=1)
        call_command("purge_playback_summaries", "--dry-run", stdout=StringIO())
        self.assertTrue(metric_model.objects.filter(pk=old.pk).exists())
        call_command("purge_playback_summaries", stdout=StringIO())
        self.assertFalse(metric_model.objects.filter(pk=old.pk).exists())
        old = metric_model.objects.create(day=old_day, segment="anonymous", scope="home", event="page_view", count=1)
        from files.tasks import purge_playback_summaries

        purge_playback_summaries.run()
        self.assertFalse(metric_model.objects.filter(pk=old.pk).exists())
        self.assertTrue(metric_model.objects.filter(pk=current.pk).exists())


@override_settings(
    ANALYTICS_ENABLED=True,
    ANALYTICS_URL="https://analytics.cinemata.org",
    ANALYTICS_WEBSITE_ID="00000000-0000-4000-8000-000000000001",
)
class MediaAnalyticsTests(TestCase):
    def test_hero_payload_has_current_measurement_grant(self):
        media = create_test_media(create_test_user())
        item = {"friendly_token": media.friendly_token}
        payload = _attach_hero_playback_to_first_featured_item([item])[0]["hero_playback"]
        self.assertEqual(payload["analytics_revision"], str(media.analytics_revision))
        self.assertEqual(signing.loads(payload["measurement_token"], salt="cinemata.playback.v1")["context"], "hero")

    def test_legacy_hero_detail_grant_is_only_available_after_access_check(self):
        owner = create_test_user()
        public = create_test_media(owner, state="public")
        response = self.client.get(f"/api/v1/media/{public.friendly_token}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["analytics_revision"], str(public.analytics_revision))
        grant = signing.loads(response.data["hero_measurement_token"], salt="cinemata.playback.v1")
        self.assertEqual(grant["media"], str(public.uid))
        self.assertEqual(grant["context"], "hero")

        private = create_test_media(owner, state="private")
        denied = self.client.get(f"/api/v1/media/{private.friendly_token}")
        self.assertEqual(denied.status_code, 401)
        self.assertNotIn("hero_measurement_token", denied.data)

    def test_media_cut_rotates_only_when_source_file_changes(self):
        media = create_test_media(create_test_user())
        original = media.analytics_revision
        media.title = "Renamed"
        media.thumbnail.name = "still.jpg"
        media.save(update_fields=["title", "thumbnail"])
        media.refresh_from_db()
        self.assertEqual(media.analytics_revision, original)
        self.assertEqual(media.analytics_revisions, [])
        media.media_file.name = "source-v2.mp4"
        with patch("files.tasks.media_init.apply_async"):
            media.save(update_fields=["media_file"])
        media.refresh_from_db()
        self.assertNotEqual(media.analytics_revision, original)
        self.assertEqual(media.analytics_revisions, [str(original)])

    def test_public_media_page_has_opaque_media_tag(self):
        owner = create_test_user()
        media = create_test_media(owner, state="public")

        response = self.client.get(f"/view?m={media.friendly_token}")

        self.assertContains(response, "cinemata-analytics-config")
        self.assertContains(response, str(media.uid))
        self.assertIn("segment_grant", response.context["ANALYTICS"])

    def test_editor_session_does_not_track_public_media(self):
        owner = create_test_user()
        editor = create_test_user()
        editor.is_editor = True
        editor.save(update_fields=["is_editor"])
        media = create_test_media(owner, state="public")
        self.client.force_login(editor)

        response = self.client.get(f"/view?m={media.friendly_token}")

        self.assertNotContains(response, "cinemata-analytics-config")

    def test_activity_logging_opt_out_does_not_load_tracker(self):
        owner = create_test_user()
        viewer = create_test_user()
        viewer.disable_activity_logging = True
        viewer.save(update_fields=["disable_activity_logging"])
        media = create_test_media(owner, state="public")
        self.client.force_login(viewer)

        self.assertNotContains(self.client.get("/"), "cinemata-analytics-config")
        self.assertNotContains(self.client.get(f"/view?m={media.friendly_token}"), "cinemata-analytics-config")

    def test_curator_session_tracks_public_media(self):
        owner = create_test_user()
        curator = create_test_user()
        curator.is_curator = True
        curator.save(update_fields=["is_curator"])
        media = create_test_media(owner, state="public")
        self.client.force_login(curator)

        self.assertContains(self.client.get(f"/view?m={media.friendly_token}"), "cinemata-analytics-config")

    def test_denied_restricted_page_does_not_track(self):
        owner = create_test_user()
        media = create_test_media(owner, state="restricted")

        response = self.client.get(f"/view?m={media.friendly_token}")

        self.assertNotContains(response, "cinemata-analytics-config")

    def test_legacy_private_embed_uses_current_access_check(self):
        owner = create_test_user()
        media = create_test_media(owner, state="private")
        media.existing_urls.add(ExistingURL.objects.create(url="/Members/owner/videos/old"))

        response = self.client.get("/Members/owner/videos/old/embed_view")

        self.assertEqual(response.status_code, 401)
        self.assertNotContains(response, "cinemata-analytics-config", status_code=401)

    def test_private_pages_require_owner_for_modern_and_legacy_urls(self):
        owner = create_test_user()
        media = create_test_media(owner, state="private")
        media.title = "Private title"
        media.save(update_fields=["title"])
        media.existing_urls.add(ExistingURL.objects.create(url="/Members/owner/videos/old"))

        for url in (f"/view?m={media.friendly_token}", "/Members/owner/videos/old"):
            response = self.client.get(url)
            self.assertEqual(response.status_code, 401)
            self.assertNotContains(response, "Private title", status_code=401)
            self.assertNotContains(response, "cinemata-analytics-config", status_code=401)

        self.client.force_login(owner)
        response = self.client.get(f"/view?m={media.friendly_token}")
        self.assertContains(response, "cinemata-analytics-config")
        self.assertNotIn("segment_grant", response.context["ANALYTICS"])

    def test_editor_and_manager_can_open_private_modern_and_legacy_pages_without_tracking(self):
        owner = create_test_user()
        media = create_test_media(owner, state="private")
        media.existing_urls.add(ExistingURL.objects.create(url="/Members/owner/videos/old"))

        for role in ("is_editor", "is_manager"):
            self.client.force_login(create_test_user(**{role: True}))
            for url in (f"/view?m={media.friendly_token}", "/Members/owner/videos/old"):
                with self.subTest(role=role, url=url):
                    response = self.client.get(url)
                    self.assertEqual(response.status_code, 200)
                    for permission in ("CAN_EDIT_MEDIA", "CAN_DELETE_MEDIA", "CAN_DELETE_COMMENTS"):
                        self.assertTrue(response.context[permission])
                    self.assertNotContains(response, "cinemata-analytics-config")

    def test_legacy_restricted_page_uses_current_access_check(self):
        owner = create_test_user()
        media = create_test_media(owner, state="restricted")
        media.existing_urls.add(ExistingURL.objects.create(url="/Members/owner/videos/old"))

        response = self.client.get("/Members/owner/videos/old")

        self.assertNotContains(response, "cinemata-analytics-config")


@override_settings(
    ANALYTICS_ENABLED=True,
    ANALYTICS_URL="https://analytics.cinemata.org",
    ANALYTICS_WEBSITE_ID="00000000-0000-4000-8000-000000000001",
    ANALYTICS_API_KEY="test-key",
)
class CreatorAnalyticsTests(TestCase):
    @override_settings(ANALYTICS_URL="", ANALYTICS_WEBSITE_ID="", ANALYTICS_API_KEY="")
    def test_film_version_labels_keep_chronological_numbers_after_replacement(self):
        owner = create_test_user()
        film = create_test_media(owner)
        first, second = str(uuid.uuid4()), str(uuid.uuid4())
        current = str(film.analytics_revision)
        film.analytics_revisions = [first, second]
        film.save(update_fields=["analytics_revisions"])
        self.client.force_login(owner)

        data = self.client.get(f"/analytics?media={film.uid}").context["ANALYTICS_DATA"]
        self.assertEqual(
            data["versions"],
            [
                {"value": "all", "label": "All versions"},
                {"value": current, "label": "Version 3 - Current"},
                {"value": second, "label": "Version 2"},
                {"value": first, "label": "Version 1"},
                {"value": "unknown", "label": "Data without a film version"},
            ],
        )
        film.analytics_revisions.append(current)
        film.analytics_revision = uuid.uuid4()
        film.save(update_fields=["analytics_revision", "analytics_revisions"])

        versions = self.client.get(f"/analytics?media={film.uid}").context["ANALYTICS_DATA"]["versions"]
        self.assertEqual(versions[1]["label"], "Version 4 - Current")
        self.assertEqual(versions[2], {"value": current, "label": "Version 3"})
        self.assertEqual(versions[3:], data["versions"][2:])

    def test_all_versions_combines_owned_film_measurements_and_events(self):
        owner = create_test_user()
        film = create_test_media(owner)
        previous = str(uuid.uuid4())
        film.analytics_revisions = [previous]
        film.save(update_fields=["analytics_revisions"])
        other = create_test_media(owner)
        for media, revision, seconds in (
            (film, film.analytics_revision, 10),
            (film, previous, 20),
            (other, other.analytics_revision, 90),
        ):
            PlaybackSummary.objects.create(
                id=uuid.uuid4(),
                media=media,
                revision=revision,
                context="page",
                initiation="deliberate",
                started_at=timezone.now(),
                duration_ms=100000,
                coverage=[[0, seconds * 1000]],
                watch_days={timezone.now().date().isoformat(): seconds * 1000},
            )
        self.client.force_login(owner)

        def reply(endpoint, params):
            self.assertEqual(params["tag"], f"media:{film.uid}")
            self.assertNotIn("epf0", params)
            if endpoint == "metrics":
                return [{"x": "media_view", "y": 6}, {"x": "playback_start", "y": 4}, {"x": "like", "y": 1}]
            return []

        with patch("cms.creator_analytics.umami_get", side_effect=reply):
            response = self.client.get(f"/analytics?media={film.uid}&version=all&days=7")
            self.assertEqual(response.status_code, 200)
            data = response.context["ANALYTICS_DATA"]
            self.assertEqual(data["version"], "all")
            self.assertIn({"value": "all", "label": "All versions"}, data["versions"])
            self.assertEqual(data["measurement"]["watch_seconds"], 30)
            self.assertEqual(data["measurement"]["measured_plays"], 2)
            self.assertEqual(data["measurement"]["average_watch_seconds"], 15)
            self.assertEqual(data["media_views"], 6)
            for dataset in ("summary", "daily", "retention", "engagement"):
                with self.subTest(dataset=dataset):
                    exported = self.client.get(
                        f"/analytics/export?media={film.uid}&version=all&days=7&dataset={dataset}"
                    )
                    self.assertEqual(exported.status_code, 200)
                    rows = list(csv.DictReader(StringIO(exported.content.decode())))
                    self.assertTrue(rows)
                    self.assertTrue(all(row["cut"] in ("all", "") for row in rows))
                    if dataset == "summary":
                        values = {row["metric"]: row["value"] for row in rows}
                        self.assertEqual(values["watch_seconds"], "30")
                        self.assertEqual(values["measured_plays"], "2")
                        self.assertEqual(values["media_views"], "6")

        with (
            override_settings(ANALYTICS_URL="", ANALYTICS_WEBSITE_ID="", ANALYTICS_API_KEY=""),
            patch("cms.creator_analytics.umami_get") as collector,
        ):
            data = self.client.get(f"/analytics?media={film.uid}&version=all&days=7").context["ANALYTICS_DATA"]
        collector.assert_not_called()
        self.assertEqual(data["measurement"]["watch_seconds"], 30)
        self.assertEqual(data["measurement"]["measured_plays"], 2)

    @override_settings(ANALYTICS_URL="", ANALYTICS_WEBSITE_ID="", ANALYTICS_API_KEY="")
    def test_cms_only_dashboard_has_owned_media_and_separate_current_totals(self):
        owner = create_test_user()
        film = create_test_media(owner, state="private", views=999, likes=17)
        create_test_media(owner, state="public", views=100, likes=3)
        other = create_test_media(create_test_user(), views=9000, likes=50)
        for media in (film, film, other):
            Comment.objects.create(media=media, user=owner, text="Comment")
        PlaybackSummary.objects.create(
            id=uuid.uuid4(),
            media=film,
            revision=film.analytics_revision,
            context="page",
            initiation="deliberate",
            started_at=timezone.now(),
            duration_ms=100000,
            coverage=[[0, 25000]],
            watch_days={timezone.now().date().isoformat(): 25000},
        )
        self.client.force_login(owner)

        with patch("cms.creator_analytics.umami_get") as collector:
            data = self.client.get("/analytics?days=7").context["ANALYTICS_DATA"]
            detail = self.client.get(f"/analytics?media={film.uid}").context["ANALYTICS_DATA"]
            exported = self.client.get("/analytics/export?days=7")
            summary = self.client.get(f"/analytics/export?media={film.uid}&dataset=summary")

        collector.assert_not_called()
        self.assertIsNone(data["media_views"])
        self.assertIsNone(data["totals"])
        self.assertEqual(data["cms_totals"], {"legacy_views": 1099, "likes": 20, "comments": 2})
        self.assertEqual(detail["cms_totals"], {"legacy_views": 999, "likes": 17, "comments": 2})
        self.assertEqual(len(data["rows"]), 2)
        row = next(row for row in data["rows"] if row["analytics_url"].startswith(f"?media={film.uid}"))
        self.assertEqual(row["watch_seconds"], 25)
        self.assertEqual(row["measured_plays"], 1)
        self.assertIsNone(row["views"])
        self.assertEqual(data["pagination"]["count"], 1)
        rows = list(csv.DictReader(StringIO(exported.content.decode())))
        row = next(row for row in rows if row["media_id"] == str(film.uid))
        self.assertEqual(row["legacy_views_all_time"], "999")
        self.assertEqual(row["current_likes"], "17")
        self.assertEqual(row["current_comments"], "2")
        self.assertEqual(row["cms_measured_plays"], "1")
        self.assertEqual(row["views"], "")
        summary_rows = {row["metric"]: row for row in csv.DictReader(StringIO(summary.content.decode()))}
        current = summary_rows["legacy_views_all_time"]
        self.assertEqual(current["value"], "999")
        self.assertEqual(current["start_date"], "")
        self.assertEqual(current["cut"], "")
        self.assertEqual(current["source_status"], "available")

    @override_settings(ANALYTICS_URL="", ANALYTICS_WEBSITE_ID="", ANALYTICS_API_KEY="")
    def test_cms_only_media_list_is_paginated(self):
        owner = create_test_user()
        for _ in range(21):
            create_test_media(owner)
        self.client.force_login(owner)
        data = self.client.get("/analytics?page=2").context["ANALYTICS_DATA"]
        self.assertEqual(len(data["rows"]), 1)
        self.assertEqual(data["pagination"]["number"], 2)
        self.assertEqual(data["pagination"]["count"], 2)

    @override_settings(ANALYTICS_URL="", ANALYTICS_WEBSITE_ID="", ANALYTICS_API_KEY="")
    def test_portfolio_export_ignores_film_version(self):
        owner = create_test_user()
        film = create_test_media(owner)
        for revision in (film.analytics_revision, uuid.uuid4()):
            PlaybackSummary.objects.create(
                id=uuid.uuid4(),
                media=film,
                revision=revision,
                context="page",
                initiation="deliberate",
                started_at=timezone.now(),
                duration_ms=100000,
                coverage=[[0, 2000]],
                watch_days={timezone.now().date().isoformat(): 2000},
            )
        self.client.force_login(owner)
        for version in ("not-a-uuid", str(film.analytics_revision), "unknown", "all"):
            with self.subTest(version=version):
                response = self.client.get("/analytics/export", {"days": 7, "version": version})
                self.assertEqual(response.status_code, 200)
                rows = list(csv.DictReader(StringIO(response.content.decode())))
                self.assertEqual(len(rows), 1)
                self.assertEqual(rows[0]["cms_measured_plays"], "2")
                self.assertEqual(rows[0]["watch_seconds"], "4")

    def test_local_report_boundaries_and_equal_elapsed_comparison_across_dst(self):
        owner = create_test_user()
        film = create_test_media(owner)
        self.client.force_login(owner)
        for instant, name in (
            ("2026-03-10T18:00:00+00:00", "America/New_York"),
            ("2026-11-03T18:00:00+00:00", "America/New_York"),
            ("2026-10-01T18:00:00+00:00", "Asia/Jakarta"),
        ):
            now = datetime.fromisoformat(instant)
            today = now.astimezone(ZoneInfo(name)).date()
            start = datetime.combine(today - timedelta(days=6), datetime.min.time(), ZoneInfo(name))
            with (
                self.subTest(time=instant),
                patch("cms.creator_analytics.datetime", wraps=datetime) as clock,
                patch("cms.creator_analytics.umami_get", return_value=[]) as collector,
            ):
                clock.now.return_value = now
                result = creator_analytics(owner, 7, None, film.uid, revision="unknown", report_timezone=name)
            self.assertEqual(result["daily"][-1]["date"], today.isoformat())
            params = [call.args[1] for call in collector.call_args_list]
            self.assertTrue(all(item["timezone"] == name for item in params))
            current = next(item for item in params if item["endAt"] == int(now.timestamp() * 1000))
            previous = next(item for item in params if item["endAt"] == current["startAt"] - 1)
            self.assertEqual(current["startAt"], int(start.timestamp() * 1000))
            self.assertEqual(current["endAt"] - current["startAt"], previous["endAt"] + 1 - previous["startAt"])

    @override_settings(ANALYTICS_URL="", ANALYTICS_WEBSITE_ID="", ANALYTICS_API_KEY="")
    def test_browser_timezone_is_preserved_in_dashboard_and_every_export(self):
        owner = create_test_user()
        film = create_test_media(owner)
        self.client.force_login(owner)
        now = datetime(2026, 10, 1, 18, tzinfo=utc_timezone.utc)
        PlaybackSummary.objects.create(
            id=uuid.uuid4(),
            media=film,
            revision=film.analytics_revision,
            context="page",
            initiation="deliberate",
            started_at=now,
            duration_ms=100000,
            coverage=[[0, 2000]],
            watch_days={"2026-10-01T18:00Z": 2000},
        )
        with (
            patch("cms.playback_analytics.datetime", wraps=datetime) as clock,
            patch("users.views.timezone.now", return_value=now),
        ):
            clock.now.return_value = now
            data = self.client.get("/analytics?days=7&tz=Asia%2FJakarta").context["ANALYTICS_DATA"]
            self.assertEqual(data["timezone"], "Asia/Jakarta")
            self.assertEqual(data["measurement"]["daily_watch_seconds"]["2026-10-02"], 2)
            self.assertIn("&tz=Asia%2FJakarta", data["rows"][0]["analytics_url"])
            for dataset in ("portfolio", "summary", "daily", "retention", "engagement"):
                query = {"days": 7, "tz": "Asia/Jakarta", "dataset": dataset}
                if dataset != "portfolio":
                    query["media"] = str(film.uid)
                response = self.client.get("/analytics/export", query)
                rows = list(csv.DictReader(StringIO(response.content.decode())))
                self.assertTrue(rows)
                self.assertTrue(all(row["timezone"] == "Asia/Jakarta" for row in rows))
                self.assertTrue(all(row["watch_time_status"] == "complete" for row in rows))
                self.assertFalse(any("_utc" in key for key in rows[0]))
                if dataset == "daily":
                    self.assertEqual(rows[-1]["date"], "2026-10-02")
                    self.assertEqual(rows[-1]["watch_seconds"], "2")
        with patch("cms.creator_analytics.umami_get") as collector:
            for url in ("/analytics", "/analytics/export"):
                self.assertEqual(self.client.get(url, {"tz": "../../etc/passwd"}).status_code, 404)
                self.assertEqual(self.client.get(url, {"tz": "Not/A_Timezone"}).status_code, 404)
            collector.assert_not_called()

    def test_equal_previous_period_comparison_and_365_day_limit(self):
        owner = create_test_user()
        create_test_media(owner)
        self.client.force_login(owner)
        current_start = datetime.combine(
            timezone.now().date() - timedelta(days=6), datetime.min.time(), tzinfo=utc_timezone.utc
        )

        bounds = {}

        def reply(endpoint, params):
            previous = params["endAt"] < int(current_start.timestamp() * 1000)
            if endpoint == "metrics" and params["startAt"] > int(current_start.timestamp() * 1000) - 8 * 86400000:
                bounds["previous" if previous else "current"] = (params["startAt"], params["endAt"])
            if endpoint == "metrics":
                return [
                    {"x": "media_view", "y": 2 if previous else 5},
                    {"x": "playback_start", "y": 1 if previous else 4},
                    {"x": "finish", "y": 1 if previous else 2},
                ]
            if endpoint in ("events/series", "event-data/values"):
                return []
            return {}

        with patch("cms.creator_analytics.umami_get", side_effect=reply):
            short = self.client.get("/analytics?days=7").context["ANALYTICS_DATA"]
            full = self.client.get("/analytics?days=365").context["ANALYTICS_DATA"]
        self.assertEqual(short["comparison"]["media_views"], 2)
        self.assertEqual(short["comparison"]["starts"], 1)
        self.assertEqual(short["comparison"]["completion_rate"], 100)
        current_start_ms, current_end_ms = bounds["current"]
        previous_start_ms, previous_end_ms = bounds["previous"]
        self.assertEqual(previous_end_ms, current_start_ms - 1)
        self.assertLessEqual(abs((current_end_ms - current_start_ms) - (previous_end_ms - previous_start_ms)), 1)
        self.assertIsNone(full["comparison"])

    def test_media_detail_and_export_load_only_selected_owned_media(self):
        owner = create_test_user()
        media = create_test_media(owner)
        media.analytics_revisions = [str(uuid.uuid4())]
        media.save(update_fields=["analytics_revisions"])
        create_test_media(owner)
        create_test_media(create_test_user())

        for revision, all_rows in ((None, False), ("unknown", True)):
            with self.subTest(revision=revision, all_rows=all_rows):
                with (
                    patch("cms.creator_analytics.umami_get", return_value=[]),
                    CaptureQueriesContext(connection) as queries,
                ):
                    creator_analytics(owner, 7, 1, media_uid=media.uid, revision=revision, all_rows=all_rows)
                media_reads = [query["sql"] for query in queries if 'FROM "files_media"' in query["sql"]]
                self.assertTrue(media_reads)
                for query in media_reads:
                    self.assertIn(media.uid.hex, query.split(" WHERE ", 1)[1].replace("-", ""))

    def test_unknown_cut_excludes_events_with_known_revisions(self):
        owner = create_test_user()
        media = create_test_media(owner)
        old_revision = str(uuid.uuid4())
        media.analytics_revisions = [old_revision]
        media.save(update_fields=["analytics_revisions"])
        self.client.force_login(owner)

        def reply(endpoint, params):
            cut = params.get("epf0", "")
            count = 2 if str(media.analytics_revision) in cut else 1 if old_revision in cut else 6
            if endpoint == "metrics":
                return [{"x": "media_view", "y": count}, {"x": "playback_start", "y": count}]
            if endpoint in ("events/series", "event-data/values"):
                return []
            return {}

        with patch("cms.creator_analytics.umami_get", side_effect=reply):
            data = self.client.get(f"/analytics?media={media.uid}&version=unknown&days=7").context["ANALYTICS_DATA"]
        self.assertEqual(data["media_views"], 3)
        self.assertEqual(data["totals"]["playback_start"], 3)
        self.assertEqual(data["comparison"]["media_views"], 3)

    def test_owner_only_and_no_key_in_response(self):
        owner = create_test_user()
        other = create_test_user()
        create_test_media(owner, state="private")
        create_test_media(other)

        self.assertEqual(self.client.get("/analytics").status_code, 302)
        self.client.force_login(other)
        self.assertEqual(self.client.get(f"/user/{owner.username}/analytics").status_code, 404)
        self.client.force_login(owner)
        self.assertEqual(
            self.client.get(f"/user/{owner.username}/analytics?days=7").headers["Location"],
            "/analytics?days=7",
        )

        def reply(endpoint, params):
            self.assertIn(str(owner.media_set.first().uid), params["tag"])
            self.assertNotIn(str(other.media_set.first().uid), params["tag"])
            if endpoint == "pageviews":
                return {"pageviews": [{"x": "2026-09-28", "y": 3}]}
            if endpoint == "metrics":
                return [
                    {"x": "media_view", "y": 3},
                    {"x": "playback_start", "y": 2},
                    {"x": "finish", "y": 1},
                    {"x": "annotation_created", "y": 4},
                ]
            if endpoint == "events/series":
                return [
                    {"x": "media_view", "t": "2026-09-28", "y": 3},
                    {"x": "playback_start", "t": "2026-09-28", "y": 2},
                ]
            if endpoint == "event-data/values":
                if params["propertyName"] == "media_id":
                    return [{"value": str(owner.media_set.first().uid), "total": 3}]
                return []
            return {"pageviews": 3}

        with patch("cms.creator_analytics.umami_get", side_effect=reply):
            response = self.client.get("/analytics")

        self.assertContains(response, "Analytics")
        self.assertEqual(response.context["ANALYTICS_DATA"]["rows"][0]["state"], "Private")
        self.assertEqual(
            response.context["ANALYTICS_DATA"]["rows"][0]["analytics_url"],
            f"?media={owner.media_set.first().uid}&days=30&tz=UTC",
        )
        self.assertNotContains(response, "test-key")
        self.assertEqual(response.context["media_views"], 3)
        self.assertEqual(response.context["completion_rate"], 50)
        self.assertIn(("Annotation created", 4), response.context["ANALYTICS_DATA"]["engagement"])

    def test_media_detail_scopes_all_queries(self):
        owner = create_test_user()
        selected = create_test_media(owner, state="private", duration=125, thumbnail="test-thumbnail.jpg")
        create_test_media(owner)
        create_test_media(create_test_user())
        self.client.force_login(owner)
        day = timezone.now().date().isoformat()

        def reply(endpoint, params):
            self.assertEqual(params["tag"], f"media:{selected.uid}")
            if endpoint == "pageviews":
                return {"pageviews": [{"x": day, "y": 12}]}
            if endpoint == "metrics":
                return [
                    {"x": "media_view", "y": 12},
                    {"x": "playback_start", "y": 8},
                    {"x": "progress_25", "y": 7},
                    {"x": "progress_50", "y": 6},
                    {"x": "progress_75", "y": 5},
                    {"x": "finish", "y": 4},
                    {"x": "like", "y": 3},
                    {"x": "comment_success", "y": 2},
                    {"x": "download_click", "y": 1},
                ]
            if endpoint == "events/series":
                return [
                    {"x": "media_view", "t": day, "y": 12},
                    {"x": "playback_start", "t": day, "y": 8},
                    {"x": "finish", "t": day, "y": 4},
                ]
            if endpoint == "event-data/values":
                return []
            return {"pageviews": 12}

        with patch("cms.creator_analytics.umami_get", side_effect=reply):
            response = self.client.get(f"/analytics?media={selected.uid}&days=7")

        self.assertEqual(response.status_code, 200)
        data = response.context["ANALYTICS_DATA"]
        self.assertEqual(data["selected_media"]["uid"], str(selected.uid))
        self.assertEqual(data["selected_media"]["state"], "Private")
        self.assertEqual(data["selected_media"]["thumbnail_url"], selected.thumbnail_url)
        self.assertEqual(data["selected_media"]["duration"], 125)
        self.assertEqual(data["selected_media"]["media_type"], selected.media_type)
        self.assertEqual(data["media_views"], 12)
        self.assertEqual(data["totals"]["playback_start"], 8)
        self.assertEqual(data["totals"]["progress_25"], 7)
        self.assertEqual(data["totals"]["progress_50"], 6)
        self.assertEqual(data["totals"]["progress_75"], 5)
        self.assertNotIn(("Progress 25", 7), data["engagement"])
        self.assertEqual(data["completion_rate"], 50)
        self.assertEqual(data["daily"][-1]["finish"], 4)
        self.assertIn(("Likes added", 3), data["engagement"])
        self.assertIn(("Comments posted", 2), data["engagement"])
        self.assertIn(("Download clicks", 1), data["engagement"])
        self.assertEqual(data["rows"], [])
        self.assertNotContains(response, "cinemata-analytics-config")

    @override_settings(ANALYTICS_ENABLED=False)
    def test_media_detail_rejects_unowned_missing_and_invalid_ids_before_querying(self):
        owner = create_test_user()
        other_media = create_test_media(create_test_user(), state="private")
        self.client.force_login(owner)
        with patch("cms.creator_analytics.umami_get") as query:
            for uid in (str(other_media.uid), "00000000-0000-4000-8000-000000000000", "invalid", ""):
                with self.subTest(uid=uid):
                    self.assertEqual(self.client.get("/analytics", {"media": uid}).status_code, 404)
            query.assert_not_called()

    @override_settings(ANALYTICS_ENABLED=False)
    def test_media_detail_access_follows_current_owner_even_when_unavailable(self):
        former_owner = create_test_user()
        current_owner = create_test_user()
        media = create_test_media(former_owner, state="unlisted")
        Media.objects.filter(pk=media.pk).update(user=current_owner)
        self.client.force_login(former_owner)
        self.assertEqual(self.client.get(f"/analytics?media={media.uid}").status_code, 404)
        self.client.force_login(current_owner)
        response = self.client.get(f"/analytics?media={media.uid}")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.context["ANALYTICS_DATA"]["unavailable"])
        self.assertEqual(response.context["ANALYTICS_DATA"]["selected_media"]["uid"], str(media.uid))

    @override_settings(ANALYTICS_ENABLED=False)
    def test_disabled_state_never_falls_back_to_legacy_counter(self):
        owner = create_test_user()
        create_test_media(owner, views=999)
        self.client.force_login(owner)

        response = self.client.get("/analytics")

        self.assertTrue(response.context["ANALYTICS_DATA"]["unavailable"])
        self.assertIsNone(response.context["ANALYTICS_DATA"]["media_views"])
        self.assertIsNone(response.context["ANALYTICS_DATA"]["totals"])

    def test_api_failure_shows_unavailable_even_without_media(self):
        owner = create_test_user()
        self.client.force_login(owner)

        with patch("cms.creator_analytics.umami_get", side_effect=AnalyticsUnavailable):
            response = self.client.get("/analytics")

        self.assertTrue(response.context["ANALYTICS_DATA"]["unavailable"])

    def test_csv_is_owner_scoped_and_marks_umami_outage(self):
        owner = create_test_user()
        media = create_test_media(owner, state="private")
        media.title = "=SUM(1,1)"
        media.save(update_fields=["title"])
        other = create_test_media(create_test_user())
        self.client.force_login(owner)

        with patch("cms.creator_analytics.umami_get", side_effect=AnalyticsUnavailable):
            response = self.client.get("/analytics/export")

        self.assertEqual(response.status_code, 200)
        self.assertIn(f'{media.uid},"\'=SUM(1,1)"', response.content.decode())
        self.assertNotIn(str(other.uid), response.content.decode())
        self.assertIn("unavailable", response.content.decode())
        self.assertEqual(response["Cache-Control"], "private, no-store")

    def test_csv_exports_all_owned_media_beyond_visible_page(self):
        owner = create_test_user()
        media = [create_test_media(owner) for _ in range(21)]
        self.client.force_login(owner)

        def reply(endpoint, _params):
            if endpoint == "stats":
                return {"pageviews": 0}
            return []

        with patch("cms.creator_analytics.umami_get", side_effect=reply):
            response = self.client.get("/analytics/export")

        rows = list(csv.reader(StringIO(response.content.decode())))
        self.assertEqual(len(rows), 22)
        self.assertEqual({row[0] for row in rows[1:]}, {str(item.uid) for item in media})

    def test_csv_neutralizes_formula_titles_with_leading_whitespace(self):
        owner = create_test_user()
        titles = ("\t=SUM(1,1)", " \r@SUM(1,1)", "\n+1", "-1")
        for title in titles:
            media = create_test_media(owner)
            media.title = title
            media.save(update_fields=["title"])
        self.client.force_login(owner)

        with patch("cms.creator_analytics.umami_get", side_effect=AnalyticsUnavailable):
            response = self.client.get("/analytics/export")

        rows = list(csv.reader(StringIO(response.content.decode())))
        self.assertEqual({row[1] for row in rows[1:]}, {"'" + title for title in titles})


@override_settings(ANALYTICS_ENABLED=True)
class PlaybackSummaryTests(TestCase):
    def setUp(self):
        self.owner = create_test_user()
        self.media = create_test_media(self.owner, state="private")
        self.play_id = str(uuid.uuid4())
        self.payload = {
            "token": measurement_token(self.media, "page"),
            "play_id": self.play_id,
            "duration_ms": 100000,
            "coverage": [[0, 25000]],
            "watch_days": {datetime.now(utc_timezone.utc).date().isoformat(): 25000},
            "initiation": "deliberate",
        }

    def post(self, payload=None, **headers):
        return self.client.post(
            "/analytics/playback",
            data=json.dumps(payload or self.payload),
            content_type="application/json",
            **{"HTTP_ORIGIN": "http://testserver", **headers},
        )

    def test_repeated_snapshot_merges_coverage_and_does_not_double_count_time(self):
        self.assertEqual(self.post().status_code, 204)
        updated = {
            **self.payload,
            "coverage": [[0, 50000]],
            "watch_days": {datetime.now(utc_timezone.utc).date().isoformat(): 50000},
        }
        self.assertEqual(self.post(updated).status_code, 204)
        self.assertEqual(self.post(self.payload).status_code, 204)
        summary = PlaybackSummary.objects.get(pk=self.play_id)
        self.assertEqual(summary.coverage, [[0, 50000]])
        figures = playback_figures(self.owner, 7, self.media.uid)
        self.assertEqual(figures["watch_seconds"], 50)
        self.assertEqual(figures["retention"][:10], [100.0] * 10)
        self.assertEqual(figures["retention"][10:], [0.0] * 10)

    def test_accumulated_coverage_is_bounded_without_discarding_saved_data(self):
        day = next(iter(self.payload["watch_days"]))
        ranges = [[2 * index, 2 * index + 1] for index in range(1000)]
        initial = {**self.payload, "coverage": ranges, "watch_days": {day: 1000}}
        self.assertEqual(self.post(initial).status_code, 204)
        summary = PlaybackSummary.objects.get(pk=self.play_id)
        saved_at = summary.updated_at

        overflow = {**initial, "coverage": [[2000, 2001]], "watch_days": {day: 2001}}
        self.assertEqual(self.post(overflow).status_code, 400)
        summary.refresh_from_db()
        self.assertEqual(summary.coverage, ranges)
        self.assertEqual(summary.watch_days, {day: 1000})
        self.assertEqual(summary.updated_at, saved_at)
        self.assertEqual(self.post(initial).status_code, 204)

        joined = {**overflow, "coverage": [[0, 2001]]}
        self.assertEqual(self.post(joined).status_code, 204)
        summary.refresh_from_db()
        self.assertEqual(summary.coverage, [[0, 2001]])
        self.assertEqual(summary.watch_days, {day: 2001})

    def test_minute_snapshots_are_idempotent_and_split_at_local_midnight(self):
        now = datetime(2026, 10, 1, 18, tzinfo=utc_timezone.utc)
        buckets = {"2026-10-01T16:59Z": 1000, "2026-10-01T17:00Z": 2000}
        with patch("cms.playback_analytics.datetime", wraps=datetime) as clock:
            clock.now.return_value = now
            payload = {**self.payload, "watch_days": buckets}
            self.assertEqual(self.post(payload).status_code, 204)
            self.assertEqual(self.post(payload).status_code, 204)
        figures = playback_figures(
            self.owner, 2, end_date=now.date() + timedelta(days=1), report_timezone="Asia/Jakarta"
        )
        self.assertEqual(figures["daily_watch_seconds"], {"2026-10-01": 1, "2026-10-02": 2})
        self.assertEqual(figures["watch_seconds"], 3)
        self.assertFalse(figures["watch_time_incomplete"])
        # A quarter-hour offset must also use local, rather than UTC, midnight.
        summary = PlaybackSummary.objects.get(pk=self.play_id)
        summary.watch_days = {"2026-10-01T18:14Z": 1000, "2026-10-01T18:15Z": 2000}
        summary.save(update_fields=["watch_days"])
        figures = playback_figures(
            self.owner, 2, end_date=now.date() + timedelta(days=1), report_timezone="Asia/Kathmandu"
        )
        self.assertEqual(figures["daily_watch_seconds"], {"2026-10-01": 1, "2026-10-02": 2})

    def test_legacy_day_totals_are_flagged_instead_of_moved_to_a_local_day(self):
        self.assertEqual(self.post().status_code, 204)
        local = playback_figures(self.owner, 7, report_timezone="Asia/Jakarta")
        self.assertTrue(local["watch_time_incomplete"])
        self.assertEqual(local["watch_seconds"], 0)
        self.assertIsNone(local["average_watch_seconds"])
        self.assertEqual(local["measured_plays"], 1)
        utc = playback_figures(self.owner, 7)
        self.assertFalse(utc["watch_time_incomplete"])
        self.assertEqual(utc["watch_seconds"], 25)
        self.client.force_login(self.owner)
        response = self.client.get(f"/analytics/export?media={self.media.uid}&dataset=summary&tz=Asia%2FJakarta")
        rows = list(csv.DictReader(StringIO(response.content.decode())))
        self.assertTrue(all(row["watch_time_status"] == "partial" for row in rows))

    def test_watch_bucket_union_and_formats_are_bounded(self):
        now = datetime.now(utc_timezone.utc).replace(second=0, microsecond=0)
        buckets = {(now - timedelta(minutes=index)).strftime("%Y-%m-%dT%H:%MZ"): 1 for index in range(1441)}
        with patch("cms.playback_analytics.datetime", wraps=datetime) as clock:
            clock.now.return_value = now
            self.assertEqual(self.post({**self.payload, "watch_days": buckets}).status_code, 204)
            clock.now.return_value = now + timedelta(minutes=1)
            overflow = {(now + timedelta(minutes=1)).strftime("%Y-%m-%dT%H:%MZ"): 1}
            self.assertEqual(self.post({**self.payload, "watch_days": overflow}).status_code, 400)
            self.assertEqual(self.post(self.payload).status_code, 400)  # Cannot mix legacy and minute buckets.
            self.assertEqual(self.post({**self.payload, "watch_days": {next(iter(buckets)): 60001}}).status_code, 400)
            self.assertEqual(self.post({**self.payload, "watch_days": {"2099-01-01T00:00Z": 1}}).status_code, 400)
        self.assertEqual(PlaybackSummary.objects.get(pk=self.play_id).watch_days, buckets)

    def test_activity_logging_opt_out_rejects_playback_snapshot(self):
        self.owner.disable_activity_logging = True
        self.owner.save(update_fields=["disable_activity_logging"])
        self.client.force_login(self.owner)

        self.assertEqual(self.post().status_code, 404)
        self.assertFalse(PlaybackSummary.objects.filter(pk=self.play_id).exists())

    def test_average_watch_uses_only_plays_started_in_selected_period(self):
        today = timezone.now().date().isoformat()
        PlaybackSummary.objects.create(
            id=uuid.uuid4(),
            media=self.media,
            revision=self.media.analytics_revision,
            context="page",
            initiation="unknown",
            started_at=timezone.now() - timedelta(days=1),
            duration_ms=100000,
            coverage=[[0, 30000]],
            watch_days={today: 30000},
        )
        PlaybackSummary.objects.create(
            id=uuid.uuid4(),
            media=self.media,
            revision=self.media.analytics_revision,
            context="page",
            initiation="deliberate",
            started_at=timezone.now(),
            duration_ms=100000,
            coverage=[[0, 20000]],
            watch_days={today: 20000},
        )
        figures = playback_figures(self.owner, 1, self.media.uid)
        self.assertEqual(figures["watch_seconds"], 50)
        self.assertEqual(figures["measured_plays"], 1)
        self.assertEqual(figures["average_watch_seconds"], 20)

    def test_rejects_untrusted_origin_staff_dnt_and_changed_media_state(self):
        self.assertEqual(
            self.client.post(
                "/analytics/playback",
                json.dumps(self.payload),
                content_type="application/json",
            ).status_code,
            403,
        )
        self.assertEqual(self.post(HTTP_DNT="1").status_code, 404)
        self.owner.is_staff = True
        self.owner.save(update_fields=["is_staff"])
        self.client.force_login(self.owner)
        self.assertEqual(self.post().status_code, 404)
        self.client.logout()
        self.media.state = "public"
        self.media.save(update_fields=["state"])
        self.assertEqual(self.post().status_code, 403)
        self.assertFalse(PlaybackSummary.objects.exists())

    def test_accepts_https_origin_when_tls_ends_at_proxy(self):
        self.assertEqual(self.post(HTTP_ORIGIN="https://testserver").status_code, 204)

    def test_curator_can_submit_playback(self):
        self.owner.is_curator = True
        self.owner.save(update_fields=["is_curator"])
        self.client.force_login(self.owner)
        self.assertEqual(self.post().status_code, 204)

    def test_rejects_forged_or_oversized_snapshot(self):
        self.assertEqual(self.post({**self.payload, "coverage": [[0, 100001]]}).status_code, 400)
        self.assertEqual(self.post({**self.payload, "play_id": str(uuid.uuid4()), "token": "forged"}).status_code, 400)
        self.assertFalse(PlaybackSummary.objects.exists())

    def test_purge_removes_only_snapshots_older_than_twelve_months(self):
        self.assertEqual(self.post().status_code, 204)
        old = PlaybackSummary.objects.get(pk=self.play_id)
        old.started_at = twelve_month_cutoff(timezone.now()) - timedelta(days=1)
        old.save(update_fields=["started_at"])
        recent_id = uuid.uuid4()
        PlaybackSummary.objects.create(
            id=recent_id,
            media=self.media,
            revision=self.media.analytics_revision,
            context="page",
            initiation="unknown",
            started_at=timezone.now(),
            duration_ms=100000,
            coverage=[],
            watch_days={},
        )
        call_command("purge_playback_summaries", "--dry-run", stdout=StringIO())
        self.assertEqual(PlaybackSummary.objects.count(), 2)
        call_command("purge_playback_summaries", stdout=StringIO())
        self.assertEqual(list(PlaybackSummary.objects.values_list("id", flat=True)), [recent_id])
