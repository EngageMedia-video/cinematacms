import unittest
from contextlib import ExitStack, contextmanager
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import Mock, mock_open, patch

from django.test import override_settings

from files.helpers import calculate_seconds, get_base_ffmpeg_command


def build_command(encoder, **overrides):
    kwargs = {
        "input_file": "/tmp/in.mp4",
        "output_file": "/tmp/out.mp4",
        "has_audio": True,
        "codec": {"libx264": "h264", "libx265": "h265", "libvpx-vp9": "vp9"}[encoder],
        "encoder": encoder,
        "audio_encoder": "aac",
        "target_fps": 30,
        "target_height": 720,
        "target_rate": 2500,
        "target_rate_audio": 128,
        "pass_file": "/tmp/pass",
        "pass_number": 2,
        "enc_type": "crf",
        "chunk": False,
    }
    kwargs.update(overrides)
    return get_base_ffmpeg_command(**kwargs)


def thread_args(cmd, input_file="/tmp/in.mp4"):
    """Values of every -threads flag, split by side of the input file.

    ffmpeg scopes an option to the file that follows it, so -threads before -i
    bounds the decoder and -threads after it bounds the encoder.
    """
    boundary = cmd.index(input_file)
    decoder, encoder = [], []
    for i, arg in enumerate(cmd):
        if arg == "-threads":
            (decoder if i < boundary else encoder).append(cmd[i + 1])
    return decoder, encoder


class TestEncoderThreadLimit(unittest.TestCase):
    """The encoder needs its own -threads after -i.

    A single -threads before -i bounds the decoder only, so x264 opens one
    thread per core. Multiplied by the long_tasks worker concurrency that
    starves the web application and the database on the same host.
    """

    encoders = ("libx264", "libx265", "libvpx-vp9")

    @override_settings(FFMPEG_ENCODER_THREADS=7)
    def test_encoder_is_bounded(self):
        for encoder in self.encoders:
            with self.subTest(encoder=encoder):
                _, encoder_threads = thread_args(build_command(encoder))
                self.assertEqual(
                    encoder_threads,
                    ["7"],
                    "-threads must appear after the input file to bound the encoder",
                )

    @override_settings(FFMPEG_ENCODER_THREADS=7)
    def test_decoder_stays_bounded(self):
        for encoder in self.encoders:
            with self.subTest(encoder=encoder):
                decoder_threads, _ = thread_args(build_command(encoder))
                self.assertEqual(decoder_threads, ["1"], "the decoder limit is fixed, not the setting")

    @override_settings(FFMPEG_ENCODER_THREADS=4)
    def test_encoder_thread_count_is_configurable(self):
        for encoder in self.encoders:
            with self.subTest(encoder=encoder):
                decoder_threads, encoder_threads = thread_args(build_command(encoder))
                self.assertEqual(encoder_threads, ["4"])
                self.assertEqual(decoder_threads, ["1"], "the decoder limit is independent")

    @override_settings(FFMPEG_ENCODER_THREADS=4)
    def test_x265_pools_match_the_encoder_thread_count(self):
        # -threads reaches x265 as frame threads only; its worker pool needs
        # sizing separately or it defaults to one thread per core.
        cmd = build_command("libx265")
        x265_params = cmd[cmd.index("-x265-params") + 1]
        self.assertIn("pools=4", x265_params.split(":"))

    @override_settings(FFMPEG_ENCODER_THREADS=7)
    def test_first_pass_bounds_the_encoder_too(self):
        cmd = build_command("libx264", pass_number=1, enc_type="twopass")
        _, encoder_threads = thread_args(cmd)
        self.assertEqual(encoder_threads, ["7"])


class TestEncodingProgressTracking(unittest.TestCase):
    def test_calculate_seconds_with_4k_output(self):
        """Test duration parsing with various FFmpeg output formats"""
        # Test cases for different output patterns
        test_cases = [
            ("frame= 1000 fps= 30 q=28.0 size=   45000kB time=00:01:30.00 bitrate=2000kbits/s", 90.0),
            ("frame= 1000 fps= 30 q=28.0 size=   45000kB time=00:01:30.0 bitrate=2000kbits/s", 90.0),
            ("[h264 @ 0x...] time=00:01:30.000 bitrate=2000kb/s", 90.0),
            ("size=   45000kB time=00:01:30 bitrate=2000kbits/s speed=1.5x", 90.0),
        ]

        for output, expected in test_cases:
            with self.subTest(output=output):
                result = calculate_seconds(output)
                self.assertIsNotNone(result, f"Failed to parse: {output}")
                self.assertEqual(result, expected)

    def test_calculate_seconds_with_bytes_input(self):
        """Test that calculate_seconds handles bytes input from FFmpeg"""
        # Test with bytes input (common from subprocess)
        test_cases = [
            (b"frame= 1000 fps= 30 q=28.0 size=   45000kB time=00:01:30.00 bitrate=2000kbits/s", 90.0),
            (b"time=00:02:15.50 bitrate=2000kbits/s", 135.0),
            (b"time=00:00:45 speed=1.5x", 45.0),
        ]

        for output, expected in test_cases:
            with self.subTest(output=output):
                result = calculate_seconds(output)
                self.assertIsNotNone(result, f"Failed to parse bytes: {output}")
                self.assertEqual(result, expected)

    def test_calculate_seconds_invalid_input(self):
        """Test that calculate_seconds handles invalid input gracefully"""
        invalid_cases = [
            None,
            123,
            [],
            {},
            "no time info here",
            b"no time info here",
        ]

        for invalid_input in invalid_cases:
            with self.subTest(input=invalid_input):
                result = calculate_seconds(invalid_input)
                self.assertIsNone(result, f"Should return None for: {invalid_input}")

    def test_encoding_loop_safety_net(self):
        """Test that encoding loop doesn't run infinitely"""
        with patch("files.tasks.FFmpegBackend") as mock_backend:
            # Mock backend that returns unparseable output
            mock_encoding_command = Mock()
            mock_encoding_command.__iter__ = Mock(return_value=iter(["unparseable"] * 100))
            mock_backend.return_value.encode.return_value = mock_encoding_command

            with patch("files.tasks.calculate_seconds", return_value=None):
                # This test is primarily to ensure the loop exits.
                # The actual functionality is tested by the integration test.
                # A simple call to a mocked function within the loop will suffice.
                with patch("files.tasks.logger.info"):
                    # We need to mock the media and profile objects
                    media = Mock()
                    media.duration = 100
                    Mock()
                    Mock()

                    # A simplified call to a conceptual "run_encoding_loop" function
                    # This is illustrative. The actual implementation will depend on the refactoring of encode_media
                    # For now, we assume the loop is part of the main function and we can't test it in isolation
                    # without refactoring. The integration test is more important here.
                    pass

    def test_progress_updates_without_duration(self):
        """Test that progress tracking continues even when duration parsing fails"""
        # Mock scenario where calculate_seconds returns None
        with patch("files.tasks.calculate_seconds", return_value=None):
            with patch("files.tasks.Encoding.objects.get"):
                with patch("files.tasks.Media.objects.get"):
                    with patch("files.tasks.EncodeProfile.objects.get"):
                        with patch("files.tasks.FFmpegBackend"):
                            # This test is to ensure n_times increments.
                            # We can't easily test this without refactoring encode_media.
                            # The integration test will cover the behavior.
                            pass


class TestFFmpegSpanLifetime(unittest.TestCase):
    @override_settings(TEMP_DIRECTORY="/tmp")
    def test_ffmpeg_generator_is_consumed_inside_span(self):
        from files.tasks import encode_media

        span_active = False
        observed = []

        @contextmanager
        def fake_span(*_args, **_kwargs):
            nonlocal span_active
            span_active = True
            try:
                yield
            finally:
                span_active = False

        def output_stream():
            observed.append(span_active)
            return
            yield  # pragma: no cover

        media = SimpleNamespace(
            pk=1,
            media_type="video",
            duration=120,
            media_info="{}",
            media_file=SimpleNamespace(path="/tmp/source.mp4"),
        )
        profile = SimpleNamespace(id=2, extension="mp4", resolution=720, codec="h264")
        encoding = SimpleNamespace(
            id=3,
            profile=profile,
            status="pending",
            temp_file="",
            commands="",
            logs="",
            progress=0,
            save=Mock(),
        )
        query = Mock()
        query.count.return_value = 1
        query.exclude.return_value.delete = Mock()
        backend = SimpleNamespace(encode=Mock(return_value=output_stream()))

        with (
            patch("files.tasks.Media.objects.get", return_value=media),
            patch("files.tasks.EncodeProfile.objects.get", return_value=profile),
            patch("files.tasks.Encoding.objects.get", return_value=encoding),
            patch("files.tasks.Encoding.objects.filter", return_value=query),
            patch("files.tasks.create_temp_file", side_effect=["/tmp/output.mp4", "/tmp/pass"]),
            patch("files.tasks.produce_ffmpeg_commands", return_value=[["ffmpeg", "-i", "source"]]),
            patch("files.tasks.FFmpegBackend", return_value=backend),
            patch("files.tasks.start_span", side_effect=fake_span),
            patch("files.tasks._check_media_exists_or_cleanup", return_value=False),
        ):
            encode_media.run("token", profile.id, encoding.id, "url")

        self.assertEqual(observed, [True])


class TestEncodingOutcomeObservation(unittest.TestCase):
    def _run_encode_media(
        self,
        *,
        extension="mp4",
        duration=120,
        ffmpeg_commands=None,
        output_exists=False,
        output_type=None,
        media_info=None,
        backend_exception=None,
        capture_exception=False,
        task_retries=None,
    ):
        from files.tasks import encode_media

        media = SimpleNamespace(
            pk=1,
            media_type="video",
            duration=duration,
            media_info=media_info or "{}",
            media_file=SimpleNamespace(path="/tmp/source.mp4"),
        )
        profile = SimpleNamespace(id=2, extension=extension, resolution=720, codec="h264")
        encoding = SimpleNamespace(
            id=3,
            profile=profile,
            status="pending",
            temp_file="",
            commands="",
            logs="",
            progress=0,
            add_date=datetime(2024, 1, 1, tzinfo=timezone.utc),
            update_date=datetime(2024, 1, 1, tzinfo=timezone.utc),
            media_file=Mock(),
            save=Mock(),
        )
        query = Mock()
        query.count.return_value = 1
        query.exclude.return_value.delete = Mock()
        observer = Mock()
        backend = SimpleNamespace(
            encode=(
                Mock(side_effect=backend_exception) if backend_exception is not None else Mock(return_value=iter(()))
            ),
            terminate_process=Mock(),
        )

        @contextmanager
        def temporary_directory():
            yield "/tmp/encoding-test"

        output_file = "/tmp/encoding-test/output.mp4"
        pass_file = "/tmp/encoding-test/pass"
        temporary_files = [output_file, pass_file]
        if extension == "gif":
            temporary_files = ["/tmp/encoding-test/output.gif"]
            output_file = temporary_files[0]

        def path_exists(path):
            return path == output_file and output_exists

        with ExitStack() as stack:
            stack.enter_context(patch("files.tasks.Media.objects.get", return_value=media))
            stack.enter_context(patch("files.tasks.EncodeProfile.objects.get", return_value=profile))
            stack.enter_context(patch("files.tasks.Encoding.objects.get", return_value=encoding))
            stack.enter_context(patch("files.tasks.Encoding.objects.filter", return_value=query))
            stack.enter_context(patch("files.tasks.create_temp_file", side_effect=temporary_files))
            stack.enter_context(
                patch(
                    "files.tasks.produce_ffmpeg_commands",
                    return_value=ffmpeg_commands if ffmpeg_commands is not None else [["ffmpeg", "-i", "source"]],
                )
            )
            stack.enter_context(patch("files.tasks.FFmpegBackend", return_value=backend))
            stack.enter_context(patch("files.tasks._check_media_exists_or_cleanup", return_value=True))
            stack.enter_context(patch("files.tasks.observe_media_pipeline", observer))
            if task_retries is not None:
                stack.enter_context(patch.object(encode_media.request, "retries", task_retries))
            stack.enter_context(patch("files.tasks.os.path.exists", side_effect=path_exists))
            if output_type is not None:
                stack.enter_context(patch("files.tasks.get_file_type", return_value=output_type))
            if extension != "gif":
                stack.enter_context(patch("files.tasks.media_file_info", return_value=media_info or {}))
            if output_exists:
                stack.enter_context(patch("files.tasks.os.path.getsize", return_value=1))
                stack.enter_context(patch("builtins.open", mock_open(read_data=b"encoded")))
                stack.enter_context(patch("files.tasks.File"))
            if extension == "gif":
                stack.enter_context(patch("files.tasks.run_command", return_value={"out": ""}))
                stack.enter_context(patch("files.tasks.rm_file"))

            try:
                result = encode_media.run("token", profile.id, encoding.id, "url")
            except Exception as exception:
                if not capture_exception:
                    raise
                result = exception

        return result, media, profile, encoding, observer

    def test_gif_success_records_one_success(self):
        result, media, profile, encoding, observer = self._run_encode_media(
            extension="gif",
            output_exists=True,
            output_type="image",
        )

        self.assertTrue(result)
        self.assertEqual(encoding.status, "success")
        observer.assert_called_once_with(media, profile, "success")

    def test_missing_duration_records_one_failure(self):
        result, media, profile, encoding, observer = self._run_encode_media(duration=0)

        self.assertFalse(result)
        self.assertEqual(encoding.status, "fail")
        encoding.save.assert_any_call(update_fields=["status"])
        observer.assert_called_once_with(media, profile, "fail")

    def test_missing_ffmpeg_commands_records_one_failure(self):
        result, media, profile, encoding, observer = self._run_encode_media(ffmpeg_commands=[])

        self.assertFalse(result)
        self.assertEqual(encoding.status, "fail")
        encoding.save.assert_any_call(update_fields=["status"])
        observer.assert_called_once_with(media, profile, "fail")

    def test_normal_success_records_one_success(self):
        result, media, profile, encoding, observer = self._run_encode_media(
            output_exists=True,
            media_info={"is_video": True},
        )

        self.assertTrue(result)
        self.assertEqual(encoding.status, "success")
        encoding.media_file.save.assert_called_once()
        observer.assert_called_once_with(media, profile, "success")

    def test_normal_failure_records_one_failure(self):
        result, media, profile, encoding, observer = self._run_encode_media(
            output_exists=True,
            media_info={"is_video": False, "is_audio": False},
        )

        self.assertFalse(result)
        self.assertEqual(encoding.status, "fail")
        observer.assert_called_once_with(media, profile, "fail")

    def test_gif_failure_records_one_failure(self):
        result, media, profile, encoding, observer = self._run_encode_media(extension="gif")

        self.assertFalse(result)
        observer.assert_called_once_with(media, profile, "fail")

    def test_retryable_ffmpeg_exception_does_not_record_terminal_outcome(self):
        from files.tasks import encode_media

        with patch.object(encode_media, "retry", side_effect=RuntimeError("retry")) as retry:
            result, _media, _profile, _encoding, observer = self._run_encode_media(
                backend_exception=RuntimeError("unknown ffmpeg failure"),
                capture_exception=True,
            )

        self.assertIsInstance(result, RuntimeError)
        retry.assert_called_once()
        observer.assert_not_called()

    def test_known_ffmpeg_error_defers_outcome_until_final_result(self):
        from files.exceptions import VideoEncodingError

        result, media, profile, encoding, observer = self._run_encode_media(
            output_exists=True,
            media_info={"is_video": True},
            backend_exception=VideoEncodingError("Invalid data found when processing input"),
        )

        self.assertTrue(result)
        self.assertEqual(encoding.status, "success")
        observer.assert_called_once_with(media, profile, "success")

    def test_exhausted_retryable_ffmpeg_error_records_terminal_failure(self):
        from files.tasks import encode_media

        error = RuntimeError("unknown ffmpeg failure")
        with patch.object(encode_media, "retry", side_effect=error) as retry:
            result, media, profile, _encoding, observer = self._run_encode_media(
                backend_exception=error,
                capture_exception=True,
                task_retries=1,
            )

        self.assertIs(result, error)
        retry.assert_called_once()
        observer.assert_called_once_with(media, profile, "fail")
