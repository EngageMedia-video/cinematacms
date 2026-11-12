"""Sitemaps for the pages an anonymous visitor can find in public listings."""

from django.contrib.sitemaps import Sitemap
from django.contrib.sitemaps import views as sitemap_views
from django.db.models import Exists, Max, OuterRef

from .models import Category, Media, Playlist


def listed_media():
    return Media.objects.filter(state="public", is_reviewed=True, encoding_status="success")


class MediaSitemap(Sitemap):
    def items(self):
        return listed_media().order_by("id")

    def lastmod(self, item):
        return item.edit_date

    def get_latest_lastmod(self):
        # Django's default loads every listed film to find this one date.
        return listed_media().aggregate(latest=Max("edit_date"))["latest"]


class PlaylistSitemap(Sitemap):
    def items(self):
        holds_listed_media = Exists(listed_media().filter(playlistmedia__playlist=OuterRef("pk")))
        return Playlist.objects.filter(holds_listed_media).order_by("id")


class CategorySitemap(Sitemap):
    def items(self):
        holds_listed_media = Exists(listed_media().filter(category=OuterRef("pk")))
        return Category.objects.filter(holds_listed_media).order_by("id")


SITEMAPS = {
    "media": MediaSitemap,
    "playlists": PlaylistSitemap,
    "categories": CategorySitemap,
}


def sitemap_index(request):
    return sitemap_views.index(request, sitemaps=SITEMAPS, sitemap_url_name="sitemap_section")


def sitemap_section(request, section):
    return sitemap_views.sitemap(request, sitemaps=SITEMAPS, section=section)
