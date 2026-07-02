"""
Tests for cleanup_hls_directory_for_media, the media-replace HLS cleanup
helper used by edit_media (issue #791).

Covers removal of the versioned HLS_DIR/<uid> tree, the legacy flat layout,
directory-traversal protection, and no-op cases.
"""

import os
import tempfile

from django.test import TestCase, override_settings

from files.models import Media
from files.tests.test_hls_encryption import create_test_media
from files.views import cleanup_hls_directory_for_media
from users.models import User


class CleanupHlsDirectoryForMediaTests(TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.hls_dir = os.path.join(self.tmpdir.name, "hls")
        os.makedirs(self.hls_dir, exist_ok=True)
        self.override = override_settings(MEDIA_ROOT=self.tmpdir.name, HLS_DIR=self.hls_dir)
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.addCleanup(self.tmpdir.cleanup)

        self.user = User.objects.create_user(username="owner", email="owner@example.com", password="pw")
        self.media = create_test_media(self.user)

    def _uid_dir(self):
        return os.path.join(self.hls_dir, self.media.uid.hex)

    def test_removes_versioned_hls_tree(self):
        version_dir = os.path.join(self._uid_dir(), "abc123")
        os.makedirs(version_dir, exist_ok=True)
        master = os.path.join(version_dir, "master.m3u8")
        with open(master, "wb") as f:
            f.write(b"content")
        Media.objects.filter(pk=self.media.pk).update(hls_file=master)
        self.media.refresh_from_db()

        cleanup_hls_directory_for_media(self.media)

        self.assertFalse(os.path.exists(self._uid_dir()))

    def test_removes_legacy_flat_hls_tree(self):
        uid_dir = self._uid_dir()
        os.makedirs(uid_dir, exist_ok=True)
        master = os.path.join(uid_dir, "master.m3u8")
        with open(master, "wb") as f:
            f.write(b"content")
        Media.objects.filter(pk=self.media.pk).update(hls_file=master)
        self.media.refresh_from_db()

        cleanup_hls_directory_for_media(self.media)

        self.assertFalse(os.path.exists(uid_dir))

    def test_hls_dir_unset_skips_cleanup_without_exception(self):
        uid_dir = self._uid_dir()
        os.makedirs(uid_dir, exist_ok=True)
        with override_settings(HLS_DIR=None):
            cleanup_hls_directory_for_media(self.media)
        self.assertTrue(os.path.exists(uid_dir))

    def test_no_hls_file_and_no_on_disk_dir_is_a_no_op(self):
        # Should not raise even though nothing exists on disk.
        cleanup_hls_directory_for_media(self.media)
        self.assertFalse(os.path.exists(self._uid_dir()))

    def test_other_media_uid_directory_untouched(self):
        other_uid_dir = os.path.join(self.hls_dir, "0" * 32)
        os.makedirs(other_uid_dir, exist_ok=True)
        sentinel = os.path.join(other_uid_dir, "master.m3u8")
        with open(sentinel, "wb") as f:
            f.write(b"other media")

        uid_dir = self._uid_dir()
        os.makedirs(uid_dir, exist_ok=True)
        with open(os.path.join(uid_dir, "master.m3u8"), "wb") as f:
            f.write(b"this media")

        cleanup_hls_directory_for_media(self.media)

        self.assertFalse(os.path.exists(uid_dir))
        self.assertTrue(os.path.exists(sentinel))
