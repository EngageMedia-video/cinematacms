"""FFmpeg failures must keep the lines that name the cause, under a header that groups by cause."""

from io import BytesIO
from types import SimpleNamespace
from unittest.mock import patch

from django.test import SimpleTestCase

from files.backends import FFmpegBackend
from files.exceptions import VideoEncodingError
from files.helpers import calculate_seconds
from files.tests.test_encoding import build_command

BANNER = "".join(f"[info]   configuration line {n}: --enable-something-long-enough-to-matter\n" for n in range(40))
X264_OPTIONS = "[libx264 @ 0x7b29039180] [info] 264 - core 165 - options: " + "cabac=1 " * 150 + "\n"
PROGRESS = "".join(
    f"[info] frame=  {n} fps=0.0 q=0.0 size=0KiB time=00:00:0{n}.00 bitrate=0.0kbits/s\r" for n in range(5)
)


def failure_tail(address):
    return (
        f"[mp4 @ 0x{address}280] [error] Could not find tag for codec h264 in stream #0, codec not currently supported in container\n"
        f"[out#0/mp4 @ 0x{address}300] [error] Could not write header (incorrect codec parameters ?): Invalid argument\n"
        f"[vf#0:0 @ 0x{address}a00] [error] Error sending frames to consumers: Invalid argument\n"
        f"[vf#0:0 @ 0x{address}a00] [error] Task finished with error code: -22 (Invalid argument)\n"
        f"[vf#0:0 @ 0x{address}a00] [error] Terminating thread with return code -22 (Invalid argument)\n"
        f"[out#0/mp4 @ 0x{address}300] [error] Nothing was written into output file, because at least one of its streams received no packets.\n"
        "[info] frame=    0 fps=0.0 q=0.0 Lsize=       0KiB time=00:00:03.00 bitrate=   0.0kbits/s speed=46x\n"
        f"[aac @ 0x{address}c00] [info] Qavg: 840.065\n"
        "[info] Conversion failed!\n"
    )


def fake_process(stderr, returncode):
    return SimpleNamespace(
        stderr=BytesIO(stderr.encode("utf-8")),
        returncode=returncode,
        communicate=lambda: (b"", b""),
    )


def run_encode(stderr, returncode):
    backend = FFmpegBackend()
    with patch.object(backend, "_spawn", return_value=fake_process(stderr, returncode)):
        progress = []
        try:
            for item in backend.encode(["ffmpeg"]):
                progress.append(item)
        except VideoEncodingError as error:
            return progress, error.message
    return progress, None


class FFmpegFailureMessageTests(SimpleTestCase):
    def test_message_opens_with_the_first_error_line_without_addresses(self):
        _, message = run_encode(BANNER + X264_OPTIONS + PROGRESS + failure_tail("7b28c2"), returncode=234)

        self.assertEqual(
            message.splitlines()[0],
            "[mp4] [error] Could not find tag for codec h264 in stream #0, codec not currently supported in container",
        )

    def test_error_under_a_parent_context_opens_the_message(self):
        stderr = (
            "[Parsed_scale_0 @ 0x76fcc38300] [Eval @ 0x16fde7ca0] [error] Undefined constant or missing '(' in 'foo'\n"
            "[Parsed_scale_0 @ 0x76fcc38300] [error] Cannot parse expression for width: 'foo'\n"
            "[fatal] Error opening output files: Invalid argument\n"
        )
        _, message = run_encode(stderr, returncode=234)

        self.assertEqual(
            message.splitlines()[0],
            "[Parsed_scale_0] [Eval] [error] Undefined constant or missing '(' in 'foo'",
        )

    def test_same_cause_gives_same_header_across_runs(self):
        _, first = run_encode(BANNER + PROGRESS + failure_tail("7b28c2"), returncode=234)
        _, second = run_encode(X264_OPTIONS + failure_tail("9a11f0"), returncode=234)

        self.assertEqual(first.splitlines()[0], second.splitlines()[0])

    def test_message_keeps_whole_cause_and_summary_lines(self):
        _, message = run_encode(BANNER + X264_OPTIONS + PROGRESS + failure_tail("7b28c2"), returncode=234)
        lines = message.splitlines()

        self.assertIn(
            "[mp4 @ 0x7b28c2280] [error] Could not find tag for codec h264 in stream #0, codec not currently supported in container",
            lines,
        )
        self.assertIn("[info] Conversion failed!", lines)

    def test_first_errors_survive_a_long_tail(self):
        noise = "".join(f"[info] trailing diagnostic line {n}\n" for n in range(200))
        _, message = run_encode("[in#0 @ 0x1] [error] Error opening input: Invalid data\n" + noise, returncode=1)

        self.assertIn("[in#0 @ 0x1] [error] Error opening input: Invalid data", message.splitlines())
        self.assertIn("[info] trailing diagnostic line 199", message.splitlines())
        self.assertLess(len(message), 20_000)

    def test_multibyte_character_split_across_reads_is_kept(self):
        prefix = "[error] a"
        self.assertEqual(len(prefix.encode("utf-8")) % 10, 9)
        _, message = run_encode(prefix + "é café failed\n", returncode=1)

        self.assertIn("aé café failed", message)

    def test_silent_failure_names_the_exit_status(self):
        _, message = run_encode("", returncode=1)

        self.assertEqual(message, "FFmpeg exited with status 1")

    def test_progress_is_still_reported(self):
        progress, message = run_encode(PROGRESS + failure_tail("7b28c2"), returncode=234)

        self.assertEqual([calculate_seconds(item) for item in progress], [0, 1, 2, 3, 4])
        self.assertIsNotNone(message)


class FFmpegSuccessOutputTests(SimpleTestCase):
    def test_success_yields_the_closing_lines(self):
        stderr = (
            BANNER + PROGRESS + "[info] frame=  120 time=00:00:05.00 bitrate=1.0kbits/s\n[aac @ 0x1] [info] Qavg: 1.0\n"
        )
        progress, message = run_encode(stderr, returncode=0)

        self.assertIsNone(message)
        self.assertTrue(progress[-1].endswith("[aac @ 0x1] [info] Qavg: 1.0"))


class EncodeCommandLogLevelTests(SimpleTestCase):
    def test_encode_commands_tag_each_log_line_with_its_level(self):
        cmd = build_command("libx264")

        self.assertEqual(cmd[cmd.index("-loglevel") + 1], "level+info")
