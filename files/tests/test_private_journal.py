from django.test import Client, TestCase

from files.models import PrivateJournalNote
from files.tests.helpers import create_test_media, create_test_user


class PrivateJournalNoteModelTests(TestCase):
    def test_save_strips_markup_and_clamps_timestamp(self):
        user = create_test_user()
        media = create_test_media(user)

        note = PrivateJournalNote.objects.create(
            media=media,
            user=user,
            text="<strong>Good cut</strong>",
            timestamp_seconds=-4,
        )

        self.assertEqual(note.text, "Good cut")
        self.assertEqual(note.timestamp_seconds, 0)


class PrivateJournalEndpointTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = create_test_user(username="journaluser", password="testpass123")
        self.other_user = create_test_user(username="otherjournaluser", password="testpass123")
        self.media = create_test_media(self.user)
        self.url = f"/api/v1/media/{self.media.friendly_token}/private-journal"

    def test_authenticated_user_can_create_private_journal_note(self):
        self.client.login(username="journaluser", password="testpass123")

        response = self.client.post(
            self.url,
            data={"text": "This shot is useful later.", "timestamp_seconds": 123.45},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        note = PrivateJournalNote.objects.get(media=self.media, user=self.user)
        self.assertEqual(note.text, "This shot is useful later.")
        self.assertEqual(note.timestamp_seconds, 123.45)
        self.assertEqual(response.json()["uid"], str(note.uid))

    def test_anonymous_user_cannot_create_private_journal_note(self):
        response = self.client.post(
            self.url,
            data={"text": "Hidden thought", "timestamp_seconds": 10},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(PrivateJournalNote.objects.filter(media=self.media).exists())

    def test_rejects_empty_text_after_stripping_markup(self):
        self.client.login(username="journaluser", password="testpass123")

        response = self.client.post(
            self.url,
            data={"text": "<strong></strong>", "timestamp_seconds": 10},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("text", response.json())
        self.assertFalse(PrivateJournalNote.objects.filter(media=self.media).exists())

    def test_user_only_lists_their_own_notes(self):
        own_note = PrivateJournalNote.objects.create(
            media=self.media,
            user=self.user,
            text="Mine",
            timestamp_seconds=20,
        )
        PrivateJournalNote.objects.create(
            media=self.media,
            user=self.other_user,
            text="Not mine",
            timestamp_seconds=25,
        )
        self.client.login(username="journaluser", password="testpass123")

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        results = response.json()["results"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["uid"], str(own_note.uid))
        self.assertEqual(results[0]["text"], "Mine")

    def test_media_owner_cannot_update_or_delete_other_users_note(self):
        note = PrivateJournalNote.objects.create(
            media=self.media,
            user=self.other_user,
            text="Other user's private note",
            timestamp_seconds=50,
        )
        self.client.login(username="journaluser", password="testpass123")

        response = self.client.patch(
            f"{self.url}/{note.uid}",
            data={"text": "Try to overwrite"},
            content_type="application/json",
        )
        delete_response = self.client.delete(f"{self.url}/{note.uid}")

        self.assertEqual(response.status_code, 404)
        self.assertEqual(delete_response.status_code, 404)
        note.refresh_from_db()
        self.assertEqual(note.text, "Other user's private note")

    def test_user_can_update_and_delete_their_own_note(self):
        note = PrivateJournalNote.objects.create(
            media=self.media,
            user=self.user,
            text="Original",
            timestamp_seconds=50,
        )
        self.client.login(username="journaluser", password="testpass123")

        response = self.client.patch(
            f"{self.url}/{note.uid}",
            data={"text": "Edited", "timestamp_seconds": 55},
            content_type="application/json",
        )
        delete_response = self.client.delete(f"{self.url}/{note.uid}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["text"], "Edited")
        self.assertEqual(response.json()["timestamp_seconds"], 55)
        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(PrivateJournalNote.objects.filter(pk=note.pk).exists())

    def test_rejects_private_media_without_access(self):
        private_media = create_test_media(self.user, state="private")
        self.client.login(username="otherjournaluser", password="testpass123")

        response = self.client.get(f"/api/v1/media/{private_media.friendly_token}/private-journal")

        self.assertEqual(response.status_code, 403)
