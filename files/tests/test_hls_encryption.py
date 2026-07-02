"""
Tests for AES-128 HLS encryption (issue #472).

Covers:
- MediaKeyView endpoint (404, 403, 200 paths)
- Media.ensure_encryption_key() generation and idempotency
- Encryption toggle re-dispatching create_hls
- create_hls task encryption flag injection
- create_hls versioned output directory / cache-busting (issue #791)
"""

import os
import tempfile
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.test import Client, TestCase, override_settings
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
        Media.objects.filter(pk=media.pk).update(is_encrypted=True, encryption_key="z" * 32)
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


class CreateHlsVersionedDirectoryTests(TestCase):
    """Tests create_hls writing to HLS_DIR/<uid>/<version>/ (issue #791)."""

    def setUp(self):
        from files.models import EncodeProfile, Encoding

        self.tmpdir = tempfile.TemporaryDirectory()
        self.hls_dir = os.path.join(self.tmpdir.name, "hls")
        os.makedirs(self.hls_dir, exist_ok=True)
        self.fake_mp4hls = os.path.join(self.tmpdir.name, "mp4hls")
        with open(self.fake_mp4hls, "w", encoding="utf-8") as command_file:
            command_file.write("#!/bin/sh\n")

        self.override = override_settings(
            MEDIA_ROOT=self.tmpdir.name,
            HLS_DIR=self.hls_dir,
            TEMP_DIRECTORY=self.tmpdir.name,
            MP4HLS_COMMAND=self.fake_mp4hls,
        )
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.addCleanup(self.tmpdir.cleanup)
        cache.clear()

        self.user = User.objects.create_user(username="owner", email="owner@example.com", password="pw")
        self.profile = EncodeProfile.objects.create(name="h264_test", extension="mp4", codec="h264", resolution=720)
        self.media = create_test_media(self.user)
        self.encoding = Encoding.objects.create(
            media=self.media,
            profile=self.profile,
            status="success",
            media_file="encoded/fake.mp4",
        )

    @staticmethod
    def _fake_run_writing_master(command, capture_output, timeout=None):
        output_dir = next(
            (part.removeprefix("--output-dir=") for part in command if part.startswith("--output-dir=")),
            None,
        )
        os.makedirs(output_dir, exist_ok=True)
        with open(os.path.join(output_dir, "master.m3u8"), "wb") as master_file:
            master_file.write(b"content")
        return MagicMock(returncode=0)

    @staticmethod
    def _fake_run_producing_nothing(command, capture_output, timeout=None):
        return MagicMock(returncode=1)

    @staticmethod
    def _fake_run_failing_after_master(command, capture_output, timeout=None):
        output_dir = next(
            (part.removeprefix("--output-dir=") for part in command if part.startswith("--output-dir=")),
            None,
        )
        os.makedirs(output_dir, exist_ok=True)
        with open(os.path.join(output_dir, "master.m3u8"), "wb") as master_file:
            master_file.write(b"incomplete")
        return MagicMock(returncode=1)

    def test_first_generation_writes_versioned_directory(self):
        from files import tasks

        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))

        self.media.refresh_from_db()
        uid_dir = os.path.join(self.hls_dir, self.media.uid.hex)
        self.assertTrue(self.media.hls_file.startswith(uid_dir + os.sep))
        self.assertNotEqual(os.path.dirname(self.media.hls_file), uid_dir)
        self.assertTrue(os.path.exists(self.media.hls_file))

    def test_regeneration_removes_previous_version_directory(self):
        from files import tasks

        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))
        self.media.refresh_from_db()
        first_dir = os.path.dirname(self.media.hls_file)

        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))
        self.media.refresh_from_db()
        second_dir = os.path.dirname(self.media.hls_file)

        self.assertNotEqual(first_dir, second_dir)
        self.assertFalse(os.path.exists(first_dir))
        self.assertTrue(os.path.exists(second_dir))

        uid_dir = os.path.join(self.hls_dir, self.media.uid.hex)
        self.assertEqual(os.listdir(uid_dir), [os.path.basename(second_dir)])

    def test_regeneration_removes_legacy_flat_layout_siblings(self):
        from files import tasks

        uid_dir = os.path.join(self.hls_dir, self.media.uid.hex)
        os.makedirs(uid_dir, exist_ok=True)
        legacy_master = os.path.join(uid_dir, "master.m3u8")
        with open(legacy_master, "wb") as f:
            f.write(b"legacy")
        Media.objects.filter(pk=self.media.pk).update(hls_file=legacy_master)

        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))

        self.assertFalse(os.path.exists(legacy_master))
        self.media.refresh_from_db()
        self.assertTrue(os.path.exists(self.media.hls_file))

    def test_mp4hls_failure_leaves_previous_hls_file_untouched(self):
        from files import tasks

        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))
        self.media.refresh_from_db()
        good_hls_file = self.media.hls_file

        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_producing_nothing):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))

        self.media.refresh_from_db()
        self.assertEqual(self.media.hls_file, good_hls_file)
        self.assertTrue(os.path.exists(good_hls_file))

    def test_mp4hls_nonzero_with_master_discards_partial_output(self):
        from files import tasks

        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))
        self.media.refresh_from_db()
        good_hls_file = self.media.hls_file

        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_failing_after_master):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))

        self.media.refresh_from_db()
        self.assertEqual(self.media.hls_file, good_hls_file)
        uid_dir = os.path.join(self.hls_dir, self.media.uid.hex)
        self.assertEqual(os.listdir(uid_dir), [os.path.basename(os.path.dirname(good_hls_file))])

    def test_concurrent_run_marks_pending_when_lock_held(self):
        from files import tasks

        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))
        self.media.refresh_from_db()
        hls_file_before = self.media.hls_file
        dir_before = os.path.dirname(hls_file_before)

        lock_key = f"create_hls_lock_{self.media.uid.hex}"
        pending_key = f"create_hls_pending_{self.media.uid.hex}"
        cache.add(lock_key, "1", timeout=tasks.HLS_LOCK_TIMEOUT)
        try:
            with (
                patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master) as mock_run,
                patch("files.tasks.create_hls.apply_async") as mock_apply_async,
            ):
                self.assertTrue(tasks.create_hls(self.media.friendly_token))
            mock_run.assert_not_called()
            mock_apply_async.assert_not_called()
            self.assertEqual(cache.get(pending_key), "1")
        finally:
            cache.delete(lock_key)
            cache.delete(pending_key)

        self.media.refresh_from_db()
        self.assertEqual(self.media.hls_file, hls_file_before)
        self.assertTrue(os.path.exists(dir_before))

    def test_pending_overlap_schedules_follow_up_after_lock_release(self):
        from files import tasks

        pending_key = f"create_hls_pending_{self.media.uid.hex}"
        cache.set(pending_key, "1", timeout=tasks.HLS_PENDING_RETRY_TIMEOUT)

        with (
            patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master),
            patch("files.tasks.create_hls.apply_async") as mock_apply_async,
        ):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))

        mock_apply_async.assert_called_once_with(args=[self.media.friendly_token])
        self.assertIsNone(cache.get(pending_key))

    def test_removal_stays_within_uid_directory(self):
        from files import tasks

        other_uid_dir = os.path.join(self.hls_dir, "0" * 32)
        os.makedirs(other_uid_dir, exist_ok=True)
        sentinel = os.path.join(other_uid_dir, "master.m3u8")
        with open(sentinel, "wb") as f:
            f.write(b"other media, do not touch")

        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))

        self.assertTrue(os.path.exists(sentinel))
