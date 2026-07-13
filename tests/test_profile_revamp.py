from copy import deepcopy
from datetime import date

from django.conf import settings
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext

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

    def test_anonymous_contact_tab_redirects_to_login(self):
        # An anonymous visitor following a shared /contact link is sent to
        # login with a next back to the tab, like other gated pages.
        contact_path = f"/user/{self.owner.username}/contact"
        response = self.client.get(contact_path)

        self.assertEqual(response.status_code, 302)
        self.assertIn(settings.LOGIN_URL, response.url)
        self.assertIn(contact_path, response.url)

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

    def test_curator_cannot_contact_disallowed_profile(self):
        # The send gate is editor-only (allow_contact or editor); a curator is a
        # distinct role and does NOT override allow_contact=False. This keeps the
        # pre-existing contact/email behaviour unchanged.
        self.owner.allow_contact = False
        self.owner.save(update_fields=["allow_contact"])
        curator = User.objects.create_user(username="a-curator", password="testpass")
        curator.is_curator = True
        curator.save(update_fields=["is_curator"])
        self.client.force_login(curator)

        response = self.client.post(
            f"/api/v1/users/{self.owner.username}/contact",
            data={"subject": "Hi", "body": "Hello"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 403)

    def test_editor_can_contact_disallowed_profile(self):
        # Editors retain the override the original gate honoured.
        self.owner.allow_contact = False
        self.owner.save(update_fields=["allow_contact"])
        editor = User.objects.create_user(username="an-editor", password="testpass")
        editor.is_editor = True
        editor.save(update_fields=["is_editor"])
        self.client.force_login(editor)

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

    def test_contact_post_rejects_subject_with_line_break(self):
        # A newline in the subject would raise BadHeaderError (500) when built
        # into the email header; it must be a clean 400 instead.
        self.client.force_login(self.viewer)

        response = self.client.post(
            f"/api/v1/users/{self.owner.username}/contact",
            data={"subject": "Hi\nBcc: evil@example.com", "body": "Hello"},
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 400)

    def test_contact_post_rejects_overlong_fields(self):
        self.client.force_login(self.viewer)

        long_subject = self.client.post(
            f"/api/v1/users/{self.owner.username}/contact",
            data={"subject": "x" * 201, "body": "Hello"},
            content_type="application/json",
        )
        self.assertEqual(long_subject.status_code, 400)

        long_body = self.client.post(
            f"/api/v1/users/{self.owner.username}/contact",
            data={"subject": "Hi", "body": "x" * 5001},
            content_type="application/json",
        )
        self.assertEqual(long_body.status_code, 400)

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
        self.assertEqual(film["impact"][CommunityImpact.FEATURED], {"entries": []})
        self.assertFalse(response.json()["has_more"])

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
        self.assertEqual(response.json(), {"films": [], "has_more": False})

    def test_endpoint_excludes_saves_and_curated_categories(self):
        # saves is summary-only and curated is never shown, so neither should
        # appear in the film's impact buckets (they must match the UI).
        self._create_impact(status=CommunityImpact.APPROVED, title="A screening")
        for category in (CommunityImpact.SAVES, CommunityImpact.CURATED):
            CommunityImpact.objects.create(
                media=self.media,
                user=self.submitter,
                category=category,
                status=CommunityImpact.APPROVED,
                title=f"{category} entry",
                event_date=date(2026, 6, 30),
            )

        response = self.client.get(f"/api/v1/users/{self.author.username}/community-impacts")

        self.assertEqual(response.status_code, 200)
        buckets = response.json()["films"][0]["impact"]
        self.assertNotIn(CommunityImpact.SAVES, buckets)
        self.assertNotIn(CommunityImpact.CURATED, buckets)
        self.assertIn(CommunityImpact.SCREENING, buckets)

    def test_endpoint_query_count_is_flat_across_films(self):
        # prefetch_related("media__category") keeps the query count from scaling
        # with the number of films (MediaSerializer.categories_info walks m2m).
        def make_film(title):
            m = create_test_media(self.author)
            Media.objects.filter(pk=m.pk).update(title=title)
            CommunityImpact.objects.create(
                media=m,
                user=self.submitter,
                category=CommunityImpact.SCREENING,
                status=CommunityImpact.APPROVED,
                title=f"screening for {title}",
                event_date=date(2026, 6, 30),
            )
            return m

        url = f"/api/v1/users/{self.author.username}/community-impacts"

        make_film("Film A")
        with CaptureQueriesContext(connection) as one_film:
            self.client.get(url)

        make_film("Film B")
        make_film("Film C")
        with CaptureQueriesContext(connection) as three_films:
            self.client.get(url)

        # Query count must not grow with the number of films.
        self.assertEqual(len(three_films), len(one_film))

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
        self.assertEqual(response.json(), {"films": [], "has_more": False})

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

    def test_owner_sees_latest_note_per_film_with_media_context(self):
        self._create_note(text="A key moment", timestamp_seconds=42)
        self.client.force_login(self.owner)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        results = response.json()["results"]
        self.assertEqual(len(results), 1)
        note = results[0]
        self.assertEqual(note["text"], "A key moment")
        self.assertEqual(note["timestamp_seconds"], 42.0)
        self.assertEqual(note["note_count"], 1)
        # Media context is embedded so the frontend can render + deep-link.
        self.assertEqual(note["media"]["friendly_token"], self.media.friendly_token)
        self.assertEqual(note["media"]["title"], self.media.title)

    def test_notes_are_aggregated_to_one_row_per_film(self):
        # Three notes on one film collapse to a single row: latest note + count.
        self._create_note(text="First note")
        self._create_note(text="Second note")
        latest = self._create_note(text="Latest note")
        self.client.force_login(self.owner)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        results = response.json()["results"]
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["text"], "Latest note")
        self.assertEqual(results[0]["uid"], str(latest.uid))
        self.assertEqual(results[0]["note_count"], 3)

    def test_films_are_ordered_by_most_recent_note(self):
        other_media = create_test_media(self.owner)
        Media.objects.filter(pk=other_media.pk).update(title="Second Film")
        # Note on the first film, then a newer note on the second film.
        self._create_note(text="Older film note")
        PrivateJournalNote.objects.create(
            media=other_media,
            user=self.owner,
            text="Newer film note",
            timestamp_seconds=0,
        )
        self.client.force_login(self.owner)

        response = self.client.get(self.url)

        self.assertEqual(response.status_code, 200)
        tokens = [row["media"]["friendly_token"] for row in response.json()["results"]]
        # Most recently noted film first.
        self.assertEqual(tokens, [other_media.friendly_token, self.media.friendly_token])

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
