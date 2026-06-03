from datetime import date

from django.test import Client, TestCase

from files.models import CommunityImpact
from files.tests.helpers import create_test_media, create_test_user


class MediaSearchAwardFilterTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = create_test_user(username="impact_user")

        self.screened = self._media("Screened Film", duration=500)
        self.featured = self._media("Featured Film", duration=900)
        self.waiting = self._media("Waiting Film", duration=500)
        self.academic = self._media("Academic Film", duration=500)
        self.plain = self._media("Plain Film", duration=500)

        self._impact(self.screened, CommunityImpact.SCREENING, CommunityImpact.APPROVED)
        self._impact(self.featured, CommunityImpact.FEATURED, CommunityImpact.APPROVED)
        self._impact(self.featured, CommunityImpact.SCREENING, CommunityImpact.APPROVED)
        self._impact(self.waiting, CommunityImpact.SCREENING, CommunityImpact.WAITING_APPROVAL)
        self._impact(self.academic, CommunityImpact.ACADEMIC, CommunityImpact.APPROVED)

    def _media(self, title, **kwargs):
        media = create_test_media(self.user, **kwargs)
        media.title = title
        media.save(update_fields=["title"])
        return media

    def _impact(self, media, category, status):
        return CommunityImpact.objects.create(
            media=media,
            user=self.user,
            category=category,
            status=status,
            title=f"{media.title} impact",
            event_date=date(2025, 1, 1),
        )

    def test_award_filter_returns_approved_screening_and_featured_impacts(self):
        response = self.client.get("/api/v1/search?award=yes")

        self.assertEqual(response.status_code, 200)
        tokens = [item["friendly_token"] for item in response.json()["results"]]
        self.assertIn(self.screened.friendly_token, tokens)
        self.assertIn(self.featured.friendly_token, tokens)
        self.assertNotIn(self.waiting.friendly_token, tokens)
        self.assertNotIn(self.academic.friendly_token, tokens)
        self.assertNotIn(self.plain.friendly_token, tokens)
        self.assertEqual(tokens.count(self.featured.friendly_token), 1)

    def test_award_filter_combines_with_length_filter(self):
        response = self.client.get("/api/v1/search?award=yes&length=less_than_10")

        self.assertEqual(response.status_code, 200)
        tokens = [item["friendly_token"] for item in response.json()["results"]]
        self.assertIn(self.screened.friendly_token, tokens)
        self.assertNotIn(self.featured.friendly_token, tokens)
        self.assertNotIn(self.waiting.friendly_token, tokens)
        self.assertNotIn(self.academic.friendly_token, tokens)
        self.assertNotIn(self.plain.friendly_token, tokens)

    def test_rss_award_filter_returns_approved_screening_and_featured_impacts(self):
        response = self.client.get("/rss/search/?award=yes")

        self.assertEqual(response.status_code, 200)
        content = response.content.decode()
        self.assertIn("Screened Film", content)
        self.assertIn("Featured Film", content)
        self.assertNotIn("Waiting Film", content)
        self.assertNotIn("Academic Film", content)
        self.assertNotIn("Plain Film", content)
