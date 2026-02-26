from django.core.exceptions import ValidationError
from django.test import TestCase

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
