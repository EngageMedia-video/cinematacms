from unittest.mock import patch

from django.test import TestCase, override_settings

from notifications.models import (
    Notification,
    NotificationChannel,
    NotificationPreference,
    NotificationType,
)
from notifications.services import NotificationService


def _create_user(username, email=None):
    from django.contrib.auth import get_user_model

    User = get_user_model()
    return User.objects.create_user(
        username=username,
        email=email or f"{username}@example.com",
        password="testpass123",
    )


def _create_media(user, title="Test Video", friendly_token="abc-def-123"):  # noqa: S107
    """Create a minimal Media object for testing.

    Patches media_init to prevent file processing errors (same pattern
    as files/tests/test_race_conditions.py).
    """
    from files.models import Media

    with patch.object(Media, "media_init", return_value=None):
        return Media.objects.create(
            user=user,
            title=title,
            friendly_token=friendly_token,
            media_type="video",
            state="public",
            encoding_status="success",
        )


def _create_comment(user, media, text="test comment", parent=None):
    from files.models import Comment

    return Comment.objects.create(user=user, media=media, text=text, parent=parent)


class CreateNotificationPipelineTest(TestCase):
    """Tests for _create_notification filtering pipeline."""

    def setUp(self):
        self.sender = _create_user("sender")
        self.recipient = _create_user("recipient")

    @patch("notifications.tasks.send_notification_email.delay")
    def test_self_notification_returns_none(self, mock_email):
        result = NotificationService._create_notification(
            recipient=self.sender,
            actor=self.sender,
            notification_type=NotificationType.COMMENT,
            message="test",
            action_url="/test",
            metadata={},
        )
        self.assertIsNone(result)
        self.assertEqual(Notification.objects.filter(recipient=self.sender, actor=self.sender).count(), 0)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_anonymous_actor_returns_none(self, mock_email):
        from django.contrib.auth.models import AnonymousUser

        result = NotificationService._create_notification(
            recipient=self.recipient,
            actor=AnonymousUser(),
            notification_type=NotificationType.LIKE,
            message="test",
            action_url="/test",
            metadata={},
        )
        self.assertIsNone(result)
        self.assertEqual(Notification.objects.filter(recipient=self.recipient).count(), 0)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_duplicate_within_5min_skipped(self, mock_email):
        NotificationService._create_notification(
            recipient=self.recipient,
            actor=self.sender,
            notification_type=NotificationType.LIKE,
            message="first",
            action_url="/view/abc",
            metadata={},
        )
        result = NotificationService._create_notification(
            recipient=self.recipient,
            actor=self.sender,
            notification_type=NotificationType.LIKE,
            message="second",
            action_url="/view/abc",
            metadata={},
        )
        self.assertIsNone(result)
        self.assertEqual(Notification.objects.filter(recipient=self.recipient, actor=self.sender).count(), 1)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_duplicate_different_url_not_suppressed(self, mock_email):
        NotificationService._create_notification(
            recipient=self.recipient,
            actor=self.sender,
            notification_type=NotificationType.LIKE,
            message="first",
            action_url="/view/abc",
            metadata={},
        )
        result = NotificationService._create_notification(
            recipient=self.recipient,
            actor=self.sender,
            notification_type=NotificationType.LIKE,
            message="second",
            action_url="/view/xyz",
            metadata={},
        )
        self.assertIsNotNone(result)
        self.assertEqual(Notification.objects.filter(recipient=self.recipient, actor=self.sender).count(), 2)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_preference_none_skips(self, mock_email):
        NotificationPreference.objects.create(user=self.recipient, on_like=NotificationChannel.NONE)
        result = NotificationService._create_notification(
            recipient=self.recipient,
            actor=self.sender,
            notification_type=NotificationType.LIKE,
            message="test",
            action_url="/test",
            metadata={},
        )
        self.assertIsNone(result)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_preference_email_queues_task(self, mock_email):
        NotificationPreference.objects.create(user=self.recipient, on_comment=NotificationChannel.EMAIL)
        with self.captureOnCommitCallbacks(execute=True):
            result = NotificationService._create_notification(
                recipient=self.recipient,
                actor=self.sender,
                notification_type=NotificationType.COMMENT,
                message="test",
                action_url="/test",
                metadata={},
            )
        self.assertIsNotNone(result)
        mock_email.assert_called_once_with(result.id)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_preference_in_app_no_email(self, mock_email):
        NotificationPreference.objects.create(user=self.recipient, on_like=NotificationChannel.IN_APP)
        result = NotificationService._create_notification(
            recipient=self.recipient,
            actor=self.sender,
            notification_type=NotificationType.LIKE,
            message="test",
            action_url="/test",
            metadata={},
        )
        self.assertIsNotNone(result)
        mock_email.assert_not_called()


class ContentFilterTest(TestCase):
    """Tests for _passes_content_filter (new_media topic/category filtering)."""

    def setUp(self):
        from files.models import Category, Topic

        self.user = _create_user("filterer")
        self.uploader = _create_user("uploader")
        self.media = _create_media(self.uploader, friendly_token="filter-tok")

        self.topic_climate, _ = Topic.objects.get_or_create(title="Climate Justice")
        self.topic_rights, _ = Topic.objects.get_or_create(title="Human Rights")
        self.cat_doc, _ = Category.objects.get_or_create(title="Documentary")
        self.cat_short, _ = Category.objects.get_or_create(title="Short Film")

        self.media.topics.add(self.topic_climate)
        self.media.category.add(self.cat_doc)

    def test_empty_filters_pass_all(self):
        NotificationPreference.objects.create(user=self.user)
        self.assertTrue(NotificationService._passes_content_filter(self.user, self.media))

    def test_topic_match_passes(self):
        NotificationPreference.objects.create(user=self.user, filter_topics=[self.topic_climate.slug])
        self.assertTrue(NotificationService._passes_content_filter(self.user, self.media))

    def test_topic_mismatch_fails(self):
        NotificationPreference.objects.create(user=self.user, filter_topics=[self.topic_rights.slug])
        self.assertFalse(NotificationService._passes_content_filter(self.user, self.media))

    def test_category_match_passes(self):
        NotificationPreference.objects.create(user=self.user, filter_categories=[self.cat_doc.slug])
        self.assertTrue(NotificationService._passes_content_filter(self.user, self.media))

    def test_category_mismatch_fails(self):
        NotificationPreference.objects.create(user=self.user, filter_categories=[self.cat_short.slug])
        self.assertFalse(NotificationService._passes_content_filter(self.user, self.media))

    def test_both_filters_and_logic(self):
        """Topic matches AND category matches → pass."""
        NotificationPreference.objects.create(
            user=self.user,
            filter_topics=[self.topic_climate.slug],
            filter_categories=[self.cat_doc.slug],
        )
        self.assertTrue(NotificationService._passes_content_filter(self.user, self.media))

    def test_both_filters_topic_mismatch_fails(self):
        """Topic doesn't match even though category does → fail (AND logic)."""
        NotificationPreference.objects.create(
            user=self.user,
            filter_topics=[self.topic_rights.slug],
            filter_categories=[self.cat_doc.slug],
        )
        self.assertFalse(NotificationService._passes_content_filter(self.user, self.media))


class OnCommentTest(TestCase):
    def setUp(self):
        self.owner = _create_user("owner")
        self.commenter = _create_user("commenter")
        self.media = _create_media(self.owner, friendly_token="cmt-tok")

    @patch("notifications.tasks.send_notification_email.delay")
    def test_creates_notification_for_media_owner(self, _):
        comment = _create_comment(self.commenter, self.media)
        result = NotificationService.on_comment(actor=self.commenter, media=self.media, comment=comment)
        self.assertIsNotNone(result)
        self.assertEqual(result.recipient, self.owner)
        self.assertEqual(result.notification_type, NotificationType.COMMENT)
        self.assertIn("commenter", result.message)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_reply_still_notifies_media_owner(self, _):
        """on_comment notifies media owner even for replies (replies are
        activity on their content)."""
        parent = _create_comment(self.commenter, self.media, text="parent")
        reply = _create_comment(self.commenter, self.media, text="reply", parent=parent)
        result = NotificationService.on_comment(actor=self.commenter, media=self.media, comment=reply)
        self.assertIsNotNone(result)
        self.assertEqual(result.recipient, self.owner)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_overlap_skips_when_mentioned(self, _):
        comment = _create_comment(self.commenter, self.media)
        result = NotificationService.on_comment(
            actor=self.commenter,
            media=self.media,
            comment=comment,
            mentioned_users={self.owner},
        )
        self.assertIsNone(result)


class OnReplyTest(TestCase):
    def setUp(self):
        self.owner = _create_user("owner")
        self.commenter = _create_user("commenter")
        self.replier = _create_user("replier")
        self.media = _create_media(self.owner, friendly_token="rpl-tok")

    @patch("notifications.tasks.send_notification_email.delay")
    def test_creates_notification_for_parent_author(self, _):
        parent = _create_comment(self.commenter, self.media, text="parent")
        reply = _create_comment(self.replier, self.media, text="reply", parent=parent)
        result = NotificationService.on_reply(
            actor=self.replier, media=self.media, comment=reply, parent_comment=parent
        )
        self.assertIsNotNone(result)
        self.assertEqual(result.recipient, self.commenter)
        self.assertEqual(result.notification_type, NotificationType.REPLY)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_self_reply_skipped(self, _):
        parent = _create_comment(self.commenter, self.media, text="parent")
        reply = _create_comment(self.commenter, self.media, text="self-reply", parent=parent)
        result = NotificationService.on_reply(
            actor=self.commenter, media=self.media, comment=reply, parent_comment=parent
        )
        self.assertIsNone(result)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_overlap_skips_when_mentioned(self, _):
        parent = _create_comment(self.commenter, self.media, text="parent")
        reply = _create_comment(self.replier, self.media, text="reply", parent=parent)
        result = NotificationService.on_reply(
            actor=self.replier,
            media=self.media,
            comment=reply,
            parent_comment=parent,
            mentioned_users={self.commenter},
        )
        self.assertIsNone(result)


class OnLikeTest(TestCase):
    def setUp(self):
        self.owner = _create_user("owner")
        self.liker = _create_user("liker")
        self.media = _create_media(self.owner, friendly_token="like-tok")

    @patch("notifications.tasks.send_notification_email.delay")
    def test_creates_notification_for_media_owner(self, _):
        result = NotificationService.on_like(actor=self.liker, media=self.media)
        self.assertIsNotNone(result)
        self.assertEqual(result.recipient, self.owner)
        self.assertEqual(result.notification_type, NotificationType.LIKE)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_self_like_skipped(self, _):
        result = NotificationService.on_like(actor=self.owner, media=self.media)
        self.assertIsNone(result)


class OnFollowTest(TestCase):
    @patch("notifications.tasks.send_notification_email.delay")
    def test_creates_follow_notification(self, _):
        follower = _create_user("follower")
        followed = _create_user("followed")
        result = NotificationService.on_follow(actor=follower, followed_user=followed)
        self.assertIsNotNone(result)
        self.assertEqual(result.notification_type, NotificationType.FOLLOW)
        self.assertEqual(result.recipient, followed)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_self_follow_skipped(self, _):
        user = _create_user("selffollow")
        result = NotificationService.on_follow(actor=user, followed_user=user)
        self.assertIsNone(result)


class OnMentionTest(TestCase):
    @patch("notifications.tasks.send_notification_email.delay")
    def test_creates_mention_for_each_user(self, _):
        actor = _create_user("mentioner")
        user_a = _create_user("mentioned_a")
        user_b = _create_user("mentioned_b")
        media = _create_media(_create_user("media_owner"), friendly_token="mnt-tok")
        comment = _create_comment(actor, media)

        notified = NotificationService.on_mention(
            actor=actor, media=media, comment=comment, mentioned_users=[user_a, user_b]
        )
        self.assertEqual(notified, {user_a, user_b})
        self.assertEqual(Notification.objects.filter(notification_type=NotificationType.MENTION).count(), 2)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_self_mention_skipped(self, _):
        actor = _create_user("self_mentioner")
        media = _create_media(_create_user("m_owner"), friendly_token="smnt-tok")
        comment = _create_comment(actor, media)

        notified = NotificationService.on_mention(actor=actor, media=media, comment=comment, mentioned_users=[actor])
        self.assertEqual(notified, set())


class OnNewMediaTest(TestCase):
    @patch("notifications.tasks.send_notification_email.delay")
    def test_notifies_followers(self, _):
        from users.models import Channel

        creator = _create_user("creator")
        follower = _create_user("follower_nm")
        channel = Channel.objects.create(title="Creator Channel", user=creator)
        channel.subscribers.add(follower)

        media = _create_media(creator, friendly_token="new-tok")
        created = NotificationService.on_new_media(actor=creator, media=media)
        self.assertEqual(len(created), 1)
        self.assertEqual(created[0].recipient, follower)
        self.assertEqual(created[0].notification_type, NotificationType.NEW_MEDIA)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_skips_self(self, _):
        from users.models import Channel

        creator = _create_user("creator_self")
        channel = Channel.objects.create(title="Self Channel", user=creator)
        channel.subscribers.add(creator)

        media = _create_media(creator, friendly_token="self-tok")
        created = NotificationService.on_new_media(actor=creator, media=media)
        self.assertEqual(len(created), 0)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_content_filter_applied(self, _):
        from files.models import Topic
        from users.models import Channel

        creator = _create_user("creator_cf")
        follower = _create_user("follower_cf")
        channel = Channel.objects.create(title="CF Channel", user=creator)
        channel.subscribers.add(follower)

        # Follower only wants "human-rights" topics
        NotificationPreference.objects.create(user=follower, filter_topics=["human-rights"])

        # Media is tagged "climate-justice" — doesn't match
        topic, _ = Topic.objects.get_or_create(title="Climate Justice CF")
        media = _create_media(creator, friendly_token="cf-tok")
        media.topics.add(topic)

        created = NotificationService.on_new_media(actor=creator, media=media)
        self.assertEqual(len(created), 0)


class OnAddedToPlaylistTest(TestCase):
    @patch("notifications.tasks.send_notification_email.delay")
    def test_creates_notification_for_media_owner(self, _):
        from files.models import Playlist

        owner = _create_user("pl_owner")
        curator = _create_user("curator")
        media = _create_media(owner, friendly_token="pl-tok")
        playlist = Playlist.objects.create(title="Best Docs", user=curator)

        result = NotificationService.on_added_to_playlist(actor=curator, media=media, playlist=playlist)
        self.assertIsNotNone(result)
        self.assertEqual(result.recipient, owner)
        self.assertEqual(result.notification_type, NotificationType.ADDED_TO_PLAYLIST)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_self_add_skipped(self, _):
        from files.models import Playlist

        owner = _create_user("self_pl")
        media = _create_media(owner, friendly_token="spl-tok")
        playlist = Playlist.objects.create(title="My Playlist", user=owner)

        result = NotificationService.on_added_to_playlist(actor=owner, media=media, playlist=playlist)
        self.assertIsNone(result)


class BroadcastTest(TestCase):
    def test_creates_for_all_active_users(self):
        user_a = _create_user("active_a")
        user_b = _create_user("active_b")
        inactive = _create_user("inactive_user")
        inactive.is_active = False
        inactive.save()

        created = NotificationService.broadcast("System maintenance tonight")
        recipients = {n.recipient for n in created}
        self.assertIn(user_a, recipients)
        self.assertIn(user_b, recipients)
        self.assertNotIn(inactive, recipients)
        self.assertTrue(all(n.actor is None for n in created))
        self.assertTrue(all(n.notification_type == NotificationType.SYSTEM_ANNOUNCEMENT for n in created))

    def test_broadcast_message_and_url(self):
        _create_user("bc_user")
        created = NotificationService.broadcast("Downtime at 2am", action_url="/announcements/1")
        self.assertEqual(created[0].message, "Downtime at 2am")
        self.assertEqual(created[0].action_url, "/announcements/1")


class SendNotificationEmailTest(TestCase):
    @override_settings(
        PORTAL_NAME="TestCMS",
        SSL_FRONTEND_HOST="https://test.example.com",
        DEFAULT_FROM_EMAIL="noreply@test.com",
    )
    @patch("notifications.tasks.EmailMessage")
    def test_sends_email_with_correct_content(self, mock_email_cls):
        from notifications.tasks import send_notification_email

        recipient = _create_user("email_rcpt")
        sender = _create_user("email_sender")
        notif = Notification.objects.create(
            recipient=recipient,
            actor=sender,
            notification_type=NotificationType.COMMENT,
            message="email_sender commented on 'Test'",
            action_url="/view/abc",
            metadata={},
        )
        send_notification_email(notif.id)

        mock_email_cls.assert_called_once()
        call_kwargs = mock_email_cls.call_args[1]
        self.assertIn("[TestCMS]", call_kwargs["subject"])
        self.assertIn("https://test.example.com/view/abc", call_kwargs["body"])
        self.assertIn("preferences", call_kwargs["body"])
        self.assertEqual(call_kwargs["to"], [recipient.email])
        mock_email_cls.return_value.send.assert_called_once()

    @patch("notifications.tasks.EmailMessage")
    def test_handles_missing_notification(self, mock_email_cls):
        from notifications.tasks import send_notification_email

        send_notification_email(99999)
        mock_email_cls.assert_not_called()


class NotifyFollowersNewMediaTaskTest(TestCase):
    @patch("notifications.services.NotificationService.on_new_media")
    def test_calls_on_new_media(self, mock_on_new):
        from notifications.tasks import notify_followers_new_media

        creator = _create_user("task_creator")
        media = _create_media(creator, friendly_token="task-tok")
        notify_followers_new_media(creator.id, media.id)
        mock_on_new.assert_called_once()

    @patch("notifications.services.NotificationService.on_new_media")
    def test_handles_missing_objects(self, mock_on_new):
        from notifications.tasks import notify_followers_new_media

        notify_followers_new_media(99999, 99999)
        mock_on_new.assert_not_called()


class EdgeCaseServiceTest(TestCase):
    """Edge cases from Issue 6 (#462) scope."""

    @patch("notifications.tasks.send_notification_email.delay")
    def test_notification_actor_null_after_deletion(self, _):
        """After actor deletion, notification.actor is NULL (SET_NULL), no crash."""
        owner = _create_user("ec_owner")
        actor = _create_user("ec_actor")
        media = _create_media(owner, friendly_token="ec-tok")
        result = NotificationService.on_like(actor=actor, media=media)
        self.assertIsNotNone(result)
        actor.delete()
        result.refresh_from_db()
        self.assertIsNone(result.actor)
        self.assertIn("ec_actor", result.message)  # message preserved

    @patch("notifications.tasks.send_notification_email.delay")
    def test_on_mention_empty_list_returns_empty_set(self, _):
        """on_mention with empty mentioned_users returns empty set."""
        actor = _create_user("em_actor")
        media = _create_media(_create_user("em_owner"), friendly_token="em-tok")
        comment = _create_comment(actor, media)
        notified = NotificationService.on_mention(
            actor=actor,
            media=media,
            comment=comment,
            mentioned_users=[],
        )
        self.assertEqual(notified, set())
        self.assertEqual(Notification.objects.filter(notification_type=NotificationType.MENTION).count(), 0)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_inactive_user_still_receives_single_notification(self, _):
        """Single-target handlers don't check is_active (only broadcast does)."""
        owner = _create_user("inactive_owner")
        owner.is_active = False
        owner.save()
        actor = _create_user("ia_actor")
        media = _create_media(owner, friendly_token="ia-tok")
        result = NotificationService.on_like(actor=actor, media=media)
        # Single-target _create_notification does NOT filter by is_active
        self.assertIsNotNone(result)


class EmailValidationTest(TestCase):
    """Email delivery validation from Issue 6 (#462) scope."""

    @override_settings(
        PORTAL_NAME="TestCMS",
        SSL_FRONTEND_HOST="https://test.example.com",
        DEFAULT_FROM_EMAIL="noreply@test.com",
    )
    @patch("notifications.tasks.EmailMessage")
    def test_email_skipped_when_recipient_has_no_email(self, mock_email_cls):
        """Recipient with blank email -> task skips, no EmailMessage call."""
        from notifications.tasks import send_notification_email

        recipient = _create_user("no_email_user")
        recipient.email = ""
        recipient.save()
        sender = _create_user("ev_sender")
        notif = Notification.objects.create(
            recipient=recipient,
            actor=sender,
            notification_type=NotificationType.COMMENT,
            message="test",
            action_url="/view/abc",
            metadata={},
        )
        send_notification_email(notif.id)
        mock_email_cls.assert_not_called()

    @override_settings(
        PORTAL_NAME="TestCMS",
        SSL_FRONTEND_HOST="https://test.example.com",
        DEFAULT_FROM_EMAIL="noreply@test.com",
    )
    @patch("notifications.tasks.EmailMessage")
    def test_email_preference_recheck_at_send_time(self, mock_email_cls):
        """If preference changes to in_app between enqueue and send, email is skipped."""
        from notifications.tasks import send_notification_email

        recipient = _create_user("recheck_user")
        sender = _create_user("recheck_sender")
        NotificationPreference.objects.create(
            user=recipient,
            on_comment=NotificationChannel.EMAIL,
        )
        notif = Notification.objects.create(
            recipient=recipient,
            actor=sender,
            notification_type=NotificationType.COMMENT,
            message="test",
            action_url="/view/abc",
            metadata={},
        )
        # Simulate preference change before task runs
        pref = NotificationPreference.objects.get(user=recipient)
        pref.on_comment = NotificationChannel.IN_APP
        pref.save()
        send_notification_email(notif.id)
        mock_email_cls.assert_not_called()

    @override_settings(
        PORTAL_NAME="TestCMS",
        SSL_FRONTEND_HOST="https://test.example.com",
        DEFAULT_FROM_EMAIL="noreply@test.com",
    )
    @patch("notifications.tasks.EmailMessage")
    def test_email_body_contains_action_link(self, mock_email_cls):
        """Email body includes full action URL with site prefix."""
        from notifications.tasks import send_notification_email

        recipient = _create_user("action_user")
        sender = _create_user("action_sender")
        notif = Notification.objects.create(
            recipient=recipient,
            actor=sender,
            notification_type=NotificationType.COMMENT,
            message="action_sender commented",
            action_url="/view?m=abc",
            metadata={},
        )
        send_notification_email(notif.id)
        mock_email_cls.assert_called_once()
        body = mock_email_cls.call_args[1]["body"]
        self.assertIn("https://test.example.com/view?m=abc", body)

    @override_settings(
        PORTAL_NAME="TestCMS",
        SSL_FRONTEND_HOST="https://test.example.com",
        DEFAULT_FROM_EMAIL="noreply@test.com",
    )
    @patch("notifications.tasks.EmailMessage")
    def test_email_body_contains_preferences_link(self, mock_email_cls):
        """Email body includes notification preferences link."""
        from notifications.tasks import send_notification_email

        recipient = _create_user("pref_link_user")
        sender = _create_user("pref_link_sender")
        notif = Notification.objects.create(
            recipient=recipient,
            actor=sender,
            notification_type=NotificationType.COMMENT,
            message="test",
            action_url="/view/abc",
            metadata={},
        )
        send_notification_email(notif.id)
        mock_email_cls.assert_called_once()
        body = mock_email_cls.call_args[1]["body"]
        self.assertIn("/notifications/#preferences", body)
