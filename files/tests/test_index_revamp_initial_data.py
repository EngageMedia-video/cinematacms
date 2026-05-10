"""
Tests for the home page initial-data injection (U2).

Verifies that the index_revamp view injects featured and recommended media
payloads into the page via Django's json_script template tag, with correct
JSON shape and XSS-safe escaping.
"""

import json
from unittest.mock import patch

from django.test import TestCase, override_settings

from files.tests.helpers import create_test_media, create_test_user, make_vite_loader_mock


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
        response = self._get_revamp_response()
        content = response.content.decode()
        start_marker = 'id="home-initial-data-featured" type="application/json">'
        end_marker = "</script>"
        start = content.find(start_marker)
        self.assertGreater(start, -1, "home-initial-data-featured script tag not found")
        start += len(start_marker)
        end = content.find(end_marker, start)
        parsed = json.loads(content[start:end])
        self.assertIsInstance(parsed, list)

    def test_recommended_payload_is_valid_json(self):
        response = self._get_revamp_response()
        content = response.content.decode()
        start_marker = 'id="home-initial-data-recommended" type="application/json">'
        end_marker = "</script>"
        start = content.find(start_marker)
        self.assertGreater(start, -1, "home-initial-data-recommended script tag not found")
        start += len(start_marker)
        end = content.find(end_marker, start)
        parsed = json.loads(content[start:end])
        self.assertIsInstance(parsed, list)

    def test_xss_in_title_is_escaped_in_featured_payload(self):
        """A title with </script> must not appear unescaped in the response."""
        from files.models import Media

        xss_title = '</script><script>alert("xss")</script>'
        media = create_test_media(self.user, featured=True)
        Media.objects.filter(pk=media.pk).update(title=xss_title)
        try:
            response = self._get_revamp_response()
            content = response.content.decode()
            self.assertNotIn('</script><script>alert("xss")</script>', content)
            # json_script escapes < as <
            self.assertIn("\\u003C", content)
        finally:
            media.delete()

    def test_lt_in_title_is_escaped(self):
        """A title containing '<' must appear escaped per json_script contract."""
        from files.models import Media

        media = create_test_media(self.user, featured=True)
        Media.objects.filter(pk=media.pk).update(title="Title < with angle")
        try:
            response = self._get_revamp_response()
            content = response.content.decode()
            self.assertNotIn("<with angle", content)
        finally:
            media.delete()
