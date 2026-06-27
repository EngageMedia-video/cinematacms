import uuid
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from cms.permissions import max_bulk_upload_files
from files import lists
from files.models import Category, Language, License, Media
from users.models import User


def create_test_media(user, title, **kwargs):
    """Create a Media row with media_init patched out (no file processing).

    Media.save() overrides state on creation, so set it afterwards if requested.
    """
    desired_state = kwargs.pop("state", None)
    with patch.object(Media, "media_init", return_value=None):
        media = Media.objects.create(title=title, user=user, media_type="video", **kwargs)
    if desired_state and media.state != desired_state:
        Media.objects.filter(pk=media.pk).update(state=desired_state)
        media.refresh_from_db()
    return media


class MaxBulkUploadFilesTests(TestCase):
    def setUp(self):
        self.regular = User.objects.create_user(username="reg", email="reg@e.com", password="pw")
        self.trusted = User.objects.create_user(username="tru", email="tru@e.com", password="pw")
        self.trusted.advancedUser = True
        self.trusted.save()

    def test_default_limits(self):
        self.assertEqual(max_bulk_upload_files(self.regular), 2)
        self.assertEqual(max_bulk_upload_files(self.trusted), 10)

    @override_settings(BULK_UPLOAD_MAX_FILES_REGULAR=1, BULK_UPLOAD_MAX_FILES_TRUSTED=5)
    def test_limits_are_settings_overridable(self):
        self.assertEqual(max_bulk_upload_files(self.regular), 1)
        self.assertEqual(max_bulk_upload_files(self.trusted), 5)


class BulkUploadOptionsTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.regular = User.objects.create_user(username="reg", email="reg@e.com", password="pw")
        Category.objects.get_or_create(title="Documentary")
        Language.objects.get_or_create(code="en", defaults={"title": "English"})

    def test_anonymous_forbidden(self):
        response = self.client.get("/api/v1/my_uploads/upload_options")
        self.assertEqual(response.status_code, 403)

    def test_regular_user_gets_options(self):
        self.client.login(username="reg", password="pw")
        response = self.client.get("/api/v1/my_uploads/upload_options")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        for key in ("categories", "topics", "content_sensitivities", "languages", "countries", "licenses"):
            self.assertIn(key, data)
        self.assertTrue(any(language["code"] == "en" for language in data["languages"]))
        self.assertTrue(any(category["title"] == "Documentary" for category in data["categories"]))

    def test_licenses_expose_creative_commons_fields(self):
        # The shared CC license chooser resolves a license from the commercial /
        # modifications selection, so upload_options must expose those fields (same
        # shape the single-upload page injects via window.MediaCMS.addMediaPage).
        License.objects.get_or_create(
            title="Test License",
            defaults={"allow_commercial": "yes", "allow_modifications": "yes"},
        )
        self.client.login(username="reg", password="pw")
        response = self.client.get("/api/v1/my_uploads/upload_options")
        licenses = response.json()["licenses"]
        self.assertTrue(licenses, "expected at least one license in upload_options")
        for key in ("id", "title", "allowCommercial", "allowModifications"):
            self.assertIn(key, licenses[0])


class BulkDraftReviewExclusionTests(TestCase):
    """Drafts must never appear in the admin review queue (MediaList)."""

    def setUp(self):
        self.client = Client()
        self.author = User.objects.create_user(username="author", email="author@e.com", password="pw")
        self.editor = User.objects.create_user(username="editor", email="editor@e.com", password="pw")
        self.editor.is_editor = True
        self.editor.save()
        self.normal = create_test_media(self.author, "Normal", state="private")
        self.draft = create_test_media(self.author, "Draft", state="private")
        Media.objects.filter(pk=self.draft.pk).update(is_draft=True)

    def test_drafts_excluded_from_manage_media(self):
        self.client.login(username="editor", password="pw")
        response = self.client.get("/api/v1/manage_media")
        self.assertEqual(response.status_code, 200)
        tokens = [item["friendly_token"] for item in response.json().get("results", [])]
        self.assertIn(self.normal.friendly_token, tokens)
        self.assertNotIn(self.draft.friendly_token, tokens)

    def test_completed_draft_reenters_review_queue(self):
        # Finishing a draft through the standard edit form (MediaForm.save) — the
        # exact path the bulk flow now submits through — clears is_draft, so it
        # stops being excluded from the review queue.
        from files.forms import MediaForm

        category, _ = Category.objects.get_or_create(title="Documentary")
        Language.objects.get_or_create(code="en", defaults={"title": "English"})
        data = {
            "title": "Done",
            "summary": "A finished synopsis.",
            "description": "",
            "year_produced": "2021",
            "media_language": "en",
            "media_country": lists.video_countries[0][0],
            "category": [category.id],
            "topics": [],
            "new_tags": "",
            "state": "private",
            "enable_comments": True,
            "allow_download": True,
        }
        form = MediaForm(self.author, data=data, instance=self.draft)
        self.assertTrue(form.is_valid(), f"Form errors: {form.errors}")
        form.save()
        self.draft.refresh_from_db()
        self.assertFalse(self.draft.is_draft)

        self.client.login(username="editor", password="pw")
        response = self.client.get("/api/v1/manage_media")
        self.assertEqual(response.status_code, 200)
        tokens = [item["friendly_token"] for item in response.json().get("results", [])]
        self.assertIn(self.draft.friendly_token, tokens)


class AutoDraftUploadTests(TestCase):
    """The bulk flow sends is_draft=1, so each uploaded file is created as a
    private draft (kept out of the admin review queue) until the user submits.
    The single-upload flow does not send the param and is unaffected.
    """

    def setUp(self):
        self.client = Client()
        self.regular = User.objects.create_user(username="regupload", email="regupload@e.com", password="pw")
        self.trusted = User.objects.create_user(username="tru", email="tru@e.com", password="pw")
        self.trusted.advancedUser = True
        self.trusted.save()
        self.client.force_login(self.trusted)

    def _upload(self, extra=None):
        content = b"\x00\x00\x00\x20ftypmp41\x00\x00\x00\x00mp41isom" + b"\x00" * 64
        data = {
            "qqfilename": "v.mp4",
            "qquuid": str(uuid.uuid4()),
            "qqtotalparts": 1,
            "qqpartindex": 0,
            "qqfile": SimpleUploadedFile("v.mp4", content, content_type="video/mp4"),
        }
        if extra:
            data.update(extra)
        return self.client.post(reverse("uploader:upload"), data=data)

    @patch.object(Media, "media_init", return_value=None)
    def test_bulk_upload_creates_private_draft(self, _mock_init):
        response = self._upload({"is_draft": "1"})
        self.assertEqual(response.status_code, 200)
        media = Media.objects.filter(user=self.trusted).latest("add_date")
        self.assertTrue(media.is_draft)
        self.assertEqual(media.state, "private")

    @patch.object(Media, "media_init", return_value=None)
    def test_single_upload_is_not_draft(self, _mock_init):
        response = self._upload()
        self.assertEqual(response.status_code, 200)
        media = Media.objects.filter(user=self.trusted).latest("add_date")
        self.assertFalse(media.is_draft)

    @patch.object(Media, "media_init", return_value=None)
    @override_settings(MEDIA_IS_REVIEWED=False)
    def test_trusted_upload_is_reviewed_even_when_global_default_requires_review(self, _mock_init):
        response = self._upload()
        self.assertEqual(response.status_code, 200)
        media = Media.objects.filter(user=self.trusted).latest("add_date")
        self.assertTrue(media.is_reviewed)

    @patch.object(Media, "media_init", return_value=None)
    @override_settings(MEDIA_IS_REVIEWED=True)
    def test_regular_upload_is_unreviewed_even_when_global_default_allows_reviewed(self, _mock_init):
        self.client.force_login(self.regular)

        response = self._upload()
        self.assertEqual(response.status_code, 200)
        media = Media.objects.filter(user=self.regular).latest("add_date")
        self.assertFalse(media.is_reviewed)
