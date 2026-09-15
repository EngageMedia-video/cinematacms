"""Coverage for who may delete a comment and how a comment's text survives.

Issue #869: a viewer may delete the comment they wrote on someone else's
video, and a comment typed across several lines keeps its line breaks.
"""

import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from files.models import Comment, Media

User = get_user_model()

PASSWORD = "securepassword123"  # noqa: S105


def _create_user(username, **kwargs):
    return User.objects.create_user(
        username=username,
        email=f"{username}@example.com",
        password=PASSWORD,
        **kwargs,
    )


def _create_media(user, title="Delete Film", friendly_token="deltok", state="public"):  # noqa: S107
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


class CommentDeletePermissionTest(TestCase):
    """The endpoint decides who may delete, not the UI."""

    def setUp(self):
        self.owner = _create_user("film_owner")
        self.commenter = _create_user("commenter")
        self.bystander = _create_user("bystander")
        self.media = _create_media(self.owner)
        self.comment = Comment.objects.create(user=self.commenter, media=self.media, text="my own words")
        self.url = f"/api/v1/media/{self.media.friendly_token}/comments/{self.comment.uid}"

    def _delete_as(self, username=None):
        client = Client()
        if username:
            client.login(username=username, password=PASSWORD)
        return client.delete(self.url)

    def test_comment_author_deletes_own_comment_on_another_users_media(self):
        response = self._delete_as("commenter")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Comment.objects.filter(uid=self.comment.uid).exists())

    def test_media_owner_deletes_a_comment_on_their_media(self):
        response = self._delete_as("film_owner")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Comment.objects.filter(uid=self.comment.uid).exists())

    def test_unrelated_user_cannot_delete_someone_elses_comment(self):
        response = self._delete_as("bystander")

        self.assertEqual(response.status_code, 400)
        self.assertTrue(Comment.objects.filter(uid=self.comment.uid).exists())

    def test_anonymous_visitor_cannot_delete_a_comment(self):
        response = self._delete_as()

        self.assertNotEqual(response.status_code, 204)
        self.assertTrue(Comment.objects.filter(uid=self.comment.uid).exists())

    def test_deleting_a_parent_comment_also_removes_its_replies(self):
        """Delete is a hard delete; Comment.parent cascades, so replies go too."""
        reply = Comment.objects.create(
            user=self.bystander,
            media=self.media,
            text="replying",
            parent=self.comment,
        )

        response = self._delete_as("commenter")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Comment.objects.filter(uid=reply.uid).exists())


class CommentCanDeleteFieldTest(TestCase):
    """The listing tells each reader which comments they may delete."""

    def setUp(self):
        self.owner = _create_user("list_owner")
        self.commenter = _create_user("list_commenter")
        self.bystander = _create_user("list_bystander")
        self.media = _create_media(self.owner, friendly_token="listtok")
        self.own_comment = Comment.objects.create(user=self.commenter, media=self.media, text="mine")
        self.other_comment = Comment.objects.create(user=self.bystander, media=self.media, text="theirs")
        self.url = f"/api/v1/media/{self.media.friendly_token}/comments"

    def _can_delete_by_text(self, username=None):
        client = Client()
        if username:
            client.login(username=username, password=PASSWORD)
        response = client.get(self.url)
        self.assertEqual(response.status_code, 200)
        return {item["text"]: item["can_delete"] for item in response.json()["results"]}

    def test_author_may_delete_only_their_own_comment(self):
        flags = self._can_delete_by_text("list_commenter")

        self.assertTrue(flags["mine"])
        self.assertFalse(flags["theirs"])

    def test_media_owner_may_delete_every_comment_on_their_media(self):
        flags = self._can_delete_by_text("list_owner")

        self.assertTrue(flags["mine"])
        self.assertTrue(flags["theirs"])

    def test_anonymous_visitor_may_delete_nothing(self):
        flags = self._can_delete_by_text()

        self.assertFalse(flags["mine"])
        self.assertFalse(flags["theirs"])


class CommentListingOrderTest(TestCase):
    """The newest comment is listed last, which is what the panel scrolls to."""

    def setUp(self):
        self.owner = _create_user("order_owner")
        self.media = _create_media(self.owner, friendly_token="ordtok")
        self.url = f"/api/v1/media/{self.media.friendly_token}/comments"

    def test_a_newly_posted_comment_is_the_last_result(self):
        Comment.objects.create(user=self.owner, media=self.media, text="oldest")
        Comment.objects.create(user=self.owner, media=self.media, text="middle")
        Comment.objects.create(user=self.owner, media=self.media, text="newest")

        response = Client().get(self.url)

        self.assertEqual(response.status_code, 200)
        texts = [item["text"] for item in response.json()["results"]]
        self.assertEqual(texts, ["oldest", "middle", "newest"])


class CommentMultilineTextTest(TestCase):
    """A comment typed across several lines is stored with its line breaks."""

    def setUp(self):
        self.owner = _create_user("multiline_owner")
        self.media = _create_media(self.owner, friendly_token="multitok")
        self.url = f"/api/v1/media/{self.media.friendly_token}/comments"
        self.client = Client()
        self.client.login(username="multiline_owner", password=PASSWORD)

    @patch("notifications.tasks.send_notification_email.delay")
    def test_posted_line_breaks_survive_the_round_trip(self, _):
        response = self.client.post(
            self.url,
            data=json.dumps({"text": "first line\nsecond line"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Comment.objects.get(media=self.media).text, "first line\nsecond line")

        listing = self.client.get(self.url)
        self.assertEqual(listing.json()["results"][0]["text"], "first line\nsecond line")
