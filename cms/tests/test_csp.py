import re
from copy import deepcopy
from pathlib import Path

from django.conf import settings
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.test import SimpleTestCase, override_settings
from django.urls import path


def nonce_page(request):
    return HttpResponse(render_to_string("root.html", request=request))


def cached_response(request):
    return HttpResponse("public content", headers={"Cache-Control": "public, max-age=60"})


urlpatterns = [path("nonce-page/", nonce_page), path("cached/", cached_response)]

_templates = deepcopy(settings.TEMPLATES)
_templates[0]["OPTIONS"]["context_processors"] = ["django.template.context_processors.request"]


@override_settings(ROOT_URLCONF=__name__, MIDDLEWARE=["csp.middleware.CSPMiddleware"], TEMPLATES=_templates)
class ContentSecurityPolicyTests(SimpleTestCase):
    def test_report_only_header_denies_unknown_sources(self):
        response = self.client.get("/nonce-page/")
        self.assertEqual(response.status_code, 200)
        self.assertNotIn("Content-Security-Policy", response)
        policy = response["Content-Security-Policy-Report-Only"]
        self.assertIn("default-src 'none'", policy)
        self.assertIn("object-src 'none'", policy)
        self.assertNotIn("'unsafe-inline'", policy)
        self.assertNotIn("'unsafe-eval'", policy)

    def test_inline_script_nonce_matches_header_and_changes_per_response(self):
        first = self.client.get("/nonce-page/")
        second = self.client.get("/nonce-page/")
        first_match = re.search(r'nonce="([^"]+)"', first.content.decode())
        second_match = re.search(r'nonce="([^"]+)"', second.content.decode())
        assert first_match is not None
        assert second_match is not None
        first_nonce = first_match.group(1)
        second_nonce = second_match.group(1)
        self.assertIn(f"'nonce-{first_nonce}'", first["Content-Security-Policy-Report-Only"])
        self.assertNotEqual(first_nonce, second_nonce)
        self.assertIn(f'property="csp-nonce" content="{first_nonce}"', first.content.decode())
        self.assertIn(f'content="{first_nonce}" nonce="{first_nonce}"', first.content.decode())
        self.assertIn("window.VIDEOJS_NO_DYNAMIC_STYLE = true", first.content.decode())
        for tag in re.findall(r"<(?:script|style)\b[^>]*>", first.content.decode()):
            if " src=" not in tag:
                self.assertIn(f'nonce="{first_nonce}"', tag)

    def test_nonce_responses_are_not_cacheable(self):
        with override_settings(MIDDLEWARE=["csp.middleware.CSPMiddleware", "cms.csp.NonceCacheControlMiddleware"]):
            response = self.client.get("/nonce-page/")
        self.assertIn("no-store", response["Cache-Control"])
        self.assertIn("private", response["Cache-Control"])

    def test_responses_without_a_nonce_keep_their_cache_policy(self):
        with override_settings(MIDDLEWARE=["csp.middleware.CSPMiddleware", "cms.csp.NonceCacheControlMiddleware"]):
            response = self.client.get("/cached/")
        self.assertEqual(response["Cache-Control"], "public, max-age=60")
        self.assertNotIn("nonce-", response["Content-Security-Policy-Report-Only"])

    def test_enforcement_uses_the_same_policy(self):
        with override_settings(
            CONTENT_SECURITY_POLICY=settings.CONTENT_SECURITY_POLICY_REPORT_ONLY,
            CONTENT_SECURITY_POLICY_REPORT_ONLY=None,
        ):
            response = self.client.get("/nonce-page/")
        self.assertIn("Content-Security-Policy", response)
        self.assertNotIn("Content-Security-Policy-Report-Only", response)
        self.assertIn("default-src 'none'", response["Content-Security-Policy"])

    def test_templates_authorize_inline_scripts_and_styles(self):
        for template in (Path(settings.BASE_DIR) / "templates").rglob("*.html"):
            source = re.sub(r"{#.*?#}", "", template.read_text(), flags=re.S)
            for tag in re.finditer(r"<(script|style)\b([^>]*?)>", source):
                if not re.search(r"\bsrc\s*=", tag.group(2)):
                    with self.subTest(template=str(template), tag=tag.group(0)):
                        self.assertIn('nonce="{{ request.csp_nonce }}"', tag.group(2))
            with self.subTest(template=str(template)):
                self.assertEqual(re.findall(r'\s+on(?:click|load|error|change|submit)\s*=["\']', source), [])

    def test_contact_captcha_has_no_inline_callback(self):
        from django.contrib.auth.models import AnonymousUser

        from files.forms import ContactForm

        with override_settings(RECAPTCHA_PUBLIC_KEY="test-public-key", RECAPTCHA_PRIVATE_KEY="test-private-key"):
            form = ContactForm(AnonymousUser())
            html = str(form["captcha"])
        self.assertIn('src="/static/js/recaptcha-callback.js"', html)
        self.assertIn('data-callback="cmsRecaptchaVerified"', html)
        self.assertNotRegex(html, r"<script(?![^>]*\bsrc=)")

    def test_embed_can_be_framed_without_removing_other_protections(self):
        with override_settings(ROOT_URLCONF="cms.urls"):
            response = self.client.get("/embed")
        self.assertNotIn("frame-ancestors", response["Content-Security-Policy-Report-Only"])
        self.assertIn("object-src 'none'", response["Content-Security-Policy-Report-Only"])

    def test_configured_asset_origins_and_vite_are_scoped(self):
        from cms.csp import build_policy

        policy = build_policy(
            static_url="https://static.example.test/assets/",
            media_url="https://media.example.test/media/",
            upload_url="https://upload.example.test",
            vite={"dev_mode": True, "dev_server_host": "127.0.0.1", "dev_server_port": 5174},
        )["DIRECTIVES"]
        self.assertIn("https://static.example.test", policy["script-src"])
        self.assertNotIn("https://media.example.test", policy["script-src"])
        self.assertIn("https://media.example.test", policy["media-src"])
        self.assertIn("https://upload.example.test", policy["connect-src"])
        self.assertNotIn("https://upload.example.test", policy["script-src"])
        self.assertIn("ws://127.0.0.1:5174", policy["connect-src"])
        production = build_policy(
            static_url="/static/", media_url="/media/", upload_url="https://upload.example.test", vite={}
        )
        self.assertNotIn("http://localhost:5173", production["DIRECTIVES"]["script-src"])

    def test_policy_has_no_deployment_specific_sources(self):
        from cms.csp import build_policy

        policy = build_policy(static_url="/static/", media_url="/media/", upload_url="/upload", vite={})
        self.assertNotIn("cinemata.org", str(policy))
        self.assertNotIn("engagemedia.org", str(policy))
        self.assertNotIn("report-uri", policy["DIRECTIVES"])

    def test_optional_analytics_and_extra_sources_are_scoped(self):
        from cms.csp import build_policy

        policy = build_policy(
            static_url="/static/",
            media_url="/media/",
            upload_url="/upload",
            vite={},
            analytics_url="https://analytics.example.test/umami",
            extra_sources={"img-src": ["https://images.example.test"]},
            report_uri="https://reports.example.test/csp",
        )["DIRECTIVES"]
        self.assertIn("https://analytics.example.test/umami/script.js", policy["script-src"])
        self.assertIn("https://analytics.example.test", policy["connect-src"])
        self.assertNotIn("https://analytics.example.test", policy["img-src"])
        self.assertIn("https://images.example.test", policy["img-src"])
        self.assertNotIn("https://images.example.test", policy["script-src"])
        self.assertEqual(policy["report-uri"], ["https://reports.example.test/csp"])

    def test_invalid_analytics_url_does_not_grant_a_source(self):
        from cms.csp import build_policy

        for url in ("https://private:secret@analytics.example.test", "http://analytics.example.test"):
            with self.subTest(url=url):
                policy = build_policy(
                    static_url="/static/", media_url="/media/", upload_url="/upload", vite={}, analytics_url=url
                )
                self.assertNotIn("analytics.example.test", str(policy))
                self.assertNotIn("secret", str(policy))
