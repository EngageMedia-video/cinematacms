"""
Tests for MEDIA_ROOT-relative hls_file storage (#789): the tolerant
Media.hls_file_path reader, url_from_path prefix handling, the
hls_path_to_relative conversion helper, the 0033 data-migration transforms,
and hls_info URL generation from a relative row.
"""

import importlib
import os
import tempfile

from django.test import TestCase, override_settings

from files import helpers
from files.tests.test_hls_encryption import create_test_media
from users.models import User

migration_0033 = importlib.import_module("files.migrations.0033_relative_hls_file")


class UrlFromPathTests(TestCase):
    @override_settings(MEDIA_ROOT="/srv/media_files/", MEDIA_URL="/media/")
    def test_relative_name_passthrough(self):
        self.assertEqual(helpers.url_from_path("hls/uid/v1/master.m3u8"), "/media/hls/uid/v1/master.m3u8")

    @override_settings(MEDIA_ROOT="/srv/media_files/", MEDIA_URL="/media/")
    def test_absolute_path_with_matching_root(self):
        self.assertEqual(
            helpers.url_from_path("/srv/media_files/hls/uid/v1/master.m3u8"),
            "/media/hls/uid/v1/master.m3u8",
        )

    @override_settings(MEDIA_ROOT="/srv/media_files", MEDIA_URL="/media/")
    def test_absolute_path_with_trailing_slash_mismatch(self):
        # Stored value assumes a trailing slash the setting no longer has.
        self.assertEqual(
            helpers.url_from_path("/srv/media_files/hls/uid/v1/master.m3u8"),
            "/media/hls/uid/v1/master.m3u8",
        )

    @override_settings(MEDIA_ROOT="/srv/media_files/", MEDIA_URL="/media/")
    def test_empty_value(self):
        self.assertEqual(helpers.url_from_path(""), "/media/")


class HlsPathToRelativeTests(TestCase):
    @override_settings(MEDIA_ROOT="/srv/media_files/")
    def test_absolute_with_current_root(self):
        self.assertEqual(
            helpers.hls_path_to_relative("/srv/media_files/hls/uid/v1/master.m3u8"),
            "hls/uid/v1/master.m3u8",
        )

    @override_settings(MEDIA_ROOT="/srv/media_files/")
    def test_absolute_with_foreign_root_uses_hls_marker(self):
        # Row written on a host whose MEDIA_ROOT no longer matches.
        self.assertEqual(
            helpers.hls_path_to_relative("/old/container/media/hls/uid/v1/master.m3u8"),
            "hls/uid/v1/master.m3u8",
        )

    def test_relative_value_is_idempotent(self):
        self.assertEqual(helpers.hls_path_to_relative("hls/uid/v1/master.m3u8"), "hls/uid/v1/master.m3u8")

    def test_empty_value(self):
        self.assertEqual(helpers.hls_path_to_relative(""), "")


class MigrationTransformTests(TestCase):
    @override_settings(MEDIA_ROOT="/srv/media_files/")
    def test_forward_transform_matches_helper(self):
        for value in (
            "/srv/media_files/hls/uid/v1/master.m3u8",
            "/old/root/hls/uid/v1/master.m3u8",
            "hls/uid/v1/master.m3u8",
            "",
        ):
            self.assertEqual(migration_0033._to_relative(value), helpers.hls_path_to_relative(value))

    @override_settings(MEDIA_ROOT="/srv/media_files/")
    def test_backward_transform_restores_absolute(self):
        self.assertEqual(
            migration_0033._to_absolute("hls/uid/v1/master.m3u8"),
            "/srv/media_files/hls/uid/v1/master.m3u8",
        )
        self.assertEqual(
            migration_0033._to_absolute("/already/absolute/master.m3u8"),
            "/already/absolute/master.m3u8",
        )


class HlsFilePathPropertyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="owner", email="owner@example.com", password="pw")
        self.media = create_test_media(self.user)

    @override_settings(MEDIA_ROOT="/srv/media_files/")
    def test_relative_value_joins_media_root(self):
        self.media.hls_file = "hls/uid/v1/master.m3u8"
        self.assertEqual(self.media.hls_file_path, "/srv/media_files/hls/uid/v1/master.m3u8")

    def test_legacy_absolute_value_passes_through(self):
        self.media.hls_file = "/legacy/root/hls/uid/v1/master.m3u8"
        self.assertEqual(self.media.hls_file_path, "/legacy/root/hls/uid/v1/master.m3u8")

    def test_empty_value(self):
        self.media.hls_file = ""
        self.assertEqual(self.media.hls_file_path, "")


class HlsInfoRelativeRowTests(TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self.override = override_settings(
            MEDIA_ROOT=self.tmpdir.name + "/",
            MEDIA_URL="/media/",
            HLS_DIR=os.path.join(self.tmpdir.name, "hls/"),
        )
        self.override.enable()
        self.addCleanup(self.override.disable)

        self.user = User.objects.create_user(username="owner", email="owner@example.com", password="pw")
        self.media = create_test_media(self.user)

    def test_hls_info_builds_urls_from_relative_row(self):
        version_dir = os.path.join(self.tmpdir.name, "hls", self.media.uid.hex, "v1abc")
        os.makedirs(version_dir)
        master = os.path.join(version_dir, "master.m3u8")
        with open(master, "w") as f:
            f.write("#EXTM3U\n")

        self.media.hls_file = os.path.relpath(master, self.tmpdir.name + "/")

        info = self.media.hls_info
        self.assertEqual(
            info["master_file"],
            f"/media/hls/{self.media.uid.hex}/v1abc/master.m3u8?v=v1abc",
        )

    def test_hls_info_empty_when_file_missing(self):
        self.media.hls_file = "hls/uid/gone/master.m3u8"
        self.assertEqual(self.media.hls_info, {})
