from copy import deepcopy
from datetime import date

from django.conf import settings
from django.test import TestCase, override_settings

from files.models import CommunityImpact, Media, PrivateJournalNote
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

    def test_non_owner_can_open_contact_tab_when_contact_allowed(self):
        self.client.force_login(self.viewer)

        response = self.client.get(f"/user/{self.owner.username}/contact")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["active_tab"], "contact")
        self.assertTrue(response.context["PROFILE_INITIAL_DATA"]["can_contact"])

    def test_contact_tab_redirects_when_contact_disallowed(self):
        self.owner.allow_contact = False
        self.owner.save(update_fields=["allow_contact"])
        self.client.force_login(self.viewer)

        response = self.client.get(f"/user/{self.owner.username}/contact")

        self.assertRedirects(
            response,
            self.owner.get_absolute_url(),
            fetch_redirect_response=False,
        )

    def test_owner_is_redirected_from_own_contact_tab(self):
        self.client.force_login(self.owner)

        response = self.client.get(f"/user/{self.owner.username}/contact")

        self.assertRedirects(
            response,
            self.owner.get_absolute_url(),
            fetch_redirect_response=False,
        )

    def test_anonymous_is_redirected_from_contact_tab(self):
        # allow_contact defaults to True, but the tab still requires an
        # authenticated viewer since the contact POST does.
        response = self.client.get(f"/user/{self.owner.username}/contact")

        self.assertRedirects(
            response,
            self.owner.get_absolute_url(),
            fetch_redirect_response=False,
        )

    def test_contact_flag_is_false_for_anonymous_viewer(self):
        response = self.client.get(self.owner.get_absolute_url())

        self.assertFalse(response.context["PROFILE_INITIAL_DATA"]["can_contact"])

    def test_contact_post_requires_authentication(self):
        response = self.client.post(
            f"/api/v1/users/{self.owner.username}/contact",
            data={"subject": "Hi", "body": "Hello"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 401)

    def test_contact_post_forbidden_when_contact_disallowed(self):
        self.owner.allow_contact = False
        self.owner.save(update_fields=["allow_contact"])
        self.client.force_login(self.viewer)

        response = self.client.post(
            f"/api/v1/users/{self.owner.username}/contact",
            data={"subject": "Hi", "body": "Hello"},
            content_type="application/json",
        )

        # Must NOT be a silent 204 success — the message was not sent.
        self.assertEqual(response.status_code, 403)

    def test_contact_post_succeeds_when_allowed(self):
        self.client.force_login(self.viewer)

        response = self.client.post(
            f"/api/v1/users/{self.owner.username}/contact",
            data={"subject": "Hi", "body": "Hello"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 204)

    def test_contact_post_unknown_username_returns_404(self):
        self.client.force_login(self.viewer)

        response = self.client.post(
            "/api/v1/users/does-not-exist/contact",
            data={"subject": "Hi", "body": "Hello"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 404)

    def test_contact_post_missing_subject_or_body_returns_400(self):
        self.client.force_login(self.viewer)

        for payload in ({"body": "Hello"}, {"subject": "Hi"}):
            response = self.client.post(
                f"/api/v1/users/{self.owner.username}/contact",
                data=payload,
                content_type="application/json",
            )

            self.assertEqual(response.status_code, 400, msg=payload)

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

    def test_endpoint_groups_only_approved_entries_under_their_film(self):
        self._create_impact(status=CommunityImpact.APPROVED, title="Approved screening")
        self._create_impact(status=CommunityImpact.WAITING_APPROVAL, title="Pending screening")

        response = self.client.get(f"/api/v1/users/{self.author.username}/community-impacts")

        self.assertEqual(response.status_code, 200)
        films = response.json()["films"]
        self.assertEqual(len(films), 1)
        film = films[0]
        # Each film group carries its media so entries can be attributed.
        self.assertEqual(film["media"]["title"], self.media.title)
        self.assertEqual(
            [entry["title"] for entry in film["impact"][CommunityImpact.SCREENING]["entries"]],
            ["Approved screening"],
        )
        self.assertEqual(film["impact"][CommunityImpact.FEATURED], {"entries": [], "totalCount": 0})

    def test_endpoint_groups_entries_per_film(self):
        other_media = create_test_media(self.author)
        Media.objects.filter(pk=other_media.pk).update(title="Second Film")
        other_media.refresh_from_db()
        self._create_impact(status=CommunityImpact.APPROVED, title="First film screening")
        CommunityImpact.objects.create(
            media=other_media,
            user=self.submitter,
            category=CommunityImpact.FEATURED,
            status=CommunityImpact.APPROVED,
            title="Second film feature",
            event_date=date(2026, 6, 30),
        )

        response = self.client.get(f"/api/v1/users/{self.author.username}/community-impacts")

        self.assertEqual(response.status_code, 200)
        films = response.json()["films"]
        self.assertEqual(len(films), 2)
        entries_by_token = {
            film["media"]["friendly_token"]: [
                entry["title"] for bucket in film["impact"].values() for entry in bucket["entries"]
            ]
            for film in films
        }
        self.assertEqual(entries_by_token[self.media.friendly_token], ["First film screening"])
        self.assertEqual(entries_by_token[other_media.friendly_token], ["Second film feature"])

    def test_endpoint_returns_no_films_for_author_without_entries(self):
        response = self.client.get(f"/api/v1/users/{self.author.username}/community-impacts")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"films": []})

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
        self.assertEqual(response.json(), {"films": []})

    def test_endpoint_returns_not_found_for_unknown_author(self):
        response = self.client.get("/api/v1/users/missing-user/community-impacts")

        self.assertEqual(response.status_code, 404)


class UserPrivateJournalApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username="notes-owner", password="testpass", name="Notes Owner")
        self.other = User.objects.create_user(username="notes-other", password="testpass")
        self.media = create_test_media(self.owner)
        self.url = f"/api/v1/users/{self.owner.username}/private-journal"

    def _create_note(self, *, text, timestamp_seconds=0.0):
        return PrivateJournalNote.objects.create(
            media=self.media,
            user=self.owner,
            text=text,
            timestamp_seconds=timestamp_seconds,
        )

    def test_anonymous_is_denied(self):
        # DRF SessionAuthentication returns 403 (not 401) for unauthenticated
        # requests since it sends no WWW-Authenticate challenge header.
        response = self.client.get(self.url)

        self.assertIn(response.status_code, (401, 403))

    def test_other_user_is_forbidden(self):
        self.client.force_login(self.other)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 403)

    def test_owner_sees_own_notes_with_media_context(self):
        self._create_note(text="A key moment", timestamp_seconds=42)
        self.client.force_login(self.owner)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        results = response.json()["results"]
        self.assertEqual(len(results), 1)
        note = results[0]
        self.assertEqual(note["text"], "A key moment")
        self.assertEqual(note["timestamp_seconds"], 42.0)
        # Media context is embedded so the frontend can render + deep-link.
        self.assertEqual(note["media"]["friendly_token"], self.media.friendly_token)
        self.assertEqual(note["media"]["title"], self.media.title)

    def test_owner_does_not_see_other_users_notes(self):
        # A note authored by someone else on the owner's media must not leak.
        other_media = create_test_media(self.other)
        PrivateJournalNote.objects.create(
            media=other_media,
            user=self.other,
            text="Other user's private note",
            timestamp_seconds=0,
        )
        self._create_note(text="Owner's note")
        self.client.force_login(self.owner)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        texts = [note["text"] for note in response.json()["results"]]
        self.assertEqual(texts, ["Owner's note"])

    def test_owner_with_no_notes_gets_empty_results(self):
        self.client.force_login(self.owner)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["results"], [])
