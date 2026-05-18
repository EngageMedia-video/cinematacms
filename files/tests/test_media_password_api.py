"""Tests for the MediaPasswordView API endpoint."""

import json

from django.test import TestCase, override_settings

from files.tests.helpers import create_test_media, create_test_user
from files.token_utils import _get_brute_force_max_attempts


@override_settings(CELERY_TASK_ALWAYS_EAGER=True)
class MediaPasswordAPITest(TestCase):
    """Test POST /api/v1/media/{friendly_token}/password."""

    def setUp(self):
        self.user = create_test_user()
        self.media = create_test_media(self.user, state="restricted")
        self.media.set_password("secretpass")
        self.media.save()

    def _url(self, token=None):
        return f"/api/v1/media/{token or self.media.friendly_token}/password"

    def _post(self, password=None, token=None, **kwargs):
        data = {}
        if password is not None:
            data["password"] = password
        return self.client.post(
            self._url(token),
            data=json.dumps(data),
            content_type="application/json",
            **kwargs,
        )

    def test_correct_password_returns_token(self):
        resp = self._post("secretpass")
        self.assertEqual(resp.status_code, 200)
        self.assertIn("token", resp.json())

    def test_wrong_password_returns_403(self):
        resp = self._post("wrong")
        self.assertEqual(resp.status_code, 403)
        self.assertIn("incorrect", resp.json()["detail"].lower())

    def test_missing_password_returns_400(self):
        resp = self._post()
        self.assertEqual(resp.status_code, 400)

    def test_non_restricted_media_returns_400(self):
        public_media = create_test_media(self.user, state="public")
        resp = self._post("secretpass", token=public_media.friendly_token)
        self.assertEqual(resp.status_code, 400)

    def test_nonexistent_media_returns_404(self):
        resp = self._post("secretpass", token="nonexistent-token-xyz")
        self.assertEqual(resp.status_code, 404)

    def test_owner_bypass_no_password_needed(self):
        self.client.force_login(self.user)
        resp = self._post()
        self.assertEqual(resp.status_code, 200)
        self.assertIn("token", resp.json())

    def test_token_stored_in_session(self):
        resp = self._post("secretpass")
        self.assertEqual(resp.status_code, 200)
        session = self.client.session
        self.assertIn(f"media_token_{self.media.friendly_token}", session)

    def test_rate_limit_returns_429(self):
        max_attempts = _get_brute_force_max_attempts()
        for _ in range(max_attempts):
            self._post("wrong")
        resp = self._post("wrong")
        self.assertEqual(resp.status_code, 429)
        self.assertIn("too many", resp.json()["detail"].lower())
