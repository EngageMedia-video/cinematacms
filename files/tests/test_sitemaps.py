"""The sitemap lists only what an anonymous visitor can find in public listings (#870)."""

from datetime import datetime, timezone
from xml.etree import ElementTree

from django.conf import settings
from django.contrib.sites.models import Site
from django.test import TestCase

from files.models import Category, Media, Playlist, PlaylistMedia
from files.tests.helpers import create_test_media, create_test_user

SITEMAP_NS = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def _texts(response, path):
    # The parsed XML is this application's own test response, not untrusted input.
    root = ElementTree.fromstring(response.content)  # noqa: S314
    return [element.text for element in root.findall(path, SITEMAP_NS)]


def _locations(response):
    return _texts(response, "sm:url/sm:loc")


def _lastmods(response):
    return _texts(response, "sm:url/sm:lastmod")


class SitemapTestCase(TestCase):
    def setUp(self):
        Site.objects.update_or_create(pk=settings.SITE_ID, defaults={"domain": "cinemata.test", "name": "Cinemata"})
        Site.objects.clear_cache()
        self.addCleanup(Site.objects.clear_cache)
        self.owner = create_test_user()


class MediaSitemapTests(SitemapTestCase):
    def test_lists_only_media_that_appears_in_public_listings(self):
        listed = create_test_media(self.owner, state="public")
        create_test_media(self.owner, state="private")
        create_test_media(self.owner, state="unlisted")
        create_test_media(self.owner, state="restricted")
        create_test_media(self.owner, state="public", is_reviewed=False)
        create_test_media(self.owner, state="public", encoding_status="fail")

        response = self.client.get("/sitemap-media.xml")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/xml")
        self.assertEqual(_locations(response), [f"http://cinemata.test/view?m={listed.friendly_token}"])

    def test_reports_when_the_film_page_last_changed(self):
        media = create_test_media(self.owner, state="public")
        Media.objects.filter(pk=media.pk).update(edit_date=datetime(2026, 1, 15, 9, 30, tzinfo=timezone.utc))

        response = self.client.get("/sitemap-media.xml")

        self.assertEqual(_lastmods(response), ["2026-01-15"])


class PlaylistSitemapTests(SitemapTestCase):
    def _playlist(self, *media):
        playlist = Playlist.objects.create(title="Archive", user=self.owner)
        for ordering, item in enumerate(media, start=1):
            PlaylistMedia.objects.create(playlist=playlist, media=item, ordering=ordering)
        return playlist

    def test_lists_only_playlists_that_hold_a_publicly_listed_film(self):
        listed = self._playlist(
            create_test_media(self.owner, state="private"),
            create_test_media(self.owner, state="public"),
        )
        self._playlist()
        self._playlist(create_test_media(self.owner, state="private"))
        self._playlist(create_test_media(self.owner, state="unlisted"))
        self._playlist(create_test_media(self.owner, state="restricted"))
        self._playlist(create_test_media(self.owner, state="public", is_reviewed=False))

        response = self.client.get("/sitemap-playlists.xml")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(_locations(response), [f"http://cinemata.test/playlists/{listed.friendly_token}"])


class CategorySitemapTests(SitemapTestCase):
    def test_lists_only_categories_that_hold_a_publicly_listed_film(self):
        documentary = Category.objects.create(title="Documentary")
        hidden = Category.objects.create(title="Experimental")
        Category.objects.create(title="Music")
        create_test_media(self.owner, state="public").category.add(documentary)
        for state in ("private", "unlisted", "restricted"):
            create_test_media(self.owner, state=state).category.add(hidden)
        create_test_media(self.owner, state="public", is_reviewed=False).category.add(hidden)

        response = self.client.get("/sitemap-categories.xml")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(_locations(response), ["http://cinemata.test/search?c=Documentary"])

    def test_links_a_category_whose_title_needs_escaping_to_its_working_page(self):
        arts = Category.objects.create(title="Arts & Culture")
        create_test_media(self.owner, state="public").category.add(arts)

        response = self.client.get("/sitemap-categories.xml")

        self.assertEqual(_locations(response), ["http://cinemata.test/search?c=Arts%20%26%20Culture"])


class SitemapIndexTests(SitemapTestCase):
    def test_points_crawlers_at_each_section_sitemap(self):
        response = self.client.get("/sitemap.xml")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "application/xml")
        self.assertEqual(
            _texts(response, "sm:sitemap/sm:loc"),
            [
                "http://cinemata.test/sitemap-media.xml",
                "http://cinemata.test/sitemap-playlists.xml",
                "http://cinemata.test/sitemap-categories.xml",
            ],
        )

    def test_reports_the_latest_film_change_as_the_media_sitemap_lastmod(self):
        older = create_test_media(self.owner, state="public")
        newer = create_test_media(self.owner, state="public")
        hidden = create_test_media(self.owner, state="private")
        Media.objects.filter(pk=older.pk).update(edit_date=datetime(2026, 1, 15, 9, 30, tzinfo=timezone.utc))
        Media.objects.filter(pk=newer.pk).update(edit_date=datetime(2026, 2, 1, 8, 0, tzinfo=timezone.utc))
        Media.objects.filter(pk=hidden.pk).update(edit_date=datetime(2026, 2, 20, 8, 0, tzinfo=timezone.utc))

        response = self.client.get("/sitemap.xml")

        self.assertEqual(_texts(response, "sm:sitemap/sm:lastmod"), ["2026-02-01T08:00:00+00:00"])
