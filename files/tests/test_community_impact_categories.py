from datetime import date

from django.contrib.auth.models import AnonymousUser
from django.test import Client, RequestFactory, TestCase
from django.utils import timezone

from files.models import CommunityImpact
from files.serializers import CommunityImpactSerializer, ManageCommunityImpactSerializer, SingleMediaSerializer
from files.tests.helpers import create_test_media, create_test_user

SCREENING_PAYLOAD = {
    "category": "screening",
    "title": "Busan Community Screening",
    "year": 2024,
    "is_online": False,
    "city": "Hanoi",
    "country": "VN",
    "organiser": "Youth Media Collective",
    "organiser_private": False,
    "details": "Around 80 people stayed for the discussion.",
    "url": "https://example.com/screening",
}

ARTICLE_PAYLOAD = {
    "category": "article",
    "title": "Films that changed the conversation",
    "year": 2023,
    "creator": "Dewi Lestari",
    "publication": "Jakarta Post",
}

REFERENCED_PAYLOAD = {
    "category": "referenced",
    "title": "Tide Lines",
    "year": 2022,
    "creator": "Pacific Arts Group",
    "medium": "performance",
}

AWARD_PAYLOAD = {
    "category": "award",
    "title": "Best Documentary",
    "award_result": "won",
    "organiser": "Jogja-NETPAC Asian Film Festival",
    "year": 2021,
    "details": "For its patient, intimate portrait of a fishing village.",
}

TEACHING_PAYLOAD = {
    "category": "teaching",
    "title": "Media and Climate Justice",
    "year": 2025,
    "creator": "Dr. Maria Santos",
    "organiser": "University of the Philippines",
}


def build_payload(base, **overrides):
    payload = dict(base)
    for key, value in overrides.items():
        if value is None:
            payload.pop(key, None)
        else:
            payload[key] = value
    return payload


def request_for(user):
    request = RequestFactory().get("/api/v1/media/token")
    request.user = user
    return request


class CommunityImpactCategoryValidationTests(TestCase):
    def assert_valid(self, payload):
        serializer = CommunityImpactSerializer(data=payload)
        self.assertTrue(serializer.is_valid(), msg=serializer.errors)
        return serializer.validated_data

    def assert_invalid(self, payload, *fields):
        serializer = CommunityImpactSerializer(data=payload)
        self.assertFalse(serializer.is_valid(), msg=f"Expected {payload!r} to be rejected")
        for field in fields:
            self.assertIn(field, serializer.errors)
        return serializer.errors

    def test_accepts_each_new_category_with_its_required_fields(self):
        for payload in (SCREENING_PAYLOAD, ARTICLE_PAYLOAD, REFERENCED_PAYLOAD, AWARD_PAYLOAD, TEACHING_PAYLOAD):
            with self.subTest(category=payload["category"]):
                self.assert_valid(payload)

    def test_rejects_legacy_categories_for_new_submissions(self):
        for category in ("featured", "academic", "saves", "curated"):
            with self.subTest(category=category):
                self.assert_invalid(build_payload(SCREENING_PAYLOAD, category=category), "category")

    def test_screening_requires_name_year_place_and_organiser(self):
        for field in ("title", "year", "city", "country", "organiser"):
            with self.subTest(field=field):
                self.assert_invalid(build_payload(SCREENING_PAYLOAD, **{field: None}), field)

    def test_online_screening_does_not_need_a_city_or_country(self):
        data = self.assert_valid(build_payload(SCREENING_PAYLOAD, is_online=True, city=None, country=None))

        self.assertTrue(data["is_online"])

    def test_online_screening_drops_any_place_it_was_sent(self):
        data = self.assert_valid(build_payload(SCREENING_PAYLOAD, is_online=True))

        self.assertEqual(data["city"], "")
        self.assertEqual(data["country"], "")

    def test_article_requires_title_year_and_author(self):
        for field in ("title", "year", "creator"):
            with self.subTest(field=field):
                self.assert_invalid(build_payload(ARTICLE_PAYLOAD, **{field: None}), field)

        self.assert_valid(build_payload(ARTICLE_PAYLOAD, publication=None))

    def test_referenced_work_requires_title_year_maker_and_medium(self):
        for field in ("title", "year", "creator", "medium"):
            with self.subTest(field=field):
                self.assert_invalid(build_payload(REFERENCED_PAYLOAD, **{field: None}), field)

    def test_referenced_work_rejects_unknown_medium(self):
        self.assert_invalid(build_payload(REFERENCED_PAYLOAD, medium="hologram"), "medium")

    def test_award_requires_name_result_giver_and_year(self):
        for field in ("title", "award_result", "organiser", "year"):
            with self.subTest(field=field):
                self.assert_invalid(build_payload(AWARD_PAYLOAD, **{field: None}), field)

    def test_award_rejects_unknown_result(self):
        self.assert_invalid(build_payload(AWARD_PAYLOAD, award_result="shortlisted"), "award_result")

    def test_teaching_requires_title_year_and_lead(self):
        for field in ("title", "year", "creator"):
            with self.subTest(field=field):
                self.assert_invalid(build_payload(TEACHING_PAYLOAD, **{field: None}), field)

        self.assert_valid(build_payload(TEACHING_PAYLOAD, organiser=None))

    def test_rejects_blank_required_text(self):
        self.assert_invalid(build_payload(ARTICLE_PAYLOAD, creator="   "), "creator")
        self.assert_invalid(build_payload(ARTICLE_PAYLOAD, creator="<b></b>"), "creator")

    def test_rejects_years_outside_the_supported_range(self):
        current_year = timezone.localdate().year
        for year in (1899, current_year + 2):
            with self.subTest(year=year):
                self.assert_invalid(build_payload(ARTICLE_PAYLOAD, year=year), "year")

        self.assert_valid(build_payload(ARTICLE_PAYLOAD, year=1900))
        self.assert_valid(build_payload(ARTICLE_PAYLOAD, year=current_year))

    def test_accepts_next_year_for_submitters_ahead_of_the_server_time_zone(self):
        self.assert_valid(build_payload(ARTICLE_PAYLOAD, year=timezone.localdate().year + 1))

    def test_rejects_country_outside_the_platform_list(self):
        self.assert_invalid(build_payload(SCREENING_PAYLOAD, country="ZZ"), "country")

    def test_drops_fields_that_do_not_belong_to_the_category(self):
        data = self.assert_valid(
            build_payload(
                ARTICLE_PAYLOAD,
                city="Hanoi",
                country="VN",
                organiser="Somebody",
                organiser_private=True,
                is_online=True,
                medium="film",
                award_result="won",
            )
        )

        self.assertEqual(data["city"], "")
        self.assertEqual(data["country"], "")
        self.assertEqual(data["organiser"], "")
        self.assertFalse(data["organiser_private"])
        self.assertFalse(data["is_online"])
        self.assertEqual(data["medium"], "")
        self.assertEqual(data["award_result"], "")
        self.assertEqual(data["publication"], "Jakarta Post")


class CommunityImpactCategoryEndpointTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.owner = create_test_user(username="impactowner", password="testpass123")
        self.viewer = create_test_user(username="impactviewer", password="testpass123")
        self.media = create_test_media(self.owner)
        self.url = f"/api/v1/media/{self.media.friendly_token}/community-impacts"

    def test_submission_persists_category_fields_and_labels(self):
        self.client.login(username="impactviewer", password="testpass123")

        response = self.client.post(self.url, data=SCREENING_PAYLOAD, content_type="application/json")

        self.assertEqual(response.status_code, 201, response.content)
        impact = CommunityImpact.objects.get(media=self.media)
        self.assertEqual(impact.category, CommunityImpact.SCREENING)
        self.assertEqual(impact.year, 2024)
        self.assertEqual(impact.city, "Hanoi")
        self.assertEqual(impact.country, "VN")
        self.assertEqual(impact.organiser, "Youth Media Collective")
        self.assertEqual(impact.event_date, timezone.localdate())
        body = response.json()
        self.assertEqual(body["country_label"], "Viet Nam")
        self.assertEqual(body["category_label"], "Screened In")

    def test_submission_strips_markup_from_category_text(self):
        self.client.login(username="impactviewer", password="testpass123")

        response = self.client.post(
            self.url,
            data=build_payload(ARTICLE_PAYLOAD, creator="<script>x</script>Dewi", publication="<i>Post</i>"),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 201, response.content)
        impact = CommunityImpact.objects.get(media=self.media)
        self.assertEqual(impact.creator, "xDewi")
        self.assertEqual(impact.publication, "Post")

    def test_award_labels_are_returned(self):
        self.client.login(username="impactviewer", password="testpass123")

        response = self.client.post(self.url, data=AWARD_PAYLOAD, content_type="application/json")

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["award_result_label"], "Won")

    def test_referenced_medium_label_is_returned(self):
        self.client.login(username="impactviewer", password="testpass123")

        response = self.client.post(self.url, data=REFERENCED_PAYLOAD, content_type="application/json")

        self.assertEqual(response.status_code, 201, response.content)
        self.assertEqual(response.json()["medium_label"], "Performance")


class CommunityImpactPrivateOrganiserTests(TestCase):
    def setUp(self):
        self.owner = create_test_user(username="privateowner")
        self.submitter = create_test_user(username="privatesubmitter")
        self.stranger = create_test_user(username="privatestranger")
        self.curator = create_test_user(username="privatecurator", is_curator=True)
        self.media = create_test_media(self.owner)
        self.impact = CommunityImpact.objects.create(
            media=self.media,
            user=self.submitter,
            category=CommunityImpact.SCREENING,
            status=CommunityImpact.APPROVED,
            title="Closed-door screening",
            year=2024,
            city="Yangon",
            country="MM",
            organiser="Underground Film Club",
            organiser_private=True,
            event_date=date(2026, 5, 29),
        )

    def organiser_seen_by(self, user):
        return CommunityImpactSerializer(self.impact, context={"request": request_for(user)}).data["organiser"]

    def test_hides_private_organiser_from_the_public(self):
        self.assertEqual(self.organiser_seen_by(AnonymousUser()), "")
        self.assertEqual(self.organiser_seen_by(self.stranger), "")
        self.assertEqual(self.organiser_seen_by(self.submitter), "")

    def test_shows_private_organiser_to_film_owner_and_impact_managers(self):
        self.assertEqual(self.organiser_seen_by(self.owner), "Underground Film Club")
        self.assertEqual(self.organiser_seen_by(self.curator), "Underground Film Club")

    def test_hides_private_organiser_without_request_context(self):
        self.assertEqual(CommunityImpactSerializer(self.impact).data["organiser"], "")

    def test_hides_private_organiser_in_media_detail(self):
        data = SingleMediaSerializer(self.media, context={"request": request_for(self.stranger)}).data

        self.assertEqual(data["community_impacts"]["screening"][0]["organiser"], "")

    def test_public_organiser_is_visible_to_everyone(self):
        CommunityImpact.objects.filter(pk=self.impact.pk).update(organiser_private=False)
        self.impact.refresh_from_db()

        self.assertEqual(self.organiser_seen_by(AnonymousUser()), "Underground Film Club")

    def test_media_impact_endpoint_redacts_private_organiser_for_strangers(self):
        url = f"/api/v1/media/{self.media.friendly_token}/community-impacts"

        anonymous = Client().get(url).json()
        stranger_client = Client()
        stranger_client.force_login(self.stranger)
        stranger = stranger_client.get(url).json()
        owner_client = Client()
        owner_client.force_login(self.owner)
        owner = owner_client.get(url).json()

        self.assertEqual(anonymous[0]["organiser"], "")
        self.assertEqual(stranger[0]["organiser"], "")
        self.assertEqual(owner[0]["organiser"], "Underground Film Club")

    def test_profile_impact_endpoint_redacts_private_organiser_for_strangers(self):
        url = f"/api/v1/users/{self.owner.username}/community-impacts"

        anonymous = Client().get(url).json()
        owner_client = Client()
        owner_client.force_login(self.owner)
        owner = owner_client.get(url).json()

        self.assertEqual(anonymous["films"][0]["impact"]["screening"]["entries"][0]["organiser"], "")
        self.assertEqual(
            owner["films"][0]["impact"]["screening"]["entries"][0]["organiser"],
            "Underground Film Club",
        )

    def test_cached_media_detail_does_not_leak_the_owner_view(self):
        url = f"/api/v1/media/{self.media.friendly_token}"
        owner_client = Client()
        owner_client.force_login(self.owner)

        owner_view = owner_client.get(url).json()
        anonymous_view = Client().get(url).json()

        self.assertEqual(owner_view["community_impacts"]["screening"][0]["organiser"], "Underground Film Club")
        self.assertEqual(anonymous_view["community_impacts"]["screening"][0]["organiser"], "")

    def test_manage_serializer_always_shows_the_organiser(self):
        data = ManageCommunityImpactSerializer(self.impact, context={"request": request_for(self.curator)}).data

        self.assertEqual(data["organiser"], "Underground Film Club")
        self.assertTrue(data["organiser_private"])


class CommunityImpactOrderingTests(TestCase):
    def test_orders_entries_by_impact_year_then_reported_date(self):
        user = create_test_user()
        media = create_test_media(user)

        def create(title, year, event_date):
            CommunityImpact.objects.create(
                media=media,
                user=user,
                category=CommunityImpact.SCREENING,
                status=CommunityImpact.APPROVED,
                title=title,
                year=year,
                event_date=event_date,
            )

        create("Reported recently, screened 2019", 2019, date(2026, 6, 1))
        create("Reported earlier, screened 2024", 2024, date(2026, 5, 1))
        create("Legacy entry from 2021", None, date(2021, 3, 3))

        data = SingleMediaSerializer(media, context={"request": request_for(AnonymousUser())}).data

        self.assertEqual(
            [entry["title"] for entry in data["community_impacts"]["screening"]],
            [
                "Reported earlier, screened 2024",
                "Legacy entry from 2021",
                "Reported recently, screened 2019",
            ],
        )

    def test_media_detail_groups_new_categories(self):
        user = create_test_user()
        media = create_test_media(user)
        for category in ("article", "referenced", "award", "teaching"):
            CommunityImpact.objects.create(
                media=media,
                user=user,
                category=category,
                status=CommunityImpact.APPROVED,
                title=f"{category} entry",
                year=2024,
                event_date=date(2026, 5, 29),
            )

        data = SingleMediaSerializer(media, context={"request": request_for(AnonymousUser())}).data

        for category in ("article", "referenced", "award", "teaching"):
            with self.subTest(category=category):
                self.assertEqual(data["community_impacts"][category][0]["title"], f"{category} entry")


class ManageCommunityImpactCategoryTests(TestCase):
    def setUp(self):
        self.user = create_test_user()
        self.media = create_test_media(self.user)

    def create_impact(self, **fields):
        defaults = {
            "media": self.media,
            "user": self.user,
            "category": CommunityImpact.SCREENING,
            "status": CommunityImpact.WAITING_APPROVAL,
            "title": "Screening",
            "event_date": date(2026, 5, 29),
        }
        defaults.update(fields)
        return CommunityImpact.objects.create(**defaults)

    def test_moderation_can_still_update_status_without_category_fields(self):
        impact = self.create_impact()

        serializer = ManageCommunityImpactSerializer(impact, data={"status": "approved"}, partial=True)

        self.assertTrue(serializer.is_valid(), msg=serializer.errors)

    def test_legacy_categories_can_still_be_swapped(self):
        impact = self.create_impact(category=CommunityImpact.FEATURED)

        serializer = ManageCommunityImpactSerializer(impact, data={"category": "academic"}, partial=True)

        self.assertTrue(serializer.is_valid(), msg=serializer.errors)

    def test_changing_to_a_new_category_requires_its_fields(self):
        impact = self.create_impact(city="Hanoi", country="VN", organiser="Youth Collective", year=2024)

        serializer = ManageCommunityImpactSerializer(impact, data={"category": "award"}, partial=True)

        self.assertFalse(serializer.is_valid())
        self.assertIn("award_result", serializer.errors)

    def test_changing_category_drops_the_old_category_fields(self):
        impact = self.create_impact(city="Hanoi", country="VN", organiser="Youth Collective", year=2024)

        serializer = ManageCommunityImpactSerializer(
            impact,
            data={"category": "award", "award_result": "won", "organiser": "Busan IFF"},
            partial=True,
        )
        self.assertTrue(serializer.is_valid(), msg=serializer.errors)
        serializer.save()
        impact.refresh_from_db()

        self.assertEqual(impact.category, CommunityImpact.AWARD)
        self.assertEqual(impact.award_result, "won")
        self.assertEqual(impact.organiser, "Busan IFF")
        self.assertEqual(impact.year, 2024)
        self.assertEqual(impact.city, "")
        self.assertEqual(impact.country, "")
