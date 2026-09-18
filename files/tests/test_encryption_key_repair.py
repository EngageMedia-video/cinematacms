"""Regression tests for repairing encrypted HLS media without a stored key."""

import os
import tempfile
from io import StringIO
from unittest.mock import MagicMock, patch

from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.urls import reverse

from files import tasks
from files.models import EncodeProfile, Encoding, Media
from files.tests.helpers import create_test_media, create_test_user


class RepairEncryptionKeysCommandTests(TestCase):
    def setUp(self):
        self.user = create_test_user(username="repair-owner")
        self.broken_media = create_test_media(
            self.user,
            is_encrypted=True,
            hls_file="hls/broken/old/master.m3u8",
        )
        self.healthy_media = create_test_media(
            self.user,
            is_encrypted=True,
            hls_file="hls/healthy/master.m3u8",
        )
        self.healthy_media.ensure_encryption_key()
        self.unencrypted_media = create_test_media(
            self.user,
            is_encrypted=False,
            hls_file="hls/plain/master.m3u8",
        )

    @staticmethod
    def _successful_create_hls(friendly_token):
        media = Media.objects.get(friendly_token=friendly_token)
        Media.objects.filter(pk=media.pk).update(
            encryption_key="0123456789abcdef0123456789abcdef",
            hls_file=f"hls/{media.uid.hex}/new/master.m3u8",
        )
        return True

    def test_default_is_dry_run_and_only_lists_eligible_media(self):
        out = StringIO()

        with patch("files.management.commands.repair_encryption_keys.create_hls") as create_hls:
            call_command("repair_encryption_keys", stdout=out)

        self.broken_media.refresh_from_db()
        create_hls.assert_not_called()
        self.assertEqual(self.broken_media.encryption_key, "")
        self.assertIn(f"token={self.broken_media.friendly_token} action=would_repair result=dry_run", out.getvalue())
        self.assertNotIn(self.healthy_media.friendly_token, out.getvalue())
        self.assertNotIn(self.unencrypted_media.friendly_token, out.getvalue())
        self.assertIn("affected=1 repaired=0 failed=0 skipped=0 mode=dry_run", out.getvalue())

    def test_explicit_dry_run_does_not_change_media(self):
        out = StringIO()

        with patch("files.management.commands.repair_encryption_keys.create_hls") as create_hls:
            call_command("repair_encryption_keys", "--dry-run", stdout=out)

        self.broken_media.refresh_from_db()
        create_hls.assert_not_called()
        self.assertEqual(self.broken_media.encryption_key, "")
        self.assertEqual(self.broken_media.hls_file, "hls/broken/old/master.m3u8")
        self.assertIn("mode=dry_run", out.getvalue())

    def test_repair_regenerates_key_and_hls_output(self):
        out = StringIO()

        with patch(
            "files.management.commands.repair_encryption_keys.create_hls",
            side_effect=self._successful_create_hls,
        ):
            call_command("repair_encryption_keys", "--repair", stdout=out)

        self.broken_media.refresh_from_db()
        response = self.client.get(
            reverse("api_get_media_key", kwargs={"friendly_token": self.broken_media.friendly_token})
        )
        self.assertEqual(self.broken_media.encryption_key, "0123456789abcdef0123456789abcdef")
        self.assertEqual(self.broken_media.hls_file, f"hls/{self.broken_media.uid.hex}/new/master.m3u8")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.content), 16)
        self.assertIn(f"token={self.broken_media.friendly_token} action=repair result=succeeded", out.getvalue())
        self.assertIn("affected=1 repaired=1 failed=0 skipped=0 mode=repair", out.getvalue())

    def test_failure_for_one_media_does_not_stop_later_repairs(self):
        later_media = create_test_media(self.user, is_encrypted=True, hls_file="hls/later/old/master.m3u8")
        out = StringIO()
        err = StringIO()

        def create_hls_with_failure(friendly_token):
            if friendly_token == self.broken_media.friendly_token:
                raise RuntimeError("mp4hls unavailable")
            return self._successful_create_hls(friendly_token)

        with patch(
            "files.management.commands.repair_encryption_keys.create_hls",
            side_effect=create_hls_with_failure,
        ):
            call_command("repair_encryption_keys", "--repair", stdout=out, stderr=err)

        self.broken_media.refresh_from_db()
        later_media.refresh_from_db()
        self.assertEqual(self.broken_media.encryption_key, "")
        self.assertEqual(later_media.encryption_key, "0123456789abcdef0123456789abcdef")
        self.assertIn(f"token={self.broken_media.friendly_token} action=repair result=failed", err.getvalue())
        self.assertIn(f"token={later_media.friendly_token} action=repair result=succeeded", out.getvalue())
        self.assertIn("affected=2 repaired=1 failed=1 skipped=0 mode=repair", out.getvalue())

    def test_second_repair_is_idempotent(self):
        with patch(
            "files.management.commands.repair_encryption_keys.create_hls",
            side_effect=self._successful_create_hls,
        ) as create_hls:
            call_command("repair_encryption_keys", "--repair")

        out = StringIO()
        with patch("files.management.commands.repair_encryption_keys.create_hls") as second_create_hls:
            call_command("repair_encryption_keys", "--repair", stdout=out)

        self.assertEqual(create_hls.call_count, 1)
        second_create_hls.assert_not_called()
        self.assertIn("affected=0 repaired=0 failed=0 skipped=0 mode=repair", out.getvalue())

    def test_repair_leaves_healthy_and_unencrypted_media_unchanged(self):
        healthy_key = self.healthy_media.encryption_key
        healthy_hls = self.healthy_media.hls_file
        unencrypted_hls = self.unencrypted_media.hls_file

        with patch(
            "files.management.commands.repair_encryption_keys.create_hls",
            side_effect=self._successful_create_hls,
        ):
            call_command("repair_encryption_keys", "--repair")

        self.healthy_media.refresh_from_db()
        self.unencrypted_media.refresh_from_db()
        self.assertEqual(self.healthy_media.encryption_key, healthy_key)
        self.assertEqual(self.healthy_media.hls_file, healthy_hls)
        self.assertEqual(self.unencrypted_media.encryption_key, "")
        self.assertEqual(self.unencrypted_media.hls_file, unencrypted_hls)


class RepairEncryptionKeyTaskSafetyTests(TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.hls_dir = os.path.join(self.tmpdir.name, "hls")
        self.mp4hls_command = os.path.join(self.tmpdir.name, "mp4hls")
        with open(self.mp4hls_command, "w", encoding="utf-8") as command_file:
            command_file.write("#!/bin/sh\n")

        self.override = override_settings(
            MEDIA_ROOT=self.tmpdir.name,
            HLS_DIR=self.hls_dir,
            MP4HLS_COMMAND=self.mp4hls_command,
            CACHES={
                "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"},
            },
        )
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.addCleanup(self.tmpdir.cleanup)
        cache.clear()

        self.user = create_test_user(username="task-repair-owner")
        self.media = create_test_media(self.user, is_encrypted=True)
        profile = EncodeProfile.objects.create(name="repair h264", extension="mp4", codec="h264", resolution=720)
        Encoding.objects.create(
            media=self.media,
            profile=profile,
            status="success",
            media_file="encoded/repair.mp4",
        )

    @staticmethod
    def _output_dir(command):
        return next(part.removeprefix("--output-dir=") for part in command if part.startswith("--output-dir="))

    def _write_encrypted_playlist(self, command, capture_output, timeout=None):
        output_dir = self._output_dir(command)
        os.makedirs(output_dir, exist_ok=True)
        with open(os.path.join(output_dir, "master.m3u8"), "w", encoding="utf-8") as playlist:
            playlist.write('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="/key"\n')
        return MagicMock(returncode=0)

    def test_interrupted_regeneration_does_not_persist_a_new_key(self):
        with patch("files.tasks.subprocess.run", side_effect=KeyboardInterrupt):
            with self.assertRaises(KeyboardInterrupt):
                tasks.create_hls(self.media.friendly_token)

        self.media.refresh_from_db()
        self.assertEqual(self.media.encryption_key, "")
        self.assertEqual(self.media.hls_file, "")

    def test_command_persists_new_key_only_after_encrypted_hls_succeeds(self):
        out = StringIO()

        with patch("files.tasks.subprocess.run", side_effect=self._write_encrypted_playlist):
            call_command("repair_encryption_keys", "--repair", stdout=out)

        self.media.refresh_from_db()
        response = self.client.get(reverse("api_get_media_key", kwargs={"friendly_token": self.media.friendly_token}))
        self.assertRegex(self.media.encryption_key, r"^[0-9a-f]{32}$")
        self.assertTrue(self.media.hls_file)
        self.assertEqual(response.status_code, 200)
        self.assertIn(f"token={self.media.friendly_token} action=repair result=succeeded", out.getvalue())
