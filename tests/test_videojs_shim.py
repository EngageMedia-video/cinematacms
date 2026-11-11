"""The import map gives the video.js shim a new URL whenever the shim changes (#857).

The shim is not built by Vite, so its filename never changes, and the CDN caches
static files for up to 31 days by URL. A fixed URL kept serving an old shim after
a deploy, and the hero player crashed on pages that skip the eager video.js script.
"""

import re
import tempfile
from pathlib import Path

from django.conf import settings
from django.test import TestCase, override_settings

from files.templatetags import custom_tags

SHIM_PATH = "lib/videojs-esm-shim.js"
IMPORT_MAP_VIDEOJS_RE = re.compile(r'"video\.js":\s*"([^"]+)"')


class VideoJsShimUrlTests(TestCase):
    def setUp(self):
        self.addCleanup(custom_tags._static_file_version.cache_clear)

    def _shim_url_when_origin_serves(self, shim_body):
        with tempfile.TemporaryDirectory() as static_dir:
            shim = Path(static_dir, SHIM_PATH)
            shim.parent.mkdir(parents=True)
            shim.write_text(shim_body)
            with override_settings(STATICFILES_DIRS=[static_dir, *settings.STATICFILES_DIRS]):
                # A deploy restarts the workers, which drops the per-process version cache.
                custom_tags._static_file_version.cache_clear()
                html = self.client.get("/").content.decode()
        return IMPORT_MAP_VIDEOJS_RE.search(html).group(1)

    def test_shim_url_changes_only_when_the_shim_content_changes(self):
        passive_shim = "export default window.videojs;\n"
        self_loading_shim = "export default await loadVideoJs();\n"

        old_url = self._shim_url_when_origin_serves(passive_shim)
        old_url_after_restart = self._shim_url_when_origin_serves(passive_shim)
        new_url = self._shim_url_when_origin_serves(self_loading_shim)

        self.assertTrue(old_url.startswith("/static/lib/videojs-esm-shim.js"), old_url)
        self.assertEqual(old_url, old_url_after_restart, "an unchanged shim must keep its cached URL")
        self.assertNotEqual(old_url, new_url, "a changed shim must get a URL the CDN has not cached")
