"""
Tests for restricted media views — password entry, token issuance,
rate limiting, embed auth, and manifest rewriting.
"""

from django.test import Client, TestCase, override_settings

from files.tests.helpers import create_test_media, create_test_user
from files.token_utils import _get_brute_force_max_attempts, generate_token


class ViewMediaPasswordTest(TestCase):
    """Test the view_media password entry flow."""

    def setUp(self):
        self.client = Client()
        self.user = create_test_user()
        self.media = create_test_media(self.user, state="restricted")
        self.media.set_password("secretpass")
        self.media.save()
        self.url = f"/view?m={self.media.friendly_token}"

    def test_restricted_media_shows_password_form(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, 'type="password"')
        self.assertNotContains(resp, "media-access-token")

    def test_correct_password_issues_token(self):
        resp = self.client.post(self.url, {"password": "secretpass"})
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "media-access-token")
        self.assertNotContains(resp, "media-password")

    def test_wrong_password_shows_error(self):
        resp = self.client.post(self.url, {"password": "wrongpass"})
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "incorrect")

    def test_session_token_grants_access_on_get(self):
        # First authenticate
        self.client.post(self.url, {"password": "secretpass"})
        # Then revisit via GET
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "media-access-token")

    def test_expired_session_token_shows_form(self):
        # Set a fake stale session token
        session = self.client.session
        session[f"media_token_{self.media.friendly_token}"] = "expired-fake-token"
        session.save()

        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, 'type="password"')

    def test_owner_bypasses_password(self):
        self.client.login(username=self.user.username, password="testpass1234567890")
        resp = self.client.get(self.url)
        self.assertEqual(resp.status_code, 200)
        # Owner can see media without password
        self.assertTrue(resp.context["can_see_restricted_media"])

    def test_referrer_policy_set_on_restricted_media(self):
        resp = self.client.get(self.url)
        self.assertEqual(resp["Referrer-Policy"], "same-origin")

    def test_referrer_policy_present_on_restricted_response(self):
        """Restricted media responses must have Referrer-Policy set."""
        resp = self.client.get(self.url)
        self.assertIn("Referrer-Policy", resp)


class ViewMediaRateLimitTest(TestCase):
    """Test brute-force rate limiting on password submission."""

    def setUp(self):
        self.client = Client()
        self.user = create_test_user()
        self.media = create_test_media(self.user, state="restricted")
        self.media.set_password("correct")
        self.media.save()
        self.url = f"/view?m={self.media.friendly_token}"

    def test_rate_limit_after_max_attempts(self):
        for _ in range(_get_brute_force_max_attempts()):
            self.client.post(self.url, {"password": "wrong"})

        resp = self.client.post(self.url, {"password": "wrong"})
        self.assertContains(resp, "Too many failed attempts")

    def test_correct_password_rejected_during_lockout(self):
        for _ in range(_get_brute_force_max_attempts()):
            self.client.post(self.url, {"password": "wrong"})

        resp = self.client.post(self.url, {"password": "correct"})
        # Rate limited — correct password doesn't get checked
        self.assertTrue(resp.context.get("rate_limited"))

    @override_settings(PASSWORD_BRUTE_FORCE_MAX_ATTEMPTS=2, TRUSTED_PROXIES=("127.0.0.1",))
    def test_rate_limit_uses_forwarded_for_from_trusted_proxy(self):
        for _ in range(2):
            self.client.post(
                self.url, {"password": "wrong"}, REMOTE_ADDR="127.0.0.1", headers={"x-forwarded-for": "203.0.113.10"}
            )

        resp = self.client.post(
            self.url, {"password": "correct"}, REMOTE_ADDR="127.0.0.1", headers={"x-forwarded-for": "203.0.113.11"}
        )

        self.assertFalse(resp.context.get("rate_limited"))
        self.assertTrue(resp.context["can_see_restricted_media"])

    @override_settings(PASSWORD_BRUTE_FORCE_MAX_ATTEMPTS=2, TRUSTED_PROXIES=("127.0.0.1",))
    def test_rate_limit_ignores_forwarded_for_from_untrusted_peer(self):
        for index in range(2):
            self.client.post(
                self.url,
                {"password": "wrong"},
                REMOTE_ADDR="198.51.100.20",
                headers={"x-forwarded-for": f"203.0.113.{index}"},
            )

        resp = self.client.post(
            self.url, {"password": "correct"}, REMOTE_ADDR="198.51.100.20", headers={"x-forwarded-for": "203.0.113.99"}
        )

        self.assertTrue(resp.context.get("rate_limited"))


class MediaDetailAPITest(TestCase):
    """Test the REST API token-based access."""

    def setUp(self):
        self.client = Client()
        self.user = create_test_user()
        self.media = create_test_media(self.user, state="restricted")
        self.media.set_password("apipass")
        self.media.save()
        self.media_uid = self.media.uid.hex

    def test_api_with_valid_token(self):
        token = generate_token(self.media_uid)
        resp = self.client.get(f"/api/v1/media/{self.media.friendly_token}?token={token}")
        self.assertEqual(resp.status_code, 200)

    def test_api_without_token_returns_401(self):
        resp = self.client.get(f"/api/v1/media/{self.media.friendly_token}")
        self.assertEqual(resp.status_code, 401)

    def test_api_with_invalid_token_returns_401(self):
        resp = self.client.get(f"/api/v1/media/{self.media.friendly_token}?token=invalid")
        self.assertEqual(resp.status_code, 401)

    def test_api_password_param_no_longer_accepted(self):
        """?password= should not grant access anymore."""
        resp = self.client.get(f"/api/v1/media/{self.media.friendly_token}?password=apipass")
        self.assertEqual(resp.status_code, 401)

    def test_api_owner_bypasses_token(self):
        self.client.login(username=self.user.username, password="testpass1234567890")
        resp = self.client.get(f"/api/v1/media/{self.media.friendly_token}")
        self.assertEqual(resp.status_code, 200)

    def test_api_response_does_not_contain_password_field(self):
        token = generate_token(self.media_uid)
        resp = self.client.get(f"/api/v1/media/{self.media.friendly_token}?token={token}")
        self.assertEqual(resp.status_code, 200)
        self.assertNotIn("password", resp.json())


class EmbedMediaTest(TestCase):
    """Test embed view token validation."""

    def setUp(self):
        self.client = Client()
        self.user = create_test_user()
        self.media = create_test_media(self.user, state="restricted")
        self.media.set_password("embedpass")
        self.media.save()
        self.media_uid = self.media.uid.hex

    def test_embed_with_valid_token(self):
        token = generate_token(self.media_uid)
        resp = self.client.get(f"/embed?m={self.media.friendly_token}&token={token}")
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "media-access-token")

    def test_embed_without_token_returns_401(self):
        resp = self.client.get(f"/embed?m={self.media.friendly_token}")
        self.assertEqual(resp.status_code, 401)
        self.assertEqual(resp["Cache-Control"], "no-store")

    def test_embed_with_invalid_token_returns_401(self):
        resp = self.client.get(f"/embed?m={self.media.friendly_token}&token=invalid")
        self.assertEqual(resp.status_code, 401)

    def test_embed_public_media_no_token_needed(self):
        public_media = create_test_media(self.user, state="public")
        resp = self.client.get(f"/embed?m={public_media.friendly_token}")
        self.assertEqual(resp.status_code, 200)

    def test_embed_referrer_policy_on_restricted(self):
        token = generate_token(self.media_uid)
        resp = self.client.get(f"/embed?m={self.media.friendly_token}&token={token}")
        self.assertEqual(resp["Referrer-Policy"], "same-origin")


class PublicMediaRegressionTest(TestCase):
    """Verify public/unlisted media is not affected by token changes."""

    def setUp(self):
        self.client = Client()
        self.user = create_test_user()

    def test_public_media_accessible_without_token(self):
        media = create_test_media(self.user, state="public")
        resp = self.client.get(f"/view?m={media.friendly_token}")
        self.assertEqual(resp.status_code, 200)
        self.assertContains(resp, "page-media")

    def test_public_api_accessible_without_token(self):
        media = create_test_media(self.user, state="public")
        resp = self.client.get(f"/api/v1/media/{media.friendly_token}")
        self.assertEqual(resp.status_code, 200)
