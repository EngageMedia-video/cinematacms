import csv
import json
import uuid
from datetime import datetime, timedelta
from datetime import timezone as utc_timezone
from io import StringIO
from types import SimpleNamespace
from unittest.mock import patch

from django.apps import apps
from django.contrib.auth.models import AnonymousUser
from django.core import signing
from django.core.management import call_command
from django.test import RequestFactory, TestCase, override_settings
from django.utils import timezone

from cms.analytics import allow_page_analytics, analytics_context
from cms.creator_analytics import AnalyticsUnavailable
from cms.playback_analytics import measurement_token, playback_figures
from files.management.commands.purge_playback_summaries import twelve_month_cutoff
from files.models import Comment, ExistingURL, Media, Page, PlaybackSummary
from files.tests.helpers import create_test_media, create_test_user
from files.views import _attach_hero_playback_to_first_featured_item


class AnalyticsTemplateTests(TestCase):
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

    def test_admin_report_suppresses_small_segment_counts(self):
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
        self.assertEqual(current["start_date_utc"], "")
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
            f"?media={owner.media_set.first().uid}&days=30",
        )
        self.assertNotContains(response, "test-key")
        self.assertEqual(response.context["media_views"], 3)
        self.assertEqual(response.context["completion_rate"], 50)
        self.assertIn(("Annotation Created", 4), response.context["ANALYTICS_DATA"]["engagement"])

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
        self.assertIn(("Like", 3), data["engagement"])
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
