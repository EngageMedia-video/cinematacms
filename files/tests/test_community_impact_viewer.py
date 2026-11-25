import json
from datetime import date, timedelta
from unittest.mock import patch

from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, TestCase, override_settings
from django.utils.html import escapejs

from files.models import CommunityImpact, Playlist, PlaylistMedia
from files.serializers import SingleMediaSerializer
from files.tests.helpers import create_test_media, create_test_user, make_vite_loader_mock

FLAG_KEYS = ("viewer_sees_status", "viewer_can_delete", "viewer_can_edit", "viewer_review_url")


def screening_fields(**overrides):
    fields = {
        "category": CommunityImpact.SCREENING,
        "title": "Hanoi Doc Week",
        "event_date": date(2026, 5, 29),
        "year": 2024,
        "city": "Hanoi",
        "country": "VN",
        "organiser": "Youth Media Collective",
    }
    fields.update(overrides)
    return fields


def article_fields(**overrides):
    fields = {
        "category": CommunityImpact.ARTICLE,
        "title": "Films that changed the conversation",
        "event_date": date(2026, 5, 29),
        "year": 2023,
        "creator": "Dewi Lestari",
    }
    fields.update(overrides)
    return fields


class CommunityImpactViewerTestCase(TestCase):
    def setUp(self):
        self.owner = create_test_user()
        self.author = create_test_user()
        self.other = create_test_user()
        self.manager = create_test_user(is_manager=True)
        self.media = create_test_media(self.owner)
        self.approved = CommunityImpact.objects.create(
            media=self.media, user=self.author, status=CommunityImpact.APPROVED, **screening_fields()
        )
        self.author_waiting = CommunityImpact.objects.create(
            media=self.media, user=self.author, status=CommunityImpact.WAITING_APPROVAL, **article_fields()
        )
        self.other_waiting = CommunityImpact.objects.create(
            media=self.media,
            user=self.other,
            status=CommunityImpact.WAITING_APPROVAL,
            **article_fields(title="Another member's review"),
        )
        self.rejected = CommunityImpact.objects.create(
            media=self.media,
            user=self.author,
            status=CommunityImpact.REJECTED,
            **screening_fields(title="Rejected screening"),
        )

    def impacts_for(self, user):
        request = RequestFactory().get(f"/api/v1/media/{self.media.friendly_token}")
        request.user = user
        return SingleMediaSerializer(self.media, context={"request": request}).data["community_impacts"]

    def entries_by_uid(self, user):
        impacts = self.impacts_for(user)
        return {
            entry["uid"]: entry
            for category in (CommunityImpact.SCREENING, CommunityImpact.ARTICLE)
            for entry in impacts[category]
        }

    def flags(self, entry):
        return {key: entry[key] for key in FLAG_KEYS}


class CommunityImpactViewerVisibilityTests(CommunityImpactViewerTestCase):
    def test_anonymous_viewer_sees_approved_entries_without_actions(self):
        entries = self.entries_by_uid(AnonymousUser())

        self.assertEqual(set(entries), {str(self.approved.uid)})
        self.assertEqual(
            self.flags(entries[str(self.approved.uid)]),
            {
                "viewer_sees_status": False,
                "viewer_can_delete": False,
                "viewer_can_edit": False,
                "viewer_review_url": "",
            },
        )

    def test_other_member_sees_only_their_own_waiting_entry(self):
        entries = self.entries_by_uid(self.other)

        self.assertEqual(set(entries), {str(self.approved.uid), str(self.other_waiting.uid)})
        self.assertEqual(
            self.flags(entries[str(self.other_waiting.uid)]),
            {
                "viewer_sees_status": True,
                "viewer_can_delete": True,
                "viewer_can_edit": True,
                "viewer_review_url": "",
            },
        )
        self.assertFalse(entries[str(self.approved.uid)]["viewer_sees_status"])

    def test_author_may_delete_but_not_edit_an_approved_entry(self):
        entries = self.entries_by_uid(self.author)

        self.assertEqual(set(entries), {str(self.approved.uid), str(self.author_waiting.uid)})
        approved = entries[str(self.approved.uid)]
        self.assertEqual(approved["status"], CommunityImpact.APPROVED)
        self.assertTrue(approved["viewer_sees_status"])
        self.assertTrue(approved["viewer_can_delete"])
        self.assertFalse(approved["viewer_can_edit"])
        self.assertTrue(entries[str(self.author_waiting.uid)]["viewer_can_edit"])

    def test_owner_sees_every_waiting_entry_and_may_edit_and_delete_all(self):
        entries = self.entries_by_uid(self.owner)

        self.assertEqual(
            set(entries),
            {str(self.approved.uid), str(self.author_waiting.uid), str(self.other_waiting.uid)},
        )
        for entry in entries.values():
            with self.subTest(title=entry["title"]):
                self.assertEqual(
                    self.flags(entry),
                    {
                        "viewer_sees_status": True,
                        "viewer_can_delete": True,
                        "viewer_can_edit": True,
                        "viewer_review_url": "",
                    },
                )

    def test_manager_reviews_waiting_entries_and_edits_approved_ones(self):
        entries = self.entries_by_uid(self.manager)

        self.assertEqual(
            set(entries),
            {str(self.approved.uid), str(self.author_waiting.uid), str(self.other_waiting.uid)},
        )
        self.assertEqual(
            self.flags(entries[str(self.approved.uid)]),
            {
                "viewer_sees_status": True,
                "viewer_can_delete": True,
                "viewer_can_edit": True,
                "viewer_review_url": "",
            },
        )
        waiting = entries[str(self.other_waiting.uid)]
        self.assertFalse(waiting["viewer_can_edit"])
        self.assertTrue(waiting["viewer_can_delete"])
        self.assertEqual(waiting["viewer_review_url"], f"/manage/film-impact/{self.other_waiting.uid}/review")

    def test_rejected_entries_stay_hidden_from_everyone(self):
        for viewer in (AnonymousUser(), self.author, self.owner, self.manager):
            with self.subTest(viewer=str(viewer)):
                self.assertNotIn(str(self.rejected.uid), self.entries_by_uid(viewer))

    def test_saves_group_lists_the_playlists_holding_the_film_newest_first(self):
        curator = create_test_user(name="Mara Curator")
        older = Playlist.objects.create(title="Climate stories", user=curator)
        newer = Playlist.objects.create(title="Labor and livelihood", user=self.other)
        Playlist.objects.filter(pk=older.pk).update(add_date=newer.add_date - timedelta(days=30))
        PlaylistMedia.objects.create(playlist=older, media=self.media, ordering=1)
        PlaylistMedia.objects.create(playlist=newer, media=self.media, ordering=1)
        older.refresh_from_db()

        saves = self.impacts_for(AnonymousUser())["saves"]

        self.assertEqual(saves["totalCount"], {"saves": 2, "playlists": 2})
        self.assertEqual([playlist["title"] for playlist in saves["playlists"]], [newer.title, older.title])
        self.assertEqual(
            saves["playlists"][1],
            {
                "friendly_token": older.friendly_token,
                "title": "Climate stories",
                "url": older.get_absolute_url(),
                "add_date": older.add_date.isoformat(),
                "curator_name": "Mara Curator",
                "curator_url": curator.get_absolute_url(),
            },
        )

    def test_create_response_carries_the_viewer_flags(self):
        self.client.force_login(self.other)

        response = self.client.post(
            f"/api/v1/media/{self.media.friendly_token}/community-impacts",
            data=json.dumps(
                {
                    "category": CommunityImpact.ARTICLE,
                    "title": "A Quiet Film That Asks Us to Listen",
                    "year": 2024,
                    "creator": "Andrea Cruz",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201)
        data = response.json()
        self.assertEqual(data["status"], CommunityImpact.WAITING_APPROVAL)
        self.assertEqual(data["title"], "A Quiet Film That Asks Us to Listen")
        self.assertEqual(
            self.flags(data),
            {
                "viewer_sees_status": True,
                "viewer_can_delete": True,
                "viewer_can_edit": True,
                "viewer_review_url": "",
            },
        )


class CommunityImpactDetailApiTests(CommunityImpactViewerTestCase):
    def url(self, impact, media=None):
        return f"/api/v1/media/{(media or self.media).friendly_token}/community-impacts/{impact.uid}"

    def patch(self, user, impact, payload, media=None):
        if user is not None:
            self.client.force_login(user)
        return self.client.patch(self.url(impact, media), data=json.dumps(payload), content_type="application/json")

    def delete(self, user, impact):
        if user is not None:
            self.client.force_login(user)
        return self.client.delete(self.url(impact))

    def test_author_edits_a_waiting_entry_and_it_keeps_waiting(self):
        response = self.patch(self.author, self.author_waiting, {"title": "Retitled review", "publication": "Daily"})

        self.assertEqual(response.status_code, 200)
        self.author_waiting.refresh_from_db()
        self.assertEqual(self.author_waiting.title, "Retitled review")
        self.assertEqual(self.author_waiting.publication, "Daily")
        self.assertEqual(self.author_waiting.status, CommunityImpact.WAITING_APPROVAL)
        self.assertTrue(response.json()["viewer_can_edit"])

    def test_author_cannot_edit_an_approved_entry(self):
        response = self.patch(self.author, self.approved, {"title": "Sneaky change"})

        self.assertEqual(response.status_code, 403)
        self.approved.refresh_from_db()
        self.assertEqual(self.approved.title, "Hanoi Doc Week")

    def test_owner_edit_sends_an_approved_entry_back_to_review(self):
        response = self.patch(self.owner, self.approved, {"title": "Hanoi Doc Week 2024"})

        self.assertEqual(response.status_code, 200)
        self.approved.refresh_from_db()
        self.assertEqual(self.approved.title, "Hanoi Doc Week 2024")
        self.assertEqual(self.approved.status, CommunityImpact.WAITING_APPROVAL)
        self.assertEqual(response.json()["status"], CommunityImpact.WAITING_APPROVAL)

    def test_trusted_owner_edit_keeps_the_entry_approved(self):
        self.owner.advancedUser = True
        self.owner.save(update_fields=["advancedUser"])

        response = self.patch(self.owner, self.approved, {"title": "Hanoi Doc Week 2024"})

        self.assertEqual(response.status_code, 200)
        self.approved.refresh_from_db()
        self.assertEqual(self.approved.status, CommunityImpact.APPROVED)

    def test_manager_edit_keeps_an_approved_entry_approved(self):
        response = self.patch(self.manager, self.approved, {"city": "Da Nang"})

        self.assertEqual(response.status_code, 200)
        self.approved.refresh_from_db()
        self.assertEqual(self.approved.city, "Da Nang")
        self.assertEqual(self.approved.status, CommunityImpact.APPROVED)

    def test_manager_reviews_rather_than_edits_a_waiting_entry(self):
        response = self.patch(self.manager, self.other_waiting, {"title": "Changed"})

        self.assertEqual(response.status_code, 403)

    def test_other_member_and_anonymous_viewer_cannot_edit(self):
        self.assertEqual(self.patch(self.other, self.approved, {"title": "Changed"}).status_code, 403)
        self.client.logout()
        self.assertIn(self.patch(None, self.approved, {"title": "Changed"}).status_code, (401, 403))

    def test_category_cannot_change(self):
        response = self.patch(self.owner, self.approved, {"category": CommunityImpact.ARTICLE})

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json(), {"category": ["The category cannot be changed."]})

    def test_sending_the_same_category_is_accepted(self):
        response = self.patch(self.owner, self.approved, {"category": CommunityImpact.SCREENING, "title": "Same"})

        self.assertEqual(response.status_code, 200)

    def test_edit_checks_the_category_fields_on_the_merged_entry(self):
        response = self.patch(self.owner, self.approved, {"organiser": "  "})

        self.assertEqual(response.status_code, 400)
        self.assertIn("organiser", response.json())
        self.approved.refresh_from_db()
        self.assertEqual(self.approved.organiser, "Youth Media Collective")

    def test_edit_rejects_an_unsafe_link(self):
        response = self.patch(self.owner, self.approved, {"url": "http://example.com"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("url", response.json())

    def test_unknown_entry_or_entry_of_another_film_is_not_found(self):
        other_media = create_test_media(self.owner)

        self.assertEqual(self.patch(self.owner, self.approved, {"title": "x"}, media=other_media).status_code, 404)
        self.client.force_login(self.owner)
        missing = f"/api/v1/media/{self.media.friendly_token}/community-impacts/not-a-uid"
        self.assertEqual(self.client.delete(missing).status_code, 404)

    def test_delete_permissions(self):
        cases = (
            (self.other, self.approved, 403),
            (self.author, self.approved, 204),
            (self.owner, self.author_waiting, 204),
            (self.manager, self.other_waiting, 204),
        )
        for user, impact, expected in cases:
            with self.subTest(user=user.username, impact=impact.title):
                self.client.logout()
                self.assertEqual(self.delete(user, impact).status_code, expected)
                self.assertEqual(CommunityImpact.objects.filter(pk=impact.pk).exists(), expected == 403)

    def test_anonymous_viewer_cannot_delete(self):
        self.client.logout()

        self.assertIn(self.delete(None, self.approved).status_code, (401, 403))
        self.assertTrue(CommunityImpact.objects.filter(pk=self.approved.pk).exists())


@patch("django_vite.core.asset_loader.DjangoViteAssetLoader.instance", return_value=make_vite_loader_mock())
@override_settings(MFA_REQUIRED_ROLES=[])
class CommunityImpactReviewPageTests(CommunityImpactViewerTestCase):
    def review_url(self):
        return f"/manage/film-impact/{self.other_waiting.uid}/review"

    def test_manager_opens_the_review_page(self, _mock_vite):
        self.client.force_login(self.manager)

        response = self.client.get(self.review_url())

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "cms/manage_film_impact_review.html")
        uid = escapejs(str(self.other_waiting.uid))
        self.assertContains(response, f'impactUid: "{uid}"')
        self.assertContains(response, f'apiUrl: "/api/v1/manage_film_impact/{uid}"')
        self.assertContains(response, '<div id="app-root"></div>', html=True)

    def test_other_viewers_are_sent_home_like_the_edit_page(self, _mock_vite):
        for user in (self.owner, self.author):
            with self.subTest(user=user.username):
                self.client.force_login(user)
                response = self.client.get(self.review_url())
                self.assertEqual(response.status_code, 302)
                self.assertEqual(response["Location"], "/")

        self.client.logout()
        response = self.client.get(self.review_url())
        self.assertEqual(response.status_code, 302)
