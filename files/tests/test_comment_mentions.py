"""End-to-end coverage for @mentions written through the comment API."""

import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from files.models import Comment, Media
from notifications.models import Notification, NotificationType

User = get_user_model()

PASSWORD = "securepassword123"  # noqa: S105


def _create_user(username, **kwargs):
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password=PASSWORD,
        **kwargs,
    )


def _create_media(user, title="Mention Film", friendly_token="mention-tok", state="public"):  # noqa: S107
    with patch.object(Media, "media_init", return_value=None):
        media = Media.objects.create(
            user=user,
            title=title,
            friendly_token=friendly_token,
            media_type="video",
            state=state,
            encoding_status="success",
        )
    # Media.save() applies the portal workflow default on create.
    if media.state != state:
        Media.objects.filter(pk=media.pk).update(state=state)
        media.state = state
    return media


@patch("notifications.tasks.send_notification_email.delay")
class CommentMentionNotificationTest(TestCase):
    def setUp(self):
        self.author = _create_user("comment_author")
        self.owner = _create_user("media_owner")
        self.mentioned = _create_user("mentioned_user")
        self.media = _create_media(self.owner)
        self.url = f"/api/v1/media/{self.media.friendly_token}/comments"
        self.client = Client()
        self.client.login(username="comment_author", password=PASSWORD)

    def _post(self, text):
        return self.client.post(self.url, data=json.dumps({"text": text}), content_type="application/json")

    def _mentions_for(self, user):
        return Notification.objects.filter(recipient=user, notification_type=NotificationType.MENTION)

    def test_mention_in_comment_notifies_the_named_user(self, _):
        response = self._post("hey @mentioned_user look at this")

        self.assertEqual(response.status_code, 201)
        notification = self._mentions_for(self.mentioned).get()
        self.assertIn("Mention Film", notification.message)
        posted = Comment.objects.get(uid=response.json()["uid"])
        self.assertEqual(notification.metadata["comment_id"], posted.id)

    def test_unknown_handle_produces_no_notification(self, _):
        response = self._post("hey @nobody_at_all")

        posted = Comment.objects.get(uid=response.json()["uid"])
        self.assertEqual(
            Notification.objects.filter(
                notification_type=NotificationType.MENTION,
                metadata__comment_id=posted.id,
            ).count(),
            0,
        )

    def test_self_mention_produces_no_notification(self, _):
        self._post("note to self @comment_author")

        self.assertEqual(self._mentions_for(self.author).count(), 0)

    def test_mentioned_owner_is_not_also_sent_a_comment_notification(self, _):
        self._post("thanks @media_owner")

        self.assertEqual(self._mentions_for(self.owner).count(), 1)
        self.assertEqual(
            Notification.objects.filter(recipient=self.owner, notification_type=NotificationType.COMMENT).count(),
            0,
        )

    def test_mentioned_parent_author_is_not_also_sent_a_reply_notification(self, _):
        parent_author = _create_user("parent_author")
        parent = Comment.objects.create(user=parent_author, media=self.media, text="first")

        response = self.client.post(
            self.url,
            data=json.dumps({"text": "agreed @parent_author", "parent": parent.id}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(self._mentions_for(parent_author).count(), 1)
        self.assertEqual(
            Notification.objects.filter(recipient=parent_author, notification_type=NotificationType.REPLY).count(),
            0,
        )

    def test_the_same_handle_repeated_in_one_comment_notifies_once(self, _):
        response = self._post("@mentioned_user @mentioned_user @mentioned_user look")

        posted = Comment.objects.get(uid=response.json()["uid"])
        self.assertEqual(
            Notification.objects.filter(
                recipient=self.mentioned,
                notification_type=NotificationType.MENTION,
                metadata__comment_id=posted.id,
            ).count(),
            1,
        )

    def test_a_second_comment_notifies_again_right_away(self, _):
        """A fresh tag always reaches the person, even minutes after the last one."""
        first = self._post("@mentioned_user first")
        second = self._post("@mentioned_user second")

        comment_ids = {
            Comment.objects.get(uid=first.json()["uid"]).id,
            Comment.objects.get(uid=second.json()["uid"]).id,
        }
        notified_for = {notification.metadata["comment_id"] for notification in self._mentions_for(self.mentioned)}
        self.assertEqual(notified_for, comment_ids)

    def _password_protected_media(self):
        """A film in the state the password gate actually keys on (issue #855)."""
        media = _create_media(
            self.owner,
            title="Locked Film",
            friendly_token="mention-pw",
            state="restricted",
        )
        media.set_password("filmpassword123")
        Media.objects.filter(pk=media.pk).update(password=media.password)
        return media

    def test_password_protected_media_mention_hides_the_title(self, _):
        """Reproduces issue #855: the mentioned user has neither password nor grant."""
        media = self._password_protected_media()
        self.client.login(username="media_owner", password=PASSWORD)

        response = self.client.post(
            f"/api/v1/media/{media.friendly_token}/comments",
            data=json.dumps({"text": "take a look @mentioned_user"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        message = self._mentions_for(self.mentioned).get().message
        self.assertNotIn("Locked Film", message)
        self.assertEqual(message, "media_owner mentioned you in a comment")

    def test_the_mention_email_never_carries_a_hidden_title(self, _):
        """The title must be gone before the row is written; an email cannot be un-sent.

        Asserted on the envelope handed to the delivery layer, which is where the
        message text is finalised, rather than on a sent message: delivery is
        deferred to a Celery task on transaction commit.
        """
        from notifications.tasks import send_notification_email

        media = self._password_protected_media()
        self.client.login(username="media_owner", password=PASSWORD)
        self.client.post(
            f"/api/v1/media/{media.friendly_token}/comments",
            data=json.dumps({"text": "take a look @mentioned_user"}),
            content_type="application/json",
        )

        notification = self._mentions_for(self.mentioned).get()
        with patch("notifications.tasks.enqueue") as enqueue:
            send_notification_email(notification.id)

        enqueue.assert_called_once()
        envelope = enqueue.call_args.args[0]
        self.assertNotIn("Locked Film", envelope.subject)
        self.assertNotIn("Locked Film", envelope.text_body)

    def test_private_media_mention_hides_the_title(self, _):
        private_media = _create_media(
            self.owner,
            title="Secret Film",
            friendly_token="mention-priv",
            state="private",
        )
        # The owner posts on their own private media so the comment is allowed.
        self.client.login(username="media_owner", password=PASSWORD)

        response = self.client.post(
            f"/api/v1/media/{private_media.friendly_token}/comments",
            data=json.dumps({"text": "look @mentioned_user"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertNotIn("Secret Film", self._mentions_for(self.mentioned).get().message)
