from copy import deepcopy

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, TestCase, override_settings

from cms.ui_variant import resolve_template, ui_variant_context_processor

User = get_user_model()
HERMETIC_DJANGO_VITE = deepcopy(settings.DJANGO_VITE)
HERMETIC_DJANGO_VITE["default"]["dev_mode"] = True


class ResolveTemplateTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def _make_request(self, query_string="", is_staff=False, anonymous=False):
        path = f"/?{query_string}" if query_string else "/"
        request = self.factory.get(path)
        if anonymous:
            request.user = AnonymousUser()
        else:
            request.user = User(is_staff=is_staff)
        return request

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_legacy_default(self):
        request = self._make_request()
        result = resolve_template(request, "home")
        self.assertEqual(result, "cms/index.html")
        self.assertEqual(request.ui_variant, "legacy")

    @override_settings(UI_VARIANT_REVAMP_PAGES=["home"])
    def test_revamp_when_allowlisted(self):
        request = self._make_request()
        result = resolve_template(request, "home")
        self.assertEqual(result, "cms/index_revamp.html")
        self.assertEqual(request.ui_variant, "revamp")

    @override_settings(UI_VARIANT_REVAMP_PAGES=["home"])
    def test_revamp_when_allowlisted_logged_in(self):
        request = self._make_request(is_staff=False)
        result = resolve_template(request, "home")
        self.assertEqual(result, "cms/index_revamp.html")
        self.assertEqual(request.ui_variant, "revamp")

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_staff_preview_query_param(self):
        request = self._make_request(query_string="ui=revamp", is_staff=True)
        result = resolve_template(request, "home")
        self.assertEqual(result, "cms/index_revamp.html")
        self.assertEqual(request.ui_variant, "revamp")

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_non_staff_preview_ignored(self):
        request = self._make_request(query_string="ui=revamp", is_staff=False)
        result = resolve_template(request, "home")
        self.assertEqual(result, "cms/index.html")
        self.assertEqual(request.ui_variant, "legacy")

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_invalid_variant_ignored(self):
        request = self._make_request(query_string="ui=garbage", is_staff=True)
        result = resolve_template(request, "home")
        self.assertEqual(result, "cms/index.html")
        self.assertEqual(request.ui_variant, "legacy")

    @override_settings(UI_VARIANT_DEFAULT="revamp", UI_VARIANT_REVAMP_PAGES=[])
    def test_default_revamp_does_not_bypass_allowlist(self):
        request = self._make_request()
        result = resolve_template(request, "home")
        self.assertEqual(result, "cms/index.html")
        self.assertEqual(request.ui_variant, "legacy")

    @override_settings(UI_VARIANT_ALLOWED=["legacy", "revamp"], UI_VARIANT_DEFAULT="revmp")
    def test_invalid_default_variant_logs_warning_and_falls_back(self):
        request = self._make_request()
        with self.assertLogs("cms.ui_variant", level="WARNING") as logs:
            result = resolve_template(request, "home")
        self.assertEqual(result, "cms/index.html")
        self.assertEqual(request.ui_variant, "legacy")
        self.assertIn("UI_VARIANT_DEFAULT='revmp' not in UI_VARIANT_ALLOWED", logs.output[0])

    def test_context_processor_exposes_variant(self):
        request = self._make_request()
        request.ui_variant = "revamp"
        self.assertEqual(ui_variant_context_processor(request), {"UI_VARIANT": "revamp"})

    @override_settings(UI_VARIANT_DEFAULT="revamp")
    def test_context_processor_defaults_to_legacy(self):
        request = self._make_request()
        self.assertEqual(ui_variant_context_processor(request), {"UI_VARIANT": "legacy"})

    def test_no_user_attribute_on_request_returns_legacy(self):
        request = self.factory.get("/?ui=revamp")
        result = resolve_template(request, "home")
        self.assertEqual(result, "cms/index.html")
        self.assertEqual(request.ui_variant, "legacy")

    def test_unknown_page_key_raises(self):
        request = self._make_request()
        with self.assertRaisesMessage(KeyError, "Unknown UI variant page: missing"):
            resolve_template(request, "missing")


@override_settings(DJANGO_VITE=HERMETIC_DJANGO_VITE)
class UIVariantViewTests(TestCase):
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
    def test_revamp_when_allowlisted(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.context)
        self.assertEqual(response.context["UI_VARIANT"], "revamp")
        self.assertIn(b"index-revamp", response.content)

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_legacy_when_not_allowlisted(self):
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
        self.assertIn(b"ui: { variant:", response.content)
        self.assertIn(b'"legacy"', response.content)

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_staff_preview_param_returns_revamp(self):
        self.client.login(username="staffuser", password="testpass")
        response = self.client.get("/?ui=revamp")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.context)
        self.assertEqual(response.context["UI_VARIANT"], "revamp")

    @override_settings(UI_VARIANT_REVAMP_PAGES=[])
    def test_non_staff_preview_param_returns_legacy_indistinguishable(self):
        self.client.login(username="regularuser", password="testpass")
        response = self.client.get("/?ui=revamp")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.context)
        self.assertEqual(response.context["UI_VARIANT"], "legacy")

    @override_settings(UI_VARIANT_REVAMP_PAGES=["home"])
    def test_revamp_when_allowlisted_logged_in(self):
        self.client.login(username="regularuser", password="testpass")
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["UI_VARIANT"], "revamp")
