from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID

from django.test import SimpleTestCase

from files.models import encoding_media_file_path


class EncodingMediaFilePathTests(SimpleTestCase):
    def test_reencoding_uses_a_new_storage_path(self):
        media = SimpleNamespace(
            uid=UUID("2494fe35-1d17-4f81-82c0-c5f02359dd01"),
            user=SimpleNamespace(username="owner"),
        )
        profile = SimpleNamespace(id=7)
        first_encoding = SimpleNamespace(pk=101, media=media, profile=profile)
        replacement_encoding = SimpleNamespace(pk=202, media=media, profile=profile)

        first_path = encoding_media_file_path(first_encoding, "source.mp4")
        replacement_path = encoding_media_file_path(replacement_encoding, "source.mp4")

        self.assertEqual(
            replacement_path,
            "encoded/7/owner/2494fe351d174f8182c0c5f02359dd01.202.source.mp4",
        )
        self.assertNotEqual(first_path, replacement_path)

    @patch("files.models.helpers.produce_friendly_token", return_value="pendingVersion")
    def test_unsaved_encoding_uses_generated_version(self, _produce_friendly_token):
        encoding = SimpleNamespace(
            pk=None,
            media=SimpleNamespace(
                uid=UUID("2494fe35-1d17-4f81-82c0-c5f02359dd01"),
                user=SimpleNamespace(username="owner"),
            ),
            profile=SimpleNamespace(id=7),
        )

        path = encoding_media_file_path(encoding, "source.mp4")

        self.assertEqual(
            path,
            "encoded/7/owner/2494fe351d174f8182c0c5f02359dd01.pendingVersion.source.mp4",
        )
