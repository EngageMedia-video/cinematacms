from unittest.mock import patch

from django.conf import settings
from django.test import TestCase

from files import tasks
from files.models import EncodeProfile, Encoding
from files.tests.helpers import create_test_media, create_test_user

# Celery's Redis transport consumes priority 0 first and 9 last
REDIS_HIGHEST_PRIORITY = 0


class EncodePriorityTests(TestCase):
    """The resolutions every media needs must reach the worker before the larger ones."""

    def setUp(self):
        self.media = create_test_media(create_test_user(), video_height=1080)
        first_resolution = settings.MINIMUM_RESOLUTIONS_TO_ENCODE[0]
        self.first_profile = EncodeProfile.objects.create(
            name=f"h264-{first_resolution}", extension="mp4", codec="h264", resolution=first_resolution
        )
        self.later_profile = EncodeProfile.objects.create(
            name="h264-1080", extension="mp4", codec="h264", resolution=1080
        )
        queue_patch = patch.object(tasks.encode_media, "apply_async")
        self.encode_queue = queue_patch.start()
        self.addCleanup(queue_patch.stop)

    def _priority_by_profile_id(self):
        return {call.kwargs["args"][1]: call.kwargs["priority"] for call in self.encode_queue.call_args_list}

    def _assert_minimum_resolution_goes_first(self):
        priorities = self._priority_by_profile_id()
        self.assertEqual(priorities[self.first_profile.id], REDIS_HIGHEST_PRIORITY)
        self.assertGreater(priorities[self.later_profile.id], priorities[self.first_profile.id])

    def test_media_encode_queues_the_minimum_resolution_first(self):
        self.media.encode(profiles=[self.later_profile, self.first_profile])

        self._assert_minimum_resolution_goes_first()

    def test_deferred_encodes_keep_the_same_order_when_drained(self):
        for profile in (self.later_profile, self.first_profile):
            Encoding.objects.create(media=self.media, profile=profile, status="pending", task_dispatched=False)

        tasks.dispatch_deferred_encodings()

        self._assert_minimum_resolution_goes_first()
