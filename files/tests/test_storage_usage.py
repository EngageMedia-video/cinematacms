import os
import tempfile
from io import StringIO
from unittest.mock import MagicMock, patch

from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import RequestFactory, TestCase, override_settings

from files import tasks
from files.context_processors import stuff
from files.models import EncodeProfile, Encoding, Language, Media, Subtitle
from files.storage_usage import calculate_media_storage_usage, refresh_media_storage_usage
from files.tests.helpers import create_test_media, create_test_user


class StorageUsageTests(TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.hls_dir = os.path.join(self.tmpdir.name, "hls")
        os.makedirs(self.hls_dir, exist_ok=True)
        self.override = override_settings(
            ADMINS_NOTIFICATIONS={"NEW_USER": False},
            MEDIA_ROOT=self.tmpdir.name,
            HLS_DIR=self.hls_dir,
            TEMP_DIRECTORY=self.tmpdir.name,
        )
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.addCleanup(self.tmpdir.cleanup)
        cache.clear()

        self.user = create_test_user(username="storage_owner")
        self.media = create_test_media(self.user)

    def _attach_file(self, instance, field_name, name, content):
        field_file = getattr(instance, field_name)
        generated_name = field_file.field.generate_filename(instance, name)
        stored_name = field_file.storage.save(generated_name, ContentFile(content))
        instance.__class__.objects.filter(pk=instance.pk).update(**{field_name: stored_name})
        setattr(instance, field_name, stored_name)
        if isinstance(instance, Media):
            if field_name == "media_file":
                instance._Media__original_media_file = instance.media_file
            elif field_name == "uploaded_poster":
                instance._Media__original_uploaded_poster = instance.uploaded_poster
        return stored_name

    def _profile(self):
        return EncodeProfile.objects.create(
            name="720p mp4",
            extension="mp4",
            resolution=720,
            codec="h264",
        )

    def test_calculate_media_storage_usage_counts_all_assets(self):
        self._attach_file(self.media, "media_file", "original.mp4", b"original12")
        self._attach_file(self.media, "thumbnail", "thumb.jpg", b"thumb")
        self._attach_file(self.media, "sprites", "sprites.jpg", b"sprite")

        encoding = Encoding.objects.create(media=self.media, profile=self._profile(), status="success")
        self._attach_file(self.media, "uploaded_poster", "poster.jpg", b"poster")
        self._attach_file(encoding, "media_file", "encoded.mp4", b"encoded")
        chunk_path = os.path.join(self.tmpdir.name, "chunk.mp4")
        with open(chunk_path, "wb") as chunk_file:
            chunk_file.write(b"chunked")
        Encoding.objects.filter(pk=encoding.pk).update(chunk_file_path=chunk_path)

        language = Language.objects.create(code="test-storage", title="Storage Test")
        subtitle = Subtitle.objects.create(media=self.media, language=language, user=self.user)
        self._attach_file(subtitle, "subtitle_file", "captions.vtt", b"sub")

        hls_path = os.path.join(self.hls_dir, self.media.uid.hex, "master.m3u8")
        os.makedirs(os.path.dirname(hls_path), exist_ok=True)
        with open(hls_path, "wb") as master_file:
            master_file.write(b"hls")
        with open(os.path.join(os.path.dirname(hls_path), "segment.ts"), "wb") as segment_file:
            segment_file.write(b"segment")
        Media.objects.filter(pk=self.media.pk).update(hls_file=hls_path)

        self.media.refresh_from_db()

        self.assertEqual(
            calculate_media_storage_usage(self.media),
            10 + 5 + 6 + 6 + 7 + 7 + 3 + 3 + 7,
        )

    def test_calculate_media_storage_usage_counts_duplicate_paths_once(self):
        thumbnail_name = self._attach_file(self.media, "thumbnail", "same.jpg", b"same-file")
        Media.objects.filter(pk=self.media.pk).update(poster=thumbnail_name)
        self.media.refresh_from_db()

        self.assertEqual(calculate_media_storage_usage(self.media), 9)

    def test_refresh_media_storage_usage_updates_media_and_clears_cache(self):
        self._attach_file(self.media, "media_file", "original.mp4", b"stored")
        Media.objects.filter(pk=self.media.pk).update(storage_usage_bytes=0)
        cache.set(f"storage_usage:user:{self.user.id}", 1)
        cache.set("storage_usage:site", 1)

        self.assertEqual(refresh_media_storage_usage(self.media.pk), 6)

        self.media.refresh_from_db()
        self.assertEqual(self.media.storage_usage_bytes, 6)
        self.assertIsNone(cache.get(f"storage_usage:user:{self.user.id}"))
        self.assertIsNone(cache.get("storage_usage:site"))

    def test_context_processor_exposes_user_and_site_storage_usage(self):
        other_user = create_test_user(username="storage_other")
        other_media = create_test_media(other_user)
        Media.objects.filter(pk=self.media.pk).update(storage_usage_bytes=11)
        Media.objects.filter(pk=other_media.pk).update(storage_usage_bytes=17)

        request = RequestFactory().get("/")
        request.user = self.user
        context = stuff(request)
        self.assertEqual(context["STORAGE_SCOPE"], "user")
        self.assertEqual(context["STORAGE_USED_BYTES"], 11)

        anonymous_request = RequestFactory().get("/")
        anonymous_request.user = AnonymousUser()
        context = stuff(anonymous_request)
        self.assertEqual(context["STORAGE_SCOPE"], "site")
        self.assertEqual(context["STORAGE_USED_BYTES"], 28)

    def test_backfill_media_storage_usage_command_updates_media(self):
        self._attach_file(self.media, "media_file", "original.mp4", b"stored")
        Media.objects.filter(pk=self.media.pk).update(storage_usage_bytes=0)

        out = StringIO()
        call_command("backfill_media_storage_usage", batch_size=1, stdout=out)

        self.media.refresh_from_db()
        self.assertEqual(self.media.storage_usage_bytes, 6)
        self.assertIn("Storage usage backfill complete", out.getvalue())

    def test_create_hls_refreshes_storage_usage_when_hls_path_is_unchanged(self):
        fake_mp4hls = os.path.join(self.tmpdir.name, "mp4hls")
        with open(fake_mp4hls, "w", encoding="utf-8") as command_file:
            command_file.write("#!/bin/sh\n")

        self._attach_file(self.media, "media_file", "original.mp4", b"original")
        encoding = Encoding.objects.create(media=self.media, profile=self._profile(), status="success")
        self._attach_file(encoding, "media_file", "encoded.mp4", b"encoded")

        hls_path = os.path.join(self.hls_dir, self.media.uid.hex, "master.m3u8")
        os.makedirs(os.path.dirname(hls_path), exist_ok=True)
        with open(hls_path, "wb") as master_file:
            master_file.write(b"old")
        Media.objects.filter(pk=self.media.pk).update(hls_file=hls_path)

        def fake_run(command, capture_output):
            output_dir = next(
                (part.removeprefix("--output-dir=") for part in command if part.startswith("--output-dir=")),
                None,
            )
            if output_dir is None:
                raise ValueError("Expected mp4hls command to include --output-dir=<path>")
            os.makedirs(output_dir, exist_ok=True)
            with open(os.path.join(output_dir, "master.m3u8"), "wb") as master_file:
                master_file.write(b"new")
            return MagicMock(returncode=0)

        with (
            override_settings(MP4HLS_COMMAND=fake_mp4hls),
            patch("files.tasks.subprocess.run", side_effect=fake_run),
            patch("files.tasks.schedule_refresh_media_storage_usage") as schedule_refresh,
        ):
            self.assertTrue(tasks.create_hls(self.media.friendly_token))

        self.media.refresh_from_db()
        self.assertEqual(self.media.hls_file, hls_path)
        schedule_refresh.assert_called_once_with(self.media.id)
