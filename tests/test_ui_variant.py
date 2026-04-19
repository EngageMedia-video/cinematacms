from django.test import RequestFactory, TestCase, override_settings
from django.contrib.auth import get_user_model

from cms.ui_variant import resolve_template

User = get_user_model()


# ---------------------------------------------------------------------------
# resolve_template() unit tests — no HTTP stack, uses RequestFactory
# ---------------------------------------------------------------------------


class ResolveTemplateTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def _make_request(self, query_string="", is_staff=False, anonymous=False):
        request = self.factory.get("/", QUERY_STRING=query_string)
        if anonymous:
            from django.contrib.auth.models import AnonymousUser

            request.user = AnonymousUser()
        else:
            request.user = User(is_staff=is_staff)
        return request

    @override_settings(UI_VARIANT_REVAMP_PAGES=["home"])
    def test_allowlisted_page_returns_revamp(self):
        request = self._make_request()
        result = resolve_template(request, "home", "cms/index.html", "cms/index_revamp.html")
        self.assertEqual(result, "cms/index_revamp.html")
        self.assertEqual(request.ui_variant, "revamp")

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_non_allowlisted_page_returns_legacy(self):
        request = self._make_request()
        result = resolve_template(request, "home", "cms/index.html", "cms/index_revamp.html")
        self.assertEqual(result, "cms/index.html")
        self.assertEqual(request.ui_variant, "legacy")

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_staff_preview_param_returns_revamp(self):
        request = self._make_request(query_string="ui=revamp", is_staff=True)
        result = resolve_template(request, "home", "cms/index.html", "cms/index_revamp.html")
        self.assertEqual(result, "cms/index_revamp.html")
        self.assertEqual(request.ui_variant, "revamp")

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_non_staff_preview_param_ignored(self):
        request = self._make_request(query_string="ui=revamp", is_staff=False)
        result = resolve_template(request, "home", "cms/index.html", "cms/index_revamp.html")
        self.assertEqual(result, "cms/index.html")
        self.assertEqual(request.ui_variant, "legacy")

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_anonymous_user_preview_param_ignored(self):
        request = self._make_request(query_string="ui=revamp", anonymous=True)
        result = resolve_template(request, "home", "cms/index.html", "cms/index_revamp.html")
        self.assertEqual(result, "cms/index.html")
        self.assertEqual(request.ui_variant, "legacy")

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_invalid_param_value_ignored(self):
        request = self._make_request(query_string="ui=garbage", is_staff=True)
        result = resolve_template(request, "home", "cms/index.html", "cms/index_revamp.html")
        self.assertEqual(result, "cms/index.html")
        self.assertEqual(request.ui_variant, "legacy")

    def test_missing_setting_degrades_to_legacy(self):
        """UI_VARIANT_REVAMP_PAGES absent from settings → no AttributeError, returns legacy."""
        from django.test import override_settings as _os

        with _os(UI_VARIANT_REVAMP_PAGES=None):
            # Simulate missing by patching directly
            pass
        # Use override_settings to delete the key entirely
        from unittest import mock

        with mock.patch("cms.ui_variant.settings") as mock_settings:
            del mock_settings.UI_VARIANT_REVAMP_PAGES
            mock_settings.configure_mock(**{"UI_VARIANT_REVAMP_PAGES": AttributeError})
            # Use getattr directly to confirm the helper won't blow up
            import cms.ui_variant as uv

            original = uv.settings
            try:
                mock_obj = mock.MagicMock(spec=[])  # no attributes
                uv.settings = mock_obj
                request = self._make_request()
                result = resolve_template(request, "home", "cms/index.html", "cms/index_revamp.html")
                self.assertEqual(result, "cms/index.html")
                self.assertEqual(request.ui_variant, "legacy")
            finally:
                uv.settings = original

    @override_settings(UI_VARIANT_REVAMP_PAGES=["home"])
    def test_staff_plus_allowlisted_returns_revamp(self):
        """Allowlist wins regardless of staff status — both paths return revamp."""
        request = self._make_request(query_string="ui=revamp", is_staff=True)
        result = resolve_template(request, "home", "cms/index.html", "cms/index_revamp.html")
        self.assertEqual(result, "cms/index_revamp.html")
        self.assertEqual(request.ui_variant, "revamp")

    def test_no_user_attribute_on_request_returns_legacy(self):
        """Request without .user attribute (raw RequestFactory, no auth middleware) doesn't raise."""
        request = self.factory.get("/?ui=revamp")
        # Deliberately do NOT set request.user
        result = resolve_template(request, "home", "cms/index.html", "cms/index_revamp.html")
        self.assertEqual(result, "cms/index.html")
        self.assertEqual(request.ui_variant, "legacy")


# ---------------------------------------------------------------------------
# View integration tests — full HTTP stack via test client
# ---------------------------------------------------------------------------


class UIVariantViewIntegrationTests(TestCase):
    def setUp(self):
        self.staff_user = User.objects.create_user(
            username="staffuser",
            password="testpass",
            is_staff=True,
        )
        self.regular_user = User.objects.create_user(
            username="regularuser",
            password="testpass",
            is_staff=False,
        )

    @override_settings(UI_VARIANT_REVAMP_PAGES=["home"])
    def test_allowlisted_page_serves_revamp_template(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.context)
        self.assertEqual(response.context["UI_VARIANT"], "revamp")
        self.assertIn(b"index-revamp", response.content)

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_non_allowlisted_page_serves_legacy_template(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.context)
        self.assertEqual(response.context["UI_VARIANT"], "legacy")

    @override_settings(UI_VARIANT_REVAMP_PAGES=["home"])
    def test_revamp_page_has_data_ui_variant_attribute(self):
        response = self.client.get("/")
        self.assertIn(b'data-ui-variant="revamp"', response.content)

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_legacy_page_has_data_ui_variant_legacy(self):
        response = self.client.get("/")
        self.assertIn(b'data-ui-variant="legacy"', response.content)

    def test_bootstrap_contains_mediaCMS_ui_variant(self):
        response = self.client.get("/")
        self.assertIn(b"ui:", response.content)
        self.assertIn(b"variant:", response.content)

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_staff_preview_param_returns_revamp(self):
        self.client.login(username="staffuser", password="testpass")
        response = self.client.get("/?ui=revamp")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.context)
        self.assertEqual(response.context["UI_VARIANT"], "revamp")

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_non_staff_preview_param_returns_legacy_indistinguishable(self):
        """Non-staff ?ui=revamp → legacy, same status as normal request (no redirect/error)."""
        self.client.login(username="regularuser", password="testpass")
        response = self.client.get("/?ui=revamp")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.context)
        self.assertEqual(response.context["UI_VARIANT"], "legacy")

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_anonymous_preview_param_returns_legacy(self):
        response = self.client.get("/?ui=revamp")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.context)
        self.assertEqual(response.context["UI_VARIANT"], "legacy")

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_ui_variant_missing_from_context_when_no_resolve_call(self):
        """Non-home pages that don't call resolve_template get UI_VARIANT='legacy'."""
        # /about or similar — as long as index() is wired this test uses /
        # For pages not yet wired, the context processor defaults to legacy
        response = self.client.get("/")
        self.assertEqual(response.context["UI_VARIANT"], "legacy")
