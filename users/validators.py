import re

from django.core import validators
from django.utils.deconstruct import deconstructible
from django.utils.translation import gettext_lazy as _

from django.core.exceptions import ValidationError
from django.conf import settings
@deconstructible
class ASCIIUsernameValidator(validators.RegexValidator):
    regex = r"^[\w]+$"
    message = _(
        "Enter a valid username. This value may contain only "
        "English letters and numbers"
    )
    flags = re.ASCII


custom_username_validators = [ASCIIUsernameValidator()]

# Allowed HTML tags and attributes for internal content
ALLOWED_HTML_TAGS = ['a', 'strong', 'em', 'p', 'br']
ALLOWED_HTML_ATTRS = {'a': ['href', 'title']}

def sanitize_html(html):
    """
    Sanitize HTML by removing disallowed tags and attributes.

    Security features:
    - Removes all event handlers (onclick, onload, onerror, etc.)
    - Validates and sanitizes href attributes to prevent XSS
    - Strips dangerous attributes (style, srcset, data-*)
    - Prevents protocol-relative URLs and javascript: URIs
    """
    if not html:
        return html

    # Step 1: Remove all disallowed tags (keep only allowed ones)
    # Pattern matches any HTML tag
    tag_pattern = r'<(/?)(\w+)([^>]*)>'

    def process_tag(match):
        closing = match.group(1)
        tag_name = match.group(2).lower()
        attributes = match.group(3)

        # Remove disallowed tags completely
        if tag_name not in ALLOWED_HTML_TAGS:
            return ''

        # For self-closing tags like <br>, return as-is
        if tag_name == 'br':
            return f'<{closing}{tag_name}>'

        # For closing tags, return as-is
        if closing == '/':
            return f'</{tag_name}>'

        # For opening tags, sanitize attributes
        allowed_attrs = ALLOWED_HTML_ATTRS.get(tag_name, [])

        if not allowed_attrs:
            # No attributes allowed for this tag
            return f'<{tag_name}>'

        # Extract and validate attributes
        sanitized_attrs = _sanitize_attributes(attributes, allowed_attrs, tag_name)

        if sanitized_attrs is None:
            # Invalid href detected, remove tag but keep content
            return ''
        elif sanitized_attrs:
            return f'<{tag_name} {sanitized_attrs}>'
        else:
            return f'<{tag_name}>'

    result = re.sub(tag_pattern, process_tag, html)
    return result

def _sanitize_attributes(attr_string, allowed_attrs, tag_name):
    """
    Extract and sanitize HTML attributes, keeping only allowed ones.

    Security features:
    - Removes dangerous event handlers (onclick, onload, etc.)
    - Removes style, srcset, data-*, formaction, form attributes
    - Validates href attributes for internal URLs only

    Returns:
    - String of sanitized attributes
    - None if tag should be removed (invalid href)
    """
    if not attr_string or not allowed_attrs:
        return ''

    # Pattern to match attributes: name="value" or name='value' or name=value
    attr_pattern = r'(\w+(?:-\w+)*)(?:\s*=\s*["\']([^"\']*)["\']|\s*=\s*([^\s>]+))?'

    dangerous_prefixes = ['on', 'style', 'srcset', 'data-', 'formaction', 'form']

    sanitized = []

    for match in re.finditer(attr_pattern, attr_string):
        attr_name = match.group(1).lower()
        attr_value = match.group(2) or match.group(3) or ''

        # Skip dangerous attributes
        is_dangerous = False
        for prefix in dangerous_prefixes:
            if prefix == 'on' and attr_name.startswith('on'):
                is_dangerous = True
                break
            elif prefix != 'on' and (attr_name.startswith(prefix) or attr_name == prefix):
                is_dangerous = True
                break

        if is_dangerous:
            continue

        # Skip if not in allowed list
        if attr_name not in allowed_attrs:
            continue

        # Special validation for href
        if attr_name == 'href':
            if attr_value and not is_internal_url(attr_value.strip()):
                # Return None to signal tag removal
                return None

        # Add sanitized attribute
        if attr_value:
            # Escape quotes in value
            escaped_value = attr_value.replace('"', '&quot;')
            sanitized.append(f'{attr_name}="{escaped_value}"')
        else:
            sanitized.append(attr_name)

    return ' '.join(sanitized)

def validate_internal_html(value):
    """
    Validate HTML content allowing only internal links and safe tags
    """
    if not value:
        return value

    # Pattern to match all HTML tags
    tag_pattern = r'<(/?)(\w+)([^>]*)>'

    # Check all tags are allowed
    for match in re.finditer(tag_pattern, value):
        tag_name = match.group(2).lower()
        if tag_name not in ALLOWED_HTML_TAGS:
            raise ValidationError(f'Tag not allowed: {tag_name}. Use only <a>, <strong>, <em>, <p>, and <br>')

    # Pattern to match href attributes in anchor tags
    href_pattern = r'<a\s+[^>]*href\s*=\s*["\']([^"\']*)["\'][^>]*>'

    # Check all links are internal
    for match in re.finditer(href_pattern, value, re.IGNORECASE):
        href = match.group(1)
        if href and not is_internal_url(href):
            raise ValidationError(f'External links not allowed: {href}')

    # Validation passed - return original value unchanged
    return value

def contains_not_allowed_tags(text):
    """
    Check if text contains tags that are not in the allowed list.
    Returns True if not allowed tags are found, False otherwise.
    """
    if not text:
        return False

    # Pattern to match all HTML tags
    tag_pattern = r'<(/?)(\w+)([^>]*)>'

    for match in re.finditer(tag_pattern, text):
        tag_name = match.group(2).lower()
        if tag_name not in ALLOWED_HTML_TAGS:
            return True

    return False

def is_internal_url(url):
    """
    Check if URL is internal to the portal.

    Validates that URLs are safe internal links by:
    - Rejecting protocol-relative URLs (//evil.com)
    - Blocking dangerous protocols (javascript:, data:, vbscript:, file:)
    - Preventing URL encoding bypasses
    - Ensuring case-insensitive protocol checks
    - Allowing only relative paths, fragments, or same-domain absolute URLs
    """
    from urllib.parse import urlparse, unquote

    if not url:
        return False

    # Normalize: trim whitespace and decode once to catch encoded attacks
    url = url.strip()
    decoded_url = unquote(url)

    # Block protocol-relative URLs (//evil.com/page)
    if url.startswith('//') or decoded_url.startswith('//'):
        return False

    # Block dangerous protocols (case-insensitive)
    dangerous_protocols = ['javascript:', 'data:', 'vbscript:', 'file:', 'blob:', 'about:']
    url_lower = url.lower()
    decoded_lower = decoded_url.lower()

    for protocol in dangerous_protocols:
        if protocol in url_lower or protocol in decoded_lower:
            return False

    # Defense-in-depth: check for colon before first slash/hash
    # This catches edge cases like "/javascript:alert(1)" being interpreted as scheme
    first_slash = decoded_url.find('/')
    first_hash = decoded_url.find('#')
    first_colon = decoded_url.find(':')

    if first_colon != -1:
        # If colon exists, ensure it's after a slash or hash (i.e., in query/fragment)
        if first_slash == -1 and first_hash == -1:
            # Colon with no slash/hash = likely a scheme
            return False
        if first_slash != -1 and first_colon < first_slash:
            return False
        if first_hash != -1 and first_colon < first_hash and (first_slash == -1 or first_colon < first_slash):
            return False

    # Parse the URL
    try:
        parsed = urlparse(url)
        parsed_decoded = urlparse(decoded_url)
    except (ValueError, AttributeError):
        return False

    # Reject if scheme or netloc is present (except for http/https to same domain)
    if parsed.scheme and parsed.scheme not in ['', 'http', 'https']:
        return False

    if parsed_decoded.scheme and parsed_decoded.scheme not in ['', 'http', 'https']:
        return False

    # If scheme is http/https, verify it's the same domain
    if parsed.scheme in ['http', 'https'] or parsed_decoded.scheme in ['http', 'https']:
        allowed_hosts = getattr(settings, 'ALLOWED_HOSTS', [])
        netloc = parsed.netloc or parsed_decoded.netloc

        if not netloc or netloc not in allowed_hosts:
            return False

        # Valid same-domain absolute URL
        return True

    # Reject any netloc for relative URLs (catches protocol-relative)
    if parsed.netloc or parsed_decoded.netloc:
        # Only allowed if it's explicitly http/https and validated above
        if parsed.scheme not in ['http', 'https'] and parsed_decoded.scheme not in ['http', 'https']:
            return False

    # Must be a relative path or fragment
    return url.startswith('/') or url.startswith('#')