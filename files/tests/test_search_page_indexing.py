"""Category pages name a canonical URL and other search pages stay out of the index (#870)."""

from html.parser import HTMLParser

from django.test import TestCase, override_settings

from files.models import Category

CRAWLER_META_NAMES = {"robots", "googlebot", "bingbot", "slurp", "yandexbot", "baiduspider"}


class _CrawlerDirectives(HTMLParser):
    def __init__(self):
        super().__init__()
        self.directives = {}

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if tag == "meta" and attributes.get("name") in CRAWLER_META_NAMES:
            self.directives[attributes["name"]] = attributes.get("content")


def _crawler_directives(response):
    parser = _CrawlerDirectives()
    parser.feed(response.content.decode())
    return parser.directives


@override_settings(FRONTEND_HOST="http://cinemata.test")
class SearchPageIndexingTests(TestCase):
    def setUp(self):
        Category.objects.create(title="Arts & Culture")

    def test_category_page_names_its_canonical_url_for_either_parameter_name(self):
        for parameter in ("c", "category"):
            with self.subTest(parameter=parameter):
                response = self.client.get("/search", {parameter: "Arts & Culture"})

                self.assertContains(
                    response,
                    '<link rel="canonical" href="http://cinemata.test/search?c=Arts%20%26%20Culture">',
                    html=True,
                )

    def test_search_result_pages_ask_crawlers_not_to_index_them(self):
        for query in (
            {},
            {"q": "forest"},
            {"c": "Unknown"},
            {"c": "Arts & Culture", "q": "forest"},
            {"c": "Arts & Culture", "page": "2"},
            {"c": ["Arts & Culture", "Film"]},
        ):
            with self.subTest(query=query):
                response = self.client.get("/search", query)

                self.assertEqual(_crawler_directives(response), {"robots": "noindex, follow"})

    def test_category_page_stays_indexable(self):
        response = self.client.get("/search", {"c": "Arts & Culture"})

        self.assertEqual(_crawler_directives(response)["robots"], "index, follow")
