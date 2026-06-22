import os
import tempfile
from io import StringIO
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import TestCase, override_settings

from files.models import Media
from files.sprites import generate_sprite_for_media, resolve_imagemagick_command
from files.tests.helpers import create_test_media, create_test_user


class VideoSpriteBackfillTests(TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        self.fake_ffmpeg = self._fake_executable("ffmpeg")
        self.fake_magick = self._fake_executable("magick")
        self.override = override_settings(
            ADMINS_NOTIFICATIONS={"NEW_USER": False},
            MEDIA_ROOT=self.tmpdir.name,
            TEMP_DIRECTORY=self.tmpdir.name,
            FFMPEG_COMMAND=self.fake_ffmpeg,
            IMAGEMAGICK_COMMAND=self.fake_magick,
        )
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.user = create_test_user(username="sprite_owner")

    def _fake_executable(self, name):
        command_path = os.path.join(self.tmpdir.name, name)
        with open(command_path, "w", encoding="utf-8") as command_file:
            command_file.write("#!/bin/sh\n")
        os.chmod(command_path, 0o700)
        return command_path

    def _attach_media_file(self, media, name="original.mp4"):
        media.media_file.save(name, ContentFile(b"video"), save=False)
        Media.objects.filter(pk=media.pk).update(media_file=media.media_file.name)
        media.refresh_from_db()
        media._Media__original_media_file = media.media_file
        return media

    def _attach_sprite_file(self, media, name="sprites.jpg"):
        media.sprites.save(name, ContentFile(b"sprite"), save=False)
        Media.objects.filter(pk=media.pk).update(sprites=media.sprites.name)
        media.refresh_from_db()
        return media

    def test_generate_sprite_for_media_saves_sprite_on_success(self):
        media = self._attach_media_file(create_test_media(self.user))

        def fake_run(command):
            if command[0] == self.fake_ffmpeg:
                # Each tile is extracted with its own `-ss <time> ... -y <frame_path>`.
                with open(command[-1], "wb") as frame_file:
                    frame_file.write(b"frame")
            else:
                with open(command[-1], "wb") as sprite_file:
                    sprite_file.write(b"sprite")
            return {"out": "", "error": ""}

        with (
            patch("files.sprites.run_command", side_effect=fake_run),
            patch("files.sprites.get_file_type", return_value="image"),
        ):
            result = generate_sprite_for_media(media)

        media.refresh_from_db()
        self.assertTrue(result["ok"])
        self.assertTrue(media.sprites)
        self.assertIn("original.mp4sprites.jpg", media.sprites.name)

    @override_settings(SPRITE_NUM_SECS=10)
    def test_generate_sprite_extracts_tiles_at_exact_interval_timestamps(self):
        # The fix: each tile is extracted at an exact `-ss i*SPRITE_NUM_SECS` so the tile a
        # user clicks matches the poster the backend later generates for that same second.
        media = self._attach_media_file(create_test_media(self.user, duration=35))

        seek_times = []

        def fake_run(command):
            if command[0] == self.fake_ffmpeg:
                # command is [ffmpeg, -threads, 1, -ss, <time>, -i, file, -vframes, 1, -vf, scale, -y, frame]
                seek_times.append(command[command.index("-ss") + 1])
                with open(command[-1], "wb") as frame_file:
                    frame_file.write(b"frame")
            else:
                with open(command[-1], "wb") as sprite_file:
                    sprite_file.write(b"sprite")
            return {"out": "", "error": ""}

        with (
            patch("files.sprites.run_command", side_effect=fake_run),
            patch("files.sprites.get_file_type", return_value="image"),
        ):
            result = generate_sprite_for_media(media)

        self.assertTrue(result["ok"])
        # duration=35, interval=10 -> tiles at 0, 10, 20, 30 (range(0, 35, 10))
        self.assertEqual(seek_times, ["0", "10", "20", "30"])

    def test_generate_sprite_for_media_reports_missing_duration(self):
        media = self._attach_media_file(create_test_media(self.user, duration=0))

        result = generate_sprite_for_media(media)

        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "missing_duration")

    def test_generate_sprite_for_media_fails_when_any_expected_tile_is_missing(self):
        media = self._attach_media_file(create_test_media(self.user, duration=25))

        def fake_run(command):
            if command[0] == self.fake_ffmpeg:
                timestamp = command[command.index("-ss") + 1]
                if timestamp != "10":
                    with open(command[-1], "wb") as frame_file:
                        frame_file.write(b"frame")
            return {"out": "", "error": "missing frame"}

        with patch("files.sprites.run_command", side_effect=fake_run):
            result = generate_sprite_for_media(media)

        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "ffmpeg_missing_frame")

    def test_generate_sprite_for_media_reports_missing_ffmpeg(self):
        media = self._attach_media_file(create_test_media(self.user))

        with override_settings(FFMPEG_COMMAND="/missing/ffmpeg"):
            result = generate_sprite_for_media(media)

        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "missing_ffmpeg")

    def test_generate_sprite_for_media_reports_missing_imagemagick(self):
        media = self._attach_media_file(create_test_media(self.user))

        with (
            override_settings(IMAGEMAGICK_COMMAND=None),
            patch("files.sprites.shutil.which", return_value=None),
        ):
            result = generate_sprite_for_media(media)

        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "missing_imagemagick")

    def test_generate_sprite_for_media_reports_missing_output(self):
        media = self._attach_media_file(create_test_media(self.user))

        def fake_run(command):
            if command[0] == self.fake_ffmpeg:
                with open(command[-1], "wb") as frame_file:
                    frame_file.write(b"frame")
            return {"out": "", "error": "no output"}

        with patch("files.sprites.run_command", side_effect=fake_run):
            result = generate_sprite_for_media(media)

        media.refresh_from_db()
        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "imagemagick_no_output")
        self.assertFalse(media.sprites)

    def test_resolve_imagemagick_command_prefers_convert_then_magick(self):
        with (
            override_settings(IMAGEMAGICK_COMMAND=None),
            patch(
                "files.sprites.shutil.which",
                side_effect=lambda command: f"/bin/{command}" if command == "convert" else None,
            ),
        ):
            self.assertEqual(resolve_imagemagick_command(), ["/bin/convert"])

        with (
            override_settings(IMAGEMAGICK_COMMAND=None),
            patch(
                "files.sprites.shutil.which", side_effect=lambda command: "/bin/magick" if command == "magick" else None
            ),
        ):
            self.assertEqual(resolve_imagemagick_command(), ["/bin/magick"])

    def test_backfill_command_enqueues_missing_video_sprites_only(self):
        target = self._attach_media_file(create_test_media(self.user))
        existing = self._attach_sprite_file(self._attach_media_file(create_test_media(self.user)))
        missing_file = create_test_media(self.user)
        self._attach_media_file(create_test_media(self.user, media_type="audio"))

        out = StringIO()
        with patch("files.management.commands.backfill_video_sprites.produce_sprite_from_video.delay") as delay:
            call_command(
                "backfill_video_sprites",
                user_id=self.user.id,
                min_age_minutes=0,
                sleep=0,
                stdout=out,
            )

        delay.assert_called_once_with(target.friendly_token)
        self.assertNotIn(existing.friendly_token, str(delay.mock_calls))
        self.assertNotIn(missing_file.friendly_token, str(delay.mock_calls))
        self.assertIn("enqueued=1", out.getvalue())
        self.assertIn("skipped_missing_media_file=1", out.getvalue())

    def test_backfill_command_repairs_missing_sprite_file(self):
        media = self._attach_media_file(create_test_media(self.user))
        Media.objects.filter(pk=media.pk).update(sprites="original/thumbnails/missing-sprites.jpg")
        media.refresh_from_db()

        out = StringIO()
        with patch("files.management.commands.backfill_video_sprites.produce_sprite_from_video.delay") as delay:
            call_command(
                "backfill_video_sprites",
                repair_missing_files=True,
                user_id=self.user.id,
                min_age_minutes=0,
                sleep=0,
                stdout=out,
            )

        delay.assert_called_once_with(media.friendly_token)

    def test_backfill_command_default_skips_broken_sprite_reference(self):
        # A row whose sprites value points at a missing file looks "done" to the
        # default query and must be skipped unless --repair-missing-files is passed.
        media = self._attach_media_file(create_test_media(self.user))
        Media.objects.filter(pk=media.pk).update(sprites="original/thumbnails/missing-sprites.jpg")

        with patch("files.management.commands.backfill_video_sprites.produce_sprite_from_video.delay") as delay:
            call_command(
                "backfill_video_sprites",
                user_id=self.user.id,
                min_age_minutes=0,
                sleep=0,
                stdout=StringIO(),
            )

        delay.assert_not_called()

    def test_backfill_command_skips_unencoded_videos_by_default(self):
        encoded = self._attach_media_file(create_test_media(self.user))
        Media.objects.filter(pk=encoded.pk).update(encoding_status="success")
        for status in ("pending", "running", "fail"):
            pending = self._attach_media_file(create_test_media(self.user))
            Media.objects.filter(pk=pending.pk).update(encoding_status=status)

        with patch("files.management.commands.backfill_video_sprites.produce_sprite_from_video.delay") as delay:
            call_command(
                "backfill_video_sprites",
                user_id=self.user.id,
                min_age_minutes=0,
                sleep=0,
                stdout=StringIO(),
            )

        # Only the successfully-encoded video is targeted.
        delay.assert_called_once_with(encoded.friendly_token)

    def test_backfill_command_include_unencoded_targets_all_statuses(self):
        tokens = []
        for status in ("success", "pending", "running"):
            media = self._attach_media_file(create_test_media(self.user))
            Media.objects.filter(pk=media.pk).update(encoding_status=status)
            tokens.append(media.friendly_token)

        with patch("files.management.commands.backfill_video_sprites.produce_sprite_from_video.delay") as delay:
            call_command(
                "backfill_video_sprites",
                include_unencoded=True,
                user_id=self.user.id,
                min_age_minutes=0,
                sleep=0,
                stdout=StringIO(),
            )

        enqueued_tokens = {call.args[0] for call in delay.mock_calls}
        self.assertEqual(enqueued_tokens, set(tokens))
