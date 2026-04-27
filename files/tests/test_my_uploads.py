import json
from unittest.mock import patch

from django.test import Client, TestCase

from files.methods import can_manage_uploads
from files.models import Media
from users.models import User


def create_test_media(user, title, **kwargs):
    """Create a Media object with media_init patched out to avoid file processing.

    Note: Media.save() overrides state on creation via get_default_state(),
    so we set state after creation if provided.
    """
    desired_state = kwargs.pop("state", None)
    with patch.object(Media, "media_init", return_value=None):
        media = Media.objects.create(title=title, user=user, **kwargs)
    if desired_state and media.state != desired_state:
        Media.objects.filter(pk=media.pk).update(state=desired_state)
        media.refresh_from_db()
    return media


class MyUploadsPermissionTests(TestCase):
    """Test permission checks for Manage Uploads feature."""

    def setUp(self):
        self.client = Client()

        self.regular_user = User.objects.create_user(
            username="regularuser",
            email="regular@example.com",
            password="testpass123",
        )

        self.trusted_user = User.objects.create_user(
            username="trusteduser",
            email="trusted@example.com",
            password="testpass123",
        )
        self.trusted_user.advancedUser = True
        self.trusted_user.save()

        self.editor_user = User.objects.create_user(
            username="editoruser",
            email="editor@example.com",
            password="testpass123",
        )
        self.editor_user.is_editor = True
        self.editor_user.save()

        self.manager_user = User.objects.create_user(
            username="manageruser",
            email="manager@example.com",
            password="testpass123",
        )
        self.manager_user.is_manager = True
        self.manager_user.save()

        self.superuser = User.objects.create_superuser(
            username="superuser",
            email="super@example.com",
            password="testpass123",
        )

    def test_can_manage_uploads_helper(self):
        """Test can_manage_uploads returns correct values for each role."""
        self.assertFalse(can_manage_uploads(self.regular_user))
        self.assertTrue(can_manage_uploads(self.trusted_user))
        self.assertTrue(can_manage_uploads(self.editor_user))
        self.assertTrue(can_manage_uploads(self.manager_user))
        self.assertTrue(can_manage_uploads(self.superuser))

    def test_page_anonymous_redirect(self):
        """Anonymous user is redirected from manage uploads page."""
        response = self.client.get("/manage/uploads")
        self.assertEqual(response.status_code, 302)

    def test_page_regular_user_redirect(self):
        """Regular user is redirected from manage uploads page."""
        self.client.login(username="regularuser", password="testpass123")
        response = self.client.get("/manage/uploads")
        self.assertEqual(response.status_code, 302)

    def test_page_trusted_user_allowed(self):
        """Trusted user can access manage uploads page."""
        self.client.login(username="trusteduser", password="testpass123")
        response = self.client.get("/manage/uploads")
        self.assertEqual(response.status_code, 200)

    def test_api_anonymous_forbidden(self):
        """Anonymous user gets 403 on API."""
        response = self.client.get("/api/v1/my_uploads")
        self.assertEqual(response.status_code, 403)

    def test_api_regular_user_forbidden(self):
        """Regular user gets 403 on API."""
        self.client.login(username="regularuser", password="testpass123")
        response = self.client.get("/api/v1/my_uploads")
        self.assertEqual(response.status_code, 403)

    def test_api_trusted_user_allowed(self):
        """Trusted user can access API."""
        self.client.login(username="trusteduser", password="testpass123")
        response = self.client.get("/api/v1/my_uploads")
        self.assertEqual(response.status_code, 200)

    def test_api_editor_allowed(self):
        """Editor can access API."""
        self.client.login(username="editoruser", password="testpass123")
        response = self.client.get("/api/v1/my_uploads")
        self.assertEqual(response.status_code, 200)

    def test_api_superuser_allowed(self):
        """Superuser can access API."""
        self.client.login(username="superuser", password="testpass123")
        response = self.client.get("/api/v1/my_uploads")
        self.assertEqual(response.status_code, 200)


class MyUploadsOwnershipTests(TestCase):
    """Test that users can only see/modify their own uploads."""

    def setUp(self):
        self.client = Client()

        self.user_a = User.objects.create_user(
            username="usera",
            email="usera@example.com",
            password="testpass123",
        )
        self.user_a.advancedUser = True
        self.user_a.save()

        self.user_b = User.objects.create_user(
            username="userb",
            email="userb@example.com",
            password="testpass123",
        )
        self.user_b.advancedUser = True
        self.user_b.save()

        # Create media for user_a
        self.media_a1 = create_test_media(
            user=self.user_a,
            title="User A Video 1",
            media_type="video",
            state="public",
        )
        self.media_a2 = create_test_media(
            user=self.user_a,
            title="User A Video 2",
            media_type="video",
            state="private",
        )

        # Create media for user_b
        self.media_b1 = create_test_media(
            user=self.user_b,
            title="User B Video 1",
            media_type="video",
            state="public",
        )

    def test_user_only_sees_own_uploads(self):
        """User A only sees their own uploads."""
        self.client.login(username="usera", password="testpass123")
        response = self.client.get("/api/v1/my_uploads")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        results = data.get("results", [])
        self.assertEqual(len(results), 2)
        tokens = [r["friendly_token"] for r in results]
        self.assertIn(self.media_a1.friendly_token, tokens)
        self.assertIn(self.media_a2.friendly_token, tokens)
        self.assertNotIn(self.media_b1.friendly_token, tokens)

    def test_user_b_only_sees_own_uploads(self):
        """User B only sees their own uploads."""
        self.client.login(username="userb", password="testpass123")
        response = self.client.get("/api/v1/my_uploads")
        data = response.json()
        results = data.get("results", [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["friendly_token"], self.media_b1.friendly_token)

    def test_filter_by_state(self):
        """Filtering by state returns correct subset."""
        self.client.login(username="usera", password="testpass123")
        response = self.client.get("/api/v1/my_uploads?state=private")
        data = response.json()
        results = data.get("results", [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["friendly_token"], self.media_a2.friendly_token)

    def test_search_by_title(self):
        """Searching by title returns matching items."""
        self.client.login(username="usera", password="testpass123")
        response = self.client.get("/api/v1/my_uploads?search=Video 1")
        data = response.json()
        results = data.get("results", [])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["friendly_token"], self.media_a1.friendly_token)


class MyUploadsBulkDeleteTests(TestCase):
    """Test bulk delete with ownership verification."""

    def setUp(self):
        self.client = Client()

        self.user_a = User.objects.create_user(
            username="usera",
            email="usera@example.com",
            password="testpass123",
        )
        self.user_a.advancedUser = True
        self.user_a.save()

        self.user_b = User.objects.create_user(
            username="userb",
            email="userb@example.com",
            password="testpass123",
        )
        self.user_b.advancedUser = True
        self.user_b.save()

        self.media_a = create_test_media(
            user=self.user_a,
            title="User A Video",
            media_type="video",
        )
        self.media_b = create_test_media(
            user=self.user_b,
            title="User B Video",
            media_type="video",
        )

    def test_delete_own_media(self):
        """User can delete their own media."""
        self.client.login(username="usera", password="testpass123")
        token = self.media_a.friendly_token
        response = self.client.delete(f"/api/v1/my_uploads?tokens={token}")
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Media.objects.filter(friendly_token=token).exists())

    def test_cannot_delete_other_users_media(self):
        """User cannot delete another user's media — returns 400."""
        self.client.login(username="usera", password="testpass123")
        token_b = self.media_b.friendly_token
        response = self.client.delete(f"/api/v1/my_uploads?tokens={token_b}")
        self.assertEqual(response.status_code, 400)
        # User B's media should still exist
        self.assertTrue(Media.objects.filter(friendly_token=token_b).exists())


class MyUploadsBulkStateTests(TestCase):
    """Test bulk state change with ownership verification."""

    def setUp(self):
        self.client = Client()

        self.user_a = User.objects.create_user(
            username="usera",
            email="usera@example.com",
            password="testpass123",
        )
        self.user_a.advancedUser = True
        self.user_a.save()

        self.user_b = User.objects.create_user(
            username="userb",
            email="userb@example.com",
            password="testpass123",
        )
        self.user_b.advancedUser = True
        self.user_b.save()

        self.media_a1 = create_test_media(
            user=self.user_a,
            title="User A Video 1",
            media_type="video",
            state="public",
        )
        self.media_a2 = create_test_media(
            user=self.user_a,
            title="User A Video 2",
            media_type="video",
            state="public",
        )
        self.media_b = create_test_media(
            user=self.user_b,
            title="User B Video",
            media_type="video",
            state="public",
        )

    def test_bulk_state_change_own_media(self):
        """User can change state of their own media."""
        self.client.login(username="usera", password="testpass123")
        response = self.client.post(
            "/api/v1/my_uploads/bulk_state",
            data=json.dumps(
                {
                    "tokens": [self.media_a1.friendly_token, self.media_a2.friendly_token],
                    "state": "private",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["updated"], 2)

        self.media_a1.refresh_from_db()
        self.media_a2.refresh_from_db()
        self.assertEqual(self.media_a1.state, "private")
        self.assertEqual(self.media_a2.state, "private")

    def test_cannot_change_state_of_other_users_media(self):
        """User cannot change state of another user's media — count mismatch returns 400."""
        self.client.login(username="usera", password="testpass123")
        response = self.client.post(
            "/api/v1/my_uploads/bulk_state",
            data=json.dumps(
                {
                    "tokens": [self.media_b.friendly_token],
                    "state": "private",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

        # User B's media should still be public
        self.media_b.refresh_from_db()
        self.assertEqual(self.media_b.state, "public")

    def test_mixed_tokens_rejected(self):
        """Request with mix of own and other user's tokens is rejected."""
        self.client.login(username="usera", password="testpass123")
        response = self.client.post(
            "/api/v1/my_uploads/bulk_state",
            data=json.dumps(
                {
                    "tokens": [self.media_a1.friendly_token, self.media_b.friendly_token],
                    "state": "private",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

        # Neither media should have changed
        self.media_a1.refresh_from_db()
        self.media_b.refresh_from_db()
        self.assertEqual(self.media_a1.state, "public")
        self.assertEqual(self.media_b.state, "public")

    def test_invalid_state_rejected(self):
        """Invalid state value is rejected."""
        self.client.login(username="usera", password="testpass123")
        response = self.client.post(
            "/api/v1/my_uploads/bulk_state",
            data=json.dumps(
                {
                    "tokens": [self.media_a1.friendly_token],
                    "state": "restricted",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)

    def test_empty_tokens_rejected(self):
        """Empty tokens list is rejected."""
        self.client.login(username="usera", password="testpass123")
        response = self.client.post(
            "/api/v1/my_uploads/bulk_state",
            data=json.dumps(
                {
                    "tokens": [],
                    "state": "private",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
