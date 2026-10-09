from copy import deepcopy

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings
from django.urls import reverse

from cms.ui_variant import resolve_template, ui_variant_context_processor
from files.tests.helpers import create_test_media

User = get_user_model()
HERMETIC_DJANGO_VITE = deepcopy(settings.DJANGO_VITE)
HERMETIC_DJANGO_VITE["default"]["dev_mode"] = True


class ResolveTemplateTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    @override_settings(UI_VARIANT_ALLOWED=["legacy"], UI_VARIANT_DEFAULT="legacy", UI_VARIANT_REVAMP_PAGES=[])
    def test_retired_legacy_configuration_cannot_restore_old_pages(self):
        for page, template in {
            "home": "cms/index_revamp.html",
            "media": "cms/media_revamp.html",
            "upload": "cms/add-media_revamp.html",
            "edit_media": "cms/edit_media_revamp.html",
            "profile": "cms/user_revamp.html",
        }.items():
            for user in (None, AnonymousUser(), User(is_staff=False), User(is_staff=True)):
                with self.subTest(page=page, user=user):
                    request = self.factory.get("/?ui=legacy")
                    if user is not None:
                        request.user = user
                    self.assertEqual(resolve_template(request, page), template)
                    self.assertEqual(request.ui_variant, "revamp")

    def test_unknown_page_key_raises(self):
        with self.assertRaisesMessage(KeyError, "Unknown UI variant page: missing"):
            resolve_template(self.factory.get("/"), "missing")

    def test_context_processor_exposes_variant(self):
        request = self.factory.get("/")
        resolve_template(request, "home")
        self.assertEqual(ui_variant_context_processor(request), {"UI_VARIANT": "revamp"})

    def test_context_processor_defaults_to_revamp(self):
        self.assertEqual(ui_variant_context_processor(self.factory.get("/")), {"UI_VARIANT": "revamp"})


@override_settings(
    DJANGO_VITE=HERMETIC_DJANGO_VITE,
    UI_VARIANT_ALLOWED=["legacy"],
    UI_VARIANT_DEFAULT="legacy",
    UI_VARIANT_REVAMP_PAGES=[],
)
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

    def test_revamp_default(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.context)
        self.assertEqual(response.context["UI_VARIANT"], "revamp")
        self.assertIn(b"index-revamp", response.content)

    def test_revamp_page_has_data_ui_variant_attribute(self):
        response = self.client.get("/")
        self.assertIn(b'data-ui-variant="revamp"', response.content)

    def test_bootstrap_contains_default_revamp_ui_variant(self):
        response = self.client.get("/")
        self.assertIn(b"ui: { variant:", response.content)
        self.assertIn(b'"revamp"', response.content)

    def test_staff_preview_param_returns_revamp(self):
        self.client.login(username="staffuser", password="testpass")
        response = self.client.get("/?ui=revamp")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.context)
        self.assertEqual(response.context["UI_VARIANT"], "revamp")

    def test_non_staff_preview_param_returns_revamp(self):
        self.client.login(username="regularuser", password="testpass")
        response = self.client.get("/?ui=revamp")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.context)
        self.assertEqual(response.context["UI_VARIANT"], "revamp")

    def test_revamp_default_logged_in(self):
        self.client.login(username="regularuser", password="testpass")
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.context["UI_VARIANT"], "revamp")

    def test_upload_uses_revamp(self):
        self.client.login(username="regularuser", password="testpass")
        response = self.client.get("/upload")
        self.assertEqual(response.status_code, 200)
        self.assertIsNotNone(response.context)
        self.assertEqual(response.context["UI_VARIANT"], "revamp")
        self.assertIn(b'id="app-root"', response.content)
        self.assertIn(b"src/entries/add-media.js", response.content)

    def test_media_and_edit_use_revamp_despite_retired_configuration(self):
        media = create_test_media(self.regular_user)
        response = self.client.get(f"/view?m={media.friendly_token}&ui=legacy")
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "cms/media_revamp.html")
        self.assertContains(response, 'id="app-root"')
        self.assertContains(response, "src/entries/media-revamp.js")

        self.client.force_login(self.regular_user)
        response = self.client.get(f"/edit?m={media.friendly_token}&ui=legacy")
        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "cms/edit_media_revamp.html")
        self.assertContains(response, 'id="edit-media-page-config"')
        self.assertContains(response, "src/entries/edit-media.js")

    def test_upload_anonymous_redirects_to_login(self):
        response = self.client.get("/upload")
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response["Location"], f"{reverse('account_login')}?next=%2Fupload")
