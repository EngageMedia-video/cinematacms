from datetime import timedelta
from unittest.mock import patch

from django.conf import settings
from django.test import TestCase
from django.utils import timezone

from files import tasks
from files.models import EncodeProfile, Encoding, chunk_finalisation_cache, chunk_finalize_lock_key
from files.tests.helpers import create_test_media, create_test_user

STALE = timedelta(seconds=settings.RUNNING_STATE_STALE + 60)
LIVE = timedelta(seconds=settings.RUNNING_STATE_STALE - 60)
CHUNKED_DURATION = settings.CHUNKIZE_VIDEO_DURATION + 60


class CheckRunningStatesTests(TestCase):
    """A worker that dies mid-encode leaves its row in 'running' with no heartbeat."""

    def setUp(self):
        self.user = create_test_user()
        self.media = create_test_media(self.user, video_height=1080)
        self.profile = EncodeProfile.objects.create(name="h264-720", extension="mp4", codec="h264", resolution=720)
        self.second_profile = EncodeProfile.objects.create(
            name="h264-1080", extension="mp4", codec="h264", resolution=1080
        )
        queue_patches = (
            patch.object(tasks.encode_media, "apply_async"),
            patch.object(tasks.chunkize_media, "delay"),
        )
        self.encode_queue, self.chunk_queue = (queue_patch.start() for queue_patch in queue_patches)
        for queue_patch in queue_patches:
            self.addCleanup(queue_patch.stop)

    def _make_chunked(self):
        type(self.media).objects.filter(pk=self.media.pk).update(duration=CHUNKED_DURATION)
        self.media.refresh_from_db()

    def _encoding(self, silent_for, status="running", profile=None, media=None, **fields):
        encoding = Encoding.objects.create(
            media=media or self.media, profile=profile or self.profile, status=status, **fields
        )
        # update_date is auto_now, so only a queryset update can backdate it
        Encoding.objects.filter(pk=encoding.pk).update(update_date=timezone.now() - silent_for)
        return encoding

    def _chunk(self, silent_for, index, status="running", profile=None):
        return self._encoding(
            silent_for, status=status, profile=profile, chunk=True, chunk_file_path=f"/tmp/{index:02d}_chunk.mkv"
        )

    def test_reencodes_an_encoding_silent_for_whole_days(self):
        # Three days and one minute: a timedelta's .seconds component is only 60 here
        stale = self._encoding(silent_for=timedelta(days=3, minutes=1))

        result = tasks.check_running_states()

        self.assertFalse(Encoding.objects.filter(pk=stale.pk).exists())
        replacement = Encoding.objects.get(media=self.media, profile=self.profile)
        self.assertEqual(replacement.status, "pending")
        self.encode_queue.assert_called_once()
        self.assertEqual(
            result, {"outcome": "succeeded", "reason_code": "none", "processed": 1, "changed": 1, "failed": 0}
        )

    def test_leaves_an_encoding_with_a_recent_heartbeat_alone(self):
        live = self._encoding(silent_for=LIVE)

        result = tasks.check_running_states()

        self.assertTrue(Encoding.objects.filter(pk=live.pk, status="running").exists())
        self.encode_queue.assert_not_called()
        self.assertEqual(result["processed"], 0)

    def test_rebuilds_a_broken_chunk_group_with_one_split(self):
        self._make_chunked()
        for index in range(2):
            self._chunk(STALE, index)
        self._chunk(STALE, 2, status="success")

        result = tasks.check_running_states()

        self.assertFalse(Encoding.objects.filter(media=self.media, chunk=True).exists())
        self.chunk_queue.assert_called_once_with(self.media.friendly_token, [self.profile.id], force=True)
        self.assertEqual(result["changed"], 1)

    def test_splits_once_for_every_dead_profile_of_a_media(self):
        self._make_chunked()
        self._chunk(STALE, 0)
        self._chunk(STALE, 0, profile=self.second_profile)

        tasks.check_running_states()

        self.chunk_queue.assert_called_once()
        _, profile_ids = self.chunk_queue.call_args.args
        self.assertCountEqual(profile_ids, [self.profile.id, self.second_profile.id])

    def test_waits_while_a_sibling_chunk_still_has_a_heartbeat(self):
        self._make_chunked()
        dead = self._chunk(STALE, 0)
        live = self._chunk(LIVE, 1)

        tasks.check_running_states()

        self.assertEqual(set(Encoding.objects.values_list("id", flat=True)), {dead.id, live.id})
        self.chunk_queue.assert_not_called()

    def test_waits_while_the_chunk_group_is_being_merged(self):
        self._make_chunked()
        dead = self._chunk(STALE, 0)
        lock_key = chunk_finalize_lock_key(self.media.id, self.profile.id)
        chunk_finalisation_cache.add(lock_key, "merging worker", timeout=60)
        self.addCleanup(chunk_finalisation_cache.delete, lock_key)

        tasks.check_running_states()

        self.assertTrue(Encoding.objects.filter(pk=dead.pk).exists())
        self.chunk_queue.assert_not_called()
        self.assertEqual(chunk_finalisation_cache.get(lock_key), "merging worker")

    def test_keeps_dead_rows_for_the_next_run_when_queueing_fails(self):
        self._make_chunked()
        dead = self._chunk(STALE, 0)
        self.chunk_queue.side_effect = ConnectionError("broker unavailable")

        failed_run = tasks.check_running_states()

        self.assertTrue(Encoding.objects.filter(pk=dead.pk).exists())
        self.assertEqual(failed_run["failed"], 1)
        self.assertEqual(failed_run["outcome"], "failed")

        self.chunk_queue.side_effect = None
        tasks.check_running_states()

        self.assertFalse(Encoding.objects.filter(pk=dead.pk).exists())

    def test_reports_a_cache_outage_instead_of_treating_it_as_a_held_lock(self):
        dead = self._encoding(STALE)

        cache_backend = chunk_finalisation_cache.adapter.backend
        with patch.object(cache_backend, "add", side_effect=ConnectionError("cache unavailable")):
            result = tasks.check_running_states()

        self.assertTrue(Encoding.objects.filter(pk=dead.pk).exists())
        self.assertEqual((result["outcome"], result["failed"]), ("failed", 1))

    def test_releases_the_merge_lock_after_rebuilding(self):
        self._make_chunked()
        self._chunk(STALE, 0)

        tasks.check_running_states()

        self.assertIsNone(chunk_finalisation_cache.get(chunk_finalize_lock_key(self.media.id, self.profile.id)))

    def test_does_not_split_a_long_media_to_replace_only_its_gif(self):
        self._make_chunked()
        gif = EncodeProfile.objects.create(name="preview", extension="gif", codec="gif", resolution=0)
        self._encoding(STALE, profile=gif)

        tasks.check_running_states()

        self.encode_queue.assert_called_once()
        self.chunk_queue.assert_not_called()

    def test_defers_a_plain_replacement_that_cannot_be_queued(self):
        stale = self._encoding(STALE)
        self.encode_queue.side_effect = ConnectionError("broker unavailable")

        tasks.check_running_states()

        self.assertFalse(Encoding.objects.filter(pk=stale.pk).exists())
        replacement = Encoding.objects.get(media=self.media, profile=self.profile)
        self.assertEqual((replacement.status, replacement.task_dispatched), ("pending", False))

    def test_a_media_that_must_wait_does_not_use_up_the_run(self):
        self._make_chunked()
        self._chunk(STALE + timedelta(hours=1), 0)
        lock_key = chunk_finalize_lock_key(self.media.id, self.profile.id)
        chunk_finalisation_cache.add(lock_key, "merging worker", timeout=60)
        self.addCleanup(chunk_finalisation_cache.delete, lock_key)
        newer_media = create_test_media(self.user, video_height=1080)
        newer = self._encoding(silent_for=STALE, media=newer_media)

        with patch.object(tasks, "STALE_ENCODING_MEDIA_PER_RUN", 1):
            result = tasks.check_running_states()

        self.assertFalse(Encoding.objects.filter(pk=newer.pk).exists())
        self.assertEqual((result["processed"], result["changed"]), (2, 1))

    def test_replaces_the_longest_dead_media_first_and_leaves_the_rest_for_later_runs(self):
        newer_media = create_test_media(self.user, video_height=1080)
        self._encoding(silent_for=STALE, media=newer_media)
        oldest = self._encoding(silent_for=STALE + timedelta(hours=1))

        with patch.object(tasks, "STALE_ENCODING_MEDIA_PER_RUN", 1):
            result = tasks.check_running_states()

        self.assertFalse(Encoding.objects.filter(pk=oldest.pk).exists())
        self.assertTrue(Encoding.objects.filter(media=newer_media, status="running").exists())
        self.assertEqual(result["processed"], 1)
