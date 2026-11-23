from datetime import timedelta

from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from files.methods import get_current_featured_media
from files.models import FeaturedVideo, Media
from files.tests.helpers import create_test_media, create_test_user
from users.validators import validate_internal_html


class TestIndexPageFeaturedValidation(TestCase):
    def test_event_handler_attributes_blocked(self):
        """Test that event handler attributes are blocked"""
        test_cases = [
            ('<a href="/test" onclick="alert(1)">Click</a>', "onclick"),
            ('<a href="/test" onerror="alert(1)">Link</a>', "onerror"),
            ('<img src="/img.png" onload="alert(1)">', "onload"),
            ('<a href="/test" onmouseover="alert(1)">Hover</a>', "onmouseover"),
            ('<div onfocus="alert(1)"><a href="/test">Link</a></div>', "onfocus"),
        ]
        for content, dangerous_attr in test_cases:
            with self.assertRaises(ValidationError, msg=f"Failed to block: {dangerous_attr}"):
                validate_internal_html(content)

    def test_dangerous_attributes_blocked(self):
        """Test that dangerous attributes are blocked"""
        test_cases = [
            ('<a href="/test" style="position:fixed;top:0">Link</a>', "style"),
            ('<form><button formaction="javascript:alert(1)">Click</button></form>', "formaction"),
            ('<iframe srcdoc="<script>alert(1)</script>"></iframe>', "srcdoc"),
            ('<object data="evil.swf"></object>', "data"),
        ]
        for content, dangerous_attr in test_cases:
            # These should raise ValidationError for dangerous attributes or tags
            with self.assertRaises(ValidationError, msg=f"Failed to block: {dangerous_attr}"):
                validate_internal_html(content)

    def test_dangerous_tags_blocked(self):
        """Test that dangerous HTML tags are blocked"""
        dangerous_tags = [
            "<script>alert(1)</script>",
            '<iframe src="evil.com"></iframe>',
            '<object data="evil.swf"></object>',
            '<embed src="evil.swf">',
            '<form action="/evil"><input name="x"></form>',
            '<base href="http://evil.com">',
            '<link rel="stylesheet" href="http://evil.com/evil.css">',
            '<meta http-equiv="refresh" content="0;url=http://evil.com">',
            '<svg onload="alert(1)"><circle r="10"/></svg>',
        ]
        for content in dangerous_tags:
            with self.assertRaises(ValidationError, msg=f"Failed to block: {content}"):
                validate_internal_html(content)

    def test_encoded_javascript_schemes_blocked(self):
        """Test that URL-encoded JavaScript schemes are blocked"""
        test_cases = [
            '<a href="j%61vascript:alert(1)">Encoded JS</a>',
            '<a href="java&#x09;script:alert(1)">Entity Encoded</a>',
            '<a href="java\nscript:alert(1)">Newline</a>',
            '<a href="java\tscript:alert(1)">Tab</a>',
            '<a href="JaVaScRiPt:alert(1)">Mixed Case</a>',
            '<a href=" javascript:alert(1)">Leading Space</a>',
            '<a href="vbscript:msgbox(1)">VBScript</a>',
            '<a href="data:text/html,<script>alert(1)</script>">Data URI</a>',
        ]
        for content in test_cases:
            with self.assertRaises(ValidationError, msg=f"Failed to block: {content}"):
                validate_internal_html(content)

    def test_edge_case_urls(self):
        """Test edge cases in URL handling"""
        # Empty href - blocked (empty href is not a valid internal link)
        content = '<a href="">Empty</a>'
        with self.assertRaises(ValidationError):
            validate_internal_html(content)

        # Whitespace-only href - should be blocked
        content = '<a href="   ">Whitespace</a>'
        with self.assertRaises(ValidationError):
            validate_internal_html(content)

        # Mixed quote styles (should be normalized)
        content = """<a href='/test'>Single Quotes</a>"""
        result = validate_internal_html(content)
        self.assertIn("href=", result)
        self.assertIn("/test", result)

        # URL with hash and query params
        content = '<a href="/page?param=value#section">Complex URL</a>'
        result = validate_internal_html(content)
        self.assertIn('href="/page?param=value#section"', result)

    def test_extremely_long_input(self):
        """Test that extremely long inputs are handled gracefully"""
        # Very long safe content (must fit within MAX_LENGTH of 10000 chars including tags)
        long_text = "A" * 9950
        content = f'<a href="/test">{long_text}</a>'
        result = validate_internal_html(content)
        self.assertIn('href="/test"', result)
        self.assertIn(long_text, result)

        # Very long URL (potential ReDoS) — kept under the 2000-char href regex limit
        long_url = "/" + "a" * 1990
        content = f'<a href="{long_url}">Link</a>'
        result = validate_internal_html(content)
        self.assertIn('href="/', result)

    def test_redos_prevention(self):
        """Test that ReDoS-prone inputs don't cause performance issues"""
        import time

        # Input with many nested tags and spaces
        content = "<a" + " " * 1000 + 'href="/test">Link</a>'
        start = time.time()
        result = validate_internal_html(content)
        elapsed = time.time() - start

        # Should complete quickly (under 1 second)
        self.assertLess(elapsed, 1.0, "Validation took too long, possible ReDoS")
        self.assertIn('href="/test"', result)

    def test_nested_dangerous_content(self):
        """Test that nested dangerous content is blocked"""
        # Content with script tags should be blocked
        content_with_script = """
        <div>
            <script>alert("outer")</script>
            <a href="/safe">Safe Link</a>
        </div>
        """
        with self.assertRaises(ValidationError):
            validate_internal_html(content_with_script)

        # Content with iframe tags should be blocked
        content_with_iframe = """
        <div>
            <a href="/safe">Safe Link</a>
            <iframe src="evil.com"></iframe>
        </div>
        """
        with self.assertRaises(ValidationError):
            validate_internal_html(content_with_iframe)

    def test_attribute_injection_attempts(self):
        """Test protection against attribute injection"""
        test_cases = [
            # Trying to inject onclick via quote breaking
            '<a href="/test" title="x" onclick="alert(1)" x="y">Link</a>',
            # Trying to inject via newline
            '<a href="/test"\nonclick="alert(1)">Link</a>',
            # Trying to inject via multiple spaces
            '<a href="/test"     onclick="alert(1)">Link</a>',
            # Boolean attribute without value
            '<a href="/test" onclick>Link</a>',
            "<button onclick>Click</button>",
            # Boolean dangerous attributes
            '<a href="/test" style>Link</a>',
        ]
        for content in test_cases:
            with self.assertRaises(ValidationError):
                validate_internal_html(content)

    def test_malformed_html_blocked(self):
        """Test that malformed/incomplete HTML is blocked"""
        test_cases = [
            "<a onclick",  # Incomplete tag
            "<script",  # Incomplete dangerous tag
            '<div onclick="alert(1)"',  # Incomplete tag with attribute
            '<iframe src="evil.com"',  # Incomplete iframe
        ]
        for content in test_cases:
            with self.assertRaises(ValidationError, msg=f"Failed to block: {content}"):
                validate_internal_html(content)

    def test_anchor_without_href_blocked(self):
        """Test that <a> tags without href are blocked"""
        test_cases = [
            "<a>Link</a>",  # No attributes
            '<a class="test">Link</a>',  # Has class but no href
            '<a onclick="alert(1)">Link</a>',  # Has onclick but no href
            '<a id="link" class="test">Link</a>',  # Multiple attributes but no href
        ]
        for content in test_cases:
            with self.assertRaises(ValidationError, msg=f"Failed to block: {content}"):
                validate_internal_html(content)

        # Valid <a> tags with href should pass
        valid_cases = [
            '<a href="/test">Link</a>',
            '<a href="/test" class="test">Link</a>',
            '<a class="test" href="/test">Link</a>',  # href not first
        ]
        for content in valid_cases:
            result = validate_internal_html(content)
            self.assertIn("href", result)

    def test_unicode_and_special_characters(self):
        """Test handling of unicode and special characters in URLs"""
        # Unicode characters in URL
        content = '<a href="/test/café">Link</a>'
        result = validate_internal_html(content)
        self.assertIn("href=", result)

        # Special characters that should be preserved
        content = '<a href="/test?a=1&b=2">Query</a>'
        result = validate_internal_html(content)
        self.assertIn('href="/test?a=1&b=2"', result)

        # HTML entities in link text (should be preserved)
        content = '<a href="/test">Link &amp; Text</a>'
        result = validate_internal_html(content)
        self.assertIn("Link", result)


class GetCurrentFeaturedMediaTest(TestCase):
    """Hero selection skips schedule rows whose film cannot be shown (#1176)."""

    @classmethod
    def setUpTestData(cls):
        cls.user = create_test_user()

    def setUp(self):
        super().setUp()
        self.now = timezone.now()

    def _media(self, title, **kwargs):
        media = create_test_media(self.user, **kwargs)
        # The helper fixes the title, so name each film for readable failures.
        # Backdate the upload so a test can make one film the newest upload.
        Media.objects.filter(pk=media.pk).update(title=title, add_date=self.now - timedelta(days=30))
        media.refresh_from_db()
        return media

    def _schedule(self, media, start_days_ago, end_days_ago=None, **kwargs):
        """Create a schedule row. The post_save signal marks the media featured."""
        end_date = None if end_days_ago is None else self.now - timedelta(days=end_days_ago)
        return FeaturedVideo.objects.create(
            media=media,
            start_date=self.now - timedelta(days=start_days_ago),
            end_date=end_date,
            **kwargs,
        )

    def _decoy(self):
        """A featured film with no schedule row that wins either fallback ordering.

        Its upload date and featured_date are the newest, so a test only passes
        when the hero really comes from a schedule row.
        """
        decoy = self._media("unscheduled decoy")
        Media.objects.filter(pk=decoy.pk).update(
            featured=True,
            featured_date=self.now - timedelta(hours=1),
            add_date=self.now,
        )
        return decoy

    def _hide(self, media, **fields):
        # update() bypasses Media.save() and the featured signals, like a
        # curator change that lands after the schedule row was created.
        Media.objects.filter(pk=media.pk).update(**fields)

    def test_newest_row_with_hidden_film_hands_hero_to_previous_row(self):
        cases = [
            ("unlisted", {"state": "unlisted"}),
            ("private", {"state": "private"}),
            ("not reviewed", {"is_reviewed": False}),
            ("not encoded", {"encoding_status": "fail"}),
            ("featured unticked", {"featured": False}),
        ]
        for label, hidden_fields in cases:
            with self.subTest(label):
                decoy = self._decoy()
                previous = self._media(f"previous {label}")
                newest = self._media(f"newest {label}")
                self._schedule(previous, start_days_ago=3)
                self._schedule(newest, start_days_ago=1)
                self._hide(newest, **hidden_fields)

                self.assertEqual(get_current_featured_media(), previous)

                FeaturedVideo.objects.all().delete()
                Media.objects.filter(pk__in=[decoy.pk, previous.pk, newest.pk]).delete()

    def test_several_hidden_rows_in_a_row_skip_to_first_valid_row(self):
        self._decoy()
        valid = self._media("valid")
        self._schedule(valid, start_days_ago=10)
        for days_ago, fields in [(3, {"state": "private"}), (2, {"is_reviewed": False}), (1, {"featured": False})]:
            hidden = self._media(f"hidden {days_ago}")
            self._schedule(hidden, start_days_ago=days_ago)
            self._hide(hidden, **fields)

        self.assertEqual(get_current_featured_media(), valid)

    def test_ended_newest_row_hands_hero_to_previous_open_row(self):
        self._decoy()
        open_film = self._media("open")
        ended_film = self._media("ended")
        self._schedule(open_film, start_days_ago=5)
        self._schedule(ended_film, start_days_ago=2, end_days_ago=1)

        self.assertEqual(get_current_featured_media(), open_film)

    def test_only_ended_rows_valid_uses_most_recent_valid_ended_row(self):
        self._decoy()
        older_ended = self._media("older ended")
        newer_ended = self._media("newer ended")
        hidden_ended = self._media("hidden ended")
        hidden_open = self._media("hidden open")
        self._schedule(older_ended, start_days_ago=10, end_days_ago=8)
        self._schedule(newer_ended, start_days_ago=7, end_days_ago=5)
        self._schedule(hidden_ended, start_days_ago=4, end_days_ago=3)
        self._schedule(hidden_open, start_days_ago=2)
        self._hide(hidden_ended, state="unlisted")
        self._hide(hidden_open, state="private")

        self.assertEqual(get_current_featured_media(), newer_ended)

    def test_no_valid_rows_falls_back_to_featured_date_order(self):
        # Uploaded first, featured most recently: featured_date must decide.
        recently_featured = self._media("recently featured")
        recently_uploaded = self._media("recently uploaded")
        never_dated = self._media("never dated")
        Media.objects.filter(pk=recently_featured.pk).update(
            featured=True,
            featured_date=self.now - timedelta(days=1),
            add_date=self.now - timedelta(days=30),
        )
        Media.objects.filter(pk=recently_uploaded.pk).update(
            featured=True,
            featured_date=self.now - timedelta(days=5),
            add_date=self.now - timedelta(days=1),
        )
        Media.objects.filter(pk=never_dated.pk).update(
            featured=True,
            featured_date=None,
            add_date=self.now,
        )
        hidden = self._media("hidden scheduled")
        self._schedule(hidden, start_days_ago=0)
        self._hide(hidden, state="unlisted")

        self.assertEqual(get_current_featured_media(), recently_featured)

    def test_fallback_skips_film_scheduled_for_the_future(self):
        # The schedule signal sets featured_date to the future start date,
        # which would sort first if the fallback did not skip it.
        current = self._media("current")
        upcoming = self._media("upcoming")
        Media.objects.filter(pk=current.pk).update(featured=True, featured_date=self.now - timedelta(days=1))
        FeaturedVideo.objects.create(media=upcoming, start_date=self.now + timedelta(days=2))

        self.assertEqual(get_current_featured_media(), current)

    def test_rows_with_same_start_date_pick_the_newest_row(self):
        first = self._media("first")
        second = self._media("second")
        self._schedule(first, start_days_ago=1)
        self._schedule(second, start_days_ago=1)

        self.assertEqual(get_current_featured_media(), second)

    def test_inactive_rows_are_ignored(self):
        self._decoy()
        active = self._media("active")
        inactive = self._media("inactive")
        self._schedule(active, start_days_ago=3)
        self._schedule(inactive, start_days_ago=1, is_active=False)

        self.assertEqual(get_current_featured_media(), active)

    def test_returns_none_without_any_featured_media(self):
        self._media("not featured")

        self.assertIsNone(get_current_featured_media())
