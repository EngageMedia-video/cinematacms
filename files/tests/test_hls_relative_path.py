"""
Tests for MEDIA_ROOT-relative hls_file storage (#789): the tolerant
Media.hls_file_path reader, url_from_path prefix handling, the 0033
data-migration transforms (including the _rewrite pass that touches
production rows), and hls_info URL generation from a relative row.
"""

import importlib
import os
import tempfile
from unittest.mock import patch

from django.db import connection
from django.db.migrations.loader import MigrationLoader
from django.test import TestCase, override_settings

from files import helpers
from files.models import Media
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


class MigrationToRelativeTests(TestCase):
    @override_settings(MEDIA_ROOT="/srv/media_files/")
    def test_absolute_with_current_root(self):
        self.assertEqual(
            migration_0033._to_relative("/srv/media_files/hls/uid/v1/master.m3u8"),
            "hls/uid/v1/master.m3u8",
        )

    @override_settings(MEDIA_ROOT="/srv/media_files/")
    def test_foreign_root_falls_back_to_hls_marker(self):
        # Row written on a host whose MEDIA_ROOT no longer matches.
        self.assertEqual(
            migration_0033._to_relative("/old/container/media/hls/uid/v1/master.m3u8"),
            "hls/uid/v1/master.m3u8",
        )

    @override_settings(MEDIA_ROOT="/srv/media_files/")
    def test_foreign_root_containing_hls_uses_last_marker(self):
        # The foreign prefix itself contains an hls directory: only the LAST
        # /hls/ is the HLS root (uid/version segments are hex tokens).
        self.assertEqual(
            migration_0033._to_relative("/mnt/hls/cinemata/media_files/hls/uid/v1/master.m3u8"),
            "hls/uid/v1/master.m3u8",
        )

    @override_settings(MEDIA_ROOT="/srv/hls/media_files/")
    def test_exact_root_strip_takes_precedence_over_marker(self):
        # MEDIA_ROOT itself contains /hls/: the exact prefix strip must win
        # before any marker heuristic runs.
        self.assertEqual(
            migration_0033._to_relative("/srv/hls/media_files/hls/uid/v1/master.m3u8"),
            "hls/uid/v1/master.m3u8",
        )

    def test_relative_value_is_idempotent(self):
        self.assertEqual(migration_0033._to_relative("hls/uid/v1/master.m3u8"), "hls/uid/v1/master.m3u8")

    @override_settings(MEDIA_ROOT="/srv/media_files/")
    def test_unknown_absolute_left_untouched(self):
        self.assertEqual(
            migration_0033._to_relative("/opt/data/uid/master.m3u8"),
            "/opt/data/uid/master.m3u8",
        )

    def test_empty_value(self):
        self.assertEqual(migration_0033._to_relative(""), "")


class MigrationToAbsoluteTests(TestCase):
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


class MigrationRewriteTests(TestCase):
    """Exercises _rewrite, the pass that actually touches production rows.

    Uses the historical apps registry (as RunPython provides), whose plain
    model class is what _rewrite actually iterates during the migration.
    """

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        loader = MigrationLoader(connection)
        cls.migration_apps = loader.project_state(("files", "0033_relative_hls_file")).apps

    def setUp(self):
        self.user = User.objects.create_user(username="owner", email="owner@example.com", password="pw")

    def _media_with_hls_file(self, value):
        media = create_test_media(self.user)
        Media.objects.filter(pk=media.pk).update(hls_file=value)
        return media

    def test_rewrite_converts_absolute_rows_and_skips_the_rest(self):
        current_root = self._media_with_hls_file("/srv/media_files/hls/aa/v1/master.m3u8")
        foreign_root = self._media_with_hls_file("/mnt/hls/old/media_files/hls/bb/v2/master.m3u8")
        already_relative = self._media_with_hls_file("hls/cc/v3/master.m3u8")
        unknown_form = self._media_with_hls_file("/opt/data/dd/master.m3u8")
        no_hls = self._media_with_hls_file("")

        # BATCH_SIZE=1 forces the mid-loop flush path as well as the final one.
        with (
            override_settings(MEDIA_ROOT="/srv/media_files/"),
            patch.object(migration_0033, "BATCH_SIZE", 1),
        ):
            migration_0033._rewrite(self.migration_apps, migration_0033._to_relative)

        for media in (current_root, foreign_root, already_relative, unknown_form, no_hls):
            media.refresh_from_db()
        self.assertEqual(current_root.hls_file, "hls/aa/v1/master.m3u8")
        self.assertEqual(foreign_root.hls_file, "hls/bb/v2/master.m3u8")
        self.assertEqual(already_relative.hls_file, "hls/cc/v3/master.m3u8")
        self.assertEqual(unknown_form.hls_file, "/opt/data/dd/master.m3u8")
        self.assertEqual(no_hls.hls_file, "")

    def test_rewrite_backwards_restores_absolute_rows(self):
        media = self._media_with_hls_file("hls/aa/v1/master.m3u8")

        with override_settings(MEDIA_ROOT="/srv/media_files/"):
            migration_0033._rewrite(self.migration_apps, migration_0033._to_absolute)

        media.refresh_from_db()
        self.assertEqual(media.hls_file, "/srv/media_files/hls/aa/v1/master.m3u8")


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
