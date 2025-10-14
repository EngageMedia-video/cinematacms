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


def validate_internal_html(value):
    """
    Validate HTML content allowing only internal links.

    This lightweight validator:
    - Checks all <a> tags only have internal URLs (starting with / or #)
    - Strips dangerous tags like <script>, <iframe>
    - Uses regex - no additional dependencies needed

    Args:
        value (str): The HTML content to validate

    Returns:
        str: Sanitized HTML content

    Raises:
        ValidationError: If external links are found
    """
    if not value:
        return value

    # Find all <a> tags with href attributes
    link_pattern = r'<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>'
    links = re.findall(link_pattern, value, re.IGNORECASE)

    # Check all links are internal
    for href in links:
        if not is_internal_url(href):
            raise ValidationError(
                f"External links are not allowed. Found: {href}. "
                f'Only internal links starting with "/" or "#" are permitted.'
            )

    # Strip dangerous tags that could execute code
    dangerous_tags = ["script", "iframe", "object", "embed", "form", "input"]
    for tag in dangerous_tags:
        # Remove opening and closing tags with any content
        value = re.sub(
            f"<{tag}[^>]*>.*?</{tag}>", "", value, flags=re.IGNORECASE | re.DOTALL
        )
        # Remove self-closing tags
        value = re.sub(f"<{tag}[^>]*/?>", "", value, flags=re.IGNORECASE)

    return value


def is_internal_url(url):
    """
    Check if URL is internal to the portal.

    Args:
        url (str): The URL to check

    Returns:
        bool: True if URL is internal (starts with / or #)
    """
    url = url.strip()
    return url.startswith("/") or url.startswith("#")
