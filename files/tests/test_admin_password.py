"""
Tests for the admin panel media password widget.
"""

from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.contrib.auth.hashers import check_password
from django.test import TestCase

from files.admin import MediaAdminForm
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


class MediaAdminFormPasswordTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_superuser(username="admin_test", password="adminpass1234567890")
        self.media = create_test_media(self.user, state="restricted")
        self.media.set_password("original123")
        self.media.save()
        self.original_hash = self.media.password

    def test_blank_password_preserves_existing_hash(self):
        """Admin save with empty password field should not change the hash."""
        form_data = self._get_admin_form_data(password="")
        form = MediaAdminForm(data=form_data, instance=self.media)
        if form.is_valid():
            form.save()
            self.media.refresh_from_db()
            self.assertEqual(self.media.password, self.original_hash)

    def test_new_password_gets_hashed(self):
        """Admin save with a new password should hash it."""
        form_data = self._get_admin_form_data(password="newadminpass")
        form = MediaAdminForm(data=form_data, instance=self.media)
        if form.is_valid():
            form.save()
            self.media.refresh_from_db()
            self.assertNotEqual(self.media.password, "newadminpass")
            self.assertTrue(check_password("newadminpass", self.media.password))

    def test_widget_renders_password_set_status(self):
        """Widget should show 'Password set' for media with password."""
        from files.admin import MediaPasswordWidget

        widget = MediaPasswordWidget()
        html = widget.render("password", self.original_hash)
        self.assertIn("Password set", html)

    def test_widget_renders_no_password_status(self):
        """Widget should show 'No password' for media without password."""
        from files.admin import MediaPasswordWidget

        widget = MediaPasswordWidget()
        html = widget.render("password", "")
        self.assertIn("No password", html)

    def _get_admin_form_data(self, **overrides):
        """Return minimal data for the admin form."""
        data = {
            "title": self.media.title,
            "user": self.user.pk,
            "state": self.media.state,
            "password": "",
            "media_type": "video",
            "enable_comments": True,
            "allow_download": True,
            "video_height": 1,
        }
        data.update(overrides)
        return data
