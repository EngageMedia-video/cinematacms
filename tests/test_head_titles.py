"""Regression tests for the ``headtitle`` block convention.

``templates/root.html`` renders the whole ``<title>`` from the ``headtitle``
block, so an overriding template replaces the title outright rather than
extending it. Templates used to compensate in two broken ways: the
django-allauth ones prepended a pipe (``| Sign In``) as if the base emitted the
portal name first, and ``templates/404.html`` overrode ``headermeta`` to emit a
second ``<title>``.

Overriding templates now append ``{{ block.super }}``, which resolves to the
portal name defined in ``root.html``, so the suffix lives in exactly one place.
"""

import re
from pathlib import Path

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.template.loader import render_to_string
from django.test import RequestFactory, SimpleTestCase

TEMPLATE_ROOT = Path(settings.BASE_DIR) / "templates"
TITLE_TAG_RE = re.compile(r"<title>(.*?)</title>", re.DOTALL)
HEADTITLE_BLOCK_RE = re.compile(r"\{%\s*block headtitle\s*%\}(.*?)\{%\s*endblock headtitle\s*%\}", re.DOTALL)
PORTAL_NAME = "Test Portal"

# ``root.html`` owns the ``<title>`` for every template that extends it.
# ``503.html`` is served by the web server without Django and carries its own
# complete document, so it holds the only other legitimate ``<title>``.
TEMPLATES_OWNING_A_TITLE_TAG = {"root.html", "503.html"}

# ``cms/edit_media.html`` reverses an upload URL from a media object in its
# body, so it cannot render from a bare context. Its ``headtitle`` block is
# still covered by the source-level test below.
TEMPLATES_NEEDING_VIEW_CONTEXT = {"cms/edit_media.html"}


def _template_names():
    for path in sorted(TEMPLATE_ROOT.rglob("*.html")):
        yield path.relative_to(TEMPLATE_ROOT).as_posix(), path


def _overriding_templates():
    for name, path in _template_names():
        if name == "root.html":
            continue
        match = HEADTITLE_BLOCK_RE.search(path.read_text())
        if match:
            yield name, match.group(1)


class HeadTitleSourceTests(SimpleTestCase):
    """Source-level checks that cover every template, renderable or not."""

    def test_overrides_append_the_inherited_portal_name(self):
        overrides = dict(_overriding_templates())
        self.assertTrue(overrides, "no templates override headtitle")

        for name, body in overrides.items():
            with self.subTest(template=name):
                body = " ".join(body.split())
                self.assertFalse(
                    body.startswith("|"),
                    f"{name} prepends a pipe instead of naming the page: {body!r}",
                )
                self.assertNotIn(
                    "PORTAL_NAME",
                    body,
                    f"{name} repeats PORTAL_NAME; use {{{{ block.super }}}}: {body!r}",
                )
                self.assertTrue(
                    body.endswith("{{ block.super }}"),
                    f"{name} does not end with block.super: {body!r}",
                )
                self.assertNotEqual(
                    body,
                    "{{ block.super }}",
                    f"{name} overrides headtitle without naming a page",
                )

    def test_only_the_base_templates_declare_a_title_tag(self):
        offenders = [
            name
            for name, path in _template_names()
            if name not in TEMPLATES_OWNING_A_TITLE_TAG and TITLE_TAG_RE.search(path.read_text())
        ]
        self.assertEqual(
            offenders,
            [],
            f"these templates emit their own <title>, duplicating root.html's: {offenders}",
        )


class HeadTitleRenderTests(SimpleTestCase):
    """Rendered-output checks for every template that renders context-free."""

    def setUp(self):
        request = RequestFactory().get("/")
        request.user = AnonymousUser()
        self.context = {"PORTAL_NAME": PORTAL_NAME, "request": request}

    def _render_titles(self, template_name):
        html = render_to_string(template_name, self.context)
        return [" ".join(t.split()) for t in TITLE_TAG_RE.findall(html)]

    def test_each_page_renders_one_title_ending_in_the_portal_name(self):
        for name, block in _overriding_templates():
            if name in TEMPLATES_NEEDING_VIEW_CONTEXT:
                continue
            # Profile and playlist titles name the page only when the object is
            # in context; from a bare context they correctly fall back to the
            # portal name alone.
            names_a_page = "{% if" not in block
            with self.subTest(template=name):
                titles = self._render_titles(name)
                self.assertEqual(len(titles), 1, f"{name} rendered {len(titles)} <title> tags: {titles}")
                title = titles[0]
                self.assertFalse(title.startswith("|"), f"{name} title starts with a pipe: {title!r}")
                self.assertTrue(
                    title.endswith(PORTAL_NAME),
                    f"{name} title does not end with the portal name: {title!r}",
                )
                if names_a_page:
                    self.assertNotEqual(title, PORTAL_NAME, f"{name} title names no page: {title!r}")

    def test_exempt_templates_are_still_exempt(self):
        """Fail if an exempt template becomes renderable, or a new one is added."""
        still_failing = set()
        for name in TEMPLATES_NEEDING_VIEW_CONTEXT:
            try:
                self._render_titles(name)
            except Exception:
                still_failing.add(name)
        self.assertEqual(
            still_failing,
            TEMPLATES_NEEDING_VIEW_CONTEXT,
            "TEMPLATES_NEEDING_VIEW_CONTEXT is stale; drop any template that now renders from a bare context",
        )

    def test_root_template_defaults_to_the_portal_name(self):
        self.assertEqual(self._render_titles("root.html"), [PORTAL_NAME])
