from django.test import TestCase

from files.models import Playlist
from files.tests.helpers import create_test_user


class PlaylistDetailCuratorNoteTests(TestCase):
    def setUp(self):
        self.user = create_test_user(username="playlist_owner")
        self.playlist = Playlist.objects.create(
            title="Curated Shorts",
            description="A program note",
            curator_note="Initial curator note",
            user=self.user,
            friendly_token="plnote01",
        )

    def test_detail_exposes_curator_note(self):
        response = self.client.get(f"/api/v1/playlists/{self.playlist.friendly_token}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["curator_note"], "Initial curator note")
        self.assertEqual(response.json()["user_display_name"], self.user.name)
        self.assertFalse(response.json()["author_is_manager"])

    def test_owner_can_update_curator_note(self):
        self.client.force_login(self.user)

        response = self.client.post(
            f"/api/v1/playlists/{self.playlist.friendly_token}",
            {
                "title": self.playlist.title,
                "description": self.playlist.description,
                "curator_note": "Updated editorial framing",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.playlist.refresh_from_db()
        self.assertEqual(self.playlist.curator_note, "Updated editorial framing")
