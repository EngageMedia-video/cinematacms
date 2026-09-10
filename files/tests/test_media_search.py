from datetime import date, datetime
from datetime import timezone as dt_timezone

from django.core.management import call_command
from django.db import connection
from django.test import Client, TestCase

from files.models import Category, CommunityImpact, Language, MediaCountry, Tag, Topic
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

    def test_community_impact_filter_returns_selected_approved_categories_distinct(self):
        response = self.client.get(
            "/api/v1/search",
            {
                "community_impact": [
                    CommunityImpact.SCREENING,
                    CommunityImpact.SAVES,
                ]
            },
        )

        self.assertEqual(response.status_code, 200)
        tokens = [item["friendly_token"] for item in response.json()["results"]]
        self.assertIn(self.screened.friendly_token, tokens)
        self.assertIn(self.featured.friendly_token, tokens)
        self.assertNotIn(self.waiting.friendly_token, tokens)
        self.assertNotIn(self.academic.friendly_token, tokens)
        self.assertNotIn(self.plain.friendly_token, tokens)
        self.assertEqual(tokens.count(self.featured.friendly_token), 1)

    def test_community_impact_filter_combines_with_country_filter(self):
        self.screened.media_country = "PH"
        self.screened.save(update_fields=["media_country"])
        self.featured.media_country = "ID"
        self.featured.save(update_fields=["media_country"])
        self.academic.media_country = "PH"
        self.academic.save(update_fields=["media_country"])
        self.plain.media_country = "AU"
        self.plain.save(update_fields=["media_country"])

        response = self.client.get(
            "/api/v1/search",
            {
                "country": ["Philippines", "Indonesia"],
                "community_impact": [CommunityImpact.SCREENING],
            },
        )

        self.assertEqual(response.status_code, 200)
        tokens = [item["friendly_token"] for item in response.json()["results"]]
        self.assertIn(self.screened.friendly_token, tokens)
        self.assertIn(self.featured.friendly_token, tokens)
        self.assertNotIn(self.academic.friendly_token, tokens)
        self.assertNotIn(self.plain.friendly_token, tokens)

    def test_rss_community_impact_filter_matches_api_membership(self):
        self.screened.media_country = "PH"
        self.screened.save(update_fields=["media_country"])
        self.featured.media_country = "ID"
        self.featured.save(update_fields=["media_country"])
        self.academic.media_country = "PH"
        self.academic.save(update_fields=["media_country"])

        params = {
            "country": ["Philippines", "Indonesia"],
            "community_impact": [CommunityImpact.SCREENING],
        }

        api_response = self.client.get("/api/v1/search", params)
        rss_response = self.client.get("/rss/search/", params)

        self.assertEqual(api_response.status_code, 200)
        self.assertEqual(rss_response.status_code, 200)
        api_titles = {item["title"] for item in api_response.json()["results"]}
        rss_content = rss_response.content.decode()
        self.assertEqual(api_titles, {"Screened Film", "Featured Film"})
        for title in api_titles:
            self.assertIn(title, rss_content)
        self.assertNotIn("Academic Film", rss_content)


class MediaSearchTaxonomyFilterTests(TestCase):
    def setUp(self):
        self.client = Client()
        self.user = create_test_user(username="taxonomy_user")
        self.labor = Category.objects.create(title="Labor")
        self.environment = Category.objects.create(title="Environment")
        self.other_category = Category.objects.create(title="Other Category")
        self.justice = Topic.objects.create(title="Justice")
        self.health = Topic.objects.create(title="Health")

        self.ph_labor_justice = self._media("PH Labor Justice", media_country="PH")
        self.ph_labor_justice.category.add(self.labor, self.environment)
        self.ph_labor_justice.topics.add(self.justice)

        self.id_environment_justice = self._media("ID Environment Justice", media_country="ID")
        self.id_environment_justice.category.add(self.environment)
        self.id_environment_justice.topics.add(self.justice)

        self.ph_labor_health = self._media("PH Labor Health", media_country="PH")
        self.ph_labor_health.category.add(self.labor)
        self.ph_labor_health.topics.add(self.health)

        self.au_other_justice = self._media("AU Other Justice", media_country="AU")
        self.au_other_justice.category.add(self.other_category)
        self.au_other_justice.topics.add(self.justice)

    def _media(self, title, **kwargs):
        media = create_test_media(self.user, **kwargs)
        media.title = title
        media.save(update_fields=["title"])
        return media

    def test_multi_value_taxonomy_filters_union_within_dimension_and_combine_across_dimensions(self):
        response = self.client.get(
            "/api/v1/search",
            {
                "category": ["Labor", "Environment"],
                "topic": ["Justice", "Health"],
                "country": ["Philippines", "Indonesia"],
            },
        )

        self.assertEqual(response.status_code, 200)
        titles = [item["title"] for item in response.json()["results"]]
        self.assertCountEqual(
            titles,
            [
                "PH Labor Justice",
                "ID Environment Justice",
                "PH Labor Health",
            ],
        )
        self.assertEqual(titles.count("PH Labor Justice"), 1)
        self.assertNotIn("AU Other Justice", titles)

    def test_single_value_category_filter_works_with_new_and_legacy_param_names(self):
        new_response = self.client.get("/api/v1/search", {"category": "Labor"})
        legacy_response = self.client.get("/api/v1/search", {"c": "Labor"})

        self.assertEqual(new_response.status_code, 200)
        self.assertEqual(legacy_response.status_code, 200)
        new_titles = {item["title"] for item in new_response.json()["results"]}
        legacy_titles = {item["title"] for item in legacy_response.json()["results"]}

        self.assertEqual(new_titles, legacy_titles)
        self.assertEqual(new_titles, {"PH Labor Justice", "PH Labor Health"})

    def test_rss_taxonomy_filters_match_api_membership(self):
        params = {
            "category": ["Labor", "Environment"],
            "topic": ["Justice"],
            "country": ["Philippines", "Indonesia"],
        }
        api_response = self.client.get("/api/v1/search", params)
        rss_response = self.client.get("/rss/search/", params)

        self.assertEqual(api_response.status_code, 200)
        self.assertEqual(rss_response.status_code, 200)
        api_titles = {item["title"] for item in api_response.json()["results"]}
        rss_content = rss_response.content.decode()
        self.assertEqual(api_titles, {"PH Labor Justice", "ID Environment Justice"})
        for title in api_titles:
            self.assertIn(title, rss_content)
        self.assertNotIn("PH Labor Health", rss_content)
        self.assertNotIn("AU Other Justice", rss_content)


class SearchFilterOptionListTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_topic_filter_options_include_zero_count_topics(self):
        Topic.objects.create(title="Zero Count Topic", media_count=0)

        response = self.client.get("/api/v1/topics")

        self.assertEqual(response.status_code, 200)
        titles = [item["title"] for item in response.json()]
        self.assertIn("Zero Count Topic", titles)

    def test_country_filter_options_include_no_thumbnail_countries(self):
        user = create_test_user(username="country_options_user")
        create_test_media(user, media_country="PH")
        MediaCountry.objects.create(title="No Thumbnail Country", media_count=0, listings_thumbnail="")

        response = self.client.get("/api/v1/countries")

        self.assertEqual(response.status_code, 200)
        countries = {item["title"]: item for item in response.json()}
        titles = countries.keys()
        self.assertIn("No Thumbnail Country", titles)
        self.assertEqual(countries["Philippines"]["media_count"], 1)

    def test_subtitle_language_filter_options_include_languages_and_exclude_automatic(self):
        Language.objects.get_or_create(code="tl", defaults={"title": "Tagalog"})
        Language.objects.get_or_create(code="automatic", defaults={"title": "Automatic"})

        response = self.client.get("/api/v1/subtitle-languages")

        self.assertEqual(response.status_code, 200)
        values = {item["code"]: item["title"] for item in response.json()}
        self.assertEqual(values["tl"], "Tagalog")
        self.assertNotIn("automatic", values)


class MediaSearchRelevanceRankingTests(TestCase):
    """Issue #879: a film must be findable by its title.

    The reported defect: "The Train" (uploaded 2011) was returned for the query
    "The Train" but at result 96 of 154, because results were ordered by
    -add_date with no relevance ranking, so newer media matching only in the
    description outranked an exact title match.
    """

    def setUp(self):
        self.client = Client()
        self.user = create_test_user(username="ranking_user")

    def _media(self, title, add_date, description=""):
        media = create_test_media(self.user)
        media.title = title
        media.description = description
        media.add_date = add_date
        media.save(update_fields=["title", "description", "add_date"])
        return media

    def _tokens(self, query):
        response = self.client.get(f"/api/v1/search?q={query}")
        self.assertEqual(response.status_code, 200)
        return [item["friendly_token"] for item in response.json()["results"]]

    def test_title_match_outranks_newer_description_only_match(self):
        title_match = self._media(
            "The Train",
            datetime(2011, 3, 23, tzinfo=dt_timezone.utc),
            description="A short film about a journey.",
        )
        description_match = self._media(
            "Harvest Season",
            datetime(2026, 3, 23, tzinfo=dt_timezone.utc),
            description="Filmed near the train station at dawn.",
        )

        tokens = self._tokens("the+train")

        self.assertIn(title_match.friendly_token, tokens)
        self.assertIn(description_match.friendly_token, tokens)
        self.assertLess(
            tokens.index(title_match.friendly_token),
            tokens.index(description_match.friendly_token),
        )

    def test_exact_title_match_outranks_newer_prefix_matches(self):
        """The reported case: 'The Train' (2011) buried under newer 'Training' media.

        'train:*' is a prefix query, so every 'Training ...' title matches it and
        carries the same title weight. Without an exact-term boost the 2011 film
        loses the recency tie-break to all of them and never reaches the
        four-row global-search dropdown.
        """
        the_train = self._media(
            "The Train",
            datetime(2011, 3, 23, tzinfo=dt_timezone.utc),
        )
        for index in range(6):
            self._media(
                f"Training Session {index}",
                datetime(2026, 3, index + 1, tzinfo=dt_timezone.utc),
            )

        response = self.client.get("/api/v1/search?q=the+train&page_size=4")
        self.assertEqual(response.status_code, 200)
        tokens = [item["friendly_token"] for item in response.json()["results"]]

        self.assertIn(the_train.friendly_token, tokens)

    def test_explicit_sort_by_still_overrides_relevance(self):
        """Relevance is the default for a text query, not an override.

        A visitor who asks for newest-first must still get newest-first.
        """
        older = self._media("The Train", datetime(2011, 3, 23, tzinfo=dt_timezone.utc))
        newer = self._media("Training Session", datetime(2026, 3, 23, tzinfo=dt_timezone.utc))

        response = self.client.get("/api/v1/search?q=the+train&sort_by=add_date")
        self.assertEqual(response.status_code, 200)
        tokens = [item["friendly_token"] for item in response.json()["results"]]

        self.assertLess(tokens.index(newer.friendly_token), tokens.index(older.friendly_token))

    def test_relevance_ordering_survives_a_tag_filter(self):
        """The tag filter adds .distinct(); ranked ordering must still apply."""
        tagged = self._media("The Train", datetime(2011, 3, 23, tzinfo=dt_timezone.utc))
        tagged.tags.add(Tag.objects.create(title="rail", user=self.user))
        other = self._media("Training Session", datetime(2026, 3, 23, tzinfo=dt_timezone.utc))
        other.tags.add(Tag.objects.get(title="rail"))

        response = self.client.get("/api/v1/search?q=the+train&tag=rail")
        self.assertEqual(response.status_code, 200)
        tokens = [item["friendly_token"] for item in response.json()["results"]]

        self.assertEqual(tokens[0], tagged.friendly_token)


class ReindexMediaSearchCommandTests(TestCase):
    """Issue #879: weighting only reaches a row when that row is saved.

    update_search_vector runs from the post_save receiver and nowhere else, so
    every pre-existing row keeps the unweighted vector it was written with.
    Without a reindex the ranking fix does not reach the existing corpus.
    """

    def setUp(self):
        self.user = create_test_user(username="reindex_user")

    def _vector(self, media):
        with connection.cursor() as cursor:
            cursor.execute("SELECT search FROM files_media WHERE id = %s", [media.id])
            return cursor.fetchone()[0]

    def test_reindex_rebuilds_weighted_vectors_for_existing_rows(self):
        media = create_test_media(self.user)
        media.title = "The Train"
        media.save(update_fields=["title"])

        # Rewrite the row the way the old unweighted implementation did.
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE files_media SET search = to_tsvector('simple', %s) WHERE id = %s",
                ["the train", media.id],
            )
        self.assertNotIn("A", self._vector(media))

        call_command("reindex_media_search")

        # Postgres renders a title lexeme carrying weight A as 'train':1A.
        self.assertIn("'train':1A", self._vector(media))
