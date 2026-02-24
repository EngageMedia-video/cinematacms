"""
Tests for secure media thumbnail and preview GIF authorization.

These tests verify that thumbnails and preview GIFs for private/restricted
media are protected by the same authorization checks as video files.
"""

from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase, TestCase

from files.secure_media_views import (
    PUBLIC_MEDIA_PATHS,
    SecureMediaView,
)


class SecureMediaViewPathTests(SimpleTestCase):
    """Tests for path validation and classification in SecureMediaView."""

    def setUp(self):
        self.view = SecureMediaView()

    def test_public_media_paths_excludes_thumbnails(self):
        """Verify 'thumbnails/' is not in PUBLIC_MEDIA_PATHS."""
        self.assertNotIn("thumbnails/", PUBLIC_MEDIA_PATHS)

    def test_user_thumbnails_are_media_associated(self):
        """Verify user thumbnails are recognized as media-associated paths."""
        self.assertTrue(
            self.view._is_media_associated_file("original/thumbnails/user/admin/test.jpg"),
            "User thumbnails should be recognized as media-associated",
        )

    def test_is_public_media_file_rejects_user_thumbnails(self):
        """Thumbnails in user directories should NOT be public."""
        paths = [
            "original/thumbnails/user/admin/test.jpg",
            "original/thumbnails/user/testuser/image_abc123.jpg",
        ]
        for path in paths:
            self.assertFalse(self.view._is_public_media_file(path), f"Path {path} should NOT be public")

    def test_is_public_media_file_allows_category_thumbnails(self):
        """Category thumbnails should be public."""
        paths = [
            "original/categories/abc123.jpg",
            "original/categories/category_thumb.png",
        ]
        for path in paths:
            self.assertTrue(self.view._is_public_media_file(path), f"Path {path} SHOULD be public")

    def test_is_public_media_file_allows_topic_thumbnails(self):
        """Topic thumbnails should be public."""
        paths = [
            "original/topics/abc123.jpg",
            "original/topics/topic_thumb.png",
        ]
        for path in paths:
            self.assertTrue(self.view._is_public_media_file(path), f"Path {path} SHOULD be public")

    def test_is_public_media_file_allows_user_logos(self):
        """User logos should be public."""
        paths = [
            "original/userlogos/admin/logo.jpg",
            "userlogos/logo.jpg",
        ]
        for path in paths:
            self.assertTrue(self.view._is_public_media_file(path), f"Path {path} SHOULD be public")

    def test_is_media_associated_file_for_thumbnails(self):
        """Thumbnails in user directories should be media-associated."""
        paths = [
            "original/thumbnails/user/admin/test.jpg",
            "original/thumbnails/user/testuser/image_abc123.jpg",
            "original/thumbnails/user/myuser/poster.jpg",
        ]
        for path in paths:
            self.assertTrue(self.view._is_media_associated_file(path), f"Path {path} should be media-associated")

    def test_is_media_associated_file_for_encoded_gifs(self):
        """Preview GIFs in encoded directory should be media-associated."""
        paths = [
            "encoded/22/admin/preview.gif",
            "encoded/22/testuser/abc123.gif",
            "encoded/5/user/animated.GIF",  # Case insensitive
        ]
        for path in paths:
            self.assertTrue(self.view._is_media_associated_file(path), f"Path {path} should be media-associated")

    def test_is_media_associated_file_excludes_non_gif_encoded(self):
        """Non-GIF files in encoded directory should NOT be media-associated."""
        paths = [
            "encoded/22/admin/video.mp4",
            "encoded/22/testuser/video.webm",
        ]
        for path in paths:
            self.assertFalse(
                self.view._is_media_associated_file(path), f"Path {path} should NOT be media-associated (video files)"
            )

    def test_is_non_video_file_does_not_bypass_thumbnails(self):
        """Thumbnails should NOT bypass authorization."""
        paths = [
            "original/thumbnails/user/admin/test.jpg",
            "original/thumbnails/user/testuser/image.png",
        ]
        for path in paths:
            self.assertFalse(self.view._is_non_video_file(path), f"Path {path} should NOT bypass authorization")

    def test_is_non_video_file_does_not_bypass_preview_gifs(self):
        """Preview GIFs should NOT bypass authorization."""
        paths = [
            "encoded/22/admin/preview.gif",
            "encoded/22/testuser/animated.GIF",
        ]
        for path in paths:
            self.assertFalse(self.view._is_non_video_file(path), f"Path {path} should NOT bypass authorization")

    def test_is_non_video_file_does_not_bypass_subtitles(self):
        """Subtitle files should NOT bypass authorization (P2-004 fix).

        Subtitles contain transcripts of video content and must be protected
        to prevent leaking private video content through subtitle files.
        """
        paths = [
            "original/subtitles/user/admin/subs.vtt",
            "original/subtitles/user/testuser/captions.srt",
        ]
        for path in paths:
            self.assertFalse(
                self.view._is_non_video_file(path),
                f"Path {path} should NOT bypass authorization (subtitles contain video transcripts)",
            )

    def test_is_media_associated_file_for_subtitles(self):
        """Subtitle files should be recognized as media-associated (P2-004 fix)."""
        paths = [
            "original/subtitles/user/admin/subs.vtt",
            "original/subtitles/user/testuser/captions.srt",
        ]
        for path in paths:
            self.assertTrue(self.view._is_media_associated_file(path), f"Path {path} should be media-associated")

    def test_is_valid_file_path_allows_thumbnail_paths(self):
        """Thumbnail paths should be valid file paths."""
        paths = [
            "original/thumbnails/user/admin/test.jpg",
            "original/thumbnails/user/testuser/image.png",
        ]
        for path in paths:
            self.assertTrue(self.view._is_valid_file_path(path), f"Path {path} should be valid")

    def test_is_valid_file_path_allows_encoded_gif_paths(self):
        """Encoded GIF paths should be valid file paths."""
        paths = [
            "encoded/22/admin/preview.gif",
            "encoded/5/testuser/animated.gif",
        ]
        for path in paths:
            self.assertTrue(self.view._is_valid_file_path(path), f"Path {path} should be valid")


class SecureMediaViewVerifyPathTests(SimpleTestCase):
    """Tests for _verify_media_owns_thumbnail_path (P1-001 and P1-002 fixes)."""

    def setUp(self):
        self.view = SecureMediaView()

    def test_verify_media_owns_exact_thumbnail_path(self):
        """Media that owns the exact path should verify successfully."""
        mock_media = MagicMock()
        mock_media.thumbnail.name = "original/thumbnails/user/alice/thumb.jpg"
        mock_media.poster.name = "original/thumbnails/user/alice/poster.jpg"
        mock_media.uploaded_thumbnail = None
        mock_media.uploaded_poster = None
        mock_media.sprites = None

        result = self.view._verify_media_owns_thumbnail_path(mock_media, "original/thumbnails/user/alice/thumb.jpg")
        self.assertTrue(result, "Media should verify when it owns the exact path")

    def test_verify_media_rejects_suffix_collision(self):
        """Media should NOT verify for a path that's a suffix of its actual path."""
        mock_media = MagicMock()
        # Media owns "video_thumb.jpg" but request is for "thumb.jpg"
        mock_media.thumbnail.name = "original/thumbnails/user/alice/video_thumb.jpg"
        mock_media.poster = None
        mock_media.uploaded_thumbnail = None
        mock_media.uploaded_poster = None
        mock_media.sprites = None

        result = self.view._verify_media_owns_thumbnail_path(mock_media, "original/thumbnails/user/alice/thumb.jpg")
        self.assertFalse(result, "Media should NOT verify for suffix collision")

    def test_verify_media_rejects_different_user_path(self):
        """Media should NOT verify for a path with different username."""
        mock_media = MagicMock()
        mock_media.thumbnail.name = "original/thumbnails/user/alice/thumb.jpg"
        mock_media.poster = None
        mock_media.uploaded_thumbnail = None
        mock_media.uploaded_poster = None
        mock_media.sprites = None

        result = self.view._verify_media_owns_thumbnail_path(mock_media, "original/thumbnails/user/bob/thumb.jpg")
        self.assertFalse(result, "Media should NOT verify for different user's path")

    def test_verify_media_with_no_thumbnails(self):
        """Media with no thumbnails should not verify any path."""
        mock_media = MagicMock()
        mock_media.thumbnail = None
        mock_media.poster = None
        mock_media.uploaded_thumbnail = None
        mock_media.uploaded_poster = None
        mock_media.sprites = None

        result = self.view._verify_media_owns_thumbnail_path(mock_media, "original/thumbnails/user/alice/thumb.jpg")
        self.assertFalse(result, "Media with no thumbnails should not verify")

    def test_verify_media_checks_all_thumbnail_fields(self):
        """Verification should check all thumbnail-related fields."""
        mock_media = MagicMock()
        mock_media.thumbnail = None
        mock_media.poster = None
        mock_media.uploaded_thumbnail = None
        mock_media.uploaded_poster.name = "original/thumbnails/user/alice/uploaded_poster.jpg"
        mock_media.sprites = None

        result = self.view._verify_media_owns_thumbnail_path(
            mock_media, "original/thumbnails/user/alice/uploaded_poster.jpg"
        )
        self.assertTrue(result, "Should verify when uploaded_poster matches")


class SecureMediaViewNormalizePathTests(SimpleTestCase):
    """Tests for _normalize_to_relative (absolute path normalization fix)."""

    def setUp(self):
        self.view = SecureMediaView()

    @patch("files.secure_media_views.settings")
    def test_normalize_strips_media_root_prefix(self, mock_settings):
        """Absolute paths with MEDIA_ROOT prefix should be normalized to relative."""
        mock_settings.MEDIA_ROOT = "/home/cinemata/cinematacms/media_files/"
        path = "/home/cinemata/cinematacms/media_files/original/thumbnails/user/alice/thumb.jpg"
        result = self.view._normalize_to_relative(path)
        self.assertEqual(result, "original/thumbnails/user/alice/thumb.jpg")

    @patch("files.secure_media_views.settings")
    def test_normalize_preserves_relative_paths(self, mock_settings):
        """Relative paths should be returned unchanged."""
        mock_settings.MEDIA_ROOT = "/home/cinemata/cinematacms/media_files/"
        path = "original/thumbnails/user/alice/thumb.jpg"
        result = self.view._normalize_to_relative(path)
        self.assertEqual(result, "original/thumbnails/user/alice/thumb.jpg")

    @patch("files.secure_media_views.settings")
    def test_normalize_handles_media_root_without_trailing_slash(self, mock_settings):
        """Should work even if MEDIA_ROOT doesn't end with /."""
        mock_settings.MEDIA_ROOT = "/home/cinemata/cinematacms/media_files"
        path = "/home/cinemata/cinematacms/media_files/original/thumbnails/user/alice/thumb.jpg"
        result = self.view._normalize_to_relative(path)
        self.assertEqual(result, "original/thumbnails/user/alice/thumb.jpg")

    @patch("files.secure_media_views.settings")
    def test_normalize_handles_empty_path(self, mock_settings):
        """Empty paths should be returned as-is."""
        mock_settings.MEDIA_ROOT = "/home/cinemata/cinematacms/media_files/"
        self.assertEqual(self.view._normalize_to_relative(""), "")
        self.assertIsNone(self.view._normalize_to_relative(None))

    @patch("files.secure_media_views.settings")
    def test_normalize_ignores_different_absolute_prefix(self, mock_settings):
        """Absolute paths with a different prefix should be returned unchanged."""
        mock_settings.MEDIA_ROOT = "/home/cinemata/cinematacms/media_files/"
        path = "/home/other/media_files/original/thumbnails/user/alice/thumb.jpg"
        result = self.view._normalize_to_relative(path)
        self.assertEqual(result, path)

    @patch("files.secure_media_views.settings")
    def test_verify_media_owns_absolute_thumbnail_path(self, mock_settings):
        """Verification should succeed when DB stores absolute paths but request uses relative."""
        mock_settings.MEDIA_ROOT = "/home/cinemata/cinematacms/media_files/"
        mock_media = MagicMock()
        mock_media.uploaded_thumbnail.name = (
            "/home/cinemata/cinematacms/media_files/original/thumbnails/user/emnews/Dagami_Daytoy_Yn9w2nl.jpg"
        )
        mock_media.thumbnail = None
        mock_media.poster = None
        mock_media.uploaded_poster = None
        mock_media.sprites = None

        result = self.view._verify_media_owns_thumbnail_path(
            mock_media, "original/thumbnails/user/emnews/Dagami_Daytoy_Yn9w2nl.jpg"
        )
        self.assertTrue(result, "Should verify when DB has absolute path and request has relative path")


class SecureMediaViewGetMediaFromPathTests(TestCase):
    """Tests for _get_media_from_path with thumbnail paths.

    NOTE: These tests require database access. Run with:
        make docker-up  # Start PostgreSQL
        python manage.py test files.tests.test_secure_media_thumbnails.SecureMediaViewGetMediaFromPathTests
    """

    databases = ["default"]

    def setUp(self):
        self.view = SecureMediaView()

    def test_get_media_from_thumbnail_path_returns_none_when_no_media(self):
        """When no media matches the thumbnail path, return None."""
        media, _ = self.view._get_media_from_path("original/thumbnails/user/testuser/nonexistent.jpg")
        self.assertIsNone(media)

    def test_get_media_from_encoded_gif_path_returns_none_when_no_encoding(self):
        """When no encoding matches the GIF path, return None."""
        media, _ = self.view._get_media_from_path("encoded/22/testuser/nonexistent.gif")
        self.assertIsNone(media)
