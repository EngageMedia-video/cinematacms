"""
Tests for AES-128 HLS encryption (issue #472).

Covers:
- MediaKeyView endpoint (404, 403, 200 paths)
- Media.ensure_encryption_key() generation and idempotency
- Encryption toggle re-dispatching create_hls
- create_hls task encryption flag injection
"""

from unittest.mock import patch

from django.test import Client, TestCase
from django.urls import reverse

from files.models import Media
from users.models import User


def create_test_media(user, title="Test Video", **kwargs):
    """Create a Media object with media_init patched out."""
    desired_state = kwargs.pop("state", None)
    with patch.object(Media, "media_init", return_value=None):
        media = Media.objects.create(title=title, user=user, **kwargs)
    if desired_state and media.state != desired_state:
        Media.objects.filter(pk=media.pk).update(state=desired_state)
        media.refresh_from_db()
    return media


class EnsureEncryptionKeyTests(TestCase):
    """Tests for Media.ensure_encryption_key()."""

    def setUp(self):
        self.user = User.objects.create_user(username="owner", email="owner@example.com", password="pw")
        self.media = create_test_media(self.user)

    def test_generates_32_char_hex_key(self):
        key = self.media.ensure_encryption_key()
        self.assertEqual(len(key), 32)
        # Hex characters only
        int(key, 16)

    def test_returns_existing_key_without_regenerating(self):
        first_key = self.media.ensure_encryption_key()
        second_key = self.media.ensure_encryption_key()
        self.assertEqual(first_key, second_key)

    def test_persists_key_to_database(self):
        key = self.media.ensure_encryption_key()
        self.media.refresh_from_db()
        self.assertEqual(self.media.encryption_key, key)


class MediaKeyViewTests(TestCase):
    """Tests for the MediaKeyView endpoint."""

    def setUp(self):
        self.client = Client()
        self.owner = User.objects.create_user(username="owner", email="owner@example.com", password="pw")
        self.other_user = User.objects.create_user(username="other", email="other@example.com", password="pw")

    def _key_url(self, friendly_token):
        return reverse("api_get_media_key", kwargs={"friendly_token": friendly_token})

    def test_returns_404_when_media_not_found(self):
        response = self.client.get(self._key_url("nonexistent-token"))
        self.assertEqual(response.status_code, 404)

    def test_returns_404_when_media_not_encrypted(self):
        media = create_test_media(self.owner, state="public")
        response = self.client.get(self._key_url(media.friendly_token))
        self.assertEqual(response.status_code, 404)

    def test_returns_404_when_encryption_key_missing(self):
        media = create_test_media(self.owner, state="public")
        Media.objects.filter(pk=media.pk).update(is_encrypted=True, encryption_key="")
        response = self.client.get(self._key_url(media.friendly_token))
        self.assertEqual(response.status_code, 404)

    def test_returns_404_when_encryption_key_malformed(self):
        media = create_test_media(self.owner, state="public")
        # Bypass the model validator with a direct UPDATE
        Media.objects.filter(pk=media.pk).update(is_encrypted=True, encryption_key="not-hex-zzzzzzzzzzzzzzzzzzzzzzzzzzz")
        response = self.client.get(self._key_url(media.friendly_token))
        self.assertEqual(response.status_code, 404)

    def test_returns_key_for_public_encrypted_media_anonymous(self):
        media = create_test_media(self.owner, state="public")
        Media.objects.filter(pk=media.pk).update(
            is_encrypted=True,
            encryption_key="0123456789abcdef0123456789abcdef",
        )
        response = self.client.get(self._key_url(media.friendly_token))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/octet-stream")
        self.assertEqual(int(response["Content-Length"]), 16)
        self.assertEqual(len(response.content), 16)
        self.assertIn("no-store", response["Cache-Control"])

    def test_returns_403_for_private_media_anonymous(self):
        media = create_test_media(self.owner, state="private")
        Media.objects.filter(pk=media.pk).update(
            is_encrypted=True,
            encryption_key="0123456789abcdef0123456789abcdef",
        )
        response = self.client.get(self._key_url(media.friendly_token))
        self.assertEqual(response.status_code, 403)

    def test_returns_key_for_private_media_owner(self):
        media = create_test_media(self.owner, state="private")
        Media.objects.filter(pk=media.pk).update(
            is_encrypted=True,
            encryption_key="0123456789abcdef0123456789abcdef",
        )
        self.client.force_login(self.owner)
        response = self.client.get(self._key_url(media.friendly_token))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.content), 16)

    def test_returns_403_for_private_media_other_user(self):
        media = create_test_media(self.owner, state="private")
        Media.objects.filter(pk=media.pk).update(
            is_encrypted=True,
            encryption_key="0123456789abcdef0123456789abcdef",
        )
        self.client.force_login(self.other_user)
        response = self.client.get(self._key_url(media.friendly_token))
        self.assertEqual(response.status_code, 403)

    def test_decoded_key_matches_stored_hex(self):
        media = create_test_media(self.owner, state="public")
        Media.objects.filter(pk=media.pk).update(
            is_encrypted=True,
            encryption_key="0123456789abcdef0123456789abcdef",
        )
        response = self.client.get(self._key_url(media.friendly_token))
        self.assertEqual(response.content, bytes.fromhex("0123456789abcdef0123456789abcdef"))


class EncryptionToggleTests(TestCase):
    """Tests for the encryption-toggle re-dispatch path in Media.save()."""

    def setUp(self):
        self.user = User.objects.create_user(username="owner", email="owner@example.com", password="pw")

    def test_toggling_encryption_dispatches_create_hls_when_h264_exists(self):
        media = create_test_media(self.user)
        # Simulate a media with successful h264 encoding
        with patch.object(Media, "encodings") as mock_encodings:
            mock_encodings.filter.return_value.exists.return_value = True
            with patch("files.tasks.create_hls.delay") as mock_delay:
                media.is_encrypted = True
                media.save()
                mock_delay.assert_called_once_with(media.friendly_token)

    def test_toggling_encryption_does_not_dispatch_without_h264(self):
        media = create_test_media(self.user)
        with patch.object(Media, "encodings") as mock_encodings:
            mock_encodings.filter.return_value.exists.return_value = False
            with patch("files.tasks.create_hls.delay") as mock_delay:
                media.is_encrypted = True
                media.save()
                mock_delay.assert_not_called()

    def test_new_media_creation_does_not_dispatch_encryption_task(self):
        # Creating a new Media should not trigger create_hls regardless of
        # the encryption tracker default — the `is not None` guard handles this.
        with patch("files.tasks.create_hls.delay") as mock_delay:
            create_test_media(self.user)
            mock_delay.assert_not_called()

    def test_no_dispatch_when_encryption_unchanged(self):
        media = create_test_media(self.user)
        with patch("files.tasks.create_hls.delay") as mock_delay:
            media.title = "Updated title"
            media.save()
            mock_delay.assert_not_called()


class CreateHlsEncryptionFlagsTests(TestCase):
    """Tests for create_hls task injecting Bento4 encryption flags."""

    def setUp(self):
        from files.models import EncodeProfile

        self.user = User.objects.create_user(username="owner", email="owner@example.com", password="pw")
        self.profile = EncodeProfile.objects.create(name="h264_test", extension="mp4", codec="h264", resolution=720)

    def _make_media_with_encoding(self, is_encrypted=False, encryption_key=""):
        from files.models import Encoding

        media = create_test_media(self.user)
        if is_encrypted or encryption_key:
            Media.objects.filter(pk=media.pk).update(is_encrypted=is_encrypted, encryption_key=encryption_key)
            media.refresh_from_db()

        # Create an Encoding with media_file populated to a fake path so create_hls
        # has something to pass to mp4hls.
        encoding = Encoding(media=media, profile=self.profile, status="success", chunk=False)
        encoding.media_file.name = "encoded/fake.mp4"
        encoding.save()
        return media

    def _run_create_hls_capturing_cmd(self, friendly_token):
        """Run create_hls with subprocess and filesystem mocked. Returns the cmd list."""
        from django.conf import settings as django_settings

        from files import tasks

        with patch("files.tasks.subprocess.run") as mock_run, patch("files.tasks.os.path.exists") as mock_exists:
            # mp4hls binary check returns True; HLS output dir returns False
            # so we skip the cp -rT branch.
            def exists_side_effect(path):
                return path == getattr(django_settings, "MP4HLS_COMMAND", "")

            mock_exists.side_effect = exists_side_effect
            tasks.create_hls(friendly_token)

            if not mock_run.call_args_list:
                return None
            return mock_run.call_args_list[0][0][0]

    def test_omits_encryption_flags_when_not_encrypted(self):
        media = self._make_media_with_encoding(is_encrypted=False)
        cmd = self._run_create_hls_capturing_cmd(media.friendly_token)
        self.assertIsNotNone(cmd)
        self.assertNotIn("--encryption-mode=AES-128", cmd)
        self.assertFalse(any(arg.startswith("--encryption-key=") for arg in cmd))

    def test_includes_encryption_flags_when_encrypted(self):
        media = self._make_media_with_encoding(
            is_encrypted=True,
            encryption_key="0123456789abcdef0123456789abcdef",
        )
        cmd = self._run_create_hls_capturing_cmd(media.friendly_token)
        self.assertIsNotNone(cmd)
        self.assertIn("--encryption-key=0123456789abcdef0123456789abcdef", cmd)
        self.assertIn("--encryption-mode=AES-128", cmd)

    def test_key_uri_is_root_relative(self):
        media = self._make_media_with_encoding(
            is_encrypted=True,
            encryption_key="0123456789abcdef0123456789abcdef",
        )
        cmd = self._run_create_hls_capturing_cmd(media.friendly_token)
        self.assertIsNotNone(cmd)
        key_uri_flag = next(arg for arg in cmd if arg.startswith("--encryption-key-uri="))
        key_uri = key_uri_flag.split("=", 1)[1]
        # Must be root-relative, not an absolute URL
        self.assertTrue(key_uri.startswith("/"), f"Expected root-relative URI, got: {key_uri}")
        self.assertFalse(key_uri.startswith("http"), f"URI should not be absolute, got: {key_uri}")
        self.assertIn(media.friendly_token, key_uri)
