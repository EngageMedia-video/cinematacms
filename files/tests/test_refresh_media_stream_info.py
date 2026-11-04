"""Older inspections stored the cover-art stream as the video, so every encode mapped it and wrote nothing."""

import json
import tempfile
from io import StringIO
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.core.management import call_command
from django.test import TestCase, override_settings

from files.models import Media
from files.tests.helpers import create_test_media, create_test_user

COVER_ART = {
    "index": 0,
    "codec_type": "video",
    "codec_name": "mjpeg",
    "width": 600,
    "height": 600,
    "r_frame_rate": "0/0",
    "disposition": {"attached_pic": 1},
}
VIDEO = {
    "index": 1,
    "codec_type": "video",
    "codec_name": "h264",
    "width": 1920,
    "height": 1080,
    "r_frame_rate": "25/1",
    "duration": "95.5",
    "bit_rate": "1000000",
    "disposition": {"attached_pic": 0},
}
AUDIO = {
    "index": 2,
    "codec_type": "audio",
    "codec_name": "aac",
    "duration": "95.5",
    "bit_rate": "128000",
    "sample_rate": "48000",
    "channels": 2,
}


def stored_info(video_info):
    return json.dumps({"video_info": video_info, "audio_info": AUDIO, "has_audio": True, "is_video": True})


class RefreshMediaStreamInfoTests(TestCase):
    def setUp(self):
        media_root = tempfile.TemporaryDirectory()
        self.addCleanup(media_root.cleanup)
        override = override_settings(MEDIA_ROOT=media_root.name)
        override.enable()
        self.addCleanup(override.disable)
        self.user = create_test_user()
        self.probes = []

    def _video(self, video_info, media_file="original.mp4", store_file=True, media_info=None):
        media = create_test_media(self.user, duration=1, video_height=600)
        if store_file:
            media_file = media._meta.get_field("media_file").storage.save(media_file, ContentFile(b"content"))
        Media.objects.filter(pk=media.pk).update(
            media_file=media_file, media_info=stored_info(video_info) if media_info is None else media_info
        )
        media.refresh_from_db()
        return media

    def _run(self, *args, streams=(COVER_ART, VIDEO, AUDIO)):
        def run_command(command, cwd=None):
            if command[0] == "stat":
                return {"out": "1024"}
            if command[0] == "md5sum":
                return {"out": "checksum original.mp4"}
            self.probes.append(command)
            return {"out": json.dumps({"streams": list(streams)})}

        out, err = StringIO(), StringIO()
        with patch("files.helpers.run_command", side_effect=run_command):
            call_command("refresh_media_stream_info", *args, stdout=out, stderr=err)
        return out.getvalue(), err.getvalue()

    def _video_info(self, media):
        media.refresh_from_db()
        return json.loads(media.media_info)["video_info"]

    def test_repairs_rows_whose_stored_video_stream_is_the_cover_art(self):
        legacy = self._video(COVER_ART)
        healthy = self._video(VIDEO)
        healthy_before = (healthy.media_info, healthy.duration, healthy.video_height, healthy.edit_date)

        out, err = self._run()

        self.assertEqual(self._video_info(legacy)["index"], VIDEO["index"])
        self.assertFalse(self._video_info(legacy)["disposition"]["attached_pic"])
        self.assertEqual((legacy.duration, legacy.video_height), (96, 1080))
        self.assertEqual((legacy.media_type, legacy.state, legacy.encoding_status), ("video", "public", "success"))
        healthy.refresh_from_db()
        self.assertEqual(
            (healthy.media_info, healthy.duration, healthy.video_height, healthy.edit_date), healthy_before
        )
        self.assertEqual(len(self.probes), 1)
        self.assertIn(f"id={legacy.pk} token={legacy.friendly_token} action=repair result=succeeded", out)
        self.assertIn("scanned=2 affected=1 repaired=1 skipped=0 failed=0 mode=repair", out)
        self.assertEqual(err, "")

    def test_a_repaired_row_keeps_its_edit_date(self):
        legacy = self._video(COVER_ART)
        edit_date = legacy.edit_date

        self._run()

        legacy.refresh_from_db()
        self.assertEqual(legacy.edit_date, edit_date)

    def test_a_second_run_finds_nothing_left_to_repair(self):
        self._video(COVER_ART)
        self._run()

        out, _ = self._run()

        self.assertIn("scanned=1 affected=0 repaired=0 skipped=0 failed=0 mode=repair", out)
        self.assertEqual(len(self.probes), 1)

    def test_dry_run_lists_the_affected_rows_and_changes_nothing(self):
        legacy = self._video(COVER_ART)
        self._video(VIDEO)

        out, _ = self._run("--dry-run")

        self.assertEqual(self._video_info(legacy), COVER_ART)
        self.assertEqual(self.probes, [])
        self.assertIn(f"id={legacy.pk} token={legacy.friendly_token} action=would_repair result=dry_run", out)
        self.assertIn("scanned=2 affected=1 repaired=0 skipped=0 failed=0 mode=dry_run", out)

    def test_reports_a_missing_file_and_repairs_the_next_row(self):
        gone = self._video(COVER_ART, media_file="gone.mp4", store_file=False)
        legacy = self._video(COVER_ART)

        out, err = self._run()

        self.assertEqual(self._video_info(gone), COVER_ART)
        self.assertEqual(self._video_info(legacy)["index"], VIDEO["index"])
        self.assertIn(f"id={gone.pk} token={gone.friendly_token} action=repair result=failed error=", err)
        self.assertIn("scanned=2 affected=2 repaired=1 skipped=0 failed=1 mode=repair", out)

    def _stored_fields(self, media):
        media.refresh_from_db()
        return (media.media_info, media.media_type, media.encoding_status, media.duration, media.video_height)

    def test_reports_audio_only_when_inspection_finds_only_the_cover_art_and_audio(self):
        legacy = self._video(COVER_ART)
        before = self._stored_fields(legacy)

        out, err = self._run(streams=(COVER_ART, AUDIO))

        self.assertEqual(self._stored_fields(legacy), before)
        self.assertIn(
            f"id={legacy.pk} token={legacy.friendly_token} action=repair result=failed error=inspection found audio only",
            err,
        )
        self.assertIn("scanned=1 affected=1 repaired=0 skipped=0 failed=1 mode=repair", out)

    def test_leaves_a_row_alone_when_inspection_finds_no_stream_at_all(self):
        legacy = self._video(COVER_ART)
        before = self._stored_fields(legacy)

        out, err = self._run(streams=())

        self.assertEqual(self._stored_fields(legacy), before)
        self.assertIn(
            f"id={legacy.pk} token={legacy.friendly_token} action=repair result=failed "
            "error=inspection did not find a video stream",
            err,
        )
        self.assertIn("scanned=1 affected=1 repaired=0 skipped=0 failed=1 mode=repair", out)

    def test_skips_a_row_whose_file_was_replaced_during_inspection(self):
        legacy = self._video(COVER_ART)
        replacement = {
            "media_file": "replacement.mp4",
            "media_info": stored_info(VIDEO),
            "duration": 7,
            "video_height": 720,
        }
        inspect = Media.set_media_type

        def replace_source_during_inspection(media, save=True):
            inspect(media, save=save)
            Media.objects.filter(pk=media.pk).update(**replacement)

        with patch.object(Media, "set_media_type", replace_source_during_inspection):
            out, err = self._run()

        legacy.refresh_from_db()
        self.assertEqual(
            (legacy.media_file.name, legacy.media_info, legacy.duration, legacy.video_height),
            tuple(replacement.values()),
        )
        self.assertIn(
            f"id={legacy.pk} token={legacy.friendly_token} action=repair result=skipped "
            "error=media file changed during inspection",
            err,
        )
        self.assertIn("scanned=1 affected=1 repaired=0 skipped=1 failed=0 mode=repair", out)

    def test_skips_rows_without_usable_stored_info(self):
        for media_info in ("", "not json", json.dumps({"video_info": {}}), json.dumps([])):
            self._video(VIDEO, media_info=media_info)

        out, _ = self._run()

        self.assertIn("scanned=4 affected=0 repaired=0 skipped=0 failed=0 mode=repair", out)
        self.assertEqual(self.probes, [])
