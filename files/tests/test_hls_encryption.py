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
import subprocess
import tempfile
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.db import connection
from django.test import Client, TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.urls import reverse

from files.models import Category, Language, Media
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


def _jpeg_bytes():
    """Smallest real JPEG, for ProcessedImageField saves that run bytes through PIL."""
    import io

    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (1, 1)).save(buf, format="JPEG")
    return buf.getvalue()


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
        uid_rel = os.path.join("hls", self.media.uid.hex)
        self.assertFalse(os.path.isabs(self.media.hls_file))
        self.assertTrue(self.media.hls_file.startswith(uid_rel + os.sep))
        self.assertNotEqual(os.path.dirname(self.media.hls_file), uid_rel)
        self.assertTrue(os.path.exists(self.media.hls_file_path))

    def test_regeneration_removes_previous_version_directory(self):
        from files import tasks

        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))
        self.media.refresh_from_db()
        first_dir = os.path.dirname(self.media.hls_file_path)

        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))
        self.media.refresh_from_db()
        second_dir = os.path.dirname(self.media.hls_file_path)

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
        self.assertTrue(os.path.exists(self.media.hls_file_path))

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
        self.assertTrue(os.path.exists(self.media.hls_file_path))

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

    @staticmethod
    def _fake_timeout(command, capture_output, timeout=None):
        output_dir = next(
            (part.removeprefix("--output-dir=") for part in command if part.startswith("--output-dir=")),
            None,
        )
        os.makedirs(output_dir, exist_ok=True)
        with open(os.path.join(output_dir, "master.m3u8"), "wb") as master_file:
            master_file.write(b"incomplete")
        raise subprocess.TimeoutExpired(cmd=command, timeout=timeout)

    def test_mp4hls_timeout_discards_partial_output_and_schedules_delayed_retry(self):
        from files import tasks

        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))
        self.media.refresh_from_db()
        good_hls_file = self.media.hls_file

        with (
            patch("files.tasks.subprocess.run", side_effect=self._fake_timeout),
            patch("files.tasks.create_hls.apply_async") as mock_apply_async,
        ):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))

        self.media.refresh_from_db()
        self.assertEqual(self.media.hls_file, good_hls_file)
        uid_dir = os.path.join(self.hls_dir, self.media.uid.hex)
        self.assertEqual(os.listdir(uid_dir), [os.path.basename(os.path.dirname(good_hls_file))])
        # Timeout retries are bounded and delayed, not the immediate overlap retry.
        mock_apply_async.assert_called_once_with(
            args=[self.media.friendly_token],
            countdown=tasks.HLS_TIMEOUT_RETRY_DELAY,
        )

    def test_mp4hls_timeout_retries_are_bounded(self):
        from files import tasks

        # Every run times out. The retry must stop after HLS_TIMEOUT_MAX_RETRIES
        # so a deterministically-too-large input cannot loop a worker forever.
        with patch("files.tasks.subprocess.run", side_effect=self._fake_timeout):
            for _ in range(tasks.HLS_TIMEOUT_MAX_RETRIES + 3):
                with patch("files.tasks.create_hls.apply_async") as mock_apply_async:
                    self.assertTrue(tasks.create_hls(self.media.friendly_token))
                # Record whether this attempt scheduled a follow-up run.
                if mock_apply_async.call_count == 0:
                    break

        # After the bound is reached the retry key is cleared and no run queued.
        timeout_retry_key = f"create_hls_timeout_retries_{self.media.uid.hex}"
        self.assertIsNone(cache.get(timeout_retry_key))
        self.assertEqual(mock_apply_async.call_count, 0)

    def test_successful_generation_clears_timeout_backoff(self):
        from files import tasks

        timeout_retry_key = f"create_hls_timeout_retries_{self.media.uid.hex}"
        with (
            patch("files.tasks.subprocess.run", side_effect=self._fake_timeout),
            patch("files.tasks.create_hls.apply_async"),
        ):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))
        self.assertEqual(cache.get(timeout_retry_key), 1)

        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))
        self.assertIsNone(cache.get(timeout_retry_key))

    def test_expired_lock_discards_stale_output_and_schedules_retry(self):
        from files import tasks

        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))
        self.media.refresh_from_db()
        good_hls_file = self.media.hls_file
        lock_key = f"create_hls_lock_{self.media.uid.hex}"

        def fake_run_after_lock_expired(command, capture_output, timeout=None):
            cache.delete(lock_key)
            return self._fake_run_writing_master(command, capture_output, timeout=timeout)

        with (
            patch("files.tasks.subprocess.run", side_effect=fake_run_after_lock_expired),
            patch("files.tasks.create_hls.apply_async") as mock_apply_async,
        ):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))

        self.media.refresh_from_db()
        self.assertEqual(self.media.hls_file, good_hls_file)
        uid_dir = os.path.join(self.hls_dir, self.media.uid.hex)
        self.assertEqual(os.listdir(uid_dir), [os.path.basename(os.path.dirname(good_hls_file))])
        mock_apply_async.assert_called_once_with(args=[self.media.friendly_token])

    def test_concurrent_run_marks_pending_when_lock_held(self):
        from files import tasks

        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))
        self.media.refresh_from_db()
        hls_file_before = self.media.hls_file
        dir_before = os.path.dirname(self.media.hls_file_path)

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


class HlsInfoVersionParameterTests(TestCase):
    """The ?v= on HLS URLs must track the HLS generation, not edit_date (issue #791).

    create_hls commits the new playlist with save(update_fields=["hls_file"]), which
    never writes the auto_now edit_date. A ?v= derived from edit_date therefore stays
    frozen across regenerations and busts nothing.
    """

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

        self.user = User.objects.create_user(username="owner2", email="owner2@example.com", password="pw")
        self.profile = EncodeProfile.objects.create(name="h264_v", extension="mp4", codec="h264", resolution=720)
        self.media = create_test_media(self.user)
        Encoding.objects.create(
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
        with open(os.path.join(output_dir, "master.m3u8"), "w", encoding="utf-8") as master_file:
            master_file.write("#EXTM3U\n#EXT-X-VERSION:4\n")
        return MagicMock(returncode=0)

    def _generate_and_read_master_url(self):
        from files import tasks

        cache.clear()
        with patch("files.tasks.subprocess.run", side_effect=self._fake_run_writing_master):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))
        # Re-fetch: hls_info and hls_version are cached_property.
        fresh = Media.objects.get(pk=self.media.pk)
        return fresh, fresh.hls_info["master_file"]

    def test_version_param_is_the_generation_directory(self):
        fresh, master_url = self._generate_and_read_master_url()
        version_dir = os.path.basename(os.path.dirname(fresh.hls_file))
        self.assertEqual(fresh.hls_version, version_dir)
        self.assertIn(f"?v={version_dir}", master_url)

    def test_version_param_changes_on_regeneration(self):
        first, first_url = self._generate_and_read_master_url()
        second, second_url = self._generate_and_read_master_url()

        self.assertNotEqual(first.hls_file, second.hls_file)
        self.assertNotEqual(first_url, second_url)

        # The regression: edit_date does not move, so a media_version-derived ?v=
        # would have been identical across both generations.
        self.assertEqual(first.media_version, second.media_version)


class EncryptionKeyLostUpdateTests(TestCase):
    """Regression tests for issue #840: stale instances blanking encryption_key.

    Media.save() without update_fields writes every concrete column from
    in-memory state. An instance loaded before create_hls generated the key
    carries encryption_key="" and would write that blank back over the stored
    key, leaving is_encrypted=True and no key -- unrecoverable, since the .ts
    segments are already encrypted with it.
    """

    def setUp(self):
        self.user = User.objects.create_user(username="owner", email="owner@example.com", password="pw")
        # MediaForm requires a category, a language and a country to validate.
        self.category = Category.objects.first() or Category.objects.create(
            title="Test Category", user=self.user, is_global=True
        )
        Language.objects.get_or_create(code="en", defaults={"title": "English"})

    def _form_payload(self, **overrides):
        """A fully valid MediaForm payload, mirroring test_media_forms._get_form_data."""
        data = {
            "title": "Test",
            "state": "public",
            "summary": "test summary",
            "description": "test description",
            "media_language": "en",
            "media_country": "AU",
            "category": [self.category.id],
            "topics": [],
            "new_tags": "",
            "year_produced": "2025",
            "enable_comments": True,
            "allow_download": True,
            "is_encrypted": True,
        }
        data.update(overrides)
        return data

    def _encrypted_media_with_stale_instance(self):
        """Return (stale, key): an instance loaded before the key was written."""
        # media_type="video": MediaForm drops the is_encrypted field otherwise.
        media = create_test_media(self.user, is_encrypted=True, media_type="video")
        # Loaded while encryption_key was still blank, as a uWSGI worker or a
        # Celery task holding the row across a long encode would be.
        stale = Media.objects.get(pk=media.pk)
        # Meanwhile create_hls generates and stores the key on its own instance.
        key = Media.objects.get(pk=media.pk).ensure_encryption_key()
        self.assertTrue(key)
        self.assertEqual(stale.encryption_key, "")
        return stale, key

    def _stored_key(self, media):
        return Media.objects.filter(pk=media.pk).values_list("encryption_key", flat=True).first()

    def test_stale_full_row_saves_preserve_key(self):
        """Every full-row write path leaves the stored key intact."""
        from django.core.files.base import ContentFile

        from files.draft_utils import apply_media_draft

        def plain_save(stale):
            stale.save()

        def sprites_save(stale):
            # files/sprites.py:198 -- the path confirmed live in issue #840.
            stale.sprites.save(content=ContentFile(b"sprite-bytes"), name="sprites.jpg")

        def thumbnail_and_poster_save(stale):
            # files/models.py:745-746, the set_thumbnail / produce_thumbnails pair.
            # These are ProcessedImageFields, so the bytes must decode as an image.
            stale.thumbnail.save(content=ContentFile(_jpeg_bytes()), name="thumb.jpg")
            stale.poster.save(content=ContentFile(_jpeg_bytes()), name="poster.jpg")

        def media_form_save(stale):
            # files/forms.py:363,366 -- MediaForm lists is_encrypted but not
            # encryption_key, so a plain admin edit is a non-race trigger that
            # needs no concurrency at all.
            from files.forms import MediaForm

            form = MediaForm(self.user, instance=stale, data=self._form_payload(title="Edited via form"))
            self.assertTrue(form.is_valid(), f"Form errors: {form.errors}")
            form.save()

        def draft_save(stale):
            # files/draft_utils.py:88
            apply_media_draft(stale, {"title": "Draft title"}, self.user)

        def update_fields_save(stale):
            # Already safe today; pinned so the safe path cannot regress.
            stale.title = "Renamed"
            stale.save(update_fields=["title"])

        cases = [
            ("plain full save", plain_save),
            ("sprites.save", sprites_save),
            ("thumbnail and poster save", thumbnail_and_poster_save),
            ("MediaForm save", media_form_save),
            ("apply_media_draft", draft_save),
            ("save with update_fields", update_fields_save),
        ]

        for name, write in cases:
            with self.subTest(case=name):
                stale, key = self._encrypted_media_with_stale_instance()
                write(stale)
                self.assertEqual(
                    self._stored_key(stale),
                    key,
                    f"{name} blanked encryption_key on an encrypted media",
                )

    def test_intentional_disable_clears_key(self):
        """Turning encryption off must still be able to clear the key."""
        media = create_test_media(self.user, is_encrypted=True)
        media.ensure_encryption_key()

        fresh = Media.objects.get(pk=media.pk)
        fresh.is_encrypted = False
        fresh.encryption_key = ""
        fresh.save()

        self.assertEqual(self._stored_key(media), "")

    def test_unencrypted_media_gets_no_key_invented(self):
        media = create_test_media(self.user, is_encrypted=False)
        media.title = "Renamed"
        media.save()

        self.assertEqual(self._stored_key(media), "")

    def test_guard_is_noop_when_key_present_in_memory(self):
        media = create_test_media(self.user, is_encrypted=True)
        key = media.ensure_encryption_key()

        media.title = "Renamed"
        media.save()

        self.assertEqual(self._stored_key(media), key)
        self.assertEqual(media.encryption_key, key)

    def test_ensure_encryption_key_stays_idempotent(self):
        media = create_test_media(self.user, is_encrypted=True)
        first = media.ensure_encryption_key()
        second = media.ensure_encryption_key()

        self.assertEqual(first, second)
        self.assertEqual(self._stored_key(media), first)

    def _guard_reads(self, media):
        """Count the guard's key re-reads during one full-row save.

        The guard is the only caller that selects encryption_key on its own, so
        its deferred-column SELECT is distinguishable from the full-row loads
        Media.save() already makes. Counting that one query instead of asserting
        a total keeps the test pinned to the guard rather than to unrelated
        query churn elsewhere in save().
        """
        with CaptureQueriesContext(connection) as ctx:
            media.title = "Renamed"
            media.save()
        return len(
            [q for q in ctx.captured_queries if 'SELECT "files_media"."encryption_key" AS "encryption_key"' in q["sql"]]
        )

    def test_guard_costs_one_query_only_on_the_stale_path(self):
        """The re-read fires once when it must, and never otherwise.

        Nothing but this test stops someone hoisting the re-read above the
        is_encrypted check, which would charge every Media.save() in the
        codebase an extra query to protect a column almost none of them touch.
        """
        stale, _ = self._encrypted_media_with_stale_instance()

        # media_type matches the stale fixture: post-save notification work
        # differs by type, and only the guard's own query is being measured.
        encrypted_with_key = create_test_media(self.user, is_encrypted=True, media_type="video")
        encrypted_with_key.ensure_encryption_key()
        encrypted_with_key = Media.objects.get(pk=encrypted_with_key.pk)

        unencrypted = create_test_media(self.user, is_encrypted=False, media_type="video")

        cases = [
            ("stale encrypted instance", stale, 1),
            ("encrypted with key in memory", encrypted_with_key, 0),
            ("unencrypted media", unencrypted, 0),
        ]

        for name, media, expected in cases:
            with self.subTest(case=name):
                self.assertEqual(
                    self._guard_reads(media),
                    expected,
                    f"{name}: unexpected number of encryption_key re-reads",
                )
