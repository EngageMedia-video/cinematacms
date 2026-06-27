import os
import tempfile
from io import StringIO
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import TestCase, override_settings

from files.models import Media
from files.sprites import generate_sprite_for_media, resolve_imagemagick_command, resolve_sprite_interval
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
        media.refresh_from_db()
        # Short video keeps the base interval and persists it for the selector.
        self.assertEqual(media.sprite_num_secs, 10)
        self.assertEqual(result["sprite_num_secs"], 10)

    @override_settings(SPRITE_NUM_SECS=10, SPRITE_MAX_TILES=100)
    def test_generate_sprite_caps_tile_count_for_long_videos(self):
        # A 27-minute video at 10s spacing would be 162 tiles. With max_tiles=100 the
        # interval widens to ceil(1620/100)=17s, yielding <=100 evenly spaced tiles, and
        # the widened interval is persisted so tile i still maps to time i*17.
        duration = 1620
        media = self._attach_media_file(create_test_media(self.user, duration=duration))

        seek_times = []

        def fake_run(command):
            if command[0] == self.fake_ffmpeg:
                seek_times.append(int(command[command.index("-ss") + 1]))
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
        self.assertEqual(media.sprite_num_secs, 17)
        self.assertEqual(result["sprite_num_secs"], 17)
        self.assertLessEqual(len(seek_times), 100)
        # Tiles are spaced exactly at the persisted interval starting from 0.
        self.assertEqual(seek_times[:3], [0, 17, 34])

    def test_generate_sprite_for_media_reports_missing_duration(self):
        media = self._attach_media_file(create_test_media(self.user, duration=0))

        result = generate_sprite_for_media(media)

        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "missing_duration")

    @override_settings(SPRITE_NUM_SECS=10)
    def test_generate_sprite_truncates_at_first_failed_tile(self):
        # A frame failure (e.g. a seek near EOF) must NOT abort the whole job. We keep the
        # contiguous run of tiles from index 0 and stop at the first failure, so surviving
        # tiles stay aligned to their original timestamps (tile i -> i * interval).
        media = self._attach_media_file(create_test_media(self.user, duration=45))

        appended_frames = []

        def fake_run(command):
            if command[0] == self.fake_ffmpeg:
                timestamp = command[command.index("-ss") + 1]
                # Frame at 20 fails; 0 and 10 succeed, 30/40 are never attempted.
                if timestamp == "20":
                    return {"out": "", "error": "seek failed"}
                with open(command[-1], "wb") as frame_file:
                    frame_file.write(b"frame")
            else:
                # ImageMagick append: every arg before -append is an input tile.
                appended_frames.extend(arg for arg in command if arg.endswith(".jpg") and "img" in arg)
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
        # Only the two tiles before the failure (img000, img001) make it into the sheet.
        self.assertEqual(len(appended_frames), 2)

    def test_generate_sprite_for_media_fails_when_first_tile_is_missing(self):
        # If even the very first tile cannot be extracted there is nothing to build a sheet
        # from, so the job reports ffmpeg_no_frames rather than producing an empty image.
        media = self._attach_media_file(create_test_media(self.user, duration=25))

        with patch("files.sprites.run_command", return_value={"out": "", "error": "missing frame"}):
            result = generate_sprite_for_media(media)

        self.assertFalse(result["ok"])
        self.assertEqual(result["reason"], "ffmpeg_no_frames")

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


class ResolveSpriteIntervalTests(TestCase):
    def test_short_video_keeps_base_interval(self):
        # Below the cap the base interval is used unchanged.
        self.assertEqual(resolve_sprite_interval(duration=120, base_interval=10, max_tiles=100), 10)

    def test_long_video_widens_interval_to_stay_under_cap(self):
        # 1620s / 100 tiles -> ceil = 17s spacing.
        self.assertEqual(resolve_sprite_interval(duration=1620, base_interval=10, max_tiles=100), 17)
        # Resulting tile count must not exceed the cap.
        interval = resolve_sprite_interval(duration=1620, base_interval=10, max_tiles=100)
        self.assertLessEqual(len(range(0, 1620, interval)), 100)

    def test_exactly_at_cap_keeps_base_interval(self):
        # duration / base_interval == max_tiles -> no widening needed.
        self.assertEqual(resolve_sprite_interval(duration=1000, base_interval=10, max_tiles=100), 10)

    def test_zero_or_negative_inputs_fall_back_to_base(self):
        self.assertEqual(resolve_sprite_interval(duration=0, base_interval=10, max_tiles=100), 10)
        self.assertEqual(resolve_sprite_interval(duration=1620, base_interval=10, max_tiles=0), 10)
        # A zero/None base interval is clamped to 1 (never 0, which would break range()/the
        # tile->timestamp mapping); the cap may still widen it: ceil(120/100) = 2.
        self.assertEqual(resolve_sprite_interval(duration=120, base_interval=0, max_tiles=100), 2)
        # With a short duration and a zero base interval, the clamp floor of 1 wins.
        self.assertEqual(resolve_sprite_interval(duration=50, base_interval=0, max_tiles=100), 1)
