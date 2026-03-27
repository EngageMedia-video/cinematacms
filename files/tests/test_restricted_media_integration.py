"""
Integration tests for the full restricted media flow.
Tests span multiple units: token issuance → API → file serving → invalidation.
"""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import Client, TestCase

from files.models import Media
from files.token_utils import generate_token, validate_token

User = get_user_model()


def create_test_media(user, **kwargs):
    state = kwargs.pop("state", "public")
    defaults = {
        "media_type": "video",
        "duration": 120,
        "views": 0,
        "likes": 0,
        "dislikes": 0,
        "reported_times": 0,
        "encoding_status": "success",
        "is_reviewed": True,
    }
    defaults.update(kwargs)
    with patch.object(Media, "media_init", return_value=None):
        media = Media.objects.create(title="Test", user=user, **defaults)
    Media.objects.filter(pk=media.pk).update(state=state)
    media.refresh_from_db()
    return media


class FullPasswordToTokenFlowTest(TestCase):
    """Test the complete flow: password entry → token → API access."""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username="integ_user", password="testpass1234567890")
        self.media = create_test_media(self.user, state="restricted")
        self.media.set_password("integrationpass")
        self.media.save()
        self.media_uid = self.media.uid.hex

    def test_full_flow_password_to_api(self):
        """Submit password → get token → use token for API call."""
        url = f"/view?m={self.media.friendly_token}"

        # Step 1: Submit correct password
        resp = self.client.post(url, {"password": "integrationpass"})
        self.assertEqual(resp.status_code, 200)
        self.assertTrue(resp.context["can_see_restricted_media"])
        token = resp.context["media_access_token"]
        self.assertIsNotNone(token)

        # Step 2: Use token for API call
        api_resp = self.client.get(f"/api/v1/media/{self.media.friendly_token}?token={token}")
        self.assertEqual(api_resp.status_code, 200)
        self.assertNotIn("password", api_resp.json())

    def test_session_token_reuse(self):
        """Authenticate → navigate away → return → session token grants access."""
        url = f"/view?m={self.media.friendly_token}"

        # Authenticate
        self.client.post(url, {"password": "integrationpass"})

        # Return via GET — should use session token
        resp = self.client.get(url)
        self.assertTrue(resp.context["can_see_restricted_media"])
        self.assertIsNotNone(resp.context["media_access_token"])


class TokenScopingTest(TestCase):
    """Test that tokens are scoped to specific media."""

    def setUp(self):
        self.user = User.objects.create_user(username="scope_user", password="testpass1234567890")
        self.media_a = create_test_media(self.user, state="restricted")
        self.media_a.set_password("pass_a")
        self.media_a.save()
        self.media_b = create_test_media(self.user, state="restricted")
        self.media_b.set_password("pass_b")
        self.media_b.save()

    def test_token_for_media_a_cannot_access_media_b(self):
        token_a = generate_token(self.media_a.uid.hex)
        self.assertTrue(validate_token(token_a, self.media_a.uid.hex))
        self.assertFalse(validate_token(token_a, self.media_b.uid.hex))

        client = Client()
        resp = client.get(f"/api/v1/media/{self.media_b.friendly_token}?token={token_a}")
        self.assertEqual(resp.status_code, 401)


class PasswordChangeInvalidationTest(TestCase):
    """Test that changing a password invalidates all tokens."""

    def setUp(self):
        self.user = User.objects.create_user(username="invalidation_user", password="testpass1234567890")
        self.media = create_test_media(self.user, state="restricted")
        self.media.set_password("original")
        self.media.save()
        self.media_uid = self.media.uid.hex

    def test_password_change_invalidates_tokens(self):
        token = generate_token(self.media_uid)
        self.assertTrue(validate_token(token, self.media_uid))

        # Change password
        self.media.set_password("changed")
        self.media.save()

        # Old token should be invalid
        self.assertFalse(validate_token(token, self.media_uid))

    def test_new_token_works_after_password_change(self):
        old_token = generate_token(self.media_uid)

        self.media.set_password("newpass")
        self.media.save()

        # Old token invalid
        self.assertFalse(validate_token(old_token, self.media_uid))

        # New token works
        new_token = generate_token(self.media_uid)
        self.assertTrue(validate_token(new_token, self.media_uid))


class ConcurrentAccessTest(TestCase):
    """Test multiple users with different tokens for same media."""

    def setUp(self):
        self.user = User.objects.create_user(username="concurrent_user", password="testpass1234567890")
        self.media = create_test_media(self.user, state="restricted")
        self.media.set_password("shared")
        self.media.save()
        self.media_uid = self.media.uid.hex

    def test_multiple_tokens_for_same_media(self):
        token1 = generate_token(self.media_uid)
        token2 = generate_token(self.media_uid)

        self.assertNotEqual(token1, token2)
        self.assertTrue(validate_token(token1, self.media_uid))
        self.assertTrue(validate_token(token2, self.media_uid))


class EmbedFlowTest(TestCase):
    """Test the embed authentication flow."""

    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username="embed_integ", password="testpass1234567890")
        self.media = create_test_media(self.user, state="restricted")
        self.media.set_password("embedpass")
        self.media.save()
        self.media_uid = self.media.uid.hex

    def test_embed_with_token_then_api(self):
        """Embed URL with token → embed renders → API succeeds."""
        token = generate_token(self.media_uid)

        # Embed page renders
        resp = self.client.get(f"/embed?m={self.media.friendly_token}&token={token}")
        self.assertEqual(resp.status_code, 200)

        # API call with same token
        api_resp = self.client.get(f"/api/v1/media/{self.media.friendly_token}?token={token}")
        self.assertEqual(api_resp.status_code, 200)
