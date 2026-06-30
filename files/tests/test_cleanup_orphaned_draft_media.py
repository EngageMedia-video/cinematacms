from datetime import timedelta

from django.test import Client, TestCase, override_settings
from django.utils import timezone

from files import lists
from files.draft_utils import apply_media_draft
from files.forms import MediaForm
from files.models import Category, EncodeProfile, Encoding, Language, Media
from files.tasks import cleanup_orphaned_draft_media
from files.tests.helpers import create_test_media, create_test_user


class CleanupOrphanedDraftMediaTests(TestCase):
    def setUp(self):
        self.user = create_test_user()
        self.old = timezone.now() - timedelta(days=8)
        self.recent = timezone.now() - timedelta(hours=2)

    def _age(self, media, add_date):
        Media.objects.filter(pk=media.pk).update(add_date=add_date)
        media.refresh_from_db()
        return media

    @override_settings(ORPHANED_DRAFT_CLEANUP_HOURS=168)
    def test_reaps_stale_single_upload_orphan(self):
        media = self._age(create_test_media(self.user, is_draft=False, metadata_saved_at=None), self.old)

        result = cleanup_orphaned_draft_media()

        self.assertEqual(result["drafts_deleted"], 1)
        self.assertFalse(Media.objects.filter(pk=media.pk).exists())

    @override_settings(ORPHANED_DRAFT_CLEANUP_HOURS=168)
    def test_reaps_stale_bulk_orphan(self):
        media = self._age(create_test_media(self.user, is_draft=True, metadata_saved_at=None), self.old)

        cleanup_orphaned_draft_media()

        self.assertFalse(Media.objects.filter(pk=media.pk).exists())

    @override_settings(ORPHANED_DRAFT_CLEANUP_HOURS=168)
    def test_preserves_recent_orphan(self):
        media = self._age(create_test_media(self.user, metadata_saved_at=None), self.recent)

        cleanup_orphaned_draft_media()

        self.assertTrue(Media.objects.filter(pk=media.pk).exists())

    @override_settings(ORPHANED_DRAFT_CLEANUP_HOURS=168)
    def test_preserves_submitted_full_media(self):
        media = self._age(create_test_media(self.user, metadata_saved_at=timezone.now()), self.old)

        cleanup_orphaned_draft_media()

        self.assertTrue(Media.objects.filter(pk=media.pk).exists())

    @override_settings(ORPHANED_DRAFT_CLEANUP_HOURS=168)
    def test_preserves_saved_empty_draft(self):
        media = self._age(create_test_media(self.user, is_draft=True, metadata_saved_at=timezone.now()), self.old)

        cleanup_orphaned_draft_media()

        self.assertTrue(Media.objects.filter(pk=media.pk).exists())

    @override_settings(ORPHANED_DRAFT_CLEANUP_HOURS=168)
    def test_preserves_backfilled_pre_migration_media(self):
        media = self._age(create_test_media(self.user, metadata_saved_at=self.old), self.old)

        cleanup_orphaned_draft_media()

        self.assertTrue(Media.objects.filter(pk=media.pk).exists())

    @override_settings(ORPHANED_DRAFT_CLEANUP_HOURS=168)
    def test_reaping_media_cascades_encoding_rows(self):
        media = self._age(create_test_media(self.user, metadata_saved_at=None), self.old)
        profile = EncodeProfile.objects.create(name="Test 720p", extension="mp4", codec="h264", resolution=720)
        encoding = Encoding.objects.create(media=media, profile=profile)

        cleanup_orphaned_draft_media()

        self.assertFalse(Media.objects.filter(pk=media.pk).exists())
        self.assertFalse(Encoding.objects.filter(pk=encoding.pk).exists())


class MetadataSavedMarkerTests(TestCase):
    def setUp(self):
        self.user = create_test_user()
        self.category, _ = Category.objects.get_or_create(
            title="Documentary", defaults={"user": self.user, "is_global": True}
        )
        Language.objects.get_or_create(code="en", defaults={"title": "English"})
        self.media = create_test_media(self.user, metadata_saved_at=None, state="public")

    def _valid_form_data(self):
        return {
            "title": "Submitted",
            "summary": "A complete synopsis.",
            "description": "",
            "year_produced": "2025",
            "media_language": "en",
            "media_country": lists.video_countries[0][0],
            "category": [self.category.id],
            "topics": [],
            "new_tags": "",
            "state": "private",
            "enable_comments": True,
            "allow_download": True,
        }

    def test_apply_media_draft_sets_metadata_saved_at(self):
        apply_media_draft(self.media, {"title": "Draft"}, self.user)

        self.media.refresh_from_db()
        self.assertIsNotNone(self.media.metadata_saved_at)

    def test_media_form_save_sets_metadata_saved_at(self):
        form = MediaForm(self.user, data=self._valid_form_data(), instance=self.media)
        self.assertTrue(form.is_valid(), f"Form errors: {form.errors}")

        form.save()

        self.media.refresh_from_db()
        self.assertIsNotNone(self.media.metadata_saved_at)


class MediaAbandonTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = create_test_user()
        self.other_user = create_test_user()
        self.client.force_login(self.user)

    def test_abandon_deletes_owned_unsubmitted_media(self):
        media = create_test_media(self.user, metadata_saved_at=None)

        response = self.client.post(f"/api/v1/media/{media.friendly_token}/abandon")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Media.objects.filter(pk=media.pk).exists())

    def test_abandon_noops_when_metadata_was_saved(self):
        media = create_test_media(self.user, metadata_saved_at=timezone.now())

        response = self.client.post(f"/api/v1/media/{media.friendly_token}/abandon")

        self.assertEqual(response.status_code, 204)
        self.assertTrue(Media.objects.filter(pk=media.pk).exists())

    def test_abandon_refuses_media_owned_by_another_user(self):
        media = create_test_media(self.other_user, metadata_saved_at=None)

        response = self.client.post(f"/api/v1/media/{media.friendly_token}/abandon")

        self.assertEqual(response.status_code, 403)
        self.assertTrue(Media.objects.filter(pk=media.pk).exists())
