import json

from django.test import Client, TestCase

from actions.models import MediaAction
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
