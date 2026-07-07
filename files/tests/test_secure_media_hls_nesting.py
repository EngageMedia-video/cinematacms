"""
Regression tests for SecureMediaView path resolution under the versioned
HLS output layout (hls/<uid>/<version>/...) introduced for issue #791.

_get_media_from_path's HLS branch matches parts[1] against media.uid
regardless of how deeply the remaining path is nested (len(parts) >= 3),
so no production code change was required here (KTD4). These tests prove
that behavior holds for the new layout and stays enforced end-to-end.
"""

import os
import tempfile

from django.test import Client, TestCase, override_settings

from files.secure_media_views import SecureMediaView
from files.tests.helpers import create_test_media, create_test_user
from files.token_utils import generate_token


class GetMediaFromPathNestedHlsTests(TestCase):
    databases = ["default"]

    def setUp(self):
        self.view = SecureMediaView()
        self.user = create_test_user(username="hls_nesting_owner")
        self.media = create_test_media(self.user, state="public")

    def test_resolves_versioned_manifest_path(self):
        path = f"hls/{self.media.uid.hex}/abc123/master.m3u8"
        media, actual_path = self.view._get_media_from_path(path)
        self.assertEqual(media, self.media)
        self.assertIsNone(actual_path)

    def test_resolves_deeply_nested_segment_path(self):
        path = f"hls/{self.media.uid.hex}/abc123/media-1/stream.m3u8"
        media, _ = self.view._get_media_from_path(path)
        self.assertEqual(media, self.media)

    def test_resolves_legacy_flat_path(self):
        path = f"hls/{self.media.uid.hex}/master.m3u8"
        media, _ = self.view._get_media_from_path(path)
        self.assertEqual(media, self.media)

    def test_unknown_uid_returns_none(self):
        path = "hls/00000000000000000000000000000000/abc123/master.m3u8"
        media, _ = self.view._get_media_from_path(path)
        self.assertIsNone(media)


class SecureMediaViewNestedHlsAccessTests(TestCase):
    databases = ["default"]

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.hls_dir = os.path.join(self.tmpdir.name, "hls")
        os.makedirs(self.hls_dir, exist_ok=True)
        self.override = override_settings(
            MEDIA_ROOT=self.tmpdir.name,
            HLS_DIR=self.hls_dir,
            USE_X_ACCEL_REDIRECT=False,
        )
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.addCleanup(self.tmpdir.cleanup)

        self.owner = create_test_user(username="hls_nesting_owner2")
        self.client = Client()

    def _write_manifest(self, media, version, filename="master.m3u8", content="#EXTM3U\nsegment0.ts\n"):
        version_dir = os.path.join(self.hls_dir, media.uid.hex, version)
        os.makedirs(version_dir, exist_ok=True)
        manifest_path = os.path.join(version_dir, filename)
        with open(manifest_path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"hls/{media.uid.hex}/{version}/{filename}"

    def test_private_media_denies_unauthorized_access_under_nested_path(self):
        media = create_test_media(self.owner, state="private")
        rel_path = self._write_manifest(media, "abc123")

        response = self.client.get(f"/media/{rel_path}")

        self.assertEqual(response.status_code, 403)

    def test_public_media_serves_manifest_under_nested_path(self):
        media = create_test_media(self.owner, state="public")
        rel_path = self._write_manifest(media, "abc123")

        response = self.client.get(f"/media/{rel_path}")

        self.assertEqual(response.status_code, 200)

    def test_restricted_media_rewritten_manifest_has_no_store_cache_control(self):
        media = create_test_media(self.owner, state="restricted")
        rel_path = self._write_manifest(media, "abc123")
        token = generate_token(media.uid.hex)

        response = self.client.get(f"/media/{rel_path}?token={token}")

        self.assertEqual(response.status_code, 200)
        self.assertIn("no-store", response["Cache-Control"])

    def test_restricted_media_without_token_denies_access_under_nested_path(self):
        media = create_test_media(self.owner, state="restricted")
        rel_path = self._write_manifest(media, "abc123")

        response = self.client.get(f"/media/{rel_path}")

        self.assertEqual(response.status_code, 403)
