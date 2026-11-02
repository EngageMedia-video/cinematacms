import tempfile
from unittest.mock import patch

from django.conf import settings
from django.core.cache import cache
from django.core.files.base import ContentFile
from django.test import SimpleTestCase, TestCase, override_settings

from files import tasks
from files.helpers import get_whisper_command
from files.models import EncodeProfile, Encoding, Media, TranscriptionRequest, transcription_dispatch_cache
from files.tests.helpers import create_test_media, create_test_user


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


class WhisperDispatchTests(TestCase):
    """A media gets one Whisper task per translate flag, and only when a flag is requested."""

    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.user = create_test_user(username="whisper_owner")
        dispatch = patch.object(tasks.whisper_transcribe, "apply_async")
        self.apply_async = dispatch.start()
        self.addCleanup(dispatch.stop)

    def _flagged_media(self, **flags):
        media = create_test_media(self.user)
        Media.objects.filter(pk=media.pk).update(**flags)
        media.refresh_from_db()
        self.apply_async.reset_mock()
        return media

    def _dispatched_translate_flags(self):
        return sorted(
            dispatched.kwargs.get("kwargs", {}).get("translate", False)
            for dispatched in self.apply_async.call_args_list
        )

    def test_deleting_a_media_does_not_dispatch(self):
        media = self._flagged_media(allow_whisper_transcribe=True, allow_whisper_transcribe_and_translate=True)
        profile = EncodeProfile.objects.create(name="720p", extension="mp4", codec="vp9", resolution=720)
        with tempfile.TemporaryDirectory() as media_root, override_settings(MEDIA_ROOT=media_root):
            stored_name = Encoding._meta.get_field("media_file").storage.save("720.mp4", ContentFile(b"encoded"))
            Encoding.objects.create(media=media, profile=profile, status="success", media_file=stored_name)
            self.apply_async.reset_mock()

            with (
                patch("files.models._revoke_encoding_tasks"),
                patch("files.models._schedule_storage_usage_refresh_for_media"),
                patch.object(type(self.user), "update_user_media"),
            ):
                media.delete()

        self.apply_async.assert_not_called()

    def test_saves_that_leave_the_flags_alone_do_not_dispatch(self):
        media = self._flagged_media(allow_whisper_transcribe=True)

        media.save(update_fields=["encoding_status"])
        media.save(update_fields=["hls_file"])

        self.apply_async.assert_not_called()

    def test_creating_a_flagged_media_dispatches_once_per_flag(self):
        create_test_media(self.user, allow_whisper_transcribe=True, allow_whisper_transcribe_and_translate=True)

        self.assertEqual(self._dispatched_translate_flags(), [False, True])

    def test_repeated_flag_saves_dispatch_once(self):
        media = self._flagged_media()
        media.allow_whisper_transcribe = True

        for _ in range(3):
            media.save()

        self.assertEqual(self._dispatched_translate_flags(), [False])

    def test_saves_of_two_copies_of_one_media_dispatch_once(self):
        media = self._flagged_media()
        copies = [Media.objects.get(pk=media.pk), Media.objects.get(pk=media.pk)]

        for copy in copies:
            copy.allow_whisper_transcribe_and_translate = True
            copy.save()

        self.assertEqual(self._dispatched_translate_flags(), [True])

    def test_a_media_with_a_request_is_not_dispatched_again(self):
        media = self._flagged_media()
        TranscriptionRequest.objects.create(media=media, translate_to_english=False)
        media.allow_whisper_transcribe = True

        media.save()

        self.apply_async.assert_not_called()

    def test_a_failed_task_leaves_room_for_a_later_request(self):
        media = self._flagged_media()
        media.allow_whisper_transcribe = True
        media.save()
        self.assertEqual(self.apply_async.call_count, 1)

        with override_settings(WHISPER_CPP_COMMAND="/nonexistent/whisper-cli"):
            self.assertFalse(tasks.whisper_transcribe.run(media.friendly_token))
        media.save()

        self.assertEqual(self.apply_async.call_count, 2)

    def test_a_dispatch_that_cannot_be_queued_leaves_room_for_a_later_request(self):
        media = self._flagged_media()
        media.allow_whisper_transcribe = True
        self.apply_async.side_effect = ConnectionError("broker down")
        with self.assertRaises(ConnectionError):
            media.save()

        self.apply_async.side_effect = None
        media.save()

        self.assertEqual(self.apply_async.call_count, 2)

    def test_the_claim_of_a_dead_worker_expires(self):
        media = self._flagged_media()
        media.allow_whisper_transcribe = True

        with patch.object(transcription_dispatch_cache, "add", wraps=transcription_dispatch_cache.add) as claim:
            media.save()

        self.assertEqual(claim.call_args.args[2], settings.CELERY_SOFT_TIME_LIMIT)


class WhisperTaskTests(TestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.user = create_test_user(username="whisper_task_owner")
        self.media = create_test_media(self.user)

    def test_the_task_does_not_wait_before_running(self):
        with (
            override_settings(WHISPER_CPP_COMMAND="/nonexistent/whisper-cli"),
            patch("files.tasks.time.sleep") as sleep,
        ):
            tasks.whisper_transcribe.run(self.media.friendly_token)

        sleep.assert_not_called()

    def test_a_task_for_a_media_deleted_while_queued_is_a_skip(self):
        with override_settings(WHISPER_CPP_COMMAND=__file__, WHISPER_CPP_MODEL=__file__):
            result = tasks.whisper_transcribe.run("no-such-media")

        self.assertEqual(result, tasks.WHISPER_SKIPPED_MEDIA_GONE)

    def test_concurrent_tasks_register_one_request_per_flag(self):
        first = tasks._claim_transcription_request(self.media, translate=False)
        second = tasks._claim_transcription_request(self.media, translate=False)
        other_flag = tasks._claim_transcription_request(self.media, translate=True)

        self.assertIsNotNone(first)
        self.assertIsNone(second)
        self.assertIsNotNone(other_flag)
        self.assertEqual(TranscriptionRequest.objects.filter(media=self.media).count(), 2)
