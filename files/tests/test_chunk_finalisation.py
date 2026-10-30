import json
import os
import tempfile
import threading
from unittest.mock import patch

from django.core.files.base import ContentFile
from django.db import connection
from django.db.models.signals import post_save
from django.test import TransactionTestCase, override_settings

from files import models
from files.models import EncodeProfile, Encoding, Media, encoding_file_save
from files.tasks import EncodingTask
from files.tests.helpers import create_test_media, create_test_user

CHUNK_COUNT = 2
BARRIER_TIMEOUT_SECONDS = 3


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

    def _hold_aggregates_until_both_exist(self):
        """Force the interleave seen on prod: both workers save their merged file before either cleans up."""
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
        with (
            patch("files.models.helpers.run_command", return_value="concat ok"),
            patch.object(Media, "post_encode_actions"),
            patch("files.models._schedule_storage_usage_refresh_for_media"),
        ):
            for thread in threads:
                thread.start()
            for thread in threads:
                thread.join()
        self.assertEqual(errors, [])

    def test_concurrent_finalisation_keeps_exactly_one_merged_encoding(self):
        self._hold_aggregates_until_both_exist()

        self._finalise_from_concurrent_workers()

        merged = list(Encoding.objects.filter(media=self.media, profile=self.profile, chunk=False))
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0].status, "success")
        self.assertTrue(os.path.exists(merged[0].media_file.path))
        self.assertFalse(Encoding.objects.filter(media=self.media, chunk=True).exists())

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
