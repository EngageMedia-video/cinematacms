from unittest.mock import patch

from django.test import Client, TestCase

from files.models import Media
from users.models import User


def create_test_media(user, title, **kwargs):
    desired_state = kwargs.pop("state", None)
    with patch.object(Media, "media_init", return_value=None):
        media = Media.objects.create(title=title, user=user, **kwargs)
    if desired_state and media.state != desired_state:
        Media.objects.filter(pk=media.pk).update(state=desired_state)
        media.refresh_from_db()
    return media


class ManageMediaSearchTests(TestCase):
    """Test search filtering on /api/v1/manage_media endpoint."""

    def setUp(self):
        self.client = Client()

        self.editor = User.objects.create_user(
            username="editoruser",
            email="editor@example.com",
            password="testpass123",
        )
        self.editor.is_editor = True
        self.editor.save()

        self.regular_user = User.objects.create_user(
            username="regularuser",
            email="regular@example.com",
            password="testpass123",
        )

        self.media1 = create_test_media(
            user=self.editor,
            title="Featured Documentary",
            media_type="video",
            state="public",
        )
        self.media2 = create_test_media(
            user=self.editor,
            title="Featured Short Film",
            media_type="video",
            state="public",
        )
        self.media3 = create_test_media(
            user=self.editor,
            title="Unrelated Video",
            media_type="video",
            state="public",
        )

    def test_search_returns_matching_titles(self):
        """Search by title returns only media with matching titles."""
        self.client.login(username="editoruser", password="testpass123")
        response = self.client.get("/api/v1/manage_media?search=Featured")
        self.assertEqual(response.status_code, 200)
        results = response.json().get("results", [])
        self.assertEqual(len(results), 2)
        titles = {r["title"] for r in results}
        self.assertEqual(titles, {"Featured Documentary", "Featured Short Film"})

    def test_search_is_case_insensitive(self):
        """Search is case-insensitive."""
        self.client.login(username="editoruser", password="testpass123")
        response = self.client.get("/api/v1/manage_media?search=featured")
        self.assertEqual(response.status_code, 200)
        results = response.json().get("results", [])
        self.assertEqual(len(results), 2)

    def test_search_no_match_returns_empty(self):
        """Search with no matching title returns empty results."""
        self.client.login(username="editoruser", password="testpass123")
        response = self.client.get("/api/v1/manage_media?search=nonexistent")
        self.assertEqual(response.status_code, 200)
        results = response.json().get("results", [])
        self.assertEqual(len(results), 0)

    def test_search_combined_with_state_filter(self):
        """Search can be combined with state filter."""
        private_media = create_test_media(
            user=self.editor,
            title="Featured Private",
            media_type="video",
            state="private",
        )
        self.client.login(username="editoruser", password="testpass123")
        response = self.client.get("/api/v1/manage_media?search=Featured&state=private")
        self.assertEqual(response.status_code, 200)
        results = response.json().get("results", [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["friendly_token"], private_media.friendly_token)

    def test_empty_search_returns_all(self):
        """Empty search parameter returns all media."""
        self.client.login(username="editoruser", password="testpass123")
        response = self.client.get("/api/v1/manage_media?search=")
        self.assertEqual(response.status_code, 200)
        results = response.json().get("results", [])
        self.assertEqual(len(results), 3)

    def test_non_editor_forbidden(self):
        """Non-editor user gets 403."""
        self.client.login(username="regularuser", password="testpass123")
        response = self.client.get("/api/v1/manage_media?search=Featured")
        self.assertEqual(response.status_code, 403)
