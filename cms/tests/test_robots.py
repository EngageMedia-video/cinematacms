from django.conf import settings
from django.contrib.sites.models import Site
from django.test import TestCase


class RobotsTxtTests(TestCase):
    def setUp(self):
        Site.objects.update_or_create(pk=settings.SITE_ID, defaults={"domain": "cinemata.test", "name": "Cinemata"})
        Site.objects.clear_cache()
        self.addCleanup(Site.objects.clear_cache)

    def test_robots_txt_allows_crawling_and_points_at_the_sitemap(self):
        response = self.client.get("/robots.txt")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain; charset=utf-8")
        self.assertEqual(response.content, b"User-agent: *\nDisallow:\n\nSitemap: http://cinemata.test/sitemap.xml\n")
