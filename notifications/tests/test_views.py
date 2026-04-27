from django.test import TestCase

from notifications.models import (
    Notification,
    NotificationChannel,
    NotificationPreference,
    NotificationType,
)


def _create_user(username, email=None):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.create_user(
        username=username,
        email=email or f"{username}@example.com",
        password="testpass123",
    )


def _create_notification(
    recipient,
    actor=None,
    notification_type=NotificationType.COMMENT,
    message="test notification",
    action_url="/view/abc",
    is_read=False,
    metadata=None,
):
    return Notification.objects.create(
        recipient=recipient,
        actor=actor,
        notification_type=notification_type,
        message=message,
        action_url=action_url,
        is_read=is_read,
        metadata=metadata or {},
    )


class NotificationListTest(TestCase):
    """AC #1, #2, #3, #10, #12: List endpoint with pagination, filtering, JSON format."""

    def setUp(self):
        self.user = _create_user("viewer")
        self.actor = _create_user("filmmaker")
        self.client.login(username="viewer", password="testpass123")

    def test_list_returns_paginated_notifications(self):
        """AC #1: Returns paginated list with nested actor data."""
        _create_notification(self.user, self.actor)
        resp = self.client.get("/api/v1/notifications/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("results", data)
        self.assertIn("count", data)
        self.assertEqual(data["count"], 1)
        item = data["results"][0]
        self.assertIn("actor", item)
        self.assertEqual(item["actor"]["username"], "filmmaker")

    def test_list_filter_by_type(self):
        """AC #2: ?type=comment filters correctly."""
        _create_notification(self.user, self.actor, NotificationType.COMMENT)
        _create_notification(self.user, self.actor, NotificationType.LIKE, message="liked")
        resp = self.client.get("/api/v1/notifications/?type=comment")
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["notification_type"], "comment")

    def test_list_filter_by_is_read(self):
        """AC #3: ?is_read=false filters correctly."""
        _create_notification(self.user, self.actor, is_read=False)
        _create_notification(self.user, self.actor, NotificationType.LIKE, message="liked", is_read=True)
        resp = self.client.get("/api/v1/notifications/?is_read=false")
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertFalse(data["results"][0]["is_read"])

    def test_pagination_params(self):
        """AC #10: page and page_size params work, max 100."""
        for i in range(150):
            _create_notification(self.user, self.actor, message=f"notif {i}")
        # Default page_size=20
        resp = self.client.get("/api/v1/notifications/")
        data = resp.json()
        self.assertEqual(len(data["results"]), 20)
        self.assertEqual(data["count"], 150)
        self.assertIsNotNone(data["next"])
        # Custom page_size
        resp = self.client.get("/api/v1/notifications/?page_size=5&page=2")
        data = resp.json()
        self.assertEqual(len(data["results"]), 5)
        # page_size capped at 100
        resp = self.client.get("/api/v1/notifications/?page_size=200")
        data = resp.json()
        self.assertEqual(len(data["results"]), 100)

    def test_serializer_json_format(self):
        """AC #12: Response JSON has correct structure."""
        _create_notification(
            self.user,
            self.actor,
            message="filmmaker commented on 'Doc'",
            action_url="/view/abc-def",
            metadata={"media_id": 42, "comment_id": 1},
        )
        resp = self.client.get("/api/v1/notifications/")
        item = resp.json()["results"][0]
        expected_keys = {
            "id",
            "notification_type",
            "message",
            "action_url",
            "is_read",
            "actor",
            "metadata",
            "created_at",
            "read_at",
        }
        self.assertEqual(set(item.keys()), expected_keys)
        actor_keys = {"username", "name", "thumbnail_url", "url"}
        self.assertEqual(set(item["actor"].keys()), actor_keys)
        self.assertEqual(item["metadata"]["media_id"], 42)
        self.assertIsNone(item["read_at"])

    def test_list_actor_null_for_system_announcement(self):
        """AC #13: System announcement has actor: null."""
        _create_notification(
            self.user,
            actor=None,
            notification_type=NotificationType.SYSTEM_ANNOUNCEMENT,
            message="System maintenance",
        )
        resp = self.client.get("/api/v1/notifications/")
        item = resp.json()["results"][0]
        self.assertIsNone(item["actor"])

    def test_list_filter_invalid_type_returns_400(self):
        """Invalid type param returns 400 with error detail."""
        resp = self.client.get("/api/v1/notifications/?type=nonexistent")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Invalid type", resp.json()["detail"])

    def test_list_filter_invalid_is_read_returns_400(self):
        """Invalid is_read param returns 400 with error detail."""
        resp = self.client.get("/api/v1/notifications/?is_read=banana")
        self.assertEqual(resp.status_code, 400)
        self.assertIn("is_read", resp.json()["detail"])

    def test_empty_notification_list_returns_correct_format(self):
        """Edge case: empty list returns proper paginated envelope."""
        resp = self.client.get("/api/v1/notifications/")
        data = resp.json()
        self.assertEqual(data["count"], 0)
        self.assertIsNone(data["next"])
        self.assertIsNone(data["previous"])
        self.assertEqual(data["results"], [])

    def test_list_ordered_newest_first(self):
        """Notifications returned newest first."""
        n1 = _create_notification(self.user, self.actor, message="first")
        n2 = _create_notification(
            self.user,
            self.actor,
            message="second",
            notification_type=NotificationType.LIKE,
        )
        resp = self.client.get("/api/v1/notifications/")
        results = resp.json()["results"]
        self.assertEqual(results[0]["id"], n2.id)
        self.assertEqual(results[1]["id"], n1.id)

    def test_combined_type_and_is_read_filter(self):
        """Both ?type= and ?is_read= filters apply simultaneously."""
        _create_notification(
            self.user,
            self.actor,
            NotificationType.COMMENT,
            is_read=False,
            message="unread comment",
        )
        _create_notification(
            self.user,
            self.actor,
            NotificationType.COMMENT,
            is_read=True,
            message="read comment",
        )
        _create_notification(
            self.user,
            self.actor,
            NotificationType.LIKE,
            is_read=False,
            message="unread like",
        )
        resp = self.client.get("/api/v1/notifications/?type=comment&is_read=false")
        data = resp.json()
        self.assertEqual(data["count"], 1)
        self.assertEqual(data["results"][0]["message"], "unread comment")


class UnreadCountTest(TestCase):
    """AC #4: Unread count endpoint."""

    def setUp(self):
        self.user = _create_user("viewer")
        self.actor = _create_user("filmmaker")
        self.client.login(username="viewer", password="testpass123")

    def test_unread_count_returns_correct_count(self):
        _create_notification(self.user, self.actor, is_read=False)
        _create_notification(self.user, self.actor, NotificationType.LIKE, message="liked", is_read=False)
        _create_notification(self.user, self.actor, NotificationType.FOLLOW, message="followed", is_read=True)
        resp = self.client.get("/api/v1/notifications/unread-count/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["unread_count"], 2)


class MarkAsReadTest(TestCase):
    """AC #5, #6, #9: Mark single notification as read."""

    def setUp(self):
        self.user = _create_user("viewer")
        self.other = _create_user("other")
        self.actor = _create_user("filmmaker")
        self.client.login(username="viewer", password="testpass123")

    def test_mark_as_read_marks_notification(self):
        """AC #5: Marks as read, returns updated state."""
        n = _create_notification(self.user, self.actor)
        resp = self.client.patch(
            f"/api/v1/notifications/{n.id}/read/",
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data["id"], n.id)
        self.assertTrue(data["is_read"])
        self.assertIsNotNone(data["read_at"])

    def test_mark_as_read_returns_404_for_other_user(self):
        """AC #6: 404 for other user's notification."""
        n = _create_notification(self.other, self.actor)
        resp = self.client.patch(
            f"/api/v1/notifications/{n.id}/read/",
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 404)

    def test_mark_as_read_returns_404_for_nonexistent(self):
        """AC #9: 404 for nonexistent notification."""
        resp = self.client.patch(
            "/api/v1/notifications/99999/read/",
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 404)

    def test_mark_as_read_idempotent(self):
        """Calling on already-read notification returns 200."""
        n = _create_notification(self.user, self.actor, is_read=True)
        resp = self.client.patch(
            f"/api/v1/notifications/{n.id}/read/",
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.json()["is_read"])
        self.assertIsNone(resp.json()["read_at"])

    def test_mark_as_read_already_read_preserves_original_read_at(self):
        """Marking already-read notification doesn't overwrite original read_at."""
        n = _create_notification(self.user, self.actor)
        # First mark
        self.client.patch(
            f"/api/v1/notifications/{n.id}/read/",
            content_type="application/json",
        )
        n.refresh_from_db()
        original_read_at = n.read_at
        self.assertIsNotNone(original_read_at)
        # Second mark (idempotent)
        self.client.patch(
            f"/api/v1/notifications/{n.id}/read/",
            content_type="application/json",
        )
        n.refresh_from_db()
        self.assertEqual(n.read_at, original_read_at)


class MarkAllAsReadTest(TestCase):
    """AC #7: Bulk mark all as read."""

    def setUp(self):
        self.user = _create_user("viewer")
        self.actor = _create_user("filmmaker")
        self.client.login(username="viewer", password="testpass123")

    def test_mark_all_read_bulk_marks(self):
        for i in range(3):
            _create_notification(self.user, self.actor, message=f"n{i}")
        _create_notification(self.user, self.actor, message="already read", is_read=True)
        resp = self.client.patch(
            "/api/v1/notifications/mark-all-read/",
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["marked_count"], 3)
        self.assertEqual(Notification.objects.filter(recipient=self.user, is_read=False).count(), 0)


class AuthenticationTest(TestCase):
    """AC #8: All endpoints require authentication."""

    def test_unauthenticated_returns_403(self):
        endpoints = [
            ("get", "/api/v1/notifications/"),
            ("get", "/api/v1/notifications/unread-count/"),
            ("get", "/api/v1/notifications/preferences/"),
            ("patch", "/api/v1/notifications/preferences/"),
            ("patch", "/api/v1/notifications/1/read/"),
            ("patch", "/api/v1/notifications/mark-all-read/"),
        ]
        for method, url in endpoints:
            resp = getattr(self.client, method)(url, content_type="application/json")
            self.assertEqual(
                resp.status_code,
                403,
                f"{method.upper()} {url} should return 403 for unauthenticated user",
            )


class NotificationPreferenceDetailTest(TestCase):
    """Issue #506: /api/v1/notifications/preferences/ endpoint."""

    PREF_FIELDS = (
        "on_comment",
        "on_reply",
        "on_like",
        "on_follow",
        "on_mention",
        "on_new_media_from_following",
        "on_added_to_playlist",
    )

    def setUp(self):
        self.user = _create_user("viewer")
        self.other = _create_user("other")
        self.client.login(username="viewer", password="testpass123")

    def test_get_lazy_creates_preference_with_defaults(self):
        """First GET creates a NotificationPreference row with model defaults."""
        self.assertFalse(NotificationPreference.objects.filter(user=self.user).exists())
        resp = self.client.get("/api/v1/notifications/preferences/")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(set(data.keys()), set(self.PREF_FIELDS))
        self.assertEqual(data["on_like"], NotificationChannel.IN_APP)
        self.assertEqual(data["on_new_media_from_following"], NotificationChannel.IN_APP)
        self.assertEqual(data["on_added_to_playlist"], NotificationChannel.IN_APP)
        self.assertEqual(data["on_comment"], NotificationChannel.EMAIL)
        self.assertEqual(data["on_reply"], NotificationChannel.EMAIL)
        self.assertEqual(data["on_follow"], NotificationChannel.EMAIL)
        self.assertEqual(data["on_mention"], NotificationChannel.EMAIL)
        self.assertTrue(NotificationPreference.objects.filter(user=self.user).exists())

    def test_patch_updates_single_field_and_persists(self):
        resp = self.client.patch(
            "/api/v1/notifications/preferences/",
            data={"on_like": NotificationChannel.NONE},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.json()["on_like"], NotificationChannel.NONE)
        prefs = NotificationPreference.objects.get(user=self.user)
        self.assertEqual(prefs.on_like, NotificationChannel.NONE)
        # Other fields retain defaults
        self.assertEqual(prefs.on_comment, NotificationChannel.EMAIL)

    def test_patch_updates_multiple_fields(self):
        resp = self.client.patch(
            "/api/v1/notifications/preferences/",
            data={
                "on_comment": NotificationChannel.IN_APP,
                "on_follow": NotificationChannel.NONE,
            },
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        prefs = NotificationPreference.objects.get(user=self.user)
        self.assertEqual(prefs.on_comment, NotificationChannel.IN_APP)
        self.assertEqual(prefs.on_follow, NotificationChannel.NONE)

    def test_patch_invalid_channel_returns_400(self):
        # Lazy-create the requester's row so we can assert no partial persistence.
        self.client.get("/api/v1/notifications/preferences/")
        # Mixed payload: one invalid field + one otherwise-valid change. The
        # whole PATCH must fail atomically — the valid side must NOT leak
        # through when any field fails validation.
        resp = self.client.patch(
            "/api/v1/notifications/preferences/",
            data={
                "on_like": "broadcast",
                "on_comment": NotificationChannel.NONE,
            },
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("on_like", resp.json())
        # Neither field persisted: on_like stays at its default (IN_APP) and
        # on_comment stays at its default (EMAIL), proving PATCH is atomic.
        prefs = NotificationPreference.objects.get(user=self.user)
        self.assertEqual(prefs.on_like, NotificationChannel.IN_APP)
        self.assertEqual(prefs.on_comment, NotificationChannel.EMAIL)

    def test_patch_does_not_touch_other_users_preferences(self):
        # Seed another user's prefs with a distinctive value
        NotificationPreference.objects.create(user=self.other, on_like=NotificationChannel.EMAIL)
        resp = self.client.patch(
            "/api/v1/notifications/preferences/",
            data={"on_like": NotificationChannel.NONE},
            content_type="application/json",
        )
        self.assertEqual(resp.status_code, 200)
        # Requester's own prefs must have been updated…
        user_prefs = NotificationPreference.objects.get(user=self.user)
        self.assertEqual(user_prefs.on_like, NotificationChannel.NONE)
        # …while the other user's row is untouched.
        other_prefs = NotificationPreference.objects.get(user=self.other)
        self.assertEqual(other_prefs.on_like, NotificationChannel.EMAIL)

    def test_get_does_not_leak_filter_or_timestamp_fields(self):
        resp = self.client.get("/api/v1/notifications/preferences/")
        data = resp.json()
        self.assertNotIn("filter_topics", data)
        self.assertNotIn("filter_categories", data)
        self.assertNotIn("user", data)
        self.assertNotIn("created_at", data)
        self.assertNotIn("updated_at", data)
