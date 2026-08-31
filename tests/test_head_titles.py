"""Regression tests for the ``headtitle`` block convention.

``templates/root.html`` renders ``<title>{% block headtitle %}...{% endblock %}``,
so an overriding template owns the whole title. Templates inherited from
django-allauth used to prepend a pipe (``| Sign In``) as if the base template
emitted the portal name first, which produced titles such as ``| Sign In``.
"""

import re
from pathlib import Path

from django.conf import settings
from django.template.loader import render_to_string
from django.test import SimpleTestCase

TEMPLATE_ROOT = Path(settings.BASE_DIR) / "templates"
TITLE_RE = re.compile(r"<title>(.*?)</title>", re.DOTALL)
PORTAL_NAME = "Test Portal"

# Templates rendered through ``root.html`` that override ``headtitle`` and need
# no view context to render.
AUTH_TEMPLATE_DIRS = ("account", "mfa")


def _templates_with_headtitle():
    paths = []
    for directory in AUTH_TEMPLATE_DIRS:
        paths.extend((TEMPLATE_ROOT / directory).rglob("*.html"))
    paths.append(TEMPLATE_ROOT / "cms" / "user_edit.html")
    for path in sorted(paths):
        if "{% block headtitle %}" in path.read_text():
            yield path.relative_to(TEMPLATE_ROOT).as_posix()


class HeadTitleTests(SimpleTestCase):
    def _render_title(self, template_name):
        html = render_to_string(template_name, {"PORTAL_NAME": PORTAL_NAME})
        match = TITLE_RE.search(html)
        self.assertIsNotNone(match, f"{template_name} rendered no <title>")
        return " ".join(match.group(1).split())

    def test_titles_use_the_portal_name_suffix(self):
        template_names = list(_templates_with_headtitle())
        self.assertTrue(template_names, "no templates overriding headtitle were found")

        for template_name in template_names:
            with self.subTest(template=template_name):
                title = self._render_title(template_name)
                self.assertFalse(
                    title.startswith("|"),
                    f"{template_name} title starts with a pipe: {title!r}",
                )
                self.assertTrue(
                    title.endswith(f" - {PORTAL_NAME}"),
                    f"{template_name} title does not end with the portal name: {title!r}",
                )
                self.assertNotEqual(
                    title,
                    f" - {PORTAL_NAME}",
                    f"{template_name} title has no page name: {title!r}",
                )

    def test_root_template_defaults_to_the_portal_name(self):
        self.assertEqual(self._render_title("root.html"), PORTAL_NAME)
