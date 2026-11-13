"""Sitemaps for the pages an anonymous visitor can find in public listings."""

from urllib.parse import urlsplit

from django.conf import settings
from django.contrib.sitemaps import Sitemap
from django.contrib.sitemaps import views as sitemap_views
from django.contrib.sites.shortcuts import get_current_site
from django.db.models import Exists, Max, OuterRef
from django.urls import reverse

from .models import Category, Media, Page, Playlist


def portal_scheme():
    # A proxy that terminates TLS can forward the request over plain HTTP.
    return urlsplit(settings.FRONTEND_HOST).scheme


def index_url(request):
    """Return the absolute URL of the sitemap index, built like the URLs inside it."""
    return f"{portal_scheme()}://{get_current_site(request).domain}{reverse('sitemap_index')}"


def listed_media():
    return Media.objects.filter(state="public", is_reviewed=True, encoding_status="success")


class PortalSitemap(Sitemap):
    @property
    def protocol(self):
        return portal_scheme()


class MediaSitemap(PortalSitemap):
    def items(self):
        return listed_media().order_by("id")

    def lastmod(self, item):
        return item.edit_date

    def get_latest_lastmod(self):
        # Django's default loads every listed film to find this one date.
        return listed_media().aggregate(latest=Max("edit_date"))["latest"]


class PlaylistSitemap(PortalSitemap):
    def items(self):
        holds_listed_media = Exists(listed_media().filter(playlistmedia__playlist=OuterRef("pk")))
        return Playlist.objects.filter(holds_listed_media).order_by("id")


class CategorySitemap(PortalSitemap):
    def items(self):
        holds_listed_media = Exists(listed_media().filter(category=OuterRef("pk")))
        return Category.objects.filter(holds_listed_media).order_by("id")


class PageSitemap(PortalSitemap):
    # A text page has no visibility setting: every page is public at its address.
    def items(self):
        return Page.objects.order_by("id")

    def lastmod(self, item):
        return item.edit_date


class StaticPageSitemap(PortalSitemap):
    """The site information pages and the hubs that lead to films."""

    def items(self):
        named = ("contact", "terms_of_service", "creative_commons", "categories", "topics", "countries", "languages")
        return ["/", *(reverse(name) for name in named)]

    def location(self, item):
        return item


SITEMAPS = {
    "media": MediaSitemap,
    "playlists": PlaylistSitemap,
    "categories": CategorySitemap,
    "pages": PageSitemap,
    "static": StaticPageSitemap,
}


def sitemap_index(request):
    return sitemap_views.index(request, sitemaps=SITEMAPS, sitemap_url_name="sitemap_section")


def sitemap_section(request, section):
    return sitemap_views.sitemap(request, sitemaps=SITEMAPS, section=section)
