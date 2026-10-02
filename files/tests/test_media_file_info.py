import json
import tempfile
from unittest.mock import patch

from django.test import SimpleTestCase

from files.helpers import get_media_stream_maps, media_file_info, produce_ffmpeg_commands


class MediaFileInfoTests(SimpleTestCase):
    def setUp(self):
        self.video = {
            "index": 0,
            "codec_type": "video",
            "codec_name": "hevc",
            "duration": "3",
            "bit_rate": "1000000",
            "r_frame_rate": "25/1",
            "width": 1920,
            "height": 1080,
        }
        self.audio = {
            "index": 1,
            "codec_type": "audio",
            "codec_name": "aac",
            "duration": "3",
            "bit_rate": "128000",
            "sample_rate": "48000",
            "channels": 2,
        }

    def probe(self, streams):
        def run_command(command):
            if command[0] == "stat":
                return {"out": "1024"}
            if command[0] == "md5sum":
                return {"out": "test-checksum input.mov"}
            return {"out": json.dumps({"streams": streams})}

        with tempfile.NamedTemporaryFile() as source, patch("files.helpers.run_command", side_effect=run_command):
            return media_file_info(source.name)

    def test_unidentified_audio_returns_controlled_failure(self):
        audio = dict(self.audio)
        del audio["codec_name"]
        with self.assertLogs("files.helpers", level="WARNING") as logs:
            result = self.probe([self.video, audio])
        self.assertTrue(result["fail"])
        self.assertEqual(result["error"], "incomplete_audio_metadata")
        self.assertIn("incomplete_audio_metadata", logs.output[0])

    def test_recognized_audio_is_selected_and_mapped_before_unidentified_track(self):
        self.audio["index"] = 3
        unidentified = dict(self.audio, index=5, channels=6)
        del unidentified["codec_name"]
        result = self.probe([self.video, self.audio, unidentified])
        self.assertNotIn("fail", result)
        self.assertEqual(result["audio_codec"], "aac")
        self.assertEqual(result["audio_info"]["index"], 3)
        commands = produce_ffmpeg_commands("input.mov", json.dumps(result), 720, "h264", "output.mp4", "pass")
        for command in commands:
            maps = [command[i + 1] for i, arg in enumerate(command) if arg == "-map"]
            self.assertEqual(maps, ["0:0", "0:3"])

    def test_hevc_with_aac_preserves_audio_metadata(self):
        result = self.probe([self.video, self.audio])
        self.assertTrue(result["is_video"])
        self.assertTrue(result["has_audio"])
        self.assertEqual(result["video_codec"], "hevc")
        self.assertEqual(result["audio_codec"], "aac")
        self.assertEqual(result["audio_sample_rate"], "48000")
        self.assertEqual(result["audio_channels"], 2)

    def test_hevc_without_audio_remains_video_only(self):
        result = self.probe([self.video])
        self.assertTrue(result["is_video"])
        self.assertFalse(result["has_audio"])
        self.assertNotIn("audio_codec", result)
        self.assertEqual(get_media_stream_maps(result), ["-map", "0:0"])

    def test_missing_or_empty_audio_fields_fail_without_silent_audio_loss(self):
        for key in ("codec_name", "sample_rate", "channels"):
            for value in (None, "", 0):
                with self.subTest(key=key, value=value), self.assertLogs("files.helpers", level="WARNING"):
                    result = self.probe([self.video, dict(self.audio, **{key: value})])
                    self.assertEqual(result, {"fail": True, "error": "incomplete_audio_metadata"})

    def test_audio_only_with_unidentified_codec_fails(self):
        with self.assertLogs("files.helpers", level="WARNING"):
            result = self.probe([dict(self.audio, codec_name="")])
        self.assertEqual(result, {"fail": True, "error": "incomplete_audio_metadata"})

    def test_incomplete_video_metadata_fails(self):
        for key in ("codec_name", "width", "height", "r_frame_rate"):
            with self.subTest(key=key), self.assertLogs("files.helpers", level="WARNING"):
                result = self.probe([dict(self.video, **{key: None}), self.audio])
                self.assertEqual(result, {"fail": True, "error": "incomplete_video_metadata"})

    def test_recognized_audio_after_unidentified_track_is_selected(self):
        result = self.probe([self.video, dict(self.audio, codec_name="", index=2), self.audio])
        self.assertEqual(result["audio_info"]["index"], 1)
        self.assertTrue(result["has_audio"])

    def test_chunk_commands_map_renumbered_streams(self):
        self.video["index"] = 2
        self.audio["index"] = 5
        result = self.probe([self.video, self.audio])
        self.assertEqual(get_media_stream_maps(result), ["-map", "0:2", "-map", "0:5"])
        commands = produce_ffmpeg_commands(
            "chunk.mkv", json.dumps(result), 720, "h264", "output.mp4", "pass", chunk=True
        )
        for command in commands:
            maps = [command[i + 1] for i, arg in enumerate(command) if arg == "-map"]
            self.assertEqual(maps, ["0:v:0", "0:a:0"])

    def test_first_pass_excludes_audio_and_second_pass_maps_it(self):
        self.video["duration"] = "1"
        result = self.probe([self.video, self.audio])
        commands = produce_ffmpeg_commands("input.mov", json.dumps(result), 720, "h264", "output.mp4", "pass")
        self.assertEqual(len(commands), 2)
        maps = [[command[i + 1] for i, arg in enumerate(command) if arg == "-map"] for command in commands]
        self.assertEqual(maps, [["0:0"], ["0:0", "0:1"]])

    def test_legacy_metadata_keeps_automatic_selection(self):
        self.assertEqual(get_media_stream_maps({"has_audio": True}), [])
