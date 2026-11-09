from copy import deepcopy
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings
from django.urls import reverse
from waffle.models import Flag

from cms.ui_variant import PAGES_IN_ROLLOUT, PageRollout, resolve_template
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

    def test_unknown_page_key_raises(self):
        with self.assertRaisesMessage(KeyError, "Unknown UI variant page: missing"):
            resolve_template(self.factory.get("/"), "missing")


class PageRolloutTests(TestCase):
    PAGE_KEY = "sample_page"
    FLAG_NAME = "ui_v2_sample_page"
    V1_TEMPLATE = "cms/sample_v1.html"
    V2_TEMPLATE = "cms/sample_v2.html"

    def setUp(self):
        registry = patch.dict(
            PAGES_IN_ROLLOUT,
            {self.PAGE_KEY: PageRollout(old_template=self.V1_TEMPLATE, new_template=self.V2_TEMPLATE)},
        )
        registry.start()
        self.addCleanup(registry.stop)

        # Waffle clears its cache on commit, which never runs inside TestCase.
        cached_flag = Flag(name=self.FLAG_NAME)
        cached_flag.flush()
        self.addCleanup(cached_flag.flush)

        self.staff_user = User.objects.create_user(username="staffuser", password="testpass", is_staff=True)
        self.regular_user = User.objects.create_user(username="regularuser", password="testpass")

    def template_for(self, user):
        request = RequestFactory().get("/")
        request.user = user
        return resolve_template(request, self.PAGE_KEY)

    def test_page_serves_v1_before_the_flag_exists(self):
        for user in (AnonymousUser(), self.regular_user, self.staff_user):
            with self.subTest(user=user):
                self.assertEqual(self.template_for(user), self.V1_TEMPLATE)

    def test_admin_can_target_an_auto_created_flag_without_clearing_everyone(self):
        self.template_for(AnonymousUser())
        Flag.objects.filter(name=self.FLAG_NAME).update(staff=True)
        Flag(name=self.FLAG_NAME).flush()

        self.assertEqual(self.template_for(self.staff_user), self.V2_TEMPLATE)
        self.assertEqual(self.template_for(self.regular_user), self.V1_TEMPLATE)

    def test_superusers_preview_v2_once_the_flag_is_auto_created(self):
        superuser = User.objects.create_user(username="superuser", password="testpass", is_superuser=True)
        self.template_for(AnonymousUser())

        self.assertEqual(self.template_for(superuser), self.V2_TEMPLATE)
        self.assertEqual(self.template_for(self.regular_user), self.V1_TEMPLATE)

    def test_percentage_cookie_security_follows_the_session_cookie(self):
        self.assertEqual(settings.WAFFLE_SECURE, settings.SESSION_COOKIE_SECURE)

    def test_flag_on_for_everyone_serves_v2(self):
        Flag.objects.create(name=self.FLAG_NAME, everyone=True)
        for user in (AnonymousUser(), self.regular_user, self.staff_user):
            with self.subTest(user=user):
                self.assertEqual(self.template_for(user), self.V2_TEMPLATE)

    def test_staff_targeting_serves_v2_to_staff_only(self):
        Flag.objects.create(name=self.FLAG_NAME, everyone=None, staff=True)
        self.assertEqual(self.template_for(self.staff_user), self.V2_TEMPLATE)
        self.assertEqual(self.template_for(self.regular_user), self.V1_TEMPLATE)
        self.assertEqual(self.template_for(AnonymousUser()), self.V1_TEMPLATE)

    @override_settings(DJANGO_VITE=HERMETIC_DJANGO_VITE)
    def test_staff_targeting_selects_the_shell_a_real_view_renders(self):
        cached_flag = Flag(name="ui_v2_home")
        cached_flag.flush()
        self.addCleanup(cached_flag.flush)
        Flag.objects.create(name="ui_v2_home", everyone=None, staff=True)
        rollout = PageRollout(old_template="cms/history.html", new_template="cms/index_revamp.html")

        with patch.dict(PAGES_IN_ROLLOUT, {"home": rollout}):
            self.client.force_login(self.staff_user)
            staff_response = self.client.get("/")
            self.client.force_login(self.regular_user)
            regular_response = self.client.get("/")

        self.assertContains(staff_response, 'data-ui-variant="v2"')
        self.assertContains(regular_response, 'data-ui-variant="v1"')


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

    def test_v2_default(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-ui-variant="v2"')
        self.assertIn(b"index-revamp", response.content)

    def test_v2_page_has_data_ui_variant_attribute(self):
        response = self.client.get("/")
        self.assertIn(b'data-ui-variant="v2"', response.content)

    def test_staff_preview_param_returns_v2(self):
        self.client.login(username="staffuser", password="testpass")
        response = self.client.get("/?ui=revamp")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-ui-variant="v2"')

    def test_non_staff_preview_param_returns_v2(self):
        self.client.login(username="regularuser", password="testpass")
        response = self.client.get("/?ui=revamp")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-ui-variant="v2"')

    def test_v2_default_logged_in(self):
        self.client.login(username="regularuser", password="testpass")
        response = self.client.get("/")
        self.assertContains(response, 'data-ui-variant="v2"')

    def test_upload_uses_v2(self):
        self.client.login(username="regularuser", password="testpass")
        response = self.client.get("/upload")
        self.assertEqual(response.status_code, 200)
        self.assertContains(response, 'data-ui-variant="v2"')
        self.assertIn(b'id="app-root"', response.content)
        self.assertIn(b"src/entries/add-media.js", response.content)

    def test_media_and_edit_use_v2_despite_retired_configuration(self):
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

    def test_unmigrated_page_declares_the_v1_shell(self):
        self.client.login(username="regularuser", password="testpass")
        response = self.client.get("/history")
        self.assertTemplateUsed(response, "base.html")
        self.assertContains(response, 'data-ui-variant="v1"')
        self.assertNotContains(response, 'id="app-root"')

    def test_modern_page_without_a_variant_lookup_declares_the_v2_shell(self):
        self.client.login(username="regularuser", password="testpass")
        with patch("cms.creator_analytics.umami_get"):
            response = self.client.get("/analytics?days=7")
        self.assertTemplateUsed(response, "cms/creator_analytics.html")
        self.assertContains(response, 'data-ui-variant="v2"')
        self.assertContains(response, 'id="app-root"')
