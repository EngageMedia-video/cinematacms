import json
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


class BulkUploadPageGuardTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.regular = User.objects.create_user(username="reg", email="reg@e.com", password="pw")

    def test_anonymous_sees_page(self):
        # Anonymous users are not redirected; the template renders a sign-in prompt.
        response = self.client.get("/bulk_upload")
        self.assertEqual(response.status_code, 200)

    def test_regular_user_allowed(self):
        self.client.login(username="reg", password="pw")
        response = self.client.get("/bulk_upload")
        self.assertEqual(response.status_code, 200)

    @override_settings(BULK_UPLOAD_MAX_FILES_REGULAR=1)
    def test_single_file_only_user_redirected_to_single(self):
        self.client.login(username="reg", password="pw")
        response = self.client.get("/bulk_upload")
        self.assertEqual(response.status_code, 302)
        self.assertIn("/upload", response["Location"])


class BulkUploadOptionsTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.regular = User.objects.create_user(username="reg", email="reg@e.com", password="pw")
        Category.objects.get_or_create(title="Documentary")
        Language.objects.get_or_create(code="en", defaults={"title": "English"})

    def test_anonymous_forbidden(self):
        response = self.client.get("/api/v1/my_uploads/bulk_options")
        self.assertEqual(response.status_code, 403)

    def test_regular_user_gets_options(self):
        self.client.login(username="reg", password="pw")
        response = self.client.get("/api/v1/my_uploads/bulk_options")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        for key in ("categories", "topics", "content_sensitivities", "languages", "countries", "licenses"):
            self.assertIn(key, data)
        self.assertTrue(any(language["code"] == "en" for language in data["languages"]))
        self.assertTrue(any(category["title"] == "Documentary" for category in data["categories"]))


class BulkUploadSubmitTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = User.objects.create_user(username="reg", email="reg@e.com", password="pw")
        self.other = User.objects.create_user(username="other", email="other@e.com", password="pw")
        self.category, _ = Category.objects.get_or_create(title="Documentary")
        Language.objects.get_or_create(code="en", defaults={"title": "English"})
        self.country_code = lists.video_countries[0][0]
        self.media = create_test_media(self.user, "Original", state="private")

    def _valid_metadata(self, **overrides):
        metadata = {
            "title": "My Film",
            "summary": "A concise synopsis of the film.",
            "description": "Credits here",
            "year_produced": "2021",
            "year_produced_custom": "",
            "company": "ABC Media",
            "website": "https://example.com",
            "media_language": "en",
            "media_country": self.country_code,
            "category": [self.category.id],
            "topics": [],
            "content_sensitivity": [],
            "new_tags": "one, two",
            "custom_license": "",
            "no_license": True,
            "enable_comments": True,
            "allow_download": True,
            "state": "public",
            "password": "",
        }
        metadata.update(overrides)
        return metadata

    def _post(self, action, items):
        return self.client.post(
            "/api/v1/my_uploads/bulk_submit",
            data=json.dumps({"action": action, "items": items}),
            content_type="application/json",
        )

    def test_draft_marks_media_private_and_draft(self):
        self.client.login(username="reg", password="pw")
        response = self._post(
            "draft", [{"friendly_token": self.media.friendly_token, "metadata": {"title": "Draft title"}}]
        )
        self.assertEqual(response.status_code, 200)
        self.media.refresh_from_db()
        self.assertTrue(self.media.is_draft)
        self.assertEqual(self.media.state, "private")
        self.assertEqual(self.media.title, "Draft title")

    def test_submit_applies_metadata_and_clears_draft(self):
        Media.objects.filter(pk=self.media.pk).update(is_draft=True)
        self.client.login(username="reg", password="pw")
        response = self._post(
            "submit", [{"friendly_token": self.media.friendly_token, "metadata": self._valid_metadata()}]
        )
        self.assertEqual(response.status_code, 200)
        self.media.refresh_from_db()
        self.assertFalse(self.media.is_draft)
        self.assertEqual(self.media.title, "My Film")
        self.assertIn(self.category, self.media.category.all())
        self.assertEqual(self.media.tags.count(), 2)
        # Regular users cannot publish directly; state is clamped to private (review path).
        self.assertEqual(self.media.state, "private")

    def test_submit_rejects_synopsis_over_80_words(self):
        self.client.login(username="reg", password="pw")
        long_summary = " ".join(["word"] * 81)
        response = self._post(
            "submit",
            [{"friendly_token": self.media.friendly_token, "metadata": self._valid_metadata(summary=long_summary)}],
        )
        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertIn("errors", body)
        self.assertIn("summary", body["errors"][self.media.friendly_token])

    def test_cannot_submit_other_users_media(self):
        self.client.login(username="reg", password="pw")
        others_media = create_test_media(self.other, "Theirs", state="private")
        response = self._post(
            "submit", [{"friendly_token": others_media.friendly_token, "metadata": self._valid_metadata()}]
        )
        self.assertEqual(response.status_code, 400)

    def test_batch_over_limit_rejected(self):
        self.client.login(username="reg", password="pw")
        extra1 = create_test_media(self.user, "Extra1", state="private")
        extra2 = create_test_media(self.user, "Extra2", state="private")
        items = [
            {"friendly_token": token, "metadata": {"title": "x"}}
            for token in (self.media.friendly_token, extra1.friendly_token, extra2.friendly_token)
        ]
        response = self._post("draft", items)  # 3 items > regular limit of 2
        self.assertEqual(response.status_code, 400)

    def test_invalid_action_rejected(self):
        self.client.login(username="reg", password="pw")
        response = self._post("publish", [{"friendly_token": self.media.friendly_token, "metadata": {}}])
        self.assertEqual(response.status_code, 400)

    def test_rejects_malformed_metadata(self):
        self.client.login(username="reg", password="pw")
        response = self._post("draft", [{"friendly_token": self.media.friendly_token, "metadata": "not an object"}])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "metadata must be an object")
        response = self._post("draft", [{"friendly_token": self.media.friendly_token, "metadata": None}])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["detail"], "metadata must be an object")

    def test_rejects_invalid_license_reference(self):
        self.client.login(username="reg", password="pw")
        missing_license_id = (License.objects.order_by("-id").first().id if License.objects.exists() else 0) + 1
        response = self._post(
            "draft",
            [
                {
                    "friendly_token": self.media.friendly_token,
                    "metadata": self._valid_metadata(custom_license=missing_license_id, no_license=False),
                }
            ],
        )
        self.assertEqual(response.status_code, 400)
        body = response.json()
        self.assertIn("custom_license", body["errors"][self.media.friendly_token])

    def test_editor_submit_does_not_require_admin_only_fields(self):
        # Editors keep admin-only MediaForm fields (reported_times, featured,
        # is_reviewed, add_date) required, but the bulk UI never exposes them —
        # the bulk submit must not reject on those fields.
        editor = User.objects.create_user(username="ed", email="ed@e.com", password="pw")
        editor.is_editor = True
        editor.save()
        media = create_test_media(editor, "EditorMedia", state="private")
        self.client.login(username="ed", password="pw")
        response = self._post("submit", [{"friendly_token": media.friendly_token, "metadata": self._valid_metadata()}])
        self.assertEqual(response.status_code, 200)
        media.refresh_from_db()
        self.assertEqual(media.title, "My Film")

    def test_bulk_submit_fields_are_a_subset_of_media_form(self):
        # _BULK_SUBMIT_FIELDS is an allowlist coupled to MediaForm by hand. Guard
        # that every entry is a real MediaForm field, otherwise a submit would
        # silently fail to save it (construct_instance only iterates form.fields).
        from files.forms import MediaForm
        from files.management_views import _BULK_SUBMIT_FIELDS

        declared = set(MediaForm.base_fields)
        missing = _BULK_SUBMIT_FIELDS - declared
        self.assertEqual(missing, set(), f"_BULK_SUBMIT_FIELDS entries not on MediaForm: {missing}")


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
        # Finishing a draft through the standard edit form (MediaForm.save)
        # clears is_draft, so it stops being excluded from the review queue.
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
