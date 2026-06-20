from django.test import Client, TestCase

from files.models import Category, Language, Media
from files.tests.helpers import create_test_media, create_test_user


class SingleUploadDraftTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = create_test_user()
        self.category, _ = Category.objects.get_or_create(
            title="Documentary", defaults={"user": self.user, "is_global": True}
        )
        Language.objects.get_or_create(code="en", defaults={"title": "English"})
        self.media = create_test_media(self.user, state="public")
        self.client.force_login(self.user)

    def test_edit_post_can_save_incomplete_media_as_draft(self):
        response = self.client.post(
            f"/edit?m={self.media.friendly_token}",
            {
                "action": "draft",
                "title": "Partial draft",
                "year_produced": "not-a-year",
            },
            headers={"x-requested-with": "XMLHttpRequest"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["url"], f"/user/{self.user.username}/media")

        self.media.refresh_from_db()
        self.assertTrue(self.media.is_draft)
        self.assertEqual(self.media.state, "private")
        self.assertEqual(self.media.title, "Partial draft")

    def test_edit_post_draft_applies_partial_taxonomy_and_tags(self):
        response = self.client.post(
            f"/edit?m={self.media.friendly_token}",
            {
                "action": "draft",
                "title": "Tagged draft",
                "media_language": "en",
                "media_country": "AU",
                "category": [self.category.id],
                "new_tags": "one, two",
            },
            headers={"x-requested-with": "XMLHttpRequest"},
        )

        self.assertEqual(response.status_code, 200)

        self.media.refresh_from_db()
        self.assertTrue(self.media.is_draft)
        self.assertIn(self.category, self.media.category.all())
        self.assertEqual(set(self.media.tags.values_list("title", flat=True)), {"one", "two"})

    def test_normal_edit_submit_still_clears_draft(self):
        Media.objects.filter(pk=self.media.pk).update(is_draft=True)
        response = self.client.post(
            f"/edit?m={self.media.friendly_token}",
            {
                "action": "submit",
                "title": "Submitted",
                "summary": "A complete synopsis.",
                "description": "",
                "year_produced": "2025",
                "media_language": "en",
                "media_country": "AU",
                "category": [self.category.id],
                "topics": [],
                "new_tags": "",
                "state": "private",
                "enable_comments": "on",
                "allow_download": "on",
            },
            headers={"x-requested-with": "XMLHttpRequest"},
        )

        self.assertEqual(response.status_code, 200)

        self.media.refresh_from_db()
        self.assertFalse(self.media.is_draft)
        self.assertEqual(self.media.title, "Submitted")
