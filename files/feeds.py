from django.conf import settings
from django.contrib.postgres.search import SearchQuery
from django.contrib.syndication.views import Feed
from django.db.models import Q
from django.urls import reverse
from django.utils.feedgenerator import Rss201rev2Feed

from . import helpers, lists
from .models import CommunityImpact, Language, Media
from .stop_words import STOP_WORDS


def _getlist(params, *keys):
    values = []
    for key in keys:
        values.extend(value.strip() for value in params.getlist(key) if value.strip())
    return values


def _resolve_language_codes(values):
    if not values:
        return []

    languages = Language.objects.exclude(code__in=["automatic", "automatic-translation"]).values_list("code", "title")
    valid_codes = set()
    code_by_title = {}
    for code, title in languages:
        valid_codes.add(code)
        code_by_title[title] = code

    return [
        value if value in valid_codes else code_by_title[value]
        for value in values
        if value in valid_codes or value in code_by_title
    ]


def _resolve_country_codes(values):
    country_by_title = {title: code for code, title in lists.video_countries}
    return [country_by_title[value] for value in values if value in country_by_title]


class MediaRSSFeed(Rss201rev2Feed):
    def rss_attributes(self):
        attrs = super(MediaRSSFeed, self).rss_attributes()
        attrs["xmlns:media"] = "http://search.yahoo.com/mrss/"
        attrs["xmlns:atom"] = "http://www.w3.org/2005/Atom"
        return attrs

    def add_item_elements(self, handler, item):
        """Callback to add elements to each item (item/entry) element."""
        super(MediaRSSFeed, self).add_item_elements(handler, item)

        if "media:title" in item:
            handler.addQuickElement("media:title", item["title"])
        if "media:description" in item:
            handler.addQuickElement("media:description", item["description"])

        if "content_url" in item:
            content = {"url": item["content_url"]}
            if "content_width" in item:
                content["width"] = str(item["content_width"])
            if "content_height" in item:
                content["height"] = str(item["content_height"])
            handler.addQuickElement("media:content", "", content)

        if "thumbnail_url" in item:
            thumbnail = {"url": item["thumbnail_url"]}
            if "thumbnail_width" in item:
                thumbnail["width"] = str(item["thumbnail_width"])
            if "thumbnail_height" in item:
                thumbnail["height"] = str(item["thumbnail_height"])
            handler.addQuickElement("media:thumbnail", "", thumbnail)

        if "keywords" in item:
            handler.addQuickElement("media:keywords", item["keywords"])

    def add_root_elements(self, handler):
        super().add_root_elements(handler)
        if self.feed["author_name"] is not None:
            handler.startElement("author", {})
            handler.addQuickElement("name", self.feed["author_name"])
            handler.endElement("author")
        if self.feed.get("published") is not None:
            handler.startElement("published", {})
            handler.addQuickElement("name", self.feed["published"])
            handler.endElement("published")


class IndexRSSFeed(Feed):
    feed_type = MediaRSSFeed
    title = "Latest Media"
    link = "/rss"
    description = "Latest Media RSS feed"

    def items(self):
        basic_query = Q(state="public", is_reviewed=True, encoding_status="success")
        media = Media.objects.filter(basic_query).order_by("-add_date")
        media = media.prefetch_related("user")
        return media[:20]

    def item_title(self, item):
        return item.title

    def item_description(self, item):
        return item.summary

    def item_author_name(self, item):
        return item.user.username

    def item_pubdate(self, item):
        return item.add_date

    def item_updateddate(self, item):
        return item.edit_date

    def item_link(self, item):
        return reverse("get_media") + f"?m={item.friendly_token}"

    def item_extra_kwargs(self, item):
        item = {
            "media:title": item.title,
            "media:description": item.summary,
            "content_width": 720,
            "thumbnail_url": f"{settings.SSL_FRONTEND_HOST}/{item.poster_url}",
            "content_url": f"{settings.SSL_FRONTEND_HOST}/{item.get_absolute_url()}",
            "thumbnail_width": 720,
        }
        return item


class SearchRSSFeed(Feed):
    feed_type = MediaRSSFeed
    description = "Latest Media RSS feed"

    def link(self, obj):
        return "/rss/search"

    def get_object(self, request):
        category = _getlist(request.GET, "category", "c")
        topic = _getlist(request.GET, "topic")
        language = _getlist(request.GET, "language")
        country = _getlist(request.GET, "country")
        tag = _getlist(request.GET, "tag", "t")
        query = request.GET.get("q", "")
        subtitle_language = _getlist(request.GET, "subtitle_language")
        length = request.GET.get("length", "")
        award = request.GET.get("award", "")
        community_impact = _getlist(request.GET, "community_impact")

        basic_query = Q(state="public", is_reviewed=True)
        media = Media.objects.filter(basic_query)

        if category:
            media = media.filter(category__title__in=category).distinct()
        if tag:
            media = media.filter(tags__title__in=tag).distinct()
        if topic:
            media = media.filter(topics__title__in=topic).distinct()
        if language:
            language_codes = _resolve_language_codes(language)
            if language_codes:
                media = media.filter(media_language__in=language_codes)
        if country:
            country_codes = _resolve_country_codes(country)
            if country_codes:
                media = media.filter(media_country__in=country_codes)
        if query:
            query = helpers.clean_query(query)
            q_parts = [q_part.strip("y") for q_part in query.split() if q_part not in STOP_WORDS]
            if q_parts:
                query = SearchQuery(q_parts[0] + ":*", search_type="raw")
                for part in q_parts[1:]:
                    query &= SearchQuery(part + ":*", search_type="raw")
            else:
                query = None
        if query:
            media = media.filter(search=query)

        if subtitle_language:
            media = media.filter(subtitles__language__code__in=subtitle_language).distinct()

        if length == "less_than_10":
            media = media.filter(duration__lt=600)
        elif length == "more_than_10":
            media = media.filter(duration__gte=600)

        if award == "yes":
            media = media.filter(
                community_impacts__status=CommunityImpact.APPROVED,
                community_impacts__category__in=[
                    CommunityImpact.SCREENING,
                    CommunityImpact.FEATURED,
                ],
            ).distinct()

        if community_impact:
            community_impact_options = {
                CommunityImpact.SCREENING,
                CommunityImpact.FEATURED,
                CommunityImpact.SAVES,
                CommunityImpact.ACADEMIC,
            }
            community_impact_values = [value for value in community_impact if value in community_impact_options]
            if community_impact_values:
                media = media.filter(
                    community_impacts__status=CommunityImpact.APPROVED,
                    community_impacts__category__in=community_impact_values,
                ).distinct()

        media = media.order_by("-add_date").prefetch_related("user")

        return media

    def items(self, objects):
        return objects[:20]

    def item_title(self, item):
        return item.title

    def item_description(self, item):
        return item.summary

    def item_author_name(self, item):
        return item.user.username

    def item_pubdate(self, item):
        return item.add_date

    def item_updateddate(self, item):
        return item.edit_date

    def item_link(self, item):
        return reverse("get_media") + f"?m={item.friendly_token}"

    def item_extra_kwargs(self, item):
        item = {
            "media:title": item.title,
            "media:description": item.summary,
            "content_width": 720,
            "thumbnail_url": f"{settings.SSL_FRONTEND_HOST}/{item.poster_url}",
            "content_url": f"{settings.SSL_FRONTEND_HOST}/{item.get_absolute_url()}",
            "thumbnail_width": 720,
        }
        return item
