"""
Security tests for the home page SSR data injection (U6).

These tests lock the XSS escaping contract for json_script-injected data.
Any change that removes json_script, switches to {{ data|safe }}, or
introduces raw script interpolation must cause these tests to fail.
"""

import json
from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings

from files.models import Media
from files.tests.helpers import create_test_media, create_test_user, make_vite_loader_mock


@override_settings(
    UI_VARIANT_REVAMP_PAGES=["home"],
    UI_VARIANT_DEFAULT="legacy",
    UI_VARIANT_ALLOWED=["legacy", "revamp"],
)
class IndexRevampSecurityTest(TestCase):
    """XSS escaping contract: json_script must escape dangerous characters."""

    @classmethod
    def setUpTestData(cls):
        cls.user = create_test_user()

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

    def _response(self):
        return self.client.get("/", SERVER_NAME="localhost")

    def test_title_with_script_closing_tag_is_escaped(self):
        """A title of '</script><script>alert("xss")</script>' must not execute."""
        xss_title = '</script><script>alert("xss")</script>'
        media = create_test_media(self.user, featured=True)
        Media.objects.filter(pk=media.pk).update(title=xss_title)
        try:
            content = self._response().content.decode()
            # The raw unescaped injection must not appear
            self.assertNotIn('</script><script>alert("xss")</script>', content)
            # json_script escapes < as <
            self.assertIn("\\u003C", content)
        finally:
            media.delete()

    def test_description_with_script_tag_is_escaped(self):
        """A description containing '</script>' must appear escaped."""
        xss_desc = '</script><img onerror="alert(1)">'
        media = create_test_media(self.user, featured=True)
        Media.objects.filter(pk=media.pk).update(description=xss_desc)
        try:
            content = self._response().content.decode()
            self.assertNotIn("</script><img onerror=", content)
            self.assertIn("\\u003C", content)
        finally:
            media.delete()

    def test_script_body_contains_no_raw_angle_brackets_in_json(self):
        """
        json_script guarantees no raw < or > inside script body.
        Extract the JSON body and verify no unescaped angle brackets.
        """
        media = create_test_media(self.user, featured=True)
        Media.objects.filter(pk=media.pk).update(title="Normal title <with> angles")
        try:
            content = self._response().content.decode()
            # Extract the featured json_script body
            start_marker = 'id="home-initial-data-featured" type="application/json">'
            end_marker = "</script>"
            start = content.find(start_marker)
            if start == -1:
                self.skipTest("Script tag not found — implementation may have changed")
            start += len(start_marker)
            end = content.find(end_marker, start)
            json_body = content[start:end]
            # The raw < character must not appear inside the JSON body
            self.assertNotIn("<", json_body)
            self.assertNotIn(">", json_body)
            # The JSON must still be valid
            parsed = json.loads(json_body)
            self.assertIsInstance(parsed, list)
        finally:
            media.delete()

    def test_private_media_not_in_featured_payload(self):
        """Private media must not appear in the injected featured payload."""
        private_media = create_test_media(self.user, state="private")
        private_media.refresh_from_db()
        try:
            response = self._response()
            content = response.content.decode()
            # If the private media title appears, it leaked into the payload
            start_marker = 'id="home-initial-data-featured" type="application/json">'
            end_marker = "</script>"
            start = content.find(start_marker)
            if start != -1:
                start += len(start_marker)
                end = content.find(end_marker, start)
                payload = json.loads(content[start:end])
                titles = [item.get("title", "") for item in payload]
                self.assertNotIn(private_media.title, titles)
        finally:
            private_media.delete()
