"""
Tests for MediaForm and the pages that save media through it.
"""

from unittest.mock import patch

from django.contrib.auth.hashers import check_password
from django.db.models.fields.files import FieldFile
from django.forms import MultiWidget
from django.test import TestCase, override_settings
from django.urls import reverse

from actions.models import MediaAction, recount_reported_times
from files.forms import MediaForm
from files.models import Category, Language, Media
from files.tests.helpers import create_test_media, create_test_user, make_vite_loader_mock


class MediaFormPasswordValidationTest(TestCase):
    def setUp(self):
        self.user = create_test_user()
        self.user.advancedUser = True
        self.user.save()
        self.media = create_test_media(self.user, state="restricted")
        self.media.set_password("original1234")
        self.media.save()
        # Ensure a category exists for valid form submissions
        self.category = Category.objects.first() or Category.objects.create(
            title="Test Category", user=self.user, is_global=True
        )
        Language.objects.get_or_create(code="en", defaults={"title": "English"})

    def _get_form_data(self, **overrides):
        """Return a fully valid form payload."""
        data = {
            "title": "Test",
            "state": "restricted",
            "password": "validpass123",
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
        }
        data.update(overrides)
        return data

    def test_password_shorter_than_minimum_rejected(self):
        data = self._get_form_data(password="short")
        form = MediaForm(self.user, data=data, instance=self.media)
        self.assertFalse(form.is_valid())
        self.assertIn("password", form.errors)
        self.assertIn("at least", form.errors["password"][0])

    def test_password_at_minimum_length_accepted(self):
        data = self._get_form_data(password="12345678")
        form = MediaForm(self.user, data=data, instance=self.media)
        self.assertTrue(form.is_valid(), f"Form errors: {form.errors}")

    def test_password_hashed_on_save(self):
        """Valid form save actually hashes the password."""
        data = self._get_form_data(password="newpassword99")
        form = MediaForm(self.user, data=data, instance=self.media)
        self.assertTrue(form.is_valid(), f"Form errors: {form.errors}")
        form.save()
        self.media.refresh_from_db()
        self.assertTrue(check_password("newpassword99", self.media.password))

    def test_empty_password_with_restricted_state_preserves_existing(self):
        """Leaving password blank on an existing restricted media keeps the old hash."""
        old_hash = self.media.password
        data = self._get_form_data(password="")
        form = MediaForm(self.user, data=data, instance=self.media)
        # The form should be valid -- existing hash is preserved
        if form.is_valid():
            form.save()
            self.media.refresh_from_db()
            self.assertEqual(self.media.password, old_hash)
        else:
            # If form is invalid, password should not be the reason
            self.assertNotIn("password", form.errors)

    def test_empty_password_with_restricted_state_rejected_when_no_existing(self):
        """Setting restricted state without a password on new media is rejected."""
        media_no_pw = create_test_media(self.user, state="public")
        data = self._get_form_data(password="")
        form = MediaForm(self.user, data=data, instance=media_no_pw)
        self.assertFalse(form.is_valid())
        self.assertIn("password", form.errors)

    def test_password_not_required_for_public_state(self):
        data = self._get_form_data(state="public", password="")
        form = MediaForm(self.user, data=data, instance=self.media)
        if not form.is_valid():
            self.assertNotIn("password", form.errors)

    def test_custom_year_before_1900_is_accepted(self):
        data = self._get_form_data(year_produced="other", year_produced_custom="1898")
        form = MediaForm(self.user, data=data, instance=self.media)
        self.assertTrue(form.is_valid(), f"Form errors: {form.errors}")
        media = form.save()
        self.assertEqual(media.year_produced, 1898)

    def test_custom_year_zero_is_rejected(self):
        data = self._get_form_data(year_produced="other", year_produced_custom="0")
        form = MediaForm(self.user, data=data, instance=self.media)
        self.assertFalse(form.is_valid())
        self.assertIn("year_produced_custom", form.errors)

    def test_summary_over_80_words_names_the_short_description(self):
        data = self._get_form_data(summary=" ".join(["word"] * 81))
        form = MediaForm(self.user, data=data, instance=self.media)
        self.assertFalse(form.is_valid())
        self.assertEqual(form.errors["summary"], ["Short description should have 80 words maximum"])

    @override_settings(MEDIA_PASSWORD_MIN_LENGTH=12)
    def test_respects_configurable_min_length(self):
        data = self._get_form_data(password="short1234")  # 9 chars, less than 12
        form = MediaForm(self.user, data=data, instance=self.media)
        self.assertFalse(form.is_valid())
        self.assertIn("password", form.errors)
        self.assertIn("12", form.errors["password"][0])

    def test_completing_draft_clears_is_draft_flag(self):
        """A bulk-upload draft finished through the normal MediaForm save path
        (the edit page) drops is_draft, so the media re-enters the admin review
        queue instead of being excluded forever."""
        Media.objects.filter(pk=self.media.pk).update(is_draft=True)
        self.media.refresh_from_db()
        self.assertTrue(self.media.is_draft)

        data = self._get_form_data(password="validpass123")
        form = MediaForm(self.user, data=data, instance=self.media)
        self.assertTrue(form.is_valid(), f"Form errors: {form.errors}")
        form.save()

        self.media.refresh_from_db()
        self.assertFalse(self.media.is_draft)


@override_settings(MFA_REQUIRED_ROLES=[])
class ReportedTimesFollowsReportsTest(TestCase):
    """No form may store a typed reported_times; only Report rows decide it."""

    posted_reported_times = "99"

    def setUp(self):
        self.editor = create_test_user(is_editor=True)
        self.media = create_test_media(create_test_user(), state="public", featured=False)
        for _ in range(2):
            MediaAction.objects.create(media=self.media, user=create_test_user(), action="report", extra_info="Spam")
        recount_reported_times([self.media.pk])
        self.category = Category.objects.first() or Category.objects.create(
            title="Test Category", user=self.editor, is_global=True
        )
        Language.objects.get_or_create(code="en", defaults={"title": "English"})
        self.client.force_login(self.editor)

    def _edit_page_post(self, **overrides):
        data = {
            "title": "Renamed by an editor",
            "state": "public",
            "summary": "test summary",
            "description": "test description",
            "media_language": "en",
            "media_country": "AU",
            "category": [self.category.id],
            "new_tags": "",
            "year_produced": "2025",
            "enable_comments": "on",
            "allow_download": "on",
            "featured": "on",
            "is_reviewed": "on",
            "reported_times": self.posted_reported_times,
            **overrides,
        }
        return self.client.post(f"{reverse('edit_media')}?m={self.media.friendly_token}", data)

    def _assert_counter_equals_report_rows(self):
        self.media.refresh_from_db()
        self.assertEqual(self.media.reported_times, 2)
        self.assertEqual(MediaAction.objects.filter(media=self.media, action="report").count(), 2)

    def test_edit_page_saves_admin_settings_but_not_a_typed_counter(self):
        response = self._edit_page_post()

        self.assertEqual(response.status_code, 302)
        self._assert_counter_equals_report_rows()
        self.assertEqual((self.media.title, self.media.featured), ("Renamed by an editor", True))

    def test_upload_submit_ignores_a_typed_counter(self):
        Media.objects.filter(pk=self.media.pk).update(is_draft=True, state="private")

        response = self._edit_page_post(state="private")

        self.assertEqual(response.status_code, 302)
        self._assert_counter_equals_report_rows()
        self.assertEqual((self.media.is_draft, self.media.featured), (False, True))

    def test_upload_draft_ignores_a_typed_counter(self):
        Media.objects.filter(pk=self.media.pk).update(is_draft=True, state="private")

        response = self._edit_page_post(action="draft", title="Draft title")

        self.assertEqual(response.status_code, 302)
        self._assert_counter_equals_report_rows()
        self.assertEqual((self.media.title, self.media.is_draft), ("Draft title", True))

    @patch(
        "django_vite.core.asset_loader.DjangoViteAssetLoader.instance",
        return_value=make_vite_loader_mock(),
    )
    def test_edit_page_shows_the_count_and_keeps_the_other_admin_settings(self, _mock_vite):
        config = self.client.get(f"{reverse('edit_media')}?m={self.media.friendly_token}").context[
            "edit_media_page_config"
        ]

        self.assertTrue(config["permissions"]["canUseAdminSettings"])
        self.assertTrue({"featured", "is_reviewed", "add_date"} <= set(config["fields"]))
        self.assertNotIn("reported_times", config["fields"])
        self.assertEqual(config["media"]["reportedTimes"], 2)

    def test_media_admin_change_form_ignores_a_typed_counter(self):
        Media.objects.filter(pk=self.media.pk).update(summary="test summary", media_file="original/test.mp4")
        self.client.force_login(create_test_user(is_superuser=True, is_staff=True))
        change_url = reverse("admin:files_media_change", args=[self.media.pk])
        data = _admin_change_form_data(self.client.get(change_url))
        data.update(title="Renamed in admin", reported_times=self.posted_reported_times)

        with patch.object(Media, "media_init", return_value=None):
            response = self.client.post(change_url, data)

        self.assertRedirects(response, reverse("admin:files_media_changelist"), fetch_redirect_response=False)
        self._assert_counter_equals_report_rows()
        self.assertEqual(self.media.title, "Renamed in admin")


def _admin_change_form_data(response):
    """Return the POST body a browser sends for the admin change form as rendered."""
    form = response.context["adminform"].form
    data = {}
    for name in form.fields:
        bound = form[name]
        widget = bound.field.widget
        value = bound.value()
        if isinstance(widget, MultiWidget):
            for index, part in enumerate(widget.decompress(value)):
                data[f"{bound.html_name}_{index}"] = "" if part is None else part
        elif value is None or value is False or isinstance(value, FieldFile):
            continue
        elif value is True:
            data[bound.html_name] = "on"
        else:
            data[bound.html_name] = value
    return data
