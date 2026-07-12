from django.test import TestCase

from files.models import Playlist
from files.tests.helpers import create_test_user


class PlaylistDetailBionoteTests(TestCase):
    def test_detail_exposes_creator_bionote(self):
        user = create_test_user(username="bionote_owner")
        user.description = "Community archivist.\n\nBased in Manila."
        user.save(update_fields=["description"])
        playlist = Playlist.objects.create(
            title="Bionote Shorts",
            description="A program note",
            user=user,
            friendly_token="plbio001",
        )

        response = self.client.get(f"/api/v1/playlists/{playlist.friendly_token}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user_bionote"], "Community archivist.\n\nBased in Manila.")

    def test_profile_bionote_update_invalidates_cached_detail(self):
        user = create_test_user(username="bionote_editor")
        user.description = "Original bionote"
        user.save(update_fields=["description"])
        playlist = Playlist.objects.create(
            title="Cache Shorts",
            user=user,
            friendly_token="plbio003",
        )

        first = self.client.get(f"/api/v1/playlists/{playlist.friendly_token}")
        self.assertEqual(first.json()["user_bionote"], "Original bionote")

        user.description = "Updated bionote"
        user.save(update_fields=["description"])

        second = self.client.get(f"/api/v1/playlists/{playlist.friendly_token}")
        self.assertEqual(second.json()["user_bionote"], "Updated bionote")

    def test_detail_bionote_empty_when_unset(self):
        user = create_test_user(username="bionote_less_owner")
        playlist = Playlist.objects.create(
            title="No Bionote Shorts",
            user=user,
            friendly_token="plbio002",
        )

        response = self.client.get(f"/api/v1/playlists/{playlist.friendly_token}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["user_bionote"], "")


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

    def test_partial_note_update_keeps_title_and_description(self):
        self.client.force_login(self.user)

        response = self.client.post(
            f"/api/v1/playlists/{self.playlist.friendly_token}",
            {"curator_note": "Note-only update"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.playlist.refresh_from_db()
        self.assertEqual(self.playlist.curator_note, "Note-only update")
        self.assertEqual(self.playlist.title, "Curated Shorts")
        self.assertEqual(self.playlist.description, "A program note")

    def test_editor_update_does_not_transfer_ownership(self):
        editor = create_test_user(username="playlist_editor", is_editor=True)
        self.client.force_login(editor)

        response = self.client.post(
            f"/api/v1/playlists/{self.playlist.friendly_token}",
            {"curator_note": "Editor note"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        self.playlist.refresh_from_db()
        self.assertEqual(self.playlist.curator_note, "Editor note")
        self.assertEqual(self.playlist.user, self.user)

    def test_non_owner_cannot_update_curator_note(self):
        other_user = create_test_user(username="playlist_visitor")
        self.client.force_login(other_user)

        response = self.client.post(
            f"/api/v1/playlists/{self.playlist.friendly_token}",
            {
                "title": self.playlist.title,
                "description": self.playlist.description,
                "curator_note": "Hijacked note",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.playlist.refresh_from_db()
        self.assertEqual(self.playlist.curator_note, "Initial curator note")

    def test_anonymous_cannot_update_curator_note(self):
        response = self.client.post(
            f"/api/v1/playlists/{self.playlist.friendly_token}",
            {
                "title": self.playlist.title,
                "description": self.playlist.description,
                "curator_note": "Anonymous note",
            },
            content_type="application/json",
        )

        self.assertIn(response.status_code, (401, 403))
        self.playlist.refresh_from_db()
        self.assertEqual(self.playlist.curator_note, "Initial curator note")
