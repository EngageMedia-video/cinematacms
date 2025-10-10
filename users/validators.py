import re

from django.core import validators
from django.utils.deconstruct import deconstructible
from django.utils.translation import gettext_lazy as _

from django.core.exceptions import ValidationError
from django.conf import settings
from bs4 import BeautifulSoup
from django.core.exceptions import ValidationError
from django.conf import settings
from bs4 import BeautifulSoup
@deconstructible
class ASCIIUsernameValidator(validators.RegexValidator):
    regex = r"^[\w]+$"
    message = _(
        "Enter a valid username. This value may contain only "
        "English letters and numbers"
    )
    flags = re.ASCII


custom_username_validators = [ASCIIUsernameValidator()]


def sanitize_html(html, allowed_tags, allowed_attrs):
    """
    Sanitize HTML by removing disallowed tags and attributes.

    Security features:
    - Removes all event handlers (onclick, onload, onerror, etc.)
    - Validates and sanitizes href attributes to prevent XSS
    - Strips dangerous attributes (style, srcset, data-*)
    - Prevents protocol-relative URLs and javascript: URIs
    """
    soup = BeautifulSoup(html, 'html.parser')

    # Dangerous attribute patterns to always remove
    dangerous_attr_patterns = [
        'on',  # Event handlers: onclick, onload, onerror, onmouseover, etc.
        'style',  # Can contain expression() and other CSS-based attacks
        'srcset',  # Alternative image sources that could bypass validation
        'data-',  # Custom data attributes that might be used in XSS
        'formaction',  # Override form action
        'form',  # Associate with forms
    ]

    # Remove disallowed tags
    for tag in soup.find_all():
        if tag.name not in allowed_tags:
            tag.unwrap()
        else:
            # Get allowed attributes for this tag
            tag_allowed_attrs = allowed_attrs.get(tag.name, [])

            # Check and sanitize all attributes
            for attr in list(tag.attrs.keys()):
                attr_lower = attr.lower()

                # Remove dangerous attributes
                should_remove = False
                for dangerous in dangerous_attr_patterns:
                    if dangerous == 'on' and attr_lower.startswith('on'):
                        should_remove = True
                        break
                    elif dangerous != 'on' and (attr_lower.startswith(dangerous) or attr_lower == dangerous):
                        should_remove = True
                        break

                # Remove if dangerous or not in allowed list
                if should_remove or attr not in tag_allowed_attrs:
                    del tag.attrs[attr]
                    continue

                # Special validation for href attributes
                if attr == 'href':
                    href_value = tag.attrs[attr]
                    if href_value:
                        # Normalize and validate the URL
                        href_normalized = href_value.strip()

                        # Validate using is_internal_url
                        if not is_internal_url(href_normalized):
                            # Remove the entire tag if it contains an external/dangerous link
                            tag.unwrap()
                            break

    return str(soup)

def validate_internal_html(value):
    """
    Validate HTML content allowing only internal links and safe tags
    """
    allowed_tags = ['a', 'strong', 'em', 'p', 'br']
    allowed_attrs = {'a': ['href', 'title']}

    # Parse HTML
    soup = BeautifulSoup(value, 'html.parser')

    # Check all links are internal
    for link in soup.find_all('a'):
        href = link.get('href', '')
        if href and not is_internal_url(href):
            raise ValidationError(f'External links not allowed: {href}')

    # Check if it contains tags that are not allowed
    for tag in soup.find_all():
        if tag.name not in allowed_tags:
            raise ValidationError(f'Tag not allowed: {tag.name}. Use only <a>, <strong>, <em>, <p>, and <br>')

    # Sanitize tags and attributes
    return sanitize_html(value, allowed_tags, allowed_attrs)

def contains_not_allowed_tags(text, allowed_tags):
    """
    Check if text contains tags that are not in the allowed list
    Returns True if not allowed tags are found, False otherwise
    """
    soup = BeautifulSoup(text, 'html.parser')

    for tag in soup.find_all():
        if tag.name not in allowed_tags:
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


def validate_internal_html(value):
    """
    Validate HTML content allowing only internal links and safe tags
    """
    allowed_tags = ['a', 'strong', 'em', 'p', 'br']
    allowed_attrs = {'a': ['href', 'title']}
    
    # Parse HTML
    soup = BeautifulSoup(value, 'html.parser')
    
    # Check all links are internal
    for link in soup.find_all('a'):
        href = link.get('href', '')
        if href and not is_internal_url(href):
            raise ValidationError(f'External links not allowed: {href}')
    
    # Sanitize tags and attributes
    return sanitize_html(value, allowed_tags, allowed_attrs)