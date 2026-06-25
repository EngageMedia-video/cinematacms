from datetime import date, datetime, time, timedelta

from django.test import TestCase
from django.utils import timezone

from files.forms import MediaForm, _to_local_midnight
from files.models import Category, Language, Media
from files.tests.helpers import create_test_media, create_test_user


class MediaFormVisibilityScheduleTest(TestCase):
    def setUp(self):
        self.user = create_test_user()
        self.user.advancedUser = True
        self.user.save()
        self.media = create_test_media(self.user, state="public")
        self.category = Category.objects.first() or Category.objects.create(
            title="Test Category", user=self.user, is_global=True
        )
        Language.objects.get_or_create(code="en", defaults={"title": "English"})

    def _get_form_data(self, **overrides):
        data = {
            "title": "Visibility Test",
            "state": "public",
            "password": "",
            "summary": "test summary",
            "description": "test description",
            "media_language": "en",
            "media_country": "AU",
            "category": [self.category.id],
            "topics": [],
            "new_tags": "",
            "year_produced": "2025",
            "enable_comments": True,
            "allow_download": True,
            "visibility_start": "",
            "visibility_end": "",
        }
        data.update(overrides)
        return data

    def test_end_date_before_start_date_is_invalid(self):
        today = timezone.localdate()
        data = self._get_form_data(
            visibility_start=(today + timedelta(days=2)).isoformat(),
            visibility_end=today.isoformat(),
        )

        form = MediaForm(self.user, data=data, instance=self.media)

        self.assertFalse(form.is_valid())
        self.assertIn("visibility_end", form.errors)

    def test_valid_window_stores_window_state_and_inclusive_end_datetime(self):
        today = timezone.localdate()
        data = self._get_form_data(
            state="unlisted",
            visibility_start=(today - timedelta(days=1)).isoformat(),
            visibility_end=(today + timedelta(days=1)).isoformat(),
        )

        form = MediaForm(self.user, data=data, instance=self.media)

        self.assertTrue(form.is_valid(), f"Form errors: {form.errors}")
        saved = form.save()
        self.assertEqual(saved.visibility_window_state, "unlisted")
        self.assertEqual(saved.visibility_after_expiry, "private")
        self.assertEqual(saved.state, "unlisted")
        self.assertEqual(saved.visibility_expires_at, _to_local_midnight(today + timedelta(days=1)) + timedelta(days=1))

    def test_save_immediately_hides_future_start_media(self):
        today = timezone.localdate()
        data = self._get_form_data(
            state="public",
            visibility_start=(today + timedelta(days=5)).isoformat(),
            visibility_end=(today + timedelta(days=10)).isoformat(),
        )

        form = MediaForm(self.user, data=data, instance=self.media)

        self.assertTrue(form.is_valid(), f"Form errors: {form.errors}")
        saved = form.save()
        saved.refresh_from_db()
        self.assertEqual(saved.visibility_window_state, "public")
        self.assertEqual(saved.visibility_after_expiry, "private")
        self.assertEqual(saved.state, "private")

    def test_save_immediately_expires_already_ended_media(self):
        today = timezone.localdate()
        data = self._get_form_data(
            state="public",
            visibility_start=(today - timedelta(days=10)).isoformat(),
            visibility_end=(today - timedelta(days=1)).isoformat(),
        )

        form = MediaForm(self.user, data=data, instance=self.media)

        self.assertTrue(form.is_valid(), f"Form errors: {form.errors}")
        saved = form.save()
        saved.refresh_from_db()
        self.assertEqual(saved.visibility_window_state, "public")
        self.assertEqual(saved.state, "private")

    def test_date_coercion_accepts_date_naive_datetime_and_aware_datetime(self):
        local_tz = timezone.get_current_timezone()
        day = date(2026, 6, 11)
        naive_dt = datetime.combine(day, time(hour=14, minute=30))
        aware_dt = timezone.make_aware(naive_dt, local_tz)
        expected = timezone.make_aware(datetime.combine(day, time.min), local_tz)

        self.assertEqual(_to_local_midnight(day), expected)
        self.assertEqual(_to_local_midnight(naive_dt), expected)
        self.assertEqual(_to_local_midnight(aware_dt), expected)

    def test_unchecking_schedule_clears_visibility_fields(self):
        Media.objects.filter(pk=self.media.pk).update(
            visibility_start_date=timezone.now() + timedelta(days=1),
            visibility_expires_at=timezone.now() + timedelta(days=3),
            visibility_after_expiry="unlisted",
            visibility_window_state="public",
        )
        self.media.refresh_from_db()
        data = self._get_form_data(state="unlisted")

        form = MediaForm(self.user, data=data, instance=self.media)

        self.assertTrue(form.is_valid(), f"Form errors: {form.errors}")
        saved = form.save()
        saved.refresh_from_db()
        self.assertEqual(saved.state, "unlisted")
        self.assertIsNone(saved.visibility_start_date)
        self.assertIsNone(saved.visibility_expires_at)
        self.assertIsNone(saved.visibility_after_expiry)
        self.assertIsNone(saved.visibility_window_state)

    def test_legacy_edit_without_visibility_aliases_does_not_clear_existing_schedule(self):
        start = timezone.now() + timedelta(days=1)
        expires = timezone.now() + timedelta(days=3)
        Media.objects.filter(pk=self.media.pk).update(
            visibility_start_date=start,
            visibility_expires_at=expires,
            visibility_after_expiry="private",
            visibility_window_state="public",
        )
        self.media.refresh_from_db()
        data = self._get_form_data(state="public")
        data.pop("visibility_start")
        data.pop("visibility_end")

        form = MediaForm(self.user, data=data, instance=self.media)

        self.assertTrue(form.is_valid(), f"Form errors: {form.errors}")
        saved = form.save()
        saved.refresh_from_db()
        self.assertEqual(saved.visibility_start_date, start)
        self.assertEqual(saved.visibility_expires_at, expires)
        self.assertEqual(saved.visibility_after_expiry, "private")
        self.assertEqual(saved.visibility_window_state, "public")
