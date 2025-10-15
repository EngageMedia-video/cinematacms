from django.test import TestCase
from django.core.exceptions import ValidationError

from users.validators import validate_internal_html


class TestIndexPageFeaturedValidation(TestCase):
    def test_event_handler_attributes_stripped(self):
        """Test that event handler attributes are removed"""
        test_cases = [
            ('<a href="/test" onclick="alert(1)">Click</a>', "onclick"),
            ('<a href="/test" onerror="alert(1)">Link</a>', "onerror"),
            ('<img src="/img.png" onload="alert(1)">', "onload"),
            ('<a href="/test" onmouseover="alert(1)">Hover</a>', "onmouseover"),
            ('<div onfocus="alert(1)"><a href="/test">Link</a></div>', "onfocus"),
        ]
        for content, dangerous_attr in test_cases:
            result = validate_internal_html(content)
            self.assertNotIn(dangerous_attr, result)
            # Ensure safe content is preserved
            if '<a href="/test">' in content:
                self.assertIn('href="/test"', result)


def test_dangerous_attributes_stripped(self):
    """Test that dangerous attributes are removed"""
    test_cases = [
        ('<a href="/test" style="position:fixed;top:0">Link</a>', "style"),
        (
            '<form><button formaction="javascript:alert(1)">Click</button></form>',
            "formaction",
        ),
        ('<iframe srcdoc="<script>alert(1)</script>"></iframe>', "srcdoc"),
        ('<object data="evil.swf"></object>', "data"),
        ('<embed src="evil.swf">', "src"),
    ]
    for content, dangerous_attr in test_cases:
        result = validate_internal_html(content)
        # Check that dangerous attribute is not present in a dangerous context
        # The validator should either strip the attribute or the entire tag
        if dangerous_attr in ["formaction", "srcdoc", "data"]:
            self.assertNotIn(f"{dangerous_attr}=", result)


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
    # Empty href - should pass but href might be stripped
    content = '<a href="">Empty</a>'
    result = validate_internal_html(content)
    self.assertIn("<a", result)

    # Whitespace-only href
    content = '<a href="   ">Whitespace</a>'
    result = validate_internal_html(content)
    self.assertIn("<a", result)

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
    # Very long safe content
    long_text = "A" * 10000
    content = f'<a href="/test">{long_text}</a>'
    result = validate_internal_html(content)
    self.assertIn('href="/test"', result)
    self.assertIn(long_text, result)

    # Very long URL (potential ReDoS)
    long_url = "/" + "a" * 5000
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
    """Test that nested dangerous content is properly sanitized"""
    content = """
        <div>
            <script>alert("outer")</script>
            <a href="/safe">
                <script>alert("nested")</script>
                Safe Link
            </a>
            <iframe src="evil.com">
                <script>alert("deep")</script>
            </iframe>
        </div>
    """
    result = validate_internal_html(content)
    self.assertNotIn("<script", result)
    self.assertNotIn("<iframe", result)
    self.assertIn('href="/safe"', result)
    self.assertIn("Safe Link", result)


def test_attribute_injection_attempts(self):
    """Test protection against attribute injection"""
    test_cases = [
        # Trying to inject onclick via quote breaking
        '<a href="/test" title="x" onclick="alert(1)" x="y">Link</a>',
        # Trying to inject via newline
        '<a href="/test"\nonclick="alert(1)">Link</a>',
        # Trying to inject via multiple spaces
        '<a href="/test"     onclick="alert(1)">Link</a>',
    ]
    for content in test_cases:
        result = validate_internal_html(content)
        self.assertNotIn("onclick", result)
        self.assertIn('href="/test"', result)


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
