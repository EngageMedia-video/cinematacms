from datetime import datetime, timedelta
from unittest.mock import patch

from django.core import mail
from django.test import TestCase, override_settings
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
            patch("files.tasks.scheduled_task_lock_cache.add", return_value=False),
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


WINDOW_ENDED_SUBJECT = "[Cinemata] - The visibility window for your film has ended"


@override_settings(
    PORTAL_NAME="Cinemata",
    CURATOR_CONTACT_EMAIL="curators@example.org",
    SSL_FRONTEND_HOST="https://films.example.org",
)
class VisibilityWindowEndedEmailTest(TestCase):
    """Issue #864: tell the filmmaker when a scheduled visibility window closes."""

    def _scheduled_media(self, *, username, title, state, start, expires, after, window):
        user = create_test_user(username=username, email=f"{username}@example.com")
        media = create_test_media(user, state=state)
        Media.objects.filter(pk=media.pk).update(
            title=title,
            visibility_start_date=start,
            visibility_expires_at=expires,
            visibility_after_expiry=after,
            visibility_window_state=window,
        )
        media.refresh_from_db()
        return media

    def _window_ended_emails(self):
        return [message for message in mail.outbox if message.subject == WINDOW_ENDED_SUBJECT]

    def test_each_closed_window_emails_its_filmmaker_once_with_the_new_state(self):
        # The filmmaker picked 3 March 2025 as the end date. The edit form stores
        # that as local midnight at the start of the following day.
        expires = timezone.make_aware(datetime(2025, 3, 4))
        unlisted_film = self._scheduled_media(
            username="ana",
            title="Harbour Lights",
            state="public",
            start=expires - timedelta(days=10),
            expires=expires,
            after="unlisted",
            window="public",
        )
        private_film = self._scheduled_media(
            username="budi",
            title="River Songs",
            state="public",
            start=expires - timedelta(days=10),
            expires=expires,
            after="private",
            window="public",
        )
        mail.outbox = []

        apply_visibility_schedules()
        apply_visibility_schedules()

        emails = {message.to[0]: message for message in self._window_ended_emails()}
        self.assertEqual(sorted(emails), ["ana@example.com", "budi@example.com"])
        self.assertEqual(len(self._window_ended_emails()), 2)

        ana_body = emails["ana@example.com"].body
        self.assertIn("Dear ana,", ana_body)
        self.assertIn(
            'The visibility window you set for "Harbour Lights" ended on 3 March 2025. '
            "As scheduled, your film is now unlisted, so only people with the link can see it.",
            ana_body,
        )
        self.assertIn(f"URL: https://films.example.org/view?m={unlisted_film.friendly_token}", ana_body)
        self.assertIn(
            "To make it visible again, open the film's edit page and change its status or set a new visibility window.",
            ana_body,
        )
        self.assertIn("If you have questions, write to us at curators@example.org.", ana_body)
        self.assertIn("The Cinemata Team", ana_body)

        budi_body = emails["budi@example.com"].body
        self.assertIn(
            'The visibility window you set for "River Songs" ended on 3 March 2025. '
            "As scheduled, your film is now private, so only you can see it.",
            budi_body,
        )
        self.assertIn(f"URL: https://films.example.org/view?m={private_film.friendly_token}", budi_body)

    def test_a_window_opening_into_unlisted_sends_no_window_ended_email(self):
        now = timezone.now()
        media = self._scheduled_media(
            username="citra",
            title="Night Market",
            state="private",
            start=now - timedelta(hours=1),
            expires=now + timedelta(days=7),
            after="private",
            window="unlisted",
        )
        mail.outbox = []

        apply_visibility_schedules()

        media.refresh_from_db()
        self.assertEqual(media.state, "unlisted")
        self.assertEqual(self._window_ended_emails(), [])

    def test_a_deployment_can_switch_the_window_ended_email_off(self):
        expires = timezone.make_aware(datetime(2025, 3, 4))
        media = self._scheduled_media(
            username="dewi",
            title="Quiet Shore",
            state="public",
            start=expires - timedelta(days=10),
            expires=expires,
            after="private",
            window="public",
        )
        mail.outbox = []

        with self.settings(USERS_NOTIFICATIONS={"MEDIA_VISIBILITY_ENDED": False}):
            apply_visibility_schedules()

        media.refresh_from_db()
        self.assertEqual(media.state, "private")
        self.assertEqual(self._window_ended_emails(), [])
