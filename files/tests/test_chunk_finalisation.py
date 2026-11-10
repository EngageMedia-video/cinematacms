import json
import os
import shutil
import stat
import subprocess
import tempfile
import threading
from contextlib import ExitStack
from datetime import timedelta
from unittest import skipUnless
from unittest.mock import patch

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import connection
from django.db.models.signals import post_save
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

from files import helpers, models
from files.models import EncodeProfile, Encoding, Media, encoding_file_save
from files.tasks import EncodingTask, recover_stalled_chunk_groups
from files.tests.helpers import create_test_media, create_test_user

CHUNK_COUNT = 2
BARRIER_TIMEOUT_SECONDS = 3
REAL_CHUNK_SECONDS = 3


def concat_calls(run_command):
    return [call for call in run_command.call_args_list if "concat" in call.args[0]]


def concatenate(command):
    """Stand in for an ffmpeg concat that exits cleanly and writes its output file."""
    with open(command[-1], "wb") as output_file:
        output_file.write(b"merged rendition")
    return {"out": ""}


def concat_skips_an_unreadable_chunk(command):
    """Stand in for ffmpeg 8 and 9, which skip a chunk they cannot open and still exit 0."""
    concatenate(command)
    return {"out": "", "error": "[concat @ 0x1] Impossible to open '/media/01_segment.mkv'"}


class ChunkFinalisationRaceTests(TransactionTestCase):
    """Two workers finish the last two chunks of one profile at the same time."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        override = override_settings(MEDIA_ROOT=self.tmpdir.name, TEMP_DIRECTORY=self.tmpdir.name)
        override.enable()
        self.addCleanup(override.disable)

        self.media = create_test_media(create_test_user(username="finalisation_owner"))
        stored_name = Media._meta.get_field("media_file").storage.save("original.mp4", ContentFile(b"original"))
        Media.objects.filter(pk=self.media.pk).update(media_file=stored_name)
        self.media.refresh_from_db()
        self.profile = EncodeProfile.objects.create(name="1080p", extension="mp4", codec="h264", resolution=1080)
        self.chunk_paths = [os.path.join(self.tmpdir.name, f"{index:02d}_segment.mkv") for index in range(CHUNK_COUNT)]
        chunks_info = json.dumps(dict.fromkeys(self.chunk_paths, "checksum"))
        for path in self.chunk_paths:
            chunk = Encoding.objects.create(
                media=self.media,
                profile=self.profile,
                status="pending",
                chunk=True,
                chunk_file_path=path,
                chunks_info=chunks_info,
            )
            chunk.media_file.save(os.path.basename(path), ContentFile(b"encoded chunk"), save=False)
            # update() skips the post_save receiver, which would finalise on the last chunk
            Encoding.objects.filter(pk=chunk.pk).update(status="success", media_file=chunk.media_file.name)

    def _merging(self, run_command=concatenate, media_info=None):
        """Patch the concat, its ffprobe check and the post-encode side effects, and return the run_command mock."""
        stack = ExitStack()
        self.addCleanup(stack.close)
        mock = stack.enter_context(patch("files.models.helpers.run_command", side_effect=run_command))
        full_length = {"is_video": True, "video_duration": float(self.media.duration)}
        stack.enter_context(patch("files.models.helpers.media_file_info", return_value=media_info or full_length))
        stack.enter_context(patch.object(Media, "post_encode_actions"))
        stack.enter_context(patch("files.models._schedule_storage_usage_refresh_for_media"))
        return stack, mock

    def _recover_stalled_groups(self):
        stack, _ = self._merging()
        with stack:
            return recover_stalled_chunk_groups()

    def test_recovery_merges_a_group_whose_finaliser_died(self):
        result = self._recover_stalled_groups()

        self.assertEqual(
            result, {"outcome": "succeeded", "reason_code": "none", "processed": 1, "changed": 1, "failed": 0}
        )
        merged = Encoding.objects.get(media=self.media, profile=self.profile)
        self.assertFalse(merged.chunk)
        self.assertEqual(merged.status, "success")

    def test_recovery_leaves_a_group_alone_while_its_claim_is_alive(self):
        lock_key = f"chunk_finalize_lock_{self.media.id}_{self.profile.id}"
        models.chunk_finalisation_cache.add(lock_key, "live worker", timeout=60)
        self.addCleanup(models.chunk_finalisation_cache.delete, lock_key)

        result = self._recover_stalled_groups()

        self.assertEqual(result["changed"], 0)
        self.assertEqual(Encoding.objects.filter(media=self.media, chunk=True).count(), CHUNK_COUNT)

    def test_recovery_waits_for_a_newer_encoding_of_the_same_profile(self):
        Encoding.objects.create(media=self.media, profile=self.profile, status="running")

        result = self._recover_stalled_groups()

        self.assertEqual(result["processed"], 0)
        self.assertEqual(Encoding.objects.filter(media=self.media, chunk=True).count(), CHUNK_COUNT)

    def test_recovery_skips_a_group_with_a_failed_chunk(self):
        Encoding.objects.filter(pk=Encoding.objects.filter(chunk=True).first().pk).update(status="fail")

        result = self._recover_stalled_groups()

        self.assertEqual(result["processed"], 0)
        self.assertEqual(Encoding.objects.filter(media=self.media, chunk=True).count(), CHUNK_COUNT)

    def test_recovery_stops_retrying_a_group_older_than_its_window(self):
        expired = timezone.now() - models.CHUNK_RECOVERY_WINDOW - timedelta(minutes=1)
        Encoding.objects.filter(chunk=True).update(update_date=expired)

        result = self._recover_stalled_groups()

        self.assertEqual(result["processed"], 0)

    def test_recovery_continues_past_a_merge_that_fails_and_reports_it(self):
        other_media = create_test_media(create_test_user(username="other_owner"))
        stored_name = Media._meta.get_field("media_file").storage.save("other.mp4", ContentFile(b"original"))
        Media.objects.filter(pk=other_media.pk).update(media_file=stored_name)
        path = os.path.join(self.tmpdir.name, "99_segment.mkv")
        chunk = Encoding.objects.create(
            media=other_media,
            profile=self.profile,
            status="pending",
            chunk=True,
            chunk_file_path=path,
            chunks_info=json.dumps({path: "checksum"}),
        )
        chunk.media_file.save(os.path.basename(path), ContentFile(b"encoded chunk"), save=False)
        Encoding.objects.filter(pk=chunk.pk).update(status="success", media_file=chunk.media_file.name)
        merge = models._merge_chunks

        def fail_for_other_media(instance, chunks):
            if instance.media_id == other_media.id:
                raise OSError("concat failed")
            merge(instance, chunks)

        with patch("files.models._merge_chunks", side_effect=fail_for_other_media):
            result = self._recover_stalled_groups()

        self.assertEqual(
            result, {"outcome": "failed", "reason_code": "item_errors", "processed": 2, "changed": 1, "failed": 1}
        )
        self.assertFalse(Encoding.objects.filter(media=self.media, chunk=True).exists())
        self.assertTrue(Encoding.objects.filter(media=other_media, chunk=True).exists())

    def _abandon_a_merge(self):
        """Run a merge that dies before it can clean up, as a SIGKILL does, and return what it left behind."""
        abandoned = []

        class AbandonedDirectory:
            def __init__(self, prefix, dir):
                self.name = tempfile.mkdtemp(prefix=prefix, dir=dir)
                abandoned.append(self.name)

            def __enter__(self):
                return self.name

            def __exit__(self, *exc_info):
                return False

        chunk = Encoding.objects.filter(chunk=True).first()
        with (
            patch("files.models.tempfile.TemporaryDirectory", AbandonedDirectory),
            patch("files.models.helpers.run_command", side_effect=OSError("killed")),
            self.assertRaises(OSError),
        ):
            models.finalize_chunk_group(chunk, self.chunk_paths)
        return abandoned

    def _age(self, path, age):
        aged = (timezone.now() - age).timestamp()
        os.utime(path, (aged, aged))

    def test_recovery_removes_what_a_killed_merge_left_behind(self):
        abandoned = self._abandon_a_merge()
        self.assertTrue(all(os.path.isdir(path) for path in abandoned))
        for path in abandoned:
            self._age(path, timedelta(seconds=settings.CELERY_SOFT_TIME_LIMIT + 60))

        self._recover_stalled_groups()

        self.assertFalse(any(os.path.exists(path) for path in abandoned))

    def test_each_merge_works_in_a_private_directory_of_its_own(self):
        first, second = self._abandon_a_merge() + self._abandon_a_merge()

        self.assertNotEqual(first, second)
        for path in (first, second):
            self.assertEqual(os.path.dirname(path), self.tmpdir.name)
            self.assertEqual(stat.S_IMODE(os.stat(path).st_mode), 0o700)

    def test_recovery_leaves_everything_else_in_the_temp_directory(self):
        unrelated = tempfile.mkdtemp(dir=self.tmpdir.name)
        self._age(unrelated, timedelta(seconds=settings.CELERY_SOFT_TIME_LIMIT + 60))

        self._recover_stalled_groups()

        self.assertTrue(os.path.isdir(unrelated))

    def test_recovery_does_not_follow_a_planted_link(self):
        with tempfile.TemporaryDirectory() as elsewhere:
            target = os.path.join(elsewhere, "target")
            os.mkdir(target)
            self._age(target, timedelta(seconds=settings.CELERY_SOFT_TIME_LIMIT + 60))
            os.symlink(target, os.path.join(self.tmpdir.name, f"{models.CHUNK_MERGE_DIRECTORY_PREFIX}planted"))

            self._recover_stalled_groups()

            self.assertTrue(os.path.isdir(target))

    def test_recovery_still_merges_when_the_temp_directory_cannot_be_listed(self):
        list_directory = os.scandir

        def refuse_temp_directory(path):
            if path == self.tmpdir.name:
                raise PermissionError(path)
            return list_directory(path)

        with patch("files.models.os.scandir", side_effect=refuse_temp_directory):
            result = self._recover_stalled_groups()

        self.assertEqual(result["changed"], 1)
        self.assertEqual(result["failed"], 0)

    def test_recovery_has_nothing_left_to_remove_on_a_second_run(self):
        for path in self._abandon_a_merge():
            self._age(path, timedelta(seconds=settings.CELERY_SOFT_TIME_LIMIT + 60))
        self._recover_stalled_groups()

        with patch("files.models.shutil.rmtree") as rmtree:
            result = self._recover_stalled_groups()

        rmtree.assert_not_called()
        self.assertEqual(result["failed"], 0)

    def test_recovery_leaves_a_merge_that_is_still_within_its_time_limit(self):
        abandoned = self._abandon_a_merge()

        self._recover_stalled_groups()

        self.assertTrue(all(os.path.isdir(path) for path in abandoned))

    def test_recovery_running_during_a_merge_keeps_its_directory(self):
        directories_with_files_before_merge = self._directories_with_files()
        merge_directories = []

        def recover_while_merging(command):
            merge_directories.append(self._directories_with_files() - directories_with_files_before_merge)
            recover_stalled_chunk_groups()
            merge_directories.append(self._directories_with_files() - directories_with_files_before_merge)
            return concatenate(command)

        stack, _ = self._merging(run_command=recover_while_merging)
        with stack:
            merged = models.finalize_chunk_group(Encoding.objects.filter(chunk=True).first(), self.chunk_paths)

        before_recovery, after_recovery = merge_directories
        self.assertTrue(merged)
        self.assertEqual(len(before_recovery), 1)
        self.assertEqual(after_recovery, before_recovery)
        self.assertEqual(self._directories_with_files() - directories_with_files_before_merge, set())

    def _directories_with_files(self):
        return {directory for directory, _, names in os.walk(self.tmpdir.name) if names}

    def _hold_aggregates_until_both_exist(self):
        """Force the failing interleave: both workers save their merged file before either cleans up."""
        barrier = threading.Barrier(CHUNK_COUNT)

        def wait_for_peer(sender, instance, **kwargs):
            if instance.chunk or instance.status != "success" or not instance.media_file:
                return
            try:
                barrier.wait(BARRIER_TIMEOUT_SECONDS)
            except threading.BrokenBarrierError:
                pass  # the peer was kept out of finalisation, which is the fixed behaviour

        post_save.connect(wait_for_peer, sender=Encoding)
        self.addCleanup(post_save.disconnect, wait_for_peer, sender=Encoding)

    def _finalise_from_concurrent_workers(self):
        errors = []

        def finalise(chunk_pk):
            try:
                chunk = Encoding.objects.get(pk=chunk_pk)
                encoding_file_save(sender=Encoding, instance=chunk, created=False)
            except Exception as exc:  # surfaced in the main thread
                errors.append(exc)
            finally:
                connection.close()

        chunk_pks = list(Encoding.objects.filter(chunk=True).values_list("pk", flat=True))
        threads = [threading.Thread(target=finalise, args=(pk,)) for pk in chunk_pks]
        stack, _ = self._merging()
        with stack:
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()
        self.assertEqual(errors, [])

    def _assert_one_merged_rendition(self):
        merged = list(Encoding.objects.filter(media=self.media, profile=self.profile, chunk=False))
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].status, "success")
        self.assertTrue(os.path.exists(merged[0].media_file.path))
        self.assertEqual(
            os.listdir(os.path.dirname(merged[0].media_file.path)), [os.path.basename(merged[0].media_file.path)]
        )
        self.assertFalse(Encoding.objects.filter(media=self.media, chunk=True).exists())
        return merged[0]

    def test_concurrent_finalisation_keeps_exactly_one_merged_encoding(self):
        self._hold_aggregates_until_both_exist()

        self._finalise_from_concurrent_workers()

        self._assert_one_merged_rendition()

    def test_merges_that_overlap_after_the_claim_is_lost_keep_exactly_one_merged_encoding(self):
        # Both workers claim, as they would after the cache evicts or expires the first claim.
        self._hold_aggregates_until_both_exist()

        with patch.object(models.chunk_finalisation_cache, "add", return_value=True):
            self._finalise_from_concurrent_workers()

        self._assert_one_merged_rendition()

    def _publish_previous_rendition(self, profile=None):
        """Store a finished rendition from an earlier encode, as a re-encode finds it."""
        previous = Encoding(media=self.media, profile=profile or self.profile, status="success", progress=100)
        previous.media_file.save("previous.mp4", ContentFile(b"previous rendition"), save=False)
        with (
            patch.object(Media, "post_encode_actions"),
            patch("files.models._schedule_storage_usage_refresh_for_media"),
        ):
            previous.save()
        return previous

    def test_merge_output_is_validated_before_anything_is_published(self):
        previous = self._publish_previous_rendition()

        def concat_exits_with_an_error(command):
            return {"error": "concat failed"}

        def concat_writes_nothing(command):
            open(command[-1], "wb").close()
            return {"out": ""}

        shorter_than_the_media = {"is_video": True, "video_duration": self.media.duration / 2}
        cases = [
            ("ffmpeg exits with an error", concat_exits_with_an_error, None, "concat_failed"),
            ("ffmpeg skips a chunk it cannot open", concat_skips_an_unreadable_chunk, None, "chunk_unreadable"),
            ("ffmpeg writes an empty file", concat_writes_nothing, None, "empty_output"),
            ("ffprobe finds no audio or video", concatenate, {"fail": True}, "not_playable"),
            ("the merge is shorter than the media", concatenate, shorter_than_the_media, "too_short"),
        ]
        chunk = Encoding.objects.filter(chunk=True).first()
        for name, run_command, media_info, reason in cases:
            with self.subTest(name):
                stack, _ = self._merging(run_command=run_command, media_info=media_info)
                with stack, self.assertRaises(models.ChunkMergeError) as raised:
                    models.finalize_chunk_group(chunk, self.chunk_paths)

                self.assertEqual(str(raised.exception), reason)
                self.assertIn(f"Chunk merge rejected: {reason}", Encoding.objects.get(pk=chunk.pk).logs)
                self.assertEqual(
                    list(Encoding.objects.filter(media=self.media, profile=self.profile, chunk=False)), [previous]
                )
                self.assertTrue(os.path.exists(previous.media_file.path))
                self.assertEqual(Encoding.objects.filter(media=self.media, chunk=True).count(), CHUNK_COUNT)

    def test_a_failed_merge_fails_the_group_and_the_previous_rendition_stays_usable(self):
        previous = self._publish_previous_rendition()
        last_chunk = Encoding.objects.filter(chunk=True).first()

        stack, _ = self._merging(run_command=concat_skips_an_unreadable_chunk)
        with stack, self.assertRaises(models.ChunkMergeError):
            encoding_file_save(sender=Encoding, instance=last_chunk, created=False)

        # the exception left encoding.save() in encode_media, so Celery runs on_failure
        task = EncodingTask()
        task.encoding = last_chunk
        with patch("files.tasks.kill_ffmpeg_process"):
            task.on_failure(models.ChunkMergeError("not playable"), "task-id", (), {}, None)

        previous.refresh_from_db()
        self.assertEqual(previous.status, "success")
        self.assertTrue(os.path.exists(previous.media_file.path))
        self._assert_group_failed_with("chunk_unreadable")
        self.media.refresh_from_db()
        self.assertEqual(self.media.encoding_status, "success")
        rendition = self.media.encodings_info[self.profile.resolution][self.profile.codec]
        self.assertEqual((rendition["status"], rendition["encoding_id"]), ("success", previous.pk))
        self.assertIsNotNone(rendition["url"])

    def _assert_group_failed_with(self, reason):
        """Assert the group ended as one failed aggregate whose logs say why the merge was rejected."""
        (aggregate,) = Encoding.objects.filter(media=self.media, profile=self.profile, chunk=False, status="fail")
        self.assertIn(f"Chunk merge rejected: {reason}", aggregate.logs)
        self.assertIn("Impossible to open", aggregate.logs)  # the end of ffmpeg's output
        self.assertFalse(Encoding.objects.filter(media=self.media, chunk=True).exists())

    def test_recovery_fails_a_group_whose_merge_is_rejected(self):
        previous = self._publish_previous_rendition()

        stack, _ = self._merging(run_command=concat_skips_an_unreadable_chunk)
        with stack:
            result = recover_stalled_chunk_groups()
            second_run = recover_stalled_chunk_groups()

        self.assertEqual(
            result, {"outcome": "failed", "reason_code": "item_errors", "processed": 1, "changed": 0, "failed": 1}
        )
        self.assertEqual(second_run["processed"], 0)
        self._assert_group_failed_with("chunk_unreadable")
        self.assertTrue(Encoding.objects.filter(pk=previous.pk, status="success").exists())

    def test_recovery_retries_a_concat_that_exits_with_an_error(self):
        # A non-zero exit can come from the worker, such as a full temp disk, not from the chunks.
        def concat_exits_with_an_error(command):
            return {"error": "No space left on device"}

        stack, run_command = self._merging(run_command=concat_exits_with_an_error)
        with stack:
            result = recover_stalled_chunk_groups()
            second_run = recover_stalled_chunk_groups()

        expected = {"outcome": "failed", "reason_code": "item_errors", "processed": 1, "changed": 0, "failed": 1}
        self.assertEqual((result, second_run), (expected, expected))
        self.assertEqual(len(concat_calls(run_command)), 2)
        self.assertEqual(Encoding.objects.filter(media=self.media, chunk=True, status="success").count(), CHUNK_COUNT)
        self.assertFalse(Encoding.objects.filter(media=self.media, profile=self.profile, chunk=False).exists())

    def test_a_merge_that_is_the_full_rendition_is_accepted(self):
        merged_path = os.path.join(self.tmpdir.name, "merged.mp4")
        with open(merged_path, "wb") as merged_file:
            merged_file.write(b"merged rendition")
        expected = float(self.media.duration)
        cases = [
            ("video as long as the media", {"is_video": True, "video_duration": expected}),
            (
                "video short by less than the tolerance",
                {"is_video": True, "video_duration": expected - models.CHUNK_MERGE_DURATION_TOLERANCE_SECONDS + 0.5},
            ),
            ("audio only, with the duration in its stream", {"is_audio": True, "audio_info": {"duration": "120.0"}}),
        ]
        for name, media_info in cases:
            with self.subTest(name), patch("files.models.helpers.media_file_info", return_value=media_info):
                self.assertIsNone(models._merge_rejection_reason(merged_path, {"out": ""}, self.media.duration))

    def test_publication_replaces_the_previous_rendition_and_keeps_other_profiles(self):
        previous = self._publish_previous_rendition()
        other_profile = EncodeProfile.objects.create(name="480p", extension="mp4", codec="h264", resolution=480)
        other_rendition = self._publish_previous_rendition(profile=other_profile)

        stack, _ = self._merging()
        with stack:
            self.assertTrue(models.finalize_chunk_group(Encoding.objects.filter(chunk=True).first(), self.chunk_paths))

        merged = self._assert_one_merged_rendition()
        self.assertNotEqual(merged.pk, previous.pk)
        self.assertFalse(os.path.exists(previous.media_file.path))
        self.assertTrue(Encoding.objects.filter(pk=other_rendition.pk).exists())
        self.assertTrue(os.path.exists(other_rendition.media_file.path))

    def test_callbacks_and_retries_after_publication_keep_the_merged_rendition(self):
        stale_chunk = Encoding.objects.filter(chunk=True).first()
        stack, run_command = self._merging()
        with stack:
            encoding_file_save(sender=Encoding, instance=stale_chunk, created=False)
        merged = self._assert_one_merged_rendition()

        def success_callback():
            encoding_file_save(sender=Encoding, instance=stale_chunk, created=False)

        def task_failure_after_publication():
            task = EncodingTask()
            task.encoding = stale_chunk
            with patch("files.tasks.kill_ffmpeg_process"):
                task.on_failure(RuntimeError("worker lost"), "task-id", (), {}, None)

        def recovery_run():
            recover_stalled_chunk_groups()

        cases = [
            ("duplicate success callback", success_callback),
            ("task failure after publication", task_failure_after_publication),
            ("recovery run", recovery_run),
        ]
        for name, retry in cases:
            with self.subTest(name):
                stack, run_command = self._merging()
                with stack:
                    retry()

                self.assertEqual(concat_calls(run_command), [])
                self.assertEqual(self._assert_one_merged_rendition().pk, merged.pk)

    def _publish_without_cleanup(self):
        """Publish the merged rendition and die before its chunks and older renditions are deleted."""
        stack, _ = self._merging()
        with (
            stack,
            patch("files.models._retire_superseded_encodings", side_effect=OSError("worker lost")),
            self.assertRaises(OSError),
        ):
            models.finalize_chunk_group(Encoding.objects.filter(chunk=True).first(), self.chunk_paths)
        return Encoding.objects.get(media=self.media, profile=self.profile, chunk=False, chunks_info__gt="")

    def test_a_success_callback_finishes_the_cleanup_of_a_published_group_without_merging_again(self):
        previous = self._publish_previous_rendition()
        published = self._publish_without_cleanup()
        leftover = Encoding.objects.filter(chunk=True).first()

        stack, run_command = self._merging()
        with stack:
            encoding_file_save(sender=Encoding, instance=leftover, created=False)

        self.assertEqual(concat_calls(run_command), [])
        self.assertEqual(self._assert_one_merged_rendition().pk, published.pk)
        self.assertFalse(Encoding.objects.filter(pk=previous.pk).exists())

    def test_a_chunk_failing_after_its_group_was_published_keeps_the_merged_rendition(self):
        previous = self._publish_previous_rendition()
        published = self._publish_without_cleanup()
        leftover = Encoding.objects.filter(chunk=True).first()

        task = EncodingTask()
        task.encoding = leftover
        with patch("files.tasks.kill_ffmpeg_process"):
            task.on_failure(RuntimeError("task retry failed"), "task-id", (), {}, None)

        self.assertEqual(self._assert_one_merged_rendition().pk, published.pk)
        self.assertFalse(Encoding.objects.filter(pk=previous.pk).exists())
        self.media.refresh_from_db()
        self.assertEqual(self.media.encoding_status, "success")

    def test_cache_outage_on_the_claim_fails_the_group_through_the_task_failure_path(self):
        last_chunk = Encoding.objects.filter(chunk=True).first()

        with (
            patch.object(models.chunk_finalisation_cache, "add", side_effect=ConnectionError("cache down")),
            patch("files.models._merge_chunks") as merge_chunks,
            patch("files.metrics.record_domain_outcome") as record_domain_outcome,
            self.assertLogs("files.models", level="ERROR") as logs,
            self.assertRaises(ConnectionError),
        ):
            encoding_file_save(sender=Encoding, instance=last_chunk, created=False)

        merge_chunks.assert_not_called()
        (record,) = logs.records
        self.assertEqual(record.getMessage(), "cinematacms.media.pipeline")
        self.assertEqual(
            (record.stage, record.outcome, record.reason_code, record.profile_id, record.chunk_count),
            ("chunk_finalize", "failed", "dependency_unavailable", self.profile.id, CHUNK_COUNT),
        )
        self.assertIsNotNone(record.exc_info)
        record_domain_outcome.assert_any_call("chunking", "failed", "dependency_unavailable")

        # the exception left encoding.save() in encode_media, so Celery runs on_failure
        task = EncodingTask()
        task.encoding = last_chunk
        with patch("files.tasks.kill_ffmpeg_process"):
            task.on_failure(ConnectionError("cache down"), "task-id", (), {}, None)

        failed_aggregates = Encoding.objects.filter(media=self.media, profile=self.profile, chunk=False, status="fail")
        self.assertEqual(failed_aggregates.count(), 1)
        self.assertFalse(Encoding.objects.filter(media=self.media, chunk=True).exists())
        self.media.refresh_from_db()
        self.assertEqual(self.media.encoding_status, "fail")


@skipUnless(
    shutil.which(settings.FFMPEG_COMMAND) and shutil.which(settings.FFPROBE_COMMAND), "needs ffmpeg and ffprobe"
)
class ChunkMergeWithFFmpegTests(TransactionTestCase):
    """Run the real concat, which exits 0 after skipping a chunk it cannot open."""

    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)
        override = override_settings(MEDIA_ROOT=self.tmpdir.name, TEMP_DIRECTORY=self.tmpdir.name)
        override.enable()
        self.addCleanup(override.disable)
        self.user = create_test_user(username="ffmpeg_merge_owner")
        self.profile = EncodeProfile.objects.create(name="240p", extension="mp4", codec="h264", resolution=240)

    def _media_with_encoded_chunks(self, count=3):
        media = create_test_media(self.user, duration=count * REAL_CHUNK_SECONDS)
        stored_name = Media._meta.get_field("media_file").storage.save("original.mp4", ContentFile(b"original"))
        Media.objects.filter(pk=media.pk).update(media_file=stored_name)
        media.refresh_from_db()
        sources = [os.path.join(self.tmpdir.name, f"{media.pk}_{index:02d}_segment.mkv") for index in range(count)]
        chunks_info = json.dumps(dict.fromkeys(sources, "checksum"))
        for source in sources:
            encoded = os.path.join(self.tmpdir.name, f"encoded_{os.path.basename(source)}")
            subprocess.run(
                [
                    settings.FFMPEG_COMMAND,
                    "-loglevel",
                    "error",
                    "-y",
                    "-f",
                    "lavfi",
                    "-i",
                    f"testsrc=duration={REAL_CHUNK_SECONDS}:size=64x48:rate=10",
                    "-c:v",
                    "mpeg4",
                    encoded,
                ],
                check=True,
            )
            chunk = Encoding.objects.create(
                media=media,
                profile=self.profile,
                status="pending",
                chunk=True,
                chunk_file_path=source,
                chunks_info=chunks_info,
                md5sum="checksum",
            )
            Encoding.objects.filter(pk=chunk.pk).update(status="success", media_file=os.path.basename(encoded))
        return media, sources

    def _publish_previous_rendition(self, media):
        previous = Encoding(media=media, profile=self.profile, status="success", progress=100)
        previous.media_file.save("previous.mp4", ContentFile(b"previous rendition"), save=False)
        with (
            patch.object(Media, "post_encode_actions"),
            patch("files.models._schedule_storage_usage_refresh_for_media"),
        ):
            previous.save()
        return previous

    def _finalize(self, media, chunk_paths):
        with (
            patch.object(Media, "post_encode_actions"),
            patch("files.models._schedule_storage_usage_refresh_for_media"),
        ):
            return models.finalize_chunk_group(Encoding.objects.filter(media=media, chunk=True).first(), chunk_paths)

    def test_a_complete_group_is_published(self):
        media, chunk_paths = self._media_with_encoded_chunks()

        self.assertTrue(self._finalize(media, chunk_paths))

        merged = Encoding.objects.get(media=media, chunk=False)
        merged_info = helpers.media_file_info(merged.media_file.path)
        self.assertAlmostEqual(merged_info["video_duration"], media.duration, delta=0.5)

    def test_a_concat_that_skips_a_chunk_publishes_nothing(self):
        def remove(path):
            os.remove(path)

        def overwrite_with_garbage(path):
            with open(path, "wb") as chunk_file:
                chunk_file.write(os.urandom(100))

        cases = [
            ("the second chunk is missing", 1, remove),
            ("the last chunk is missing", 2, remove),
            ("the second chunk is not video", 1, overwrite_with_garbage),
        ]
        for name, index, damage in cases:
            with self.subTest(name):
                media, chunk_paths = self._media_with_encoded_chunks()
                previous = self._publish_previous_rendition(media)
                chunks = list(Encoding.objects.filter(media=media, chunk=True).order_by("pk"))
                damage(chunks[index].media_file.path)

                with self.assertRaises(models.ChunkMergeError):
                    self._finalize(media, chunk_paths)

                self.assertEqual(list(Encoding.objects.filter(media=media, chunk=False)), [previous])
                self.assertTrue(os.path.exists(previous.media_file.path))
