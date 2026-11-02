"""A deleted Media leaves nothing on disk, and a regenerated thumbnail replaces its predecessor."""

import io
import os
import tempfile
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image

from files.models import EncodeProfile, Encoding, Language, Media, Subtitle
from files.tests.helpers import create_test_media, create_test_user


def jpeg_bytes():
    buffer = io.BytesIO()
    Image.new("RGB", (8, 8)).save(buffer, format="JPEG")
    return buffer.getvalue()


class StoredFilesTestCase(TestCase):
    """Runs against a MEDIA_ROOT that is also the BASE_DIR, so rm_dir may remove what is under it."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.root = os.path.realpath(self.tmpdir.name)
        self.hls_dir = os.path.join(self.root, "hls")
        override = override_settings(MEDIA_ROOT=self.root, BASE_DIR=self.root, HLS_DIR=self.hls_dir)
        override.enable()
        self.addCleanup(override.disable)
        self.addCleanup(self.tmpdir.cleanup)
        self.user = create_test_user(username="delete_owner")

    def _store(self, field, name, content=b"content"):
        return field.storage.save(name, ContentFile(content))

    def _files_on_disk(self):
        return sorted(
            os.path.relpath(os.path.join(directory, name), self.root)
            for directory, _, names in os.walk(self.root)
            for name in names
        )


class MediaDeleteCleanupTests(StoredFilesTestCase):
    def _delete(self, media):
        with (
            patch("files.models._revoke_encoding_tasks"),
            patch("files.models._schedule_storage_usage_refresh_for_media"),
            patch.object(type(self.user), "update_user_media"),
        ):
            media.delete()

    def _media_owning_every_kind_of_file(self):
        media = create_test_media(self.user)
        field = media._meta.get_field
        version_dir = os.path.join(self.hls_dir, media.uid.hex, "abc123")
        os.makedirs(version_dir)
        with open(os.path.join(version_dir, "master.m3u8"), "wb") as playlist:
            playlist.write(b"playlist")
        Media.objects.filter(pk=media.pk).update(
            media_file=self._store(field("media_file"), "original.mp4"),
            thumbnail=self._store(field("thumbnail"), "thumb.jpg"),
            poster=self._store(field("poster"), "poster.jpg"),
            uploaded_thumbnail=self._store(field("uploaded_thumbnail"), "uploaded-thumb.jpg"),
            uploaded_poster=self._store(field("uploaded_poster"), "uploaded-poster.jpg"),
            sprites=self._store(field("sprites"), "sprites.jpg"),
            hls_file=os.path.relpath(os.path.join(version_dir, "master.m3u8"), self.root),
        )
        media.refresh_from_db()
        profile = EncodeProfile.objects.create(name="720p", extension="mp4", codec="vp9", resolution=720)
        Encoding.objects.create(
            media=media,
            profile=profile,
            status="success",
            media_file=self._store(Encoding._meta.get_field("media_file"), "720.mp4"),
        )
        language = Language.objects.create(code="en", title="English")
        Subtitle.objects.create(
            media=media,
            user=self.user,
            language=language,
            subtitle_file=self._store(Subtitle._meta.get_field("subtitle_file"), "subtitles.vtt"),
        )
        return media

    def test_deleting_a_media_removes_every_file_it_owns(self):
        media = self._media_owning_every_kind_of_file()
        self.assertEqual(len(self._files_on_disk()), 9)

        self._delete(media)

        self.assertEqual(self._files_on_disk(), [])

    def test_deleting_a_media_removes_its_hls_directory(self):
        media = self._media_owning_every_kind_of_file()
        hls_uid_dir = os.path.join(self.hls_dir, media.uid.hex)

        self._delete(media)

        self.assertFalse(os.path.exists(hls_uid_dir))

    def test_deleting_a_media_removes_the_hls_output_of_a_failed_run(self):
        media = create_test_media(self.user)
        partial_output = os.path.join(self.hls_dir, media.uid.hex, "abc123")
        os.makedirs(partial_output)

        self._delete(media)

        self.assertFalse(os.path.exists(os.path.join(self.hls_dir, media.uid.hex)))

    def test_deleting_a_media_leaves_the_hls_of_another_media(self):
        media = self._media_owning_every_kind_of_file()
        other = create_test_media(self.user)
        other_playlist = os.path.join(self.hls_dir, other.uid.hex, "abc123", "master.m3u8")
        os.makedirs(os.path.dirname(other_playlist))
        with open(other_playlist, "wb") as playlist:
            playlist.write(b"playlist")

        self._delete(media)

        self.assertTrue(os.path.exists(other_playlist))

    def test_deleting_a_subtitle_removes_its_file(self):
        media = create_test_media(self.user)
        language = Language.objects.create(code="en", title="English")
        subtitle = Subtitle.objects.create(
            media=media,
            user=self.user,
            language=language,
            subtitle_file=self._store(Subtitle._meta.get_field("subtitle_file"), "subtitles.vtt"),
        )
        self.assertEqual(len(self._files_on_disk()), 1)

        with patch("files.models._schedule_storage_usage_refresh_for_media"):
            subtitle.delete()

        self.assertEqual(self._files_on_disk(), [])


class RegeneratedThumbnailTests(StoredFilesTestCase):
    """Producing a thumbnail again used to leave the previous thumbnail and poster behind."""

    def setUp(self):
        super().setUp()
        self.media = create_test_media(self.user, media_type="image")
        stored_name = self._store(self.media._meta.get_field("media_file"), "picture.jpg", jpeg_bytes())
        Media.objects.filter(pk=self.media.pk).update(media_file=stored_name)
        self.media.refresh_from_db()

    def _thumbnail_files(self):
        return [name for name in self._files_on_disk() if "thumbnails" in name]

    def test_a_second_thumbnail_replaces_the_first(self):
        self.media.set_thumbnail(force=True)

        self.media.set_thumbnail(force=True)

        self.assertEqual(len(self._thumbnail_files()), 2)
        self.assertTrue(os.path.exists(self.media.thumbnail.path))
        self.assertTrue(os.path.exists(self.media.poster.path))

    def test_a_new_thumbnail_time_replaces_the_thumbnail(self):
        self.media.set_thumbnail(force=True)
        self.media.thumbnail_time = 1.0
        self.media.save()

        self.media.thumbnail_time = 2.0
        self.media.save()

        self.assertEqual(len(self._thumbnail_files()), 2)
        self.assertTrue(os.path.exists(self.media.thumbnail.path))
        self.assertTrue(os.path.exists(self.media.poster.path))

    def test_a_new_uploaded_poster_replaces_the_uploaded_thumbnail(self):
        self.media.uploaded_poster = SimpleUploadedFile("first.jpg", jpeg_bytes())
        self.media.save()
        first_uploaded_thumbnail = self.media.uploaded_thumbnail.path
        self.assertTrue(os.path.exists(first_uploaded_thumbnail))

        self.media.uploaded_poster = SimpleUploadedFile("second.jpg", jpeg_bytes())
        self.media.save()

        self.assertFalse(os.path.exists(first_uploaded_thumbnail))
        self.assertTrue(os.path.exists(self.media.uploaded_thumbnail.path))
