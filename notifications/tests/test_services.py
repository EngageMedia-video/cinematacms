from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.utils import timezone

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


def _create_media(user, title="Test Video", friendly_token="abc-def-123", state="public"):  # noqa: S107
    """Create a minimal Media object for testing.

    Patches media_init to prevent file processing errors (same pattern
    as files/tests/test_race_conditions.py).
    """
    from files.models import Media

    with patch.object(Media, "media_init", return_value=None):
        media = Media.objects.create(
            user=user,
            title=title,
            friendly_token=friendly_token,
            media_type="video",
            state=state,
            encoding_status="success",
        )
    # Media.save() overwrites state with the portal workflow default on create,
    # so pin the requested state without re-running the publish side effects.
    if media.state != state:
        Media.objects.filter(pk=media.pk).update(state=state)
        media.state = state
    return media


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
        self.assertEqual(
            Notification.objects.filter(
                notification_type=NotificationType.MENTION,
                metadata__comment_id=comment.id,
            ).count(),
            2,
        )

    @patch("notifications.tasks.send_notification_email.delay")
    def test_self_mention_skipped(self, _):
        actor = _create_user("self_mentioner")
        media = _create_media(_create_user("m_owner"), friendly_token="smnt-tok")
        comment = _create_comment(actor, media)

        notified = NotificationService.on_mention(actor=actor, media=media, comment=comment, mentioned_users=[actor])
        self.assertEqual(notified, set())


class MentionTitleRedactionTest(TestCase):
    """The mention message must not leak a title the recipient cannot open."""

    @patch("notifications.tasks.send_notification_email.delay")
    def test_public_media_title_is_included(self, _):
        actor = _create_user("redact_actor")
        recipient = _create_user("redact_recipient")
        media = _create_media(_create_user("redact_owner"), title="Public Film", friendly_token="red-pub")
        comment = _create_comment(actor, media)

        NotificationService.on_mention(actor=actor, media=media, comment=comment, mentioned_users=[recipient])

        notification = Notification.objects.get(recipient=recipient)
        self.assertIn("Public Film", notification.message)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_private_media_title_is_hidden_from_outsiders(self, _):
        actor = _create_user("priv_actor")
        recipient = _create_user("priv_recipient")
        media = _create_media(
            _create_user("priv_owner"),
            title="Secret Film",
            friendly_token="red-priv",
            state="private",
        )
        comment = _create_comment(actor, media)

        NotificationService.on_mention(actor=actor, media=media, comment=comment, mentioned_users=[recipient])

        notification = Notification.objects.get(recipient=recipient)
        self.assertNotIn("Secret Film", notification.message)
        self.assertEqual(notification.message, f"{actor.username} mentioned you in a comment")

    @patch("notifications.tasks.send_notification_email.delay")
    def test_private_media_owner_still_sees_the_title(self, _):
        actor = _create_user("priv_owner_actor")
        owner = _create_user("priv_owner_recipient")
        media = _create_media(owner, title="Secret Film", friendly_token="red-priv-own", state="private")
        comment = _create_comment(actor, media)

        NotificationService.on_mention(actor=actor, media=media, comment=comment, mentioned_users=[owner])

        self.assertIn("Secret Film", Notification.objects.get(recipient=owner).message)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_unlisted_media_keeps_its_title(self, _):
        """Unlisted is link-gated, and the notification carries the link (issue #855)."""
        actor = _create_user("unlisted_actor")
        recipient = _create_user("unlisted_recipient")
        media = _create_media(
            _create_user("unlisted_owner"),
            title="Unlisted Film",
            friendly_token="red-unlisted",
            state="unlisted",
        )
        comment = _create_comment(actor, media)

        NotificationService.on_mention(actor=actor, media=media, comment=comment, mentioned_users=[recipient])

        self.assertIn("Unlisted Film", Notification.objects.get(recipient=recipient).message)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_restricted_media_title_is_hidden_from_outsiders(self, _):
        actor = _create_user("restr_actor")
        recipient = _create_user("restr_recipient")
        media = _create_media(
            _create_user("restr_owner"),
            title="Restricted Film",
            friendly_token="red-restr",
            state="restricted",
        )
        comment = _create_comment(actor, media)

        NotificationService.on_mention(actor=actor, media=media, comment=comment, mentioned_users=[recipient])

        self.assertNotIn("Restricted Film", Notification.objects.get(recipient=recipient).message)


class MentionEditDeduplicationTest(TestCase):
    """Re-notifying for a mention already delivered on the same comment."""

    @patch("notifications.tasks.send_notification_email.delay")
    def test_second_call_for_same_comment_creates_no_duplicate(self, _):
        actor = _create_user("edit_actor")
        recipient = _create_user("edit_recipient")
        media = _create_media(_create_user("edit_owner"), friendly_token="edit-tok")
        comment = _create_comment(actor, media)

        NotificationService.on_mention(actor=actor, media=media, comment=comment, mentioned_users=[recipient])
        # Simulate an edit that keeps the same handle, well past the 5-minute
        # duplicate window that _is_duplicate() covers.
        Notification.objects.filter(recipient=recipient).update(created_at=timezone.now() - timedelta(days=1))

        notified = NotificationService.on_mention(
            actor=actor, media=media, comment=comment, mentioned_users=[recipient]
        )

        self.assertEqual(notified, {recipient})
        self.assertEqual(
            Notification.objects.filter(recipient=recipient, notification_type=NotificationType.MENTION).count(),
            1,
        )

    @patch("notifications.tasks.send_notification_email.delay")
    def test_a_newly_added_handle_on_the_same_comment_is_notified(self, _):
        actor = _create_user("edit_actor_2")
        first = _create_user("edit_first")
        second = _create_user("edit_second")
        media = _create_media(_create_user("edit_owner_2"), friendly_token="edit-tok-2")
        comment = _create_comment(actor, media)

        NotificationService.on_mention(actor=actor, media=media, comment=comment, mentioned_users=[first])
        notified = NotificationService.on_mention(
            actor=actor, media=media, comment=comment, mentioned_users=[first, second]
        )

        self.assertEqual(notified, {first, second})
        self.assertEqual(
            Notification.objects.filter(
                notification_type=NotificationType.MENTION,
                metadata__comment_id=comment.id,
            ).count(),
            2,
        )


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


class SendNotificationEmailTest(TestCase):
    @override_settings(
        PORTAL_NAME="TestCMS",
        SSL_FRONTEND_HOST="https://test.example.com",
        DEFAULT_FROM_EMAIL="noreply@test.com",
    )
    @patch("notifications.tasks.enqueue")
    def test_sends_email_with_correct_content(self, mock_enqueue):
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

        mock_enqueue.assert_called_once()
        envelope = mock_enqueue.call_args.args[0]
        self.assertIn("[TestCMS]", envelope.subject)
        self.assertIn("https://test.example.com/view/abc", envelope.text_body)
        self.assertIn("preferences", envelope.text_body)
        self.assertEqual(envelope.recipient, recipient.email)

    @patch("notifications.tasks.enqueue")
    def test_handles_missing_notification(self, mock_enqueue):
        from notifications.tasks import send_notification_email

        send_notification_email(99999)
        mock_enqueue.assert_not_called()


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
        self.assertEqual(
            Notification.objects.filter(
                notification_type=NotificationType.MENTION,
                metadata__comment_id=comment.id,
            ).count(),
            0,
        )

    @patch("notifications.tasks.send_notification_email.delay")
    def test_inactive_user_still_receives_single_notification(self, _):
        """Single-target handlers don't check is_active."""
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
    @patch("notifications.tasks.enqueue")
    def test_email_skipped_when_recipient_has_no_email(self, mock_enqueue):
        """A recipient with no address does not create a delivery receipt."""
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
        mock_enqueue.assert_not_called()

    @override_settings(
        PORTAL_NAME="TestCMS",
        SSL_FRONTEND_HOST="https://test.example.com",
        DEFAULT_FROM_EMAIL="noreply@test.com",
    )
    @patch("notifications.tasks.enqueue")
    def test_email_carries_preference_recheck_to_delivery(self, mock_enqueue):
        """The delivery task receives the notification needed to re-check consent."""
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
        send_notification_email(notif.id)
        envelope = mock_enqueue.call_args.args[0]
        self.assertEqual(envelope.preference, {"kind": "notification", "id": notif.id})
        pref = NotificationPreference.objects.get(user=recipient)
        pref.on_comment = NotificationChannel.IN_APP
        pref.save()
        from email_delivery.tasks import _preference_allows

        self.assertFalse(_preference_allows(envelope.preference))

    @override_settings(
        PORTAL_NAME="TestCMS",
        SSL_FRONTEND_HOST="https://test.example.com",
        DEFAULT_FROM_EMAIL="noreply@test.com",
    )
    @patch("notifications.tasks.enqueue")
    def test_email_body_contains_action_link(self, mock_enqueue):
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
        mock_enqueue.assert_called_once()
        body = mock_enqueue.call_args.args[0].text_body
        self.assertIn("https://test.example.com/view?m=abc", body)

    @override_settings(
        PORTAL_NAME="TestCMS",
        SSL_FRONTEND_HOST="https://test.example.com",
        DEFAULT_FROM_EMAIL="noreply@test.com",
    )
    @patch("notifications.tasks.enqueue")
    def test_email_body_contains_preferences_link(self, mock_enqueue):
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
        mock_enqueue.assert_called_once()
        body = mock_enqueue.call_args.args[0].text_body
        self.assertIn("/notifications/#preferences", body)
