from datetime import date
from unittest.mock import patch

from django.contrib.auth.models import AnonymousUser
from django.test import Client, RequestFactory, TestCase

from files.models import CommunityImpact
from files.serializers import CommunityImpactSerializer, SingleMediaSerializer
from files.tests.helpers import create_test_media, create_test_user


class CommunityImpactModelTests(TestCase):
    def test_save_truncates_details_to_80_words(self):
        user = create_test_user()
        media = create_test_media(user)
        details = " ".join(f"word{i}" for i in range(90))

        impact = CommunityImpact.objects.create(
            media=media,
            user=user,
            category=CommunityImpact.SCREENING,
            title="Community screening",
            details=details,
            event_date=date(2026, 5, 29),
        )

        self.assertEqual(len(impact.details.split()), 80)


class CommunityImpactSerializerTests(TestCase):
    def test_rejects_details_over_80_words(self):
        details = " ".join(f"word{i}" for i in range(81))
        serializer = CommunityImpactSerializer(
            data={
                "category": CommunityImpact.SCREENING,
                "title": "Community screening",
                "details": details,
                "event_date": "2026-05-29",
                "url": "",
            }
        )

        self.assertFalse(serializer.is_valid())
        self.assertIn("details", serializer.errors)

    def test_rejects_non_http_url_schemes(self):
        for bad_url in ("javascript:alert(1)", "data:text/html,foo", "file:///etc/passwd"):
            serializer = CommunityImpactSerializer(
                data={
                    "category": CommunityImpact.SCREENING,
                    "title": "Community screening",
                    "event_date": "2026-05-29",
                    "url": bad_url,
                }
            )
            self.assertFalse(serializer.is_valid(), msg=f"Expected {bad_url!r} to be rejected")
            self.assertIn("url", serializer.errors)

    def test_rejects_saves_category_on_write(self):
        serializer = CommunityImpactSerializer(
            data={
                "category": CommunityImpact.SAVES,
                "title": "Fake saves entry",
                "event_date": "2026-05-29",
                "url": "",
            }
        )
        self.assertFalse(serializer.is_valid())
        self.assertIn("category", serializer.errors)

    def test_accepts_http_and_https_urls(self):
        for good_url in ("http://example.com/", "https://example.com/path"):
            serializer = CommunityImpactSerializer(
                data={
                    "category": CommunityImpact.SCREENING,
                    "title": "Community screening",
                    "event_date": "2026-05-29",
                    "url": good_url,
                }
            )
            self.assertTrue(serializer.is_valid(), msg=serializer.errors)

    def test_single_media_serializer_groups_community_impacts(self):
        user = create_test_user()
        media = create_test_media(user)
        CommunityImpact.objects.create(
            media=media,
            user=user,
            category=CommunityImpact.SCREENING,
            title="Community screening",
            event_date=date(2026, 5, 29),
        )
        CommunityImpact.objects.create(
            media=media,
            user=user,
            category=CommunityImpact.CURATED,
            title="Climate playlist",
            event_date=date(2026, 5, 30),
        )
        request = RequestFactory().get(f"/api/v1/media/{media.friendly_token}")
        request.user = AnonymousUser()

        data = SingleMediaSerializer(media, context={"request": request}).data

        self.assertEqual(data["community_impacts"]["screening"][0]["title"], "Community screening")
        self.assertEqual(data["community_impacts"]["curated"][0]["title"], "Climate playlist")
        self.assertEqual(data["community_impacts"]["academic"], [])


class CommunityImpactEndpointTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = create_test_user(username="impactuser", password="testpass123")
        self.media = create_test_media(self.user)
        self.url = f"/api/v1/media/{self.media.friendly_token}/community-impacts"

    def test_public_can_list_community_impacts(self):
        CommunityImpact.objects.create(
            media=self.media,
            user=self.user,
            category=CommunityImpact.FEATURED,
            title="Regional feature",
            event_date=date(2026, 5, 29),
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[0]["title"], "Regional feature")

    def test_authenticated_user_can_create_community_impact(self):
        self.client.login(username="impactuser", password="testpass123")

        with patch("files.views.invalidate_media_cache") as invalidate_media_cache:
            response = self.client.post(
                self.url,
                data={
                    "category": CommunityImpact.CURATED,
                    "title": "Climate playlist",
                    "details": "Added to a regional climate justice collection.",
                    "event_date": "2026-05-29",
                    "url": "https://example.com/playlist",
                },
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(CommunityImpact.objects.filter(media=self.media).count(), 1)
        invalidate_media_cache.assert_called_once_with(self.media.friendly_token)

    def test_anonymous_user_cannot_create_community_impact(self):
        response = self.client.post(
            self.url,
            data={
                "category": CommunityImpact.CURATED,
                "title": "Climate playlist",
                "event_date": "2026-05-29",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)
