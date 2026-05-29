"""
Tests for the home page initial-data injection (U2).

Verifies that the index_revamp view injects featured and recommended media
payloads into the page via Django's json_script template tag, with correct
JSON shape and XSS-safe escaping.
"""

from datetime import timedelta
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings
from django.utils import timezone

from files.models import EncodeProfile, Encoding, Media
from files.query_cache import get_cached_result, get_media_list_cache_key
from files.tests.helpers import (
    create_test_media,
    create_test_user,
    extract_json_script_payload,
    make_vite_loader_mock,
)


@override_settings(
    UI_VARIANT_REVAMP_PAGES=["home"],
    UI_VARIANT_DEFAULT="legacy",
    UI_VARIANT_ALLOWED=["legacy", "revamp"],
)
class IndexRevampInitialDataTest(TestCase):
    """Home page must emit two json_script blocks with media payloads."""

    @classmethod
    def setUpTestData(cls):
        cls.user = create_test_user()
        cls.media = create_test_media(cls.user, featured=True)

    def setUp(self):
        super().setUp()
        cache.clear()
        self._vite_patcher = patch(
            "django_vite.core.asset_loader.DjangoViteAssetLoader.instance",
            return_value=make_vite_loader_mock(),
        )
        self._vite_patcher.start()

    def tearDown(self):
        self._vite_patcher.stop()
        super().tearDown()

    def _get_revamp_response(self):
        return self.client.get("/", SERVER_NAME="localhost")

    def _featured_payload(self):
        response = self._get_revamp_response()
        content = response.content.decode()
        payload = extract_json_script_payload(content, "home-initial-data-featured")
        self.assertIsNotNone(payload, "home-initial-data-featured script tag not found")
        return payload

    def _featured_results(self):
        return self._featured_payload()["results"]

    def _add_success_encoding(self, media, filename="encoded/hero.mp4"):
        profile = EncodeProfile.objects.create(name="Hero 720p", extension="mp4", codec="h264", resolution=720)
        encoding = Encoding(media=media, profile=profile, status="success", progress=100, chunk=False)
        encoding.media_file.name = filename
        encoding.save()
        return encoding

    def test_featured_script_tag_present(self):
        response = self._get_revamp_response()
        self.assertContains(response, 'id="home-initial-data-featured"')

    def test_recommended_script_tag_present(self):
        response = self._get_revamp_response()
        self.assertContains(response, 'id="home-initial-data-recommended"')

    def test_featured_script_tag_has_correct_type(self):
        response = self._get_revamp_response()
        self.assertContains(response, 'type="application/json"')

    def test_featured_payload_is_valid_json(self):
        parsed = self._featured_payload()
        self.assertIsInstance(parsed, dict)
        self.assertIsInstance(parsed["results"], list)

    def test_featured_payload_uses_slim_home_media_shape(self):
        item = self._featured_results()[0]

        self.assertIn("title", item)
        self.assertIn("summary", item)
        self.assertIn("thumbnail_url", item)
        self.assertIn("author_profile", item)
        self.assertNotIn("author_thumbnail", item)
        self.assertNotIn("likes", item)
        self.assertNotIn("reported_times", item)
        self.assertNotIn("size", item)

    def test_recommended_payload_uses_slim_home_media_shape(self):
        response = self._get_revamp_response()
        content = response.content.decode()
        parsed = extract_json_script_payload(content, "home-initial-data-recommended")
        if not parsed["results"]:
            self.skipTest("Recommended payload is empty for this fixture")
        item = parsed["results"][0]

        self.assertIn("title", item)
        self.assertIn("thumbnail_url", item)
        self.assertIn("categories_info", item)
        self.assertNotIn("author_thumbnail", item)
        self.assertNotIn("likes", item)
        self.assertNotIn("reported_times", item)
        self.assertNotIn("size", item)

    def test_first_featured_item_includes_hero_playback(self):
        hero = create_test_media(
            self.user,
            featured=True,
            featured_date=timezone.now() + timedelta(minutes=5),
        )
        self._add_success_encoding(hero)

        payload = self._featured_results()

        self.assertEqual(payload[0]["friendly_token"], hero.friendly_token)
        self.assertIn("hero_playback", payload[0])
        self.assertIn("encodings_info", payload[0]["hero_playback"])
        self.assertIn("hls_info", payload[0]["hero_playback"])
        self.assertIn("subtitles_info", payload[0]["hero_playback"])
        self.assertEqual(payload[0]["hero_playback"]["encodings_info"]["720"]["h264"]["status"], "success")

    def test_only_first_featured_item_includes_hero_playback(self):
        other = create_test_media(
            self.user,
            featured=True,
            featured_date=timezone.now() - timedelta(minutes=5),
        )
        hero = create_test_media(
            self.user,
            featured=True,
            featured_date=timezone.now() + timedelta(minutes=5),
        )
        self._add_success_encoding(hero)
        self._add_success_encoding(other, filename="encoded/other.mp4")

        payload = self._featured_results()
        by_token = {item["friendly_token"]: item for item in payload}

        self.assertIn("hero_playback", by_token[hero.friendly_token])
        self.assertNotIn("hero_playback", by_token[other.friendly_token])

    def test_featured_api_first_result_includes_hero_playback(self):
        hero = create_test_media(
            self.user,
            featured=True,
            featured_date=timezone.now() + timedelta(minutes=5),
        )
        self._add_success_encoding(hero)

        response = self.client.get("/api/v1/media?show=featured", SERVER_NAME="localhost")
        payload = response.json()

        self.assertEqual(payload["results"][0]["friendly_token"], hero.friendly_token)
        self.assertIn("hero_playback", payload["results"][0])
        self.assertIn("encodings_info", payload["results"][0]["hero_playback"])
        self.assertIn("hls_info", payload["results"][0]["hero_playback"])
        self.assertIn("subtitles_info", payload["results"][0]["hero_playback"])

        cache_key = get_media_list_cache_key(show="featured", page=1, user_id=None, origin="http://localhost")
        cached_payload = get_cached_result(cache_key)
        self.assertIsNotNone(cached_payload)
        self.assertNotIn("hero_playback", cached_payload["results"][0])

    def test_featured_api_second_page_omits_hero_playback(self):
        hero = create_test_media(
            self.user,
            featured=True,
            featured_date=timezone.now() + timedelta(minutes=5),
        )
        self._add_success_encoding(hero)
        for index in range(50):
            create_test_media(
                self.user,
                featured=True,
                featured_date=timezone.now() - timedelta(minutes=index + 1),
            )

        response = self.client.get("/api/v1/media?show=featured&page=2", SERVER_NAME="localhost")
        payload = response.json()

        self.assertEqual(response.status_code, 200)
        self.assertNotEqual(payload["results"][0]["friendly_token"], hero.friendly_token)
        self.assertNotIn("hero_playback", payload["results"][0])

    def test_home_initial_data_uses_home_cache_without_reenriching(self):
        hero = create_test_media(
            self.user,
            featured=True,
            featured_date=timezone.now() + timedelta(minutes=5),
        )
        self._add_success_encoding(hero)

        first_payload = self._featured_payload()
        self.assertIn("hero_playback", first_payload["results"][0])

        with patch("files.views.HeroPlaybackSerializer", side_effect=AssertionError("should use home cache")):
            second_payload = self._featured_payload()

        self.assertEqual(second_payload["results"][0]["friendly_token"], hero.friendly_token)
        self.assertIn("hero_playback", second_payload["results"][0])

    def test_summary_update_invalidates_home_initial_data_cache(self):
        first_payload = self._featured_payload()
        self.assertEqual(first_payload["results"][0]["summary"], self.media.summary)

        self.media.summary = "Updated homepage synopsis"
        self.media.save(update_fields=["summary"])

        updated_payload = self._featured_payload()

        self.assertEqual(updated_payload["results"][0]["friendly_token"], self.media.friendly_token)
        self.assertEqual(updated_payload["results"][0]["summary"], "Updated homepage synopsis")

    def test_recommended_payload_is_valid_json(self):
        response = self._get_revamp_response()
        content = response.content.decode()
        parsed = extract_json_script_payload(content, "home-initial-data-recommended")
        self.assertIsNotNone(parsed, "home-initial-data-recommended script tag not found")
        self.assertIsInstance(parsed, dict)
        self.assertIsInstance(parsed["results"], list)

    def test_xss_in_title_is_escaped_in_featured_payload(self):
        """A title with </script> must not appear unescaped in the response."""
        xss_title = '</script><script>alert("xss")</script>'
        media = create_test_media(self.user, featured=True)
        Media.objects.filter(pk=media.pk).update(title=xss_title)
        try:
            response = self._get_revamp_response()
            content = response.content.decode()
            self.assertNotIn('</script><script>alert("xss")</script>', content)
            # json_script escapes < as \u003C
            self.assertIn("\\u003C", content)
        finally:
            media.delete()

    def test_lt_in_title_is_escaped(self):
        """A title containing '<' must appear escaped per json_script contract."""
        media = create_test_media(self.user, featured=True)
        Media.objects.filter(pk=media.pk).update(title="Title < with angle")
        try:
            response = self._get_revamp_response()
            content = response.content.decode()
            self.assertNotIn("Title < with angle", content)
            self.assertIn("\\u003C", content)
        finally:
            media.delete()
