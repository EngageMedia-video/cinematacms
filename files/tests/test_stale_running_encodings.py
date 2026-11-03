from datetime import timedelta
from unittest.mock import patch

from django.conf import settings
from django.test import TestCase
from django.utils import timezone

from files.models import EncodeProfile, Encoding, Media
from files.tasks import check_running_states
from files.tests.helpers import create_test_media, create_test_user


class CheckRunningStatesTests(TestCase):
    """A worker that dies mid-encode leaves its row in 'running' with no heartbeat."""

    def setUp(self):
        self.media = create_test_media(create_test_user())
        self.profile = EncodeProfile.objects.create(name="h264-720", extension="mp4", codec="h264", resolution=720)

    def _running_encoding(self, silent_for, **fields):
        encoding = Encoding.objects.create(media=self.media, profile=self.profile, status="running", **fields)
        # update_date is auto_now, so only a queryset update can backdate it
        Encoding.objects.filter(pk=encoding.pk).update(update_date=timezone.now() - silent_for)
        return encoding

    def _check_running_states(self):
        with (
            patch.object(Media, "encode", autospec=True) as encode,
            patch.object(Media, "post_encode_actions"),
        ):
            result = check_running_states()
        return result, encode

    def test_reencodes_an_encoding_silent_for_whole_days(self):
        # Three days and one minute: a timedelta's .seconds component is only 60 here
        stale = self._running_encoding(silent_for=timedelta(days=3, minutes=1))

        result, encode = self._check_running_states()

        self.assertFalse(Encoding.objects.filter(pk=stale.pk).exists())
        encode.assert_called_once_with(self.media, profiles=[self.profile])
        self.assertEqual(result, {"outcome": "succeeded", "reason_code": "none", "processed": 1, "changed": 1})

    def test_leaves_an_encoding_with_a_recent_heartbeat_alone(self):
        live = self._running_encoding(silent_for=timedelta(seconds=settings.RUNNING_STATE_STALE - 60))

        result, encode = self._check_running_states()

        self.assertTrue(Encoding.objects.filter(pk=live.pk, status="running").exists())
        encode.assert_not_called()
        self.assertEqual(result["changed"], 0)

    def test_reencodes_a_broken_chunk_group_once(self):
        silent = timedelta(seconds=settings.RUNNING_STATE_STALE + 60)
        for index in range(3):
            self._running_encoding(silent_for=silent, chunk=True, chunk_file_path=f"/tmp/{index:02d}_chunk.mkv")
        finished_sibling = Encoding.objects.create(
            media=self.media, profile=self.profile, status="success", chunk=True, chunk_file_path="/tmp/03_chunk.mkv"
        )

        result, encode = self._check_running_states()

        self.assertFalse(Encoding.objects.filter(pk=finished_sibling.pk).exists())
        self.assertFalse(Encoding.objects.filter(media=self.media, chunk=True).exists())
        encode.assert_called_once_with(self.media, profiles=[self.profile])
        self.assertEqual(result["changed"], 1)
