from django.test import TestCase

from notifications.models import (
    Notification,
    NotificationChannel,
    NotificationPreference,
    NotificationType,
)


def _create_user(username, email=None):
    """Helper to create a test user."""
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.create_user(
        username=username,
        email=email or f"{username}@example.com",
        password="testpass123",
    )


class NotificationTypeEnumTest(TestCase):
    """Test NotificationType enum has all 9 types."""

    def test_enum_has_all_nine_types(self):
        expected = {
            "comment",
            "reply",
            "like",
            "follow",
            "mention",
            "new_media",
            "added_to_playlist",
            "media_report",
            "system_announcement",
        }
        actual = {choice.value for choice in NotificationType}
        self.assertEqual(actual, expected)

    def test_enum_count(self):
        self.assertEqual(len(NotificationType.choices), 9)


class NotificationModelTest(TestCase):
    """Test Notification model creation, defaults, and methods."""

    def setUp(self):
        self.recipient = _create_user("recipient_user")
        self.actor = _create_user("actor_user")

    def test_create_notification_with_all_fields(self):
        notification = Notification.objects.create(
            recipient=self.recipient,
            actor=self.actor,
            notification_type=NotificationType.COMMENT,
            message="actor_user commented on 'Test Media'",
            action_url="/view/abc-def",
            metadata={"media_id": 42, "comment_id": 1},
        )
        self.assertEqual(notification.recipient, self.recipient)
        self.assertEqual(notification.actor, self.actor)
        self.assertEqual(notification.notification_type, "comment")
        self.assertEqual(notification.message, "actor_user commented on 'Test Media'")
        self.assertEqual(notification.action_url, "/view/abc-def")
        self.assertEqual(notification.metadata, {"media_id": 42, "comment_id": 1})

    def test_default_is_read_false(self):
        notification = Notification.objects.create(
            recipient=self.recipient,
            actor=self.actor,
            notification_type=NotificationType.LIKE,
            message="actor_user liked your media",
        )
        self.assertFalse(notification.is_read)

    def test_default_read_at_none(self):
        notification = Notification.objects.create(
            recipient=self.recipient,
            actor=self.actor,
            notification_type=NotificationType.LIKE,
            message="actor_user liked your media",
        )
        self.assertIsNone(notification.read_at)

    def test_mark_as_read(self):
        notification = Notification.objects.create(
            recipient=self.recipient,
            actor=self.actor,
            notification_type=NotificationType.COMMENT,
            message="test",
        )
        self.assertFalse(notification.is_read)
        self.assertIsNone(notification.read_at)

        notification.mark_as_read()

        notification.refresh_from_db()
        self.assertTrue(notification.is_read)
        self.assertIsNotNone(notification.read_at)

    def test_mark_as_read_idempotent(self):
        notification = Notification.objects.create(
            recipient=self.recipient,
            actor=self.actor,
            notification_type=NotificationType.COMMENT,
            message="test",
        )
        notification.mark_as_read()
        first_read_at = notification.read_at

        # Call again — should not error or change read_at
        notification.mark_as_read()
        self.assertEqual(notification.read_at, first_read_at)

    def test_create_without_actor_system_notification(self):
        notification = Notification.objects.create(
            recipient=self.recipient,
            actor=None,
            notification_type=NotificationType.SYSTEM_ANNOUNCEMENT,
            message="System maintenance scheduled",
        )
        self.assertIsNone(notification.actor)
        self.assertEqual(notification.notification_type, "system_announcement")

    def test_str_format(self):
        notification = Notification.objects.create(
            recipient=self.recipient,
            actor=self.actor,
            notification_type=NotificationType.LIKE,
            message="actor_user liked your media",
        )
        expected = "[like] actor_user liked your media → recipient_user"
        self.assertEqual(str(notification), expected)

    def test_ordering_newest_first(self):
        n1 = Notification.objects.create(
            recipient=self.recipient,
            actor=self.actor,
            notification_type=NotificationType.LIKE,
            message="first",
        )
        n2 = Notification.objects.create(
            recipient=self.recipient,
            actor=self.actor,
            notification_type=NotificationType.COMMENT,
            message="second",
        )
        notifications = list(Notification.objects.filter(recipient=self.recipient))
        self.assertEqual(notifications[0].id, n2.id)
        self.assertEqual(notifications[1].id, n1.id)

    def test_default_metadata_empty_dict(self):
        notification = Notification.objects.create(
            recipient=self.recipient,
            actor=self.actor,
            notification_type=NotificationType.FOLLOW,
            message="test",
        )
        self.assertEqual(notification.metadata, {})

    def test_default_action_url_empty(self):
        notification = Notification.objects.create(
            recipient=self.recipient,
            actor=self.actor,
            notification_type=NotificationType.FOLLOW,
            message="test",
        )
        self.assertEqual(notification.action_url, "")

    def test_actor_deletion_preserves_notification(self):
        """Deleting actor sets actor to NULL but keeps the notification."""
        notification = Notification.objects.create(
            recipient=self.recipient,
            actor=self.actor,
            notification_type=NotificationType.LIKE,
            message="actor_user liked your media",
        )
        self.actor.delete()
        notification.refresh_from_db()
        self.assertIsNone(notification.actor)
        self.assertEqual(notification.message, "actor_user liked your media")


class NotificationPreferenceModelTest(TestCase):
    """Test NotificationPreference model defaults and get_channel_for_type."""

    def setUp(self):
        self.user = _create_user("pref_user")

    def test_default_preferences(self):
        pref = NotificationPreference.objects.create(user=self.user)
        self.assertEqual(pref.on_comment, NotificationChannel.EMAIL)
        self.assertEqual(pref.on_reply, NotificationChannel.EMAIL)
        self.assertEqual(pref.on_like, NotificationChannel.IN_APP)
        self.assertEqual(pref.on_follow, NotificationChannel.EMAIL)
        self.assertEqual(pref.on_mention, NotificationChannel.EMAIL)
        self.assertEqual(pref.on_new_media_from_following, NotificationChannel.IN_APP)
        self.assertEqual(pref.on_added_to_playlist, NotificationChannel.IN_APP)

    def test_default_filter_topics_empty(self):
        pref = NotificationPreference.objects.create(user=self.user)
        self.assertEqual(pref.filter_topics, [])

    def test_default_filter_categories_empty(self):
        pref = NotificationPreference.objects.create(user=self.user)
        self.assertEqual(pref.filter_categories, [])

    def test_get_channel_for_comment(self):
        pref = NotificationPreference.objects.create(user=self.user)
        self.assertEqual(
            pref.get_channel_for_type(NotificationType.COMMENT),
            NotificationChannel.EMAIL,
        )

    def test_get_channel_for_reply(self):
        pref = NotificationPreference.objects.create(user=self.user)
        self.assertEqual(
            pref.get_channel_for_type(NotificationType.REPLY),
            NotificationChannel.EMAIL,
        )

    def test_get_channel_for_like(self):
        pref = NotificationPreference.objects.create(user=self.user)
        self.assertEqual(
            pref.get_channel_for_type(NotificationType.LIKE),
            NotificationChannel.IN_APP,
        )

    def test_get_channel_for_follow(self):
        pref = NotificationPreference.objects.create(user=self.user)
        self.assertEqual(
            pref.get_channel_for_type(NotificationType.FOLLOW),
            NotificationChannel.EMAIL,
        )

    def test_get_channel_for_mention(self):
        pref = NotificationPreference.objects.create(user=self.user)
        self.assertEqual(
            pref.get_channel_for_type(NotificationType.MENTION),
            NotificationChannel.EMAIL,
        )

    def test_get_channel_for_new_media(self):
        pref = NotificationPreference.objects.create(user=self.user)
        self.assertEqual(
            pref.get_channel_for_type(NotificationType.NEW_MEDIA),
            NotificationChannel.IN_APP,
        )

    def test_get_channel_for_added_to_playlist(self):
        pref = NotificationPreference.objects.create(user=self.user)
        self.assertEqual(
            pref.get_channel_for_type(NotificationType.ADDED_TO_PLAYLIST),
            NotificationChannel.IN_APP,
        )

    def test_system_announcement_always_in_app(self):
        """system_announcement is non-disableable — always returns in_app."""
        pref = NotificationPreference.objects.create(user=self.user)
        self.assertEqual(
            pref.get_channel_for_type(NotificationType.SYSTEM_ANNOUNCEMENT),
            NotificationChannel.IN_APP,
        )

    def test_media_report_always_in_app(self):
        """media_report is admin-facing — always returns in_app, non-configurable."""
        pref = NotificationPreference.objects.create(user=self.user)
        self.assertEqual(
            pref.get_channel_for_type(NotificationType.MEDIA_REPORT),
            NotificationChannel.IN_APP,
        )

    def test_system_announcement_ignores_custom_preferences(self):
        """Even if somehow all prefs are set to none, system_announcement still returns in_app."""
        pref = NotificationPreference.objects.create(
            user=self.user,
            on_comment=NotificationChannel.NONE,
            on_reply=NotificationChannel.NONE,
            on_like=NotificationChannel.NONE,
            on_follow=NotificationChannel.NONE,
            on_mention=NotificationChannel.NONE,
            on_new_media_from_following=NotificationChannel.NONE,
            on_added_to_playlist=NotificationChannel.NONE,
        )
        self.assertEqual(
            pref.get_channel_for_type(NotificationType.SYSTEM_ANNOUNCEMENT),
            NotificationChannel.IN_APP,
        )

    def test_custom_channel_preference(self):
        """User sets on_like to email — get_channel_for_type reflects it."""
        pref = NotificationPreference.objects.create(
            user=self.user,
            on_like=NotificationChannel.EMAIL,
        )
        self.assertEqual(
            pref.get_channel_for_type(NotificationType.LIKE),
            NotificationChannel.EMAIL,
        )

    def test_disabled_channel_preference(self):
        """User sets on_comment to none — get_channel_for_type reflects it."""
        pref = NotificationPreference.objects.create(
            user=self.user,
            on_comment=NotificationChannel.NONE,
        )
        self.assertEqual(
            pref.get_channel_for_type(NotificationType.COMMENT),
            NotificationChannel.NONE,
        )

    def test_str_format(self):
        pref = NotificationPreference.objects.create(user=self.user)
        self.assertEqual(str(pref), "NotificationPreference for pref_user")

    def test_lazy_creation_pattern(self):
        """Verify get_or_create works for lazy preference initialization."""
        pref, created = NotificationPreference.objects.get_or_create(user=self.user)
        self.assertTrue(created)

        pref2, created2 = NotificationPreference.objects.get_or_create(user=self.user)
        self.assertFalse(created2)
        self.assertEqual(pref.id, pref2.id)


class NotificationEdgeCaseTest(TestCase):
    """Edge cases from Issue 6 (#462) scope."""

    def setUp(self):
        self.recipient = _create_user("edge_recipient")
        self.actor = _create_user("edge_actor")

    def test_notification_cascade_on_recipient_deletion(self):
        """Deleting recipient cascades and removes their notifications."""
        n = Notification.objects.create(
            recipient=self.recipient,
            actor=self.actor,
            notification_type=NotificationType.COMMENT,
            message="test",
        )
        self.assertTrue(Notification.objects.filter(id=n.id).exists())
        self.recipient.delete()
        self.assertFalse(Notification.objects.filter(id=n.id).exists())

    def test_mark_as_read_sets_timezone_aware_read_at(self):
        """read_at should be timezone-aware datetime."""
        notification = Notification.objects.create(
            recipient=self.recipient,
            actor=self.actor,
            notification_type=NotificationType.LIKE,
            message="test",
        )
        notification.mark_as_read()
        notification.refresh_from_db()
        self.assertIsNotNone(notification.read_at.tzinfo)
