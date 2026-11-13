from urllib.robotparser import RobotFileParser

from django.conf import settings
from django.contrib.sites.models import Site
from django.test import TestCase, override_settings


def _rules(response):
    parser = RobotFileParser()
    parser.parse(response.content.decode().splitlines())
    return parser


def _group(text, user_agent):
    """Return the lines of the robots.txt group that names user_agent."""
    lines = text.splitlines()
    start = lines.index(f"User-agent: {user_agent}") + 1
    end = lines.index("", start) if "" in lines[start:] else len(lines)
    return lines[start:end]


def _comment_text(text):
    return " ".join(line.lstrip("#").strip() for line in text.splitlines() if line.startswith("#"))


@override_settings(FRONTEND_HOST="http://cinemata.test")
class RobotsTxtTests(TestCase):
    def setUp(self):
        Site.objects.update_or_create(pk=settings.SITE_ID, defaults={"domain": "cinemata.test", "name": "Cinemata"})
        Site.objects.clear_cache()
        self.addCleanup(Site.objects.clear_cache)

    def test_robots_txt_allows_crawling_and_points_at_the_sitemap(self):
        response = self.client.get("/robots.txt")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain; charset=utf-8")
        rules = _rules(response)
        self.assertTrue(rules.can_fetch("Googlebot", "/view?m=a1b2c3"))
        self.assertEqual(rules.site_maps(), ["http://cinemata.test/sitemap.xml"])

    @override_settings(FRONTEND_HOST="https://cinemata.test")
    def test_points_at_the_sitemap_over_https_when_a_proxy_forwards_the_request_over_http(self):
        response = self.client.get("/robots.txt")

        self.assertEqual(_rules(response).site_maps(), ["https://cinemata.test/sitemap.xml"])

    def test_closes_video_and_subtitle_files_to_every_crawler(self):
        rules = _rules(self.client.get("/robots.txt"))
        film_files = [
            "/media/original/user/alice/0f3c.film.mp4",
            "/media/original/subtitles/user/alice/film.en.vtt",
            "/media/encoded/7/alice/0f3c.film.mp4",
            "/media/encoded/7/alice/0f3c.preview.gif",
            "/media/hls/0f3c/master.m3u8",
            "/media/videos/media/film.mp4",
            "/media/videos/encoded/film.mp4",
            "/media/videos/subtitles/film.vtt",
            "/media/other_media/recording.mp3",
        ]
        for crawler in ("Googlebot", "bingbot", "archive.org_bot"):
            for path in film_files:
                with self.subTest(crawler=crawler, path=path):
                    self.assertFalse(rules.can_fetch(crawler, path))

    def test_keeps_film_pages_and_posters_open_to_search_engines_and_archives(self):
        rules = _rules(self.client.get("/robots.txt"))
        pages = [
            "/",
            "/view?m=a1b2c3",
            "/media/original/thumbnails/user/alice/poster.jpg",
            "/media/original/categories/documentary.jpg",
        ]
        for crawler in ("Googlebot", "bingbot", "archive.org_bot"):
            for path in pages:
                with self.subTest(crawler=crawler, path=path):
                    self.assertTrue(rules.can_fetch(crawler, path))

    def test_blocks_ai_training_crawlers_from_the_whole_site(self):
        rules = _rules(self.client.get("/robots.txt"))
        training_crawlers = [
            "GPTBot",
            "ClaudeBot",
            "Google-Extended",
            "Applebot-Extended",
            "meta-externalagent",
            "CCBot",
            "Amazonbot",
            "Bytespider",
        ]
        for crawler in training_crawlers:
            for path in ("/", "/view?m=a1b2c3", "/sitemap.xml"):
                with self.subTest(crawler=crawler, path=path):
                    self.assertFalse(rules.can_fetch(crawler, path))

    def test_lets_search_crawlers_and_ai_answer_tools_read_film_pages(self):
        rules = _rules(self.client.get("/robots.txt"))
        readers = [
            "Googlebot",
            "bingbot",
            "Applebot",
            "archive.org_bot",
            "OAI-SearchBot",
            "ChatGPT-User",
            "Claude-SearchBot",
            "Claude-User",
            "PerplexityBot",
            "Perplexity-User",
            "Amzn-SearchBot",
            "meta-externalfetcher",
        ]
        for crawler in readers:
            with self.subTest(crawler=crawler):
                self.assertTrue(rules.can_fetch(crawler, "/view?m=a1b2c3"))

    def test_states_that_pages_may_be_used_for_search_and_ai_answers_but_not_ai_training(self):
        text = self.client.get("/robots.txt").content.decode()

        self.assertIn("Content-Signal: search=yes, ai-input=yes, ai-train=no", _group(text, "*"))
        self.assertIn(
            "ANY RESTRICTIONS EXPRESSED VIA CONTENT SIGNALS ARE EXPRESS RESERVATIONS OF RIGHTS UNDER ARTICLE 4 OF THE "
            "EUROPEAN UNION DIRECTIVE 2019/790 ON COPYRIGHT AND RELATED RIGHTS IN THE DIGITAL SINGLE MARKET.",
            _comment_text(text),
        )
