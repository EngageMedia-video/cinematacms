import json
import tempfile
from unittest.mock import patch

from django.test import SimpleTestCase

from files.helpers import get_media_stream_maps, media_file_info, produce_ffmpeg_commands


class MediaFileInfoTests(SimpleTestCase):
    def setUp(self):
        self.commands = []
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
            self.commands.append(command)
            if command[0] == "stat":
                return {"out": "1024"}
            if command[0] == "md5sum":
                return {"out": "test-checksum input.mov"}
            if "packet=size" in command:
                return {"out": "1024\n"}
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

    def test_invalid_video_frame_rates_fail_cleanly(self):
        for rate in ("0/0", "25/0", "invalid", "0/1", "-25/1", None):
            with self.subTest(rate=rate), self.assertLogs("files.helpers", level="WARNING"):
                result = self.probe([dict(self.video, r_frame_rate=rate), self.audio])
                self.assertEqual(result, {"fail": True, "error": "incomplete_video_metadata"})

    def test_fractional_video_frame_rate_is_preserved(self):
        result = self.probe([dict(self.video, r_frame_rate="30000/1001"), self.audio])
        self.assertAlmostEqual(result["video_frame_rate"], 29.97002997002997)

    def test_main_video_is_selected_instead_of_later_preview(self):
        del self.video["bit_rate"]
        preview = dict(self.video, index=2, width=640, height=360, bit_rate="100000")
        result = self.probe([self.video, self.audio, preview])
        self.assertEqual(result["video_info"]["index"], 0)
        self.assertEqual(result["video_height"], 1080)
        self.assertEqual(result["video_bitrate"], 2.67)
        packet_probe = next(command for command in self.commands if "packet=size" in command)
        self.assertEqual(packet_probe[packet_probe.index("-select_streams") + 1], "0")
        self.assertEqual(get_media_stream_maps(result), ["-map", "0:0", "-map", "0:1"])
        commands = produce_ffmpeg_commands("input.mov", json.dumps(result), 720, "h264", "output.mp4", "pass")
        self.assertTrue(commands)
        for command in commands:
            self.assertEqual(command[command.index("-map") + 1], "0:0")

    def test_equal_resolution_prefers_the_lowest_stream_index(self):
        result = self.probe([dict(self.video, index=4), self.video, self.audio])
        self.assertEqual(result["video_info"]["index"], 0)

    def test_attached_picture_does_not_replace_main_video(self):
        picture = dict(
            self.video, index=2, width=8192, height=8192, r_frame_rate="0/0", disposition={"attached_pic": 1}
        )
        result = self.probe([self.video, self.audio, picture])
        self.assertEqual(result["video_info"]["index"], 0)

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

    def test_supported_text_subtitles_survive_webm_and_chunk_mapping(self):
        subtitle = {"index": 4, "codec_type": "subtitle", "codec_name": "subrip"}
        result = self.probe([self.video, self.audio, subtitle])
        self.assertEqual(result.get("subtitle_info"), subtitle)
        self.assertEqual(get_media_stream_maps(result), ["-map", "0:0", "-map", "0:1", "-map", "0:4"])
        for chunk in (False, True):
            with self.subTest(chunk=chunk):
                commands = produce_ffmpeg_commands(
                    "input.mkv", json.dumps(result), 720, "vp9", "output.webm", "pass", chunk=chunk
                )
                for command in commands:
                    maps = [command[i + 1] for i, arg in enumerate(command) if arg == "-map"]
                    self.assertEqual(maps, ["0:v:0", "0:a:0", "0:s:0"] if chunk else ["0:0", "0:1", "0:4"])

    def test_text_subtitle_selection_skips_bitmap_and_unknown_tracks(self):
        bitmap = {"index": 2, "codec_type": "subtitle", "codec_name": "hdmv_pgs_subtitle"}
        unknown = {"index": 3, "codec_type": "subtitle"}
        text = {"index": 4, "codec_type": "subtitle", "codec_name": "ass"}
        result = self.probe([self.video, bitmap, unknown, text, dict(text, index=5)])
        self.assertEqual(result["subtitle_info"], text)
        self.assertEqual(get_media_stream_maps(result), ["-map", "0:0", "-map", "0:4"])

    def test_bitmap_subtitles_are_not_mapped_to_webm(self):
        bitmap = {"index": 2, "codec_type": "subtitle", "codec_name": "dvd_subtitle"}
        result = self.probe([self.video, bitmap])
        self.assertEqual(result["subtitle_info"], {})
        commands = produce_ffmpeg_commands("input.mkv", json.dumps(result), 720, "vp9", "output.webm", "pass")
        for command in commands:
            maps = [command[i + 1] for i, arg in enumerate(command) if arg == "-map"]
            self.assertEqual(maps, ["0:0"])

    def test_subtitles_are_excluded_from_mp4_and_first_webm_pass(self):
        self.video["duration"] = "1"
        subtitle = {"index": 3, "codec_type": "subtitle", "codec_name": "subrip"}
        result = self.probe([self.video, self.audio, subtitle])
        for codec, output, expected in (
            ("h264", "output.mp4", [["0:0"], ["0:0", "0:1"]]),
            ("vp9", "output.webm", [["0:0"], ["0:0", "0:1", "0:3"]]),
        ):
            with self.subTest(codec=codec):
                commands = produce_ffmpeg_commands("input.mkv", json.dumps(result), 720, codec, output, "pass")
                maps = [[command[i + 1] for i, arg in enumerate(command) if arg == "-map"] for command in commands]
                self.assertEqual(maps, expected)
