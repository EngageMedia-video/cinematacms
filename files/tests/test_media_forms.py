"""
Tests for MediaForm password validation.
"""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings

from files.forms import MediaForm
from files.models import Media

User = get_user_model()


def create_test_media(user, **kwargs):
    state = kwargs.pop("state", "public")
    defaults = {
        "media_type": "video",
        "duration": 120,
        "views": 0,
        "likes": 0,
        "dislikes": 0,
        "reported_times": 0,
        "encoding_status": "success",
        "is_reviewed": True,
    }
    defaults.update(kwargs)
    with patch.object(Media, "media_init", return_value=None):
        media = Media.objects.create(title="Test", user=user, **defaults)
    Media.objects.filter(pk=media.pk).update(state=state)
    media.refresh_from_db()
    return media


class MediaFormPasswordValidationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="formuser", password="testpass1234567890")
        self.user.advancedUser = True
        self.user.save()
        self.media = create_test_media(self.user, state="restricted")
        self.media.set_password("original1234")
        self.media.save()

    def _get_form_data(self, **overrides):
        """Return minimal valid form data for editing."""
        data = {
            "title": "Test",
            "state": "restricted",
            "password": "validpass123",
            "summary": "test",
            "description": "test",
            "media_language": "en",
            "media_country": "",
            "category": "",
            "topics": "",
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
        # May have other validation errors (category etc.), but password should be fine
        if not form.is_valid():
            self.assertNotIn("password", form.errors)

    def test_empty_password_with_restricted_state_rejected(self):
        data = self._get_form_data(password="")
        form = MediaForm(self.user, data=data, instance=self.media)
        self.assertFalse(form.is_valid())
        self.assertIn("password", form.errors)

    def test_password_not_required_for_public_state(self):
        data = self._get_form_data(state="public", password="")
        form = MediaForm(self.user, data=data, instance=self.media)
        if not form.is_valid():
            self.assertNotIn("password", form.errors)

    @override_settings(MEDIA_PASSWORD_MIN_LENGTH=12)
    def test_respects_configurable_min_length(self):
        data = self._get_form_data(password="short1234")  # 9 chars, less than 12
        form = MediaForm(self.user, data=data, instance=self.media)
        self.assertFalse(form.is_valid())
        self.assertIn("password", form.errors)
        self.assertIn("12", form.errors["password"][0])
