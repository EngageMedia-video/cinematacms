import json
from unittest.mock import patch

from django.core.cache import cache
from django.test import Client, TestCase, override_settings

from actions.models import MediaAction
from files.models import Media
from files.tests.helpers import create_test_media, create_test_user


class MediaActionsTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = create_test_user(username="media_actions_user")
        self.media = create_test_media(self.user)
        self.url = f"/api/v1/media/{self.media.friendly_token}/actions"

    def test_authenticated_user_can_remove_like(self):
        self.client.force_login(self.user)
        like_response = self.client.post(
            self.url,
            data=json.dumps({"type": "like"}),
            content_type="application/json",
        )
        self.assertEqual(like_response.status_code, 201)
        self.media.refresh_from_db()
        self.assertEqual(self.media.likes, 1)
        self.assertTrue(MediaAction.objects.filter(media=self.media, user=self.user, action="like").exists())

        unlike_response = self.client.delete(
            self.url,
            data=json.dumps({"type": "like"}),
            content_type="application/json",
        )

        self.assertEqual(unlike_response.status_code, 200)
        self.assertEqual(unlike_response.json()["likes"], 0)
        self.media.refresh_from_db()
        self.assertEqual(self.media.likes, 0)
        self.assertFalse(MediaAction.objects.filter(media=self.media, user=self.user, action="like").exists())

    def test_removing_like_does_not_decrement_below_zero(self):
        self.client.force_login(self.user)

        response = self.client.delete(
            self.url,
            data=json.dumps({"type": "like"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.media.refresh_from_db()
        self.assertEqual(self.media.likes, 0)


class MediaReportActionsTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.owner = create_test_user(username="report_owner")
        self.viewer = create_test_user(username="report_viewer")
        self.media = create_test_media(self.owner)
        self.url = f"/api/v1/media/{self.media.friendly_token}/actions"
        self.detail_url = f"/api/v1/media/{self.media.friendly_token}"

    def _send(self, method, payload):
        return getattr(self.client, method)(self.url, data=json.dumps(payload), content_type="application/json")

    def _report(self, reason="Shows a private address"):
        return self._send("post", {"type": "report", "extra_info": reason})

    def _retract(self):
        return self._send("delete", {"type": "retract_report"})

    def _reports(self, user):
        return MediaAction.objects.filter(media=self.media, user=user, action="report")

    def test_report_is_stored_before_the_response_returns(self):
        self.client.force_login(self.viewer)

        response = self._report()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(self._reports(self.viewer).get().extra_info, "Shows a private address")
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 1)

    def test_viewer_who_opted_out_of_activity_logging_can_still_report(self):
        self.viewer.disable_activity_logging = True
        self.viewer.save(update_fields=["disable_activity_logging"])
        self.client.force_login(self.viewer)

        response = self._report()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(self._reports(self.viewer).count(), 1)
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 1)
        self.assertTrue(self.client.get(self.detail_url).json()["user_has_reported"])

        self.assertEqual(self._retract().json()["detail"], "report retracted")

    def test_opting_out_still_stops_like_records(self):
        self.viewer.disable_activity_logging = True
        self.viewer.save(update_fields=["disable_activity_logging"])
        self.client.force_login(self.viewer)

        self._send("post", {"type": "like"})

        self.assertFalse(MediaAction.objects.filter(media=self.media, user=self.viewer, action="like").exists())

    def test_second_report_from_the_same_viewer_is_not_counted(self):
        self.client.force_login(self.viewer)
        self._report()

        response = self._report("Again")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self._reports(self.viewer).count(), 1)
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 1)

    def test_viewer_can_retract_their_report(self):
        self.client.force_login(self.viewer)
        self._report()

        response = self._retract()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["detail"], "report retracted")
        self.assertFalse(self._reports(self.viewer).exists())
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 0)

    def test_retracting_leaves_other_viewers_reports_in_place(self):
        self.client.force_login(self.owner)
        self._report("Owner report")
        self.client.force_login(self.viewer)
        self._report()

        self._retract()

        self.assertTrue(self._reports(self.owner).exists())
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 1)

    def test_retracting_duplicate_reports_lowers_the_count_by_each_one(self):
        other_viewer = create_test_user(username="report_other_duplicate")
        MediaAction.objects.create(media=self.media, user=other_viewer, action="report")
        # Two racing requests can each store a report for the same viewer.
        MediaAction.objects.create(media=self.media, user=self.viewer, action="report")
        MediaAction.objects.create(media=self.media, user=self.viewer, action="report")
        Media.objects.filter(pk=self.media.pk).update(reported_times=3)
        self.client.force_login(self.viewer)

        response = self._retract()

        self.assertEqual(response.status_code, 200)
        self.assertFalse(self._reports(self.viewer).exists())
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 1)

    def test_retracting_does_not_lower_the_count_below_zero(self):
        MediaAction.objects.create(media=self.media, user=self.viewer, action="report")
        MediaAction.objects.create(media=self.media, user=self.viewer, action="report")
        Media.objects.filter(pk=self.media.pk).update(reported_times=1)
        self.client.force_login(self.viewer)

        self._retract()

        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 0)

    def test_retracting_without_a_report_changes_nothing(self):
        self.client.force_login(self.owner)
        self._report("Owner report")
        self.client.force_login(self.viewer)

        response = self._retract()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["detail"], "no report to retract")
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 1)

    def test_anonymous_visitor_cannot_retract(self):
        response = self._retract()

        self.assertEqual(response.status_code, 400)

    def test_viewer_can_report_again_after_retracting(self):
        self.client.force_login(self.viewer)
        self._report()
        self._retract()

        response = self._report("Second thoughts")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(self._reports(self.viewer).get().extra_info, "Second thoughts")

    def test_media_detail_tells_the_viewer_whether_they_reported(self):
        self.client.force_login(self.viewer)
        self.assertFalse(self.client.get(self.detail_url).json()["user_has_reported"])

        self._report()
        self.assertTrue(self.client.get(self.detail_url).json()["user_has_reported"])

        self.client.force_login(self.owner)
        self.assertFalse(self.client.get(self.detail_url).json()["user_has_reported"])

    def test_superuser_reset_still_clears_every_report(self):
        self.client.force_login(self.viewer)
        self._report()
        admin = create_test_user(username="report_admin", is_superuser=True)
        self.client.force_login(admin)

        response = self._send("delete", {"type": "report"})

        self.assertEqual(response.status_code, 201)
        self.assertFalse(MediaAction.objects.filter(media=self.media, action="report").exists())
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 0)


@override_settings(CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})
class MediaReportNotificationTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = Client()
        self.owner = create_test_user(username="notify_owner")
        self.viewer = create_test_user(username="notify_viewer")
        self.media = create_test_media(self.owner)
        self.url = f"/api/v1/media/{self.media.friendly_token}/actions"

    def _send(self, method, payload):
        return getattr(self.client, method)(self.url, data=json.dumps(payload), content_type="application/json")

    def _report(self, reason="Shows a private address"):
        return self._send("post", {"type": "report", "extra_info": reason})

    def _retract(self):
        return self._send("delete", {"type": "retract_report"})

    def test_reporting_again_after_retracting_does_not_notify_moderators_twice(self):
        self.client.force_login(self.viewer)

        with patch("files.tasks.notify_users") as notify_users:
            self._report()
            self._retract()
            response = self._report("Second thoughts")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(notify_users.call_count, 1)
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 1)

    def test_each_viewer_notifies_moderators_once(self):
        other_viewer = create_test_user(username="notify_other_viewer")

        with patch("files.tasks.notify_users") as notify_users:
            self.client.force_login(self.viewer)
            self._report()
            self.client.force_login(other_viewer)
            self._report()

        self.assertEqual(notify_users.call_count, 2)

    def test_report_after_the_window_notifies_moderators_again(self):
        self.client.force_login(self.viewer)

        with patch("files.tasks.notify_users") as notify_users:
            self._report()
            self._retract()
            # Sessions share the cache, so clearing it also signs the viewer out.
            cache.clear()
            self.client.force_login(self.viewer)
            self._report()

        self.assertEqual(notify_users.call_count, 2)

    def test_unreachable_cache_still_notifies_moderators(self):
        self.client.force_login(self.viewer)

        with (
            patch("files.tasks.notify_users") as notify_users,
            patch("files.tasks.report_notification_cache.add", side_effect=ConnectionError("cache down")),
            patch("files.tasks.capture_unexpected_exception"),
        ):
            response = self._report()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(notify_users.call_count, 1)
