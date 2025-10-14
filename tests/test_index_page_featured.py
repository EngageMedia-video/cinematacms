from django.test import TestCase
from django.core.exceptions import ValidationError

from users.validators import validate_internal_html


class TestIndexPageFeaturedValidation(TestCase):
    def test_internal_links_allowed(self):
        """Test that internal links are accepted"""
        content = '<a href="/about">About Us</a>'
        # Should not raise ValidationError
        result = validate_internal_html(content)
        self.assertIn('<a href="/about">About Us</a>', result)

    def test_external_links_allowed(self):
        """Test that external links are accepted"""
        content = '<a href="https://example.com">External Link</a>'
        # Should not raise ValidationError since external links are now allowed
        result = validate_internal_html(content)
        self.assertIn('<a href="https://example.com">External Link</a>', result)

    def test_http_external_links_allowed(self):
        """Test that http:// external links are accepted"""
        content = '<a href="http://example.com">HTTP Link</a>'
        result = validate_internal_html(content)
        self.assertIn('<a href="http://example.com">HTTP Link</a>', result)

    def test_invalid_links_rejected(self):
        """Test that invalid link schemes are rejected"""
        content = '<a href="javascript:alert(1)">Bad Link</a>'
        with self.assertRaises(ValidationError):
            validate_internal_html(content)

    def test_script_tags_stripped(self):
        """Test that dangerous tags are removed"""
        content = '<script>alert("xss")</script><a href="/safe">Safe</a>'
        result = validate_internal_html(content)
        self.assertNotIn('<script>', result)
        self.assertIn('<a href="/safe">Safe</a>', result)

    def test_hash_links_allowed(self):
        """Test that anchor links are accepted"""
        content = '<a href="#section">Jump to Section</a>'
        result = validate_internal_html(content)
        self.assertIn('<a href="#section">Jump to Section</a>', result)

    def test_mixed_links(self):
        """Test content with multiple link types"""
        content = '''
            <a href="/internal">Internal</a>
            <a href="https://external.com">External</a>
            <a href="#anchor">Anchor</a>
        '''
        result = validate_internal_html(content)
        self.assertIn('<a href="/internal">Internal</a>', result)
        self.assertIn('<a href="https://external.com">External</a>', result)
        self.assertIn('<a href="#anchor">Anchor</a>', result)

    def test_dangerous_tags_removed(self):
        """Test that multiple dangerous tags are stripped"""
        content = '''
            <iframe src="evil.com"></iframe>
            <script>alert("xss")</script>
            <a href="/safe">Safe Link</a>
            <object data="evil.swf"></object>
        '''
        result = validate_internal_html(content)
        self.assertNotIn('<iframe', result)
        self.assertNotIn('<script', result)
        self.assertNotIn('<object', result)
        self.assertIn('<a href="/safe">Safe Link</a>', result)
