from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase
from django.utils import timezone

from files.models import Media
from files.tasks import apply_visibility_schedules
from files.tests.helpers import create_test_media, create_test_user


class VisibilityScheduleTaskTest(TestCase):
    def setUp(self):
        self.user = create_test_user()

    def _media_with_schedule(self, *, state="public", start=None, expires=None, after="private", window="public"):
        media = create_test_media(self.user, state=state)
        Media.objects.filter(pk=media.pk).update(
            visibility_start_date=start,
            visibility_expires_at=expires,
            visibility_after_expiry=after,
            visibility_window_state=window,
        )
        media.refresh_from_db()
        return media

    def test_before_start_is_private_even_when_after_expiry_is_unlisted(self):
        now = timezone.now()
        media = self._media_with_schedule(
            state="public",
            start=now + timedelta(days=2),
            expires=now + timedelta(days=5),
            after="unlisted",
            window="public",
        )

        apply_visibility_schedules()

        media.refresh_from_db()
        self.assertEqual(media.state, "private")

    def test_active_window_restores_window_state(self):
        now = timezone.now()
        media = self._media_with_schedule(
            state="private",
            start=now - timedelta(days=1),
            expires=now + timedelta(days=1),
            after="private",
            window="public",
        )

        apply_visibility_schedules()

        media.refresh_from_db()
        self.assertEqual(media.state, "public")

    def test_expired_window_applies_after_expiry_state(self):
        now = timezone.now()
        media = self._media_with_schedule(
            state="public",
            start=now - timedelta(days=5),
            expires=now - timedelta(days=1),
            after="unlisted",
            window="public",
        )

        apply_visibility_schedules()

        media.refresh_from_db()
        self.assertEqual(media.state, "unlisted")

    def test_no_schedule_is_unchanged(self):
        media = create_test_media(self.user, state="public")

        apply_visibility_schedules()

        media.refresh_from_db()
        self.assertEqual(media.state, "public")

    def test_idempotent_state_does_not_save_or_notify(self):
        now = timezone.now()
        self._media_with_schedule(
            state="private",
            start=now + timedelta(days=2),
            expires=now + timedelta(days=5),
            after="unlisted",
            window="public",
        )

        with (
            patch("files.models.Media._invalidate_permission_cache") as invalidate_cache,
            patch("files.methods.notify_users") as notify_users,
            patch("files.tasks.media_init.apply_async") as media_init,
        ):
            apply_visibility_schedules()

        invalidate_cache.assert_not_called()
        notify_users.assert_not_called()
        media_init.assert_not_called()

    def test_publish_notification_fires_on_transition_to_public(self):
        now = timezone.now()
        media = self._media_with_schedule(
            state="private",
            start=now - timedelta(days=1),
            expires=now + timedelta(days=1),
            after="private",
            window="public",
        )

        with patch("files.methods.notify_users") as notify_users:
            apply_visibility_schedules()

        media.refresh_from_db()
        self.assertEqual(media.state, "public")
        notify_users.assert_any_call(friendly_token=media.friendly_token, action="media_published")

    def test_lock_returns_without_running_inner_task(self):
        with (
            patch("files.tasks.cache.add", return_value=False),
            patch("files.tasks._apply_visibility_schedules_inner") as inner,
        ):
            apply_visibility_schedules()

        inner.assert_not_called()

    def test_per_row_error_isolated(self):
        now = timezone.now()
        first = self._media_with_schedule(
            state="public",
            start=now + timedelta(days=1),
            expires=now + timedelta(days=2),
            after="private",
            window="public",
        )
        second = self._media_with_schedule(
            state="public",
            start=now + timedelta(days=1),
            expires=now + timedelta(days=2),
            after="private",
            window="public",
        )

        # Key the failure on the specific instance rather than call order, so the
        # test is robust to other scheduled media in the (mirrored) test DB and to
        # queryset ordering. `first` raises; every other row computes normally.
        real_expected = Media.expected_visibility_state

        def fake_expected(self, now=None):
            if self.pk == first.pk:
                raise ValueError("bad row")
            return real_expected(self, now)

        with patch("files.tasks.Media.expected_visibility_state", autospec=True, side_effect=fake_expected):
            apply_visibility_schedules()

        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.state, "public")
        self.assertEqual(second.state, "private")
