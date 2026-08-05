from django.test import SimpleTestCase, override_settings

from files.helpers import get_whisper_command


@override_settings(
    WHISPER_CPP_COMMAND="/opt/whisper.cpp/build/bin/whisper-cli",
    WHISPER_CPP_MODEL="/opt/whisper.cpp/models/ggml-base.bin",
)
class TestWhisperCommand(SimpleTestCase):
    """whisper-cli defaults to 4 threads per process.

    The whisper_tasks worker used to run without --concurrency, so Celery
    defaulted it to the core count. Unbounded threads times unbounded workers
    starves the web application and the database, which share the host.
    """

    @override_settings(WHISPER_CPP_THREADS=2)
    def test_thread_count_is_bounded(self):
        cmd = get_whisper_command("/tmp/a.wav", "/tmp/a")
        self.assertIn("-t", cmd)
        self.assertEqual(cmd[cmd.index("-t") + 1], "2")

    @override_settings(WHISPER_CPP_THREADS=6)
    def test_thread_count_is_configurable(self):
        cmd = get_whisper_command("/tmp/a.wav", "/tmp/a")
        self.assertEqual(cmd[cmd.index("-t") + 1], "6")

    def test_translate_is_requested_only_when_asked(self):
        self.assertNotIn("--translate", get_whisper_command("/tmp/a.wav", "/tmp/a"))
        self.assertIn("--translate", get_whisper_command("/tmp/a.wav", "/tmp/a", translate=True))

    def test_output_and_input_are_passed_through(self):
        cmd = get_whisper_command("/tmp/a.wav", "/tmp/out")
        self.assertEqual(cmd[cmd.index("-f") + 1], "/tmp/a.wav")
        self.assertEqual(cmd[cmd.index("--output-file") + 1], "/tmp/out")
        self.assertIn("--output-vtt", cmd)

    def test_decoding_options_are_preserved(self):
        cmd = get_whisper_command("/tmp/a.wav", "/tmp/a")
        self.assertEqual(cmd[cmd.index("--entropy-thold") + 1], "2.8")
        self.assertEqual(cmd[cmd.index("--max-context") + 1], "0")
        self.assertEqual(cmd[cmd.index("--language") + 1], "auto")
