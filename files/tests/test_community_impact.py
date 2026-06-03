import json
from datetime import date
from unittest.mock import patch

from django.contrib.auth.models import AnonymousUser
from django.test import Client, RequestFactory, TestCase, override_settings
from django.utils import timezone

from actions.models import MediaAction
from files.community_impact_validators import GENERIC_TRUSTED_URL_ERROR
from files.methods import can_manage_film_impact
from files.models import CommunityImpact, Playlist, PlaylistMedia
from files.serializers import CommunityImpactSerializer, ManageCommunityImpactSerializer, SingleMediaSerializer
from files.tests.helpers import create_test_media, create_test_user, make_vite_loader_mock


class CommunityImpactModelTests(TestCase):
    def test_save_truncates_details_to_80_words(self):
        user = create_test_user()
        media = create_test_media(user)
        details = " ".join(f"word{i}" for i in range(90))

        impact = CommunityImpact.objects.create(
            media=media,
            user=user,
            category=CommunityImpact.SCREENING,
            status=CommunityImpact.APPROVED,
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

    def test_rejects_untrusted_urls(self):
        for bad_url in ("http://drive.google.com/x", "https://evil.com/x"):
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
            self.assertEqual(str(serializer.errors["url"][0]), GENERIC_TRUSTED_URL_ERROR)

    def test_rejects_non_writable_categories_on_write(self):
        for category in (CommunityImpact.SAVES, CommunityImpact.CURATED):
            serializer = CommunityImpactSerializer(
                data={
                    "category": category,
                    "title": "Non-writable category",
                    "event_date": "2026-05-29",
                    "url": "",
                }
            )
            self.assertFalse(serializer.is_valid(), msg=f"Expected {category!r} to be rejected")
            self.assertIn("category", serializer.errors)

    def test_defaults_event_date_to_submission_date(self):
        serializer = CommunityImpactSerializer(
            data={
                "category": CommunityImpact.SCREENING,
                "title": "Community screening",
                "url": "",
            }
        )

        self.assertTrue(serializer.is_valid(), msg=serializer.errors)
        self.assertEqual(serializer.validated_data["event_date"], timezone.localdate())

    def test_accepts_trusted_https_urls(self):
        for good_url in ("https://drive.google.com/file/d/abc/view", "https://foo.drive.google.com/path"):
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
            status=CommunityImpact.APPROVED,
            title="Community screening",
            event_date=date(2026, 5, 29),
        )
        CommunityImpact.objects.create(
            media=media,
            user=user,
            category=CommunityImpact.CURATED,
            status=CommunityImpact.APPROVED,
            title="Climate playlist",
            event_date=date(2026, 5, 30),
        )
        CommunityImpact.objects.create(
            media=media,
            user=user,
            category=CommunityImpact.FEATURED,
            status=CommunityImpact.WAITING_APPROVAL,
            title="Pending feature",
            event_date=date(2026, 5, 31),
        )
        CommunityImpact.objects.create(
            media=media,
            user=user,
            category=CommunityImpact.ACADEMIC,
            status=CommunityImpact.REJECTED,
            title="Hidden classroom use",
            event_date=date(2026, 6, 1),
        )
        request = RequestFactory().get(f"/api/v1/media/{media.friendly_token}")
        request.user = AnonymousUser()

        data = SingleMediaSerializer(media, context={"request": request}).data

        self.assertEqual(data["community_impacts"]["screening"][0]["title"], "Community screening")
        self.assertEqual(data["community_impacts"]["curated"][0]["title"], "Climate playlist")
        self.assertEqual(data["community_impacts"]["featured"], [])
        self.assertEqual(data["community_impacts"]["academic"], [])

    def test_single_media_serializer_aggregates_saves_from_system_data(self):
        user = create_test_user()
        media = create_test_media(user)
        playlist = Playlist.objects.create(user=user, title="Community playlist")
        PlaylistMedia.objects.create(media=media, playlist=playlist)
        MediaAction.objects.create(media=media, user=user, action="like")
        CommunityImpact.objects.create(
            media=media,
            user=user,
            category=CommunityImpact.SAVES,
            status=CommunityImpact.APPROVED,
            title="Manual save should be ignored",
            event_date=date(2026, 5, 29),
        )
        request = RequestFactory().get(f"/api/v1/media/{media.friendly_token}")
        request.user = AnonymousUser()

        data = SingleMediaSerializer(media, context={"request": request}).data

        saves = data["community_impacts"]["saves"]
        self.assertEqual(saves["entries"], [])
        self.assertEqual(saves["totalCount"], {"saves": 1, "playlists": 1})
        self.assertTrue(saves["lastEventAt"])


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
            status=CommunityImpact.APPROVED,
            title="Regional feature",
            event_date=date(2026, 5, 29),
        )
        CommunityImpact.objects.create(
            media=self.media,
            user=self.user,
            category=CommunityImpact.SCREENING,
            status=CommunityImpact.WAITING_APPROVAL,
            title="Pending screening",
            event_date=date(2026, 5, 30),
        )
        CommunityImpact.objects.create(
            media=self.media,
            user=self.user,
            category=CommunityImpact.ACADEMIC,
            status=CommunityImpact.REJECTED,
            title="Inactive classroom use",
            event_date=date(2026, 5, 31),
        )

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        results = response.json()
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["title"], "Regional feature")
        self.assertEqual(results[0]["status"], CommunityImpact.APPROVED)

    def test_authenticated_user_can_create_community_impact(self):
        self.client.login(username="impactuser", password="testpass123")

        with patch("files.views.invalidate_media_cache") as invalidate_media_cache:
            response = self.client.post(
                self.url,
                data={
                    "category": CommunityImpact.SCREENING,
                    "title": "Community screening",
                    "details": "Screened with a youth media collective.",
                    "url": "https://drive.google.com/file/d/screening/view",
                },
                content_type="application/json",
            )

        self.assertEqual(response.status_code, 201)
        impact = CommunityImpact.objects.get(media=self.media)
        self.assertEqual(impact.status, CommunityImpact.WAITING_APPROVAL)
        self.assertEqual(response.json()["status"], CommunityImpact.WAITING_APPROVAL)
        self.assertEqual(impact.event_date, timezone.localdate())
        invalidate_media_cache.assert_called_once_with(self.media.friendly_token)

    def test_submission_defaults_to_waiting_approval(self):
        self.client.login(username="impactuser", password="testpass123")

        response = self.client.post(
            self.url,
            data={
                "category": CommunityImpact.SCREENING,
                "title": "Community screening",
                "url": "",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        impact = CommunityImpact.objects.get(media=self.media)
        self.assertEqual(impact.status, CommunityImpact.WAITING_APPROVAL)
        self.assertEqual(response.json()["status"], CommunityImpact.WAITING_APPROVAL)

    def test_allowed_authenticated_roles_can_create_community_impact(self):
        role_users = [
            create_test_user(username="trustedimpact", password="testpass123", advancedUser=True),
            create_test_user(username="editorimpact", password="testpass123", is_editor=True),
            create_test_user(username="curatorimpact", password="testpass123", is_curator=True),
        ]

        for role_user in role_users:
            with self.subTest(username=role_user.username):
                self.client.logout()
                self.client.login(username=role_user.username, password="testpass123")
                response = self.client.post(
                    self.url,
                    data={
                        "category": CommunityImpact.SCREENING,
                        "title": f"Community screening by {role_user.username}",
                        "url": "",
                    },
                    content_type="application/json",
                )

                self.assertEqual(response.status_code, 201)
                self.assertTrue(CommunityImpact.objects.filter(media=self.media, user=role_user).exists())

    def test_rejects_unsafe_submission_url(self):
        self.client.login(username="impactuser", password="testpass123")

        response = self.client.post(
            self.url,
            data={
                "category": CommunityImpact.SCREENING,
                "title": "Unsafe screening",
                "url": "https://evil.example/x",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["url"][0], GENERIC_TRUSTED_URL_ERROR)
        self.assertFalse(CommunityImpact.objects.filter(media=self.media, title="Unsafe screening").exists())

    def test_authenticated_user_cannot_create_saves_impact(self):
        self.client.login(username="impactuser", password="testpass123")

        response = self.client.post(
            self.url,
            data={
                "category": CommunityImpact.SAVES,
                "title": "Manual save",
            },
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("category", response.json())
        self.assertFalse(CommunityImpact.objects.filter(media=self.media).exists())

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


class ManageCommunityImpactTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.regular_user = create_test_user(username="regularimpact", password="testpass123")
        self.advanced_user = create_test_user(
            username="advancedimpact",
            password="testpass123",
            advancedUser=True,
        )
        self.superuser = create_test_user(
            username="impactadmin",
            password="testpass123",
            is_superuser=True,
            is_staff=True,
        )
        self.media = create_test_media(self.regular_user)
        type(self.media).objects.filter(pk=self.media.pk).update(title="Climate Film")
        self.media.refresh_from_db()
        self.impact = CommunityImpact.objects.create(
            media=self.media,
            user=self.regular_user,
            category=CommunityImpact.SCREENING,
            status=CommunityImpact.WAITING_APPROVAL,
            title="Community screening",
            details="Screened with a youth media collective.",
            event_date=date(2026, 5, 29),
        )
        CommunityImpact.objects.create(
            media=self.media,
            user=self.superuser,
            category=CommunityImpact.CURATED,
            status=CommunityImpact.APPROVED,
            title="Regional playlist",
            event_date=date(2026, 5, 30),
        )

    def test_can_manage_film_impact_helper(self):
        self.assertFalse(can_manage_film_impact(self.regular_user))
        self.assertTrue(can_manage_film_impact(self.advanced_user))
        self.assertTrue(can_manage_film_impact(self.superuser))

    def test_manage_serializer_uses_cinemata_edit_url(self):
        request = RequestFactory().get("/api/v1/manage_film_impact")

        data = ManageCommunityImpactSerializer(self.impact, context={"request": request}).data

        self.assertNotIn("admin_url", data)
        self.assertIn(f"/manage/film-impact/{self.impact.uid}/edit", data["edit_url"])
        self.assertEqual(data["media"]["friendly_token"], self.media.friendly_token)
        self.assertEqual(data["user"]["username"], self.regular_user.username)
        self.assertEqual(data["status"], CommunityImpact.WAITING_APPROVAL)
        self.assertEqual(data["status_label"], "Waiting for approval")

    def test_api_regular_user_forbidden(self):
        self.client.login(username="regularimpact", password="testpass123")

        response = self.client.get("/api/v1/manage_film_impact")

        self.assertEqual(response.status_code, 403)

    def test_api_advanced_user_allowed(self):
        self.client.login(username="advancedimpact", password="testpass123")

        response = self.client.get("/api/v1/manage_film_impact")

        self.assertEqual(response.status_code, 200)

    def test_api_superuser_can_filter_by_search_and_category(self):
        self.client.login(username="impactadmin", password="testpass123")

        response = self.client.get("/api/v1/manage_film_impact?search=youth&category=screening")

        self.assertEqual(response.status_code, 200)
        results = response.json()["results"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["uid"], str(self.impact.uid))

    def test_api_superuser_can_filter_by_status(self):
        self.client.login(username="impactadmin", password="testpass123")

        response = self.client.get(f"/api/v1/manage_film_impact?status={CommunityImpact.WAITING_APPROVAL}")

        self.assertEqual(response.status_code, 200)
        results = response.json()["results"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["uid"], str(self.impact.uid))
        self.assertEqual(results[0]["status"], CommunityImpact.WAITING_APPROVAL)

    @patch(
        "django_vite.core.asset_loader.DjangoViteAssetLoader.instance",
        return_value=make_vite_loader_mock(),
    )
    @override_settings(MFA_REQUIRED_ROLES=[])
    def test_manage_page_superuser_allowed(self, _mock_vite):
        self.client.login(username="impactadmin", password="testpass123")

        response = self.client.get("/manage/film-impact")

        self.assertEqual(response.status_code, 200)

    @patch(
        "django_vite.core.asset_loader.DjangoViteAssetLoader.instance",
        return_value=make_vite_loader_mock(),
    )
    def test_manage_page_advanced_user_allowed(self, _mock_vite):
        self.client.login(username="advancedimpact", password="testpass123")

        response = self.client.get("/manage/film-impact")

        self.assertEqual(response.status_code, 200)

    @patch(
        "django_vite.core.asset_loader.DjangoViteAssetLoader.instance",
        return_value=make_vite_loader_mock(),
    )
    def test_edit_page_advanced_user_allowed(self, _mock_vite):
        self.client.login(username="advancedimpact", password="testpass123")

        response = self.client.get(f"/manage/film-impact/{self.impact.uid}/edit")

        self.assertEqual(response.status_code, 200)

    def test_api_advanced_user_can_update_impact(self):
        self.client.login(username="advancedimpact", password="testpass123")

        response = self.client.patch(
            f"/api/v1/manage_film_impact/{self.impact.uid}",
            data=json.dumps(
                {
                    "title": "Updated screening",
                    "category": CommunityImpact.ACADEMIC,
                    "status": CommunityImpact.APPROVED,
                    "details": "Used in a classroom discussion.",
                    "event_date": "2026-06-02",
                    "url": "https://drive.google.com/file/d/updated/view",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.impact.refresh_from_db()
        self.assertEqual(self.impact.title, "Updated screening")
        self.assertEqual(self.impact.category, CommunityImpact.ACADEMIC)
        self.assertEqual(self.impact.status, CommunityImpact.APPROVED)
        self.assertEqual(self.impact.event_date, date(2026, 6, 2))

    def test_api_advanced_user_can_reject_impact(self):
        self.client.login(username="advancedimpact", password="testpass123")
        CommunityImpact.objects.filter(pk=self.impact.pk).update(status=CommunityImpact.APPROVED)

        response = self.client.patch(
            f"/api/v1/manage_film_impact/{self.impact.uid}",
            data=json.dumps({"status": CommunityImpact.REJECTED}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.impact.refresh_from_db()
        self.assertEqual(self.impact.status, CommunityImpact.REJECTED)

    def test_api_advanced_user_can_reject_waiting_approval_impact(self):
        self.client.login(username="advancedimpact", password="testpass123")
        CommunityImpact.objects.filter(pk=self.impact.pk).update(status=CommunityImpact.WAITING_APPROVAL)

        response = self.client.patch(
            f"/api/v1/manage_film_impact/{self.impact.uid}",
            data=json.dumps({"status": CommunityImpact.REJECTED}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 200)
        self.impact.refresh_from_db()
        self.assertEqual(self.impact.status, CommunityImpact.REJECTED)

    def test_api_rejects_invalid_status(self):
        self.client.login(username="advancedimpact", password="testpass123")

        response = self.client.patch(
            f"/api/v1/manage_film_impact/{self.impact.uid}",
            data=json.dumps({"status": "active"}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("status", response.json())

    def test_api_advanced_user_cannot_update_to_system_category(self):
        self.client.login(username="advancedimpact", password="testpass123")

        response = self.client.patch(
            f"/api/v1/manage_film_impact/{self.impact.uid}",
            data=json.dumps({"category": CommunityImpact.SAVES}),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("category", response.json())

    def test_api_advanced_user_can_delete_impact(self):
        self.client.login(username="advancedimpact", password="testpass123")

        response = self.client.delete(f"/api/v1/manage_film_impact/{self.impact.uid}")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(CommunityImpact.objects.filter(pk=self.impact.pk).exists())

    def test_api_regular_user_cannot_delete_impact(self):
        self.client.login(username="regularimpact", password="testpass123")

        response = self.client.delete(f"/api/v1/manage_film_impact/{self.impact.uid}")

        self.assertEqual(response.status_code, 403)
        self.assertTrue(CommunityImpact.objects.filter(pk=self.impact.pk).exists())

    def test_manage_page_regular_user_redirected(self):
        self.client.login(username="regularimpact", password="testpass123")

        response = self.client.get("/manage/film-impact")

        self.assertEqual(response.status_code, 302)

    def test_edit_page_regular_user_redirected(self):
        self.client.login(username="regularimpact", password="testpass123")

        response = self.client.get(f"/manage/film-impact/{self.impact.uid}/edit")

        self.assertEqual(response.status_code, 302)
