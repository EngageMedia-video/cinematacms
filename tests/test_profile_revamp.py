from copy import deepcopy
from datetime import date

from django.conf import settings
from django.test import TestCase, override_settings

from files.models import CommunityImpact
from files.tests.helpers import create_test_media
from users.models import User

HERMETIC_DJANGO_VITE = deepcopy(settings.DJANGO_VITE)
HERMETIC_DJANGO_VITE["default"]["dev_mode"] = True


@override_settings(
    DJANGO_VITE=HERMETIC_DJANGO_VITE,
    UI_VARIANT_REVAMP_PAGES=["profile"],
)
class ProfileRevampViewTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(
            username="profile-owner",
            password="testpass",
            name="Profile Owner",
        )
        self.viewer = User.objects.create_user(
            username="profile-viewer",
            password="testpass",
            name="Profile Viewer",
        )

    def test_profile_uses_revamp_template_and_bootstrap(self):
        response = self.client.get(self.owner.get_absolute_url())

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "cms/user_revamp.html")
        self.assertEqual(response.context["active_tab"], "about")
        self.assertContains(response, 'id="app-root"')
        self.assertContains(response, 'id="profile-initial-data"')
        self.assertContains(response, '"username": "profile-owner"')

    def test_owner_can_open_private_tabs(self):
        self.client.force_login(self.owner)

        for tab in ("uploads", "notes", "history", "liked"):
            response = self.client.get(f"/user/{self.owner.username}/{tab}")
            self.assertEqual(response.status_code, 200, msg=tab)
            self.assertTemplateUsed(response, "cms/user_revamp.html")

    def test_non_owner_is_redirected_from_private_tabs(self):
        self.client.force_login(self.viewer)

        for tab in ("uploads", "notes", "history", "liked"):
            response = self.client.get(f"/user/{self.owner.username}/{tab}")
            self.assertRedirects(
                response,
                self.owner.get_absolute_url(),
                fetch_redirect_response=False,
                msg_prefix=tab,
            )

    def test_anonymous_can_open_public_impact_tab(self):
        response = self.client.get(f"/user/{self.owner.username}/impact")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["active_tab"], "impact")

    def test_user_detail_exposes_profile_header_fields(self):
        response = self.client.get(f"/api/v1/users/{self.owner.username}")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(
            {
                "username",
                "is_manager",
                "is_trusted",
                "media_count",
                "date_added",
                "banner_thumbnail_url",
                "location_country",
            }.issubset(response.json())
        )


class UserCommunityImpactApiTests(TestCase):
    def setUp(self):
        self.author = User.objects.create_user(username="impact-author", password="testpass")
        self.submitter = User.objects.create_user(username="impact-submitter", password="testpass")
        self.media = create_test_media(self.author)

    def _create_impact(self, *, status, title):
        return CommunityImpact.objects.create(
            media=self.media,
            user=self.submitter,
            category=CommunityImpact.SCREENING,
            status=status,
            title=title,
            event_date=date(2026, 6, 30),
        )

    def test_endpoint_groups_only_approved_entries(self):
        self._create_impact(status=CommunityImpact.APPROVED, title="Approved screening")
        self._create_impact(status=CommunityImpact.WAITING_APPROVAL, title="Pending screening")

        response = self.client.get(f"/api/v1/users/{self.author.username}/community-impacts")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [entry["title"] for entry in response.json()[CommunityImpact.SCREENING]["entries"]],
            ["Approved screening"],
        )
        self.assertEqual(response.json()[CommunityImpact.FEATURED], {"entries": [], "totalCount": 0})

    def test_endpoint_returns_empty_groups_for_author_without_entries(self):
        response = self.client.get(f"/api/v1/users/{self.author.username}/community-impacts")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(all(category == {"entries": [], "totalCount": 0} for category in response.json().values()))

    def test_endpoint_does_not_expose_impacts_for_private_media(self):
        private_media = create_test_media(self.author, state="private")
        CommunityImpact.objects.create(
            media=private_media,
            user=self.submitter,
            category=CommunityImpact.SCREENING,
            status=CommunityImpact.APPROVED,
            title="Private screening",
            event_date=date(2026, 6, 30),
        )

        response = self.client.get(f"/api/v1/users/{self.author.username}/community-impacts")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()[CommunityImpact.SCREENING], {"entries": [], "totalCount": 0})

    def test_endpoint_returns_not_found_for_unknown_author(self):
        response = self.client.get("/api/v1/users/missing-user/community-impacts")

        self.assertEqual(response.status_code, 404)
