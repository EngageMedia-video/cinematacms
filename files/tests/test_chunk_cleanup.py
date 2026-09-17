import json
import os
import tempfile
from io import StringIO
from unittest.mock import call, patch

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.db import DatabaseError, transaction
from django.test import TestCase, override_settings

from files.models import EncodeProfile, Encoding, Media, schedule_chunk_file_cleanup
from files.tests.helpers import create_test_media, create_test_user


class ChunkCleanupTests(TestCase):
    def setUp(self):
        self.tmpdir = tempfile.TemporaryDirectory()
        self.override = override_settings(MEDIA_ROOT=self.tmpdir.name, TEMP_DIRECTORY=self.tmpdir.name)
        self.override.enable()
        self.addCleanup(self.override.disable)
        self.addCleanup(self.tmpdir.cleanup)

        self.user = create_test_user(username="chunk_cleanup_owner")
        self.media = create_test_media(self.user)
        field = self.media._meta.get_field("media_file")
        stored_name = field.storage.save("original.mp4", ContentFile(b"original"))
        Media.objects.filter(pk=self.media.pk).update(media_file=stored_name)
        self.media.refresh_from_db()
        self.original_path = self.media.media_file.path
        self.profile = EncodeProfile.objects.create(name="720p", extension="mp4", codec="h264", resolution=720)

    def _chunk_encoding(self, path, status="pending"):
        return Encoding.objects.create(
            media=self.media,
            profile=self.profile,
            status=status,
            chunk=True,
            chunk_file_path=path,
            chunks_info=json.dumps({path: "checksum"}),
            md5sum="checksum",
        )

    def test_terminal_failure_removes_chunk_input_but_not_original(self):
        chunk_path = os.path.join(self.tmpdir.name, "00_segment.mkv")
        with open(chunk_path, "wb") as chunk_file:
            chunk_file.write(b"chunk")
        encoding = self._chunk_encoding(chunk_path)

        with (
            patch.object(Media, "post_encode_actions"),
            patch("files.models._schedule_storage_usage_refresh_for_media"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                encoding.status = "fail"
                encoding.save(update_fields=["status"])

        self.assertFalse(os.path.exists(chunk_path))
        self.assertTrue(os.path.exists(self.original_path))

    def test_missing_chunk_encoding_task_does_not_recreate_the_deleted_row(self):
        chunk_path = os.path.join(self.tmpdir.name, "00_missing_row.mkv")
        encoding = self._chunk_encoding(chunk_path)
        encoding_id = encoding.pk

        with patch("files.models._schedule_storage_usage_refresh_for_media"):
            encoding.delete()

        from files.tasks import encode_media

        self.assertFalse(
            encode_media.run(
                self.media.friendly_token,
                self.profile.pk,
                encoding_id,
                "",
                chunk=True,
                chunk_file_path=chunk_path,
            )
        )
        self.assertFalse(Encoding.objects.filter(pk=encoding_id).exists())

    def test_chunk_cleanup_refuses_an_input_equal_to_the_original(self):
        encoding = self._chunk_encoding(self.original_path)

        with (
            patch.object(Media, "post_encode_actions"),
            patch("files.models._schedule_storage_usage_refresh_for_media"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                encoding.status = "fail"
                encoding.save(update_fields=["status"])

        self.assertTrue(os.path.exists(self.original_path))

    def test_chunk_cleanup_preserves_an_original_referenced_by_another_media(self):
        other_media = create_test_media(self.user)
        other_media_file = other_media._meta.get_field("media_file").storage.save(
            "other-original.mp4", ContentFile(b"other original")
        )
        Media.objects.filter(pk=other_media.pk).update(media_file=other_media_file)
        other_media.refresh_from_db()
        chunk_encoding = Encoding.objects.create(
            media=other_media,
            profile=self.profile,
            chunk=True,
            chunk_file_path=self.original_path,
            chunks_info=json.dumps({self.original_path: "checksum"}),
            md5sum="checksum",
        )

        with (
            patch.object(Media, "post_encode_actions"),
            patch("files.models._schedule_storage_usage_refresh_for_media"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                chunk_encoding.status = "fail"
                chunk_encoding.save(update_fields=["status"])

        self.assertTrue(os.path.exists(self.original_path))

    def test_successful_chunk_group_still_concatenates_and_removes_input(self):
        chunk_path = os.path.join(self.tmpdir.name, "00_success.mkv")
        with open(chunk_path, "wb") as chunk_file:
            chunk_file.write(b"chunk")
        encoding = self._chunk_encoding(chunk_path, status="success")
        encoded_name = encoding._meta.get_field("media_file").storage.save(
            "encoded-chunk.mp4", ContentFile(b"encoded chunk")
        )
        Encoding.objects.filter(pk=encoding.pk).update(media_file=encoded_name)
        encoding.refresh_from_db()

        def concatenate(command):
            with open(command[-1], "wb") as output_file:
                output_file.write(b"concatenated")
            return {"out": ""}

        with (
            patch("files.models.helpers.run_command", side_effect=concatenate),
            patch.object(Media, "post_encode_actions"),
            patch("files.models._schedule_storage_usage_refresh_for_media"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                encoding.save(update_fields=["status"])

        self.assertFalse(os.path.exists(chunk_path))
        self.assertTrue(os.path.exists(self.original_path))
        self.assertEqual(
            Encoding.objects.filter(media=self.media, profile=self.profile, chunk=False, status="success").count(),
            1,
        )

    def test_failed_group_waits_for_running_sibling_before_finalizing(self):
        first_chunk = os.path.join(self.tmpdir.name, "00_failed.mkv")
        second_chunk = os.path.join(self.tmpdir.name, "01_running.mkv")
        for path in (first_chunk, second_chunk):
            with open(path, "wb") as chunk_file:
                chunk_file.write(b"chunk")
        chunks_info = json.dumps({first_chunk: "first", second_chunk: "second"})
        failed = Encoding.objects.create(
            media=self.media,
            profile=self.profile,
            chunk=True,
            chunk_file_path=first_chunk,
            chunks_info=chunks_info,
            md5sum="first",
        )
        running = Encoding.objects.create(
            media=self.media,
            profile=self.profile,
            status="running",
            chunk=True,
            chunk_file_path=second_chunk,
            chunks_info=chunks_info,
            md5sum="second",
        )

        with (
            patch.object(Media, "post_encode_actions"),
            patch("files.models._schedule_storage_usage_refresh_for_media"),
        ):
            with self.captureOnCommitCallbacks(execute=False) as callbacks:
                failed.status = "fail"
                failed.save(update_fields=["status"])
            cleanup_callbacks = [callback for callback in callbacks if hasattr(callback, "chunk_cleanup_savepoint_ids")]
            self.assertEqual(len(cleanup_callbacks), 1)
            cleanup_callback = cleanup_callbacks[0]
            cleanup_callback()

            self.assertEqual(
                Encoding.objects.filter(media=self.media, profile=self.profile, chunk=False, status="fail").count(), 0
            )
            self.assertEqual(Encoding.objects.filter(media=self.media, profile=self.profile, chunk=True).count(), 2)

            with self.captureOnCommitCallbacks(execute=False):
                running.status = "success"
                running.save(update_fields=["status"])
            cleanup_callback()

        self.assertEqual(
            Encoding.objects.filter(media=self.media, profile=self.profile, chunk=False, status="fail").count(), 1
        )
        self.assertFalse(Encoding.objects.filter(media=self.media, profile=self.profile, chunk=True).exists())
        self.assertFalse(os.path.exists(first_chunk))
        self.assertFalse(os.path.exists(second_chunk))
        self.assertTrue(os.path.exists(self.original_path))

    def test_chunk_rows_are_all_published_before_the_first_task_dispatch(self):
        Media.objects.filter(pk=self.media.pk).update(video_height=1080)
        self.media.refresh_from_db()
        other_profile = EncodeProfile.objects.create(name="480p", extension="mp4", codec="h264", resolution=480)
        dispatch_row_counts = []

        def run_command(command, cwd=None):
            if command[0] == settings.FFMPEG_COMMAND:
                return {
                    "out": "",
                    "error": "\n".join(
                        [
                            "Opening '00_token_original.mp4.mkv' for writing",
                            "Opening '01_token_original.mp4.mkv' for writing",
                        ]
                    ),
                }
            return {"out": f"checksum {command[1]}"}

        def observe_dispatch(*_args, **_kwargs):
            dispatch_row_counts.append(Encoding.objects.filter(media=self.media, chunk=True).count())
            return True

        with (
            patch("files.tasks.produce_friendly_token", return_value="token"),
            patch("files.tasks.run_command", side_effect=run_command),
            patch.object(Media, "_dispatch_encoding", side_effect=observe_dispatch),
            patch("files.models._schedule_storage_usage_refresh_for_media"),
        ):
            from files.tasks import chunkize_media

            with self.captureOnCommitCallbacks(execute=True):
                self.assertTrue(chunkize_media.run(self.media.friendly_token, [self.profile.id, other_profile.id]))

        self.assertEqual(dispatch_row_counts, [4, 4, 4, 4])

    def test_chunkize_removes_segments_when_no_profile_is_eligible(self):
        chunk_filename = "00_token_original.mp4.mkv"
        chunk_path = os.path.join(os.path.dirname(self.original_path), chunk_filename)

        def run_command(command, cwd=None):
            if command[0] == settings.FFMPEG_COMMAND:
                with open(chunk_path, "wb") as chunk_file:
                    chunk_file.write(b"chunk")
                return {"out": "", "error": f"Opening '{chunk_filename}' for writing"}
            return {"out": f"checksum {command[1]}"}

        with (
            patch("files.tasks.produce_friendly_token", return_value="token"),
            patch("files.tasks.run_command", side_effect=run_command),
            patch("files.models._schedule_storage_usage_refresh_for_media"),
        ):
            from files.tasks import chunkize_media

            with self.captureOnCommitCallbacks(execute=True):
                self.assertFalse(chunkize_media.run(self.media.friendly_token, [self.profile.id]))

        self.assertFalse(os.path.exists(chunk_path))

    def test_chunkize_removes_segments_when_checksum_collection_fails(self):
        chunk_filename = "00_token_original.mp4.mkv"
        chunk_path = os.path.join(os.path.dirname(self.original_path), chunk_filename)

        def run_command(command, cwd=None):
            if command[0] == settings.FFMPEG_COMMAND:
                with open(chunk_path, "wb") as chunk_file:
                    chunk_file.write(b"chunk")
                return {"out": "", "error": f"Opening '{chunk_filename}' for writing"}
            return {"out": ""}

        with (
            patch("files.tasks.produce_friendly_token", return_value="token"),
            patch("files.tasks.run_command", side_effect=run_command),
        ):
            from files.tasks import chunkize_media

            with self.captureOnCommitCallbacks(execute=True):
                with self.assertRaises(IndexError):
                    chunkize_media.run(self.media.friendly_token, [self.profile.id])

        self.assertFalse(os.path.exists(chunk_path))

    def test_chunkize_database_failure_rolls_back_rows_and_cleans_segments_after_commit(self):
        chunk_filenames = ["00_token_original.mp4.mkv", "01_token_original.mp4.mkv"]
        chunk_paths = [os.path.join(os.path.dirname(self.original_path), filename) for filename in chunk_filenames]
        Media.objects.filter(pk=self.media.pk).update(video_height=1080)
        self.media.refresh_from_db()
        original_save = Encoding.save
        saved_chunk_count = 0

        def run_command(command, cwd=None):
            if command[0] == settings.FFMPEG_COMMAND:
                for chunk_path in chunk_paths:
                    with open(chunk_path, "wb") as chunk_file:
                        chunk_file.write(b"chunk")
                return {
                    "out": "",
                    "error": "\n".join(f"Opening '{chunk_filename}' for writing" for chunk_filename in chunk_filenames),
                }
            return {"out": f"checksum {command[1]}"}

        def fail_chunk_insert(instance, *args, **kwargs):
            nonlocal saved_chunk_count
            if instance.chunk:
                saved_chunk_count += 1
                if saved_chunk_count == 2:
                    raise DatabaseError("second encoding insert failed")
            return original_save(instance, *args, **kwargs)

        with (
            patch("files.tasks.produce_friendly_token", return_value="token"),
            patch("files.tasks.run_command", side_effect=run_command),
            patch.object(Encoding, "save", new=fail_chunk_insert),
            patch.object(Media, "_dispatch_encoding") as dispatch,
        ):
            from files.tasks import chunkize_media

            with self.captureOnCommitCallbacks(execute=True):
                self.assertFalse(chunkize_media.run(self.media.friendly_token, [self.profile.id]))

        self.assertFalse(Encoding.objects.filter(media=self.media, chunk=True).exists())
        self.assertEqual(saved_chunk_count, 2)
        self.assertFalse(any(os.path.exists(chunk_path) for chunk_path in chunk_paths))
        dispatch.assert_not_called()

    def test_failed_group_database_error_rolls_back_status_and_discards_deferred_cleanup(self):
        chunk_path = os.path.join(self.tmpdir.name, "00_finalize_rollback.mkv")
        with open(chunk_path, "wb") as chunk_file:
            chunk_file.write(b"chunk")
        encoding = self._chunk_encoding(chunk_path)
        original_save = Encoding.save

        def fail_aggregate_insert(instance, *args, **kwargs):
            if not instance.chunk and instance.status == "fail":
                raise DatabaseError("aggregate insert failed")
            return original_save(instance, *args, **kwargs)

        with patch.object(Encoding, "save", new=fail_aggregate_insert):
            with self.captureOnCommitCallbacks(execute=False) as callbacks:
                with self.assertRaises(DatabaseError):
                    with transaction.atomic():
                        encoding.status = "fail"
                        encoding.save(update_fields=["status"])

        encoding.refresh_from_db()
        self.assertEqual(encoding.status, "pending")
        self.assertEqual(callbacks, [])
        self.assertTrue(os.path.exists(chunk_path))

    def test_media_deletion_removes_in_flight_chunk_inputs(self):
        chunk_path = os.path.join(self.tmpdir.name, "00_in_flight.mkv")
        with open(chunk_path, "wb") as chunk_file:
            chunk_file.write(b"chunk")
        self._chunk_encoding(chunk_path, status="running")

        with (
            patch("files.models._revoke_encoding_tasks"),
            patch("files.models._schedule_storage_usage_refresh_for_media"),
            patch.object(type(self.user), "update_user_media"),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                self.media.delete()

        self.assertFalse(os.path.exists(chunk_path))

    def test_failed_chunk_cleanup_remains_idempotent_after_media_deletion(self):
        chunk_path = os.path.join(self.tmpdir.name, "00_failed_then_deleted.mkv")
        with open(chunk_path, "wb") as chunk_file:
            chunk_file.write(b"chunk")
        encoding = self._chunk_encoding(chunk_path)

        with (
            patch.object(Media, "post_encode_actions"),
            patch("files.models._revoke_encoding_tasks"),
            patch("files.models._schedule_storage_usage_refresh_for_media"),
            patch.object(type(self.user), "update_user_media"),
        ):
            with self.captureOnCommitCallbacks(execute=False) as callbacks:
                encoding.status = "fail"
                encoding.save(update_fields=["status"])
                self.media.delete()

        cleanup_callbacks = [callback for callback in callbacks if hasattr(callback, "chunk_cleanup_savepoint_ids")]
        self.assertEqual(
            len(cleanup_callbacks),
            1,
            [(callback.chunk_cleanup_savepoint_ids, callback.chunk_file_paths) for callback in cleanup_callbacks],
        )
        cleanup_callbacks[0]()
        cleanup_callbacks[0]()
        self.assertFalse(os.path.exists(chunk_path))

    def test_chunk_survives_until_every_profile_stops_needing_it(self):
        chunk_path = os.path.join(self.tmpdir.name, "00_shared.mkv")
        with open(chunk_path, "wb") as chunk_file:
            chunk_file.write(b"chunk")
        other_profile = EncodeProfile.objects.create(name="480p", extension="mp4", codec="h264", resolution=480)
        finished = self._chunk_encoding(chunk_path)
        active = Encoding.objects.create(
            media=self.media,
            profile=other_profile,
            status="running",
            chunk=True,
            chunk_file_path=chunk_path,
            chunks_info=json.dumps({chunk_path: "checksum"}),
            md5sum="checksum",
        )
        with patch("files.models._schedule_storage_usage_refresh_for_media"):
            with self.captureOnCommitCallbacks(execute=False) as callbacks:
                finished.delete()
        cleanup_callbacks = [callback for callback in callbacks if hasattr(callback, "chunk_cleanup_savepoint_ids")]
        self.assertEqual(len(cleanup_callbacks), 1)
        cleanup_callback = cleanup_callbacks[0]
        cleanup_callback()
        self.assertTrue(os.path.exists(chunk_path))

        with patch("files.models._schedule_storage_usage_refresh_for_media"):
            with self.captureOnCommitCallbacks(execute=False):
                active.delete()
        cleanup_callback()
        self.assertFalse(os.path.exists(chunk_path))

    def test_chunk_cleanup_is_idempotent(self):
        chunk_path = os.path.join(self.tmpdir.name, "00_idempotent.mkv")
        with open(chunk_path, "wb") as chunk_file:
            chunk_file.write(b"chunk")

        with self.captureOnCommitCallbacks(execute=True):
            schedule_chunk_file_cleanup([chunk_path])
        with self.captureOnCommitCallbacks(execute=True):
            schedule_chunk_file_cleanup([chunk_path])

        self.assertFalse(os.path.exists(chunk_path))

    def test_chunk_cleanup_batches_distinct_paths_in_one_callback_and_two_reference_queries(self):
        chunk_paths = [os.path.join(self.tmpdir.name, f"0{index}_batch.mkv") for index in range(3)]
        for chunk_path in chunk_paths:
            with open(chunk_path, "wb") as chunk_file:
                chunk_file.write(b"chunk")

        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            schedule_chunk_file_cleanup(chunk_paths)
            schedule_chunk_file_cleanup(reversed(chunk_paths))

        self.assertEqual(len(callbacks), 1)
        with self.assertNumQueries(4):
            callbacks[0]()
        self.assertFalse(any(os.path.exists(chunk_path) for chunk_path in chunk_paths))

    def test_automatic_chunk_cleanup_records_a_fail_soft_bounded_outcome(self):
        chunk_path = os.path.join(self.tmpdir.name, "00_telemetry.mkv")
        with open(chunk_path, "wb") as chunk_file:
            chunk_file.write(b"chunk")

        with patch("files.metrics.record_domain_outcome", side_effect=RuntimeError("telemetry unavailable")):
            with self.captureOnCommitCallbacks(execute=True):
                schedule_chunk_file_cleanup([chunk_path])

        self.assertFalse(os.path.exists(chunk_path))

    def test_automatic_chunk_cleanup_records_storage_maintenance_outcome(self):
        chunk_path = os.path.join(self.tmpdir.name, "00_telemetry_outcome.mkv")
        with open(chunk_path, "wb") as chunk_file:
            chunk_file.write(b"chunk")

        with patch("files.metrics.record_domain_outcome") as outcome:
            with self.captureOnCommitCallbacks(execute=True):
                schedule_chunk_file_cleanup([chunk_path])

        outcome.assert_called_once_with("storage_maintenance", "succeeded", "none")

    def test_automatic_chunk_cleanup_records_filesystem_failure(self):
        chunk_path = os.path.join(self.tmpdir.name, "00_telemetry_failure.mkv")
        with open(chunk_path, "wb") as chunk_file:
            chunk_file.write(b"chunk")

        with (
            patch("files.metrics.record_domain_outcome") as outcome,
            patch("files.models.helpers.rm_file", return_value=False),
        ):
            with self.captureOnCommitCallbacks(execute=True):
                schedule_chunk_file_cleanup([chunk_path])

        self.assertTrue(os.path.exists(chunk_path))
        outcome.assert_called_once_with("storage_maintenance", "failed", "cleanup_failed")

    def test_non_chunk_encoding_delete_leaves_chunk_path_untouched(self):
        chunk_path = os.path.join(self.tmpdir.name, "00_non_chunk.mkv")
        with open(chunk_path, "wb") as chunk_file:
            chunk_file.write(b"chunk")
        encoding = Encoding.objects.create(
            media=self.media,
            profile=self.profile,
            chunk=False,
            chunk_file_path=chunk_path,
            md5sum="checksum",
        )

        with patch("files.models._schedule_storage_usage_refresh_for_media"):
            with self.captureOnCommitCallbacks(execute=True):
                encoding.delete()

        self.assertTrue(os.path.exists(chunk_path))

    def test_orphan_cleanup_command_requires_delete_flag(self):
        chunk_path = os.path.join(self.tmpdir.name, "original", "00_123456789_orphan.mkv")
        os.makedirs(os.path.dirname(chunk_path), exist_ok=True)
        with open(chunk_path, "wb") as chunk_file:
            chunk_file.write(b"orphan")

        dry_run_output = StringIO()
        call_command("cleanup_orphaned_encoding_chunks", "--min-age-hours=0", stdout=dry_run_output)
        self.assertTrue(os.path.exists(chunk_path))
        self.assertIn("would_delete=1", dry_run_output.getvalue())

        delete_output = StringIO()
        call_command("cleanup_orphaned_encoding_chunks", "--min-age-hours=0", "--delete", stdout=delete_output)
        self.assertFalse(os.path.exists(chunk_path))
        self.assertIn("deleted=1", delete_output.getvalue())

    def test_orphan_cleanup_command_records_bounded_outcomes_without_affecting_cleanup(self):
        chunk_path = os.path.join(self.tmpdir.name, "original", "00_123456789_telemetry.mkv")
        os.makedirs(os.path.dirname(chunk_path), exist_ok=True)
        with open(chunk_path, "wb") as chunk_file:
            chunk_file.write(b"orphan")

        with patch("files.management.commands.cleanup_orphaned_encoding_chunks.record_domain_outcome") as outcome:
            call_command("cleanup_orphaned_encoding_chunks", "--min-age-hours=0", stdout=StringIO())
            call_command("cleanup_orphaned_encoding_chunks", "--min-age-hours=0", "--delete", stdout=StringIO())

        self.assertEqual(
            outcome.call_args_list,
            [
                call("storage_maintenance", "skipped", "none"),
                call("storage_maintenance", "succeeded", "none"),
            ],
        )

    def test_orphan_cleanup_command_ignores_telemetry_failures(self):
        chunk_path = os.path.join(self.tmpdir.name, "original", "00_123456789_telemetry_failure.mkv")
        os.makedirs(os.path.dirname(chunk_path), exist_ok=True)
        with open(chunk_path, "wb") as chunk_file:
            chunk_file.write(b"orphan")

        with patch(
            "files.management.commands.cleanup_orphaned_encoding_chunks.record_domain_outcome",
            side_effect=RuntimeError("telemetry unavailable"),
        ):
            call_command("cleanup_orphaned_encoding_chunks", "--min-age-hours=0", "--delete", stdout=StringIO())

        self.assertFalse(os.path.exists(chunk_path))

    def test_orphan_cleanup_command_preserves_referenced_chunk(self):
        chunk_path = os.path.join(self.tmpdir.name, "original", "00_123456789_referenced.mkv")
        os.makedirs(os.path.dirname(chunk_path), exist_ok=True)
        with open(chunk_path, "wb") as chunk_file:
            chunk_file.write(b"referenced")
        self._chunk_encoding(chunk_path)

        call_command("cleanup_orphaned_encoding_chunks", "--min-age-hours=0", "--delete", stdout=StringIO())

        self.assertTrue(os.path.exists(chunk_path))

    def test_orphan_cleanup_command_scans_only_old_unreferenced_original_segments(self):
        outside_path = os.path.join(self.tmpdir.name, "cache", "00_123456789_outside.mkv")
        live_path = os.path.join(self.tmpdir.name, "original", "00_123456789_live.mkv")
        recent_path = os.path.join(self.tmpdir.name, "original", "00_123456789_recent.mkv")
        for path in (outside_path, live_path, recent_path):
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "wb") as chunk_file:
                chunk_file.write(b"chunk")
        os.utime(outside_path, (0, 0))
        os.utime(live_path, (0, 0))
        Media.objects.filter(pk=self.media.pk).update(media_file=os.path.relpath(live_path, self.tmpdir.name))

        call_command("cleanup_orphaned_encoding_chunks", "--min-age-hours=1", "--delete", stdout=StringIO())

        self.assertTrue(os.path.exists(outside_path))
        self.assertTrue(os.path.exists(live_path))
        self.assertTrue(os.path.exists(recent_path))
