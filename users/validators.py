import re
from django.core import validators
from django.utils.deconstruct import deconstructible
from django.utils.translation import gettext_lazy as _

from django.core.exceptions import ValidationError


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
    Validate HTML content allowing internal and external links.
    This lightweight validator:
    - Checks all <a> tags have valid URLs (internal: /, # or external: http://, https://)
    - Strips dangerous tags like <script>, <iframe>
    - Strips event handler attributes (onclick, onerror, etc.)
    - Strips dangerous attributes (style, formaction, etc.)
    - Uses regex - no additional dependencies needed
    Args:
        value (str): The HTML content to validate
    Returns:
        str: Sanitized HTML content
    Raises:
        ValidationError: If invalid or potentially dangerous links are found
    """
    if not value:
        return value

    # Find all <a> tags with href attributes
    link_pattern = r'<a\s+[^>]*href=["\']([^"\']+)["\'][^>]*>'
    links = re.findall(link_pattern, value, re.IGNORECASE)

    # Check all links are valid (internal or external)
    for href in links:
        if not is_valid_url(href):
            raise ValidationError(
                f"Invalid link found: {href}. "
                f'Only internal links (starting with "/" or "#") or external links (starting with "http://" or "https://") are permitted.'
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

    # Strip event handler attributes (onclick, onerror, onload, etc.)
    event_handlers = [
        "onclick", "onerror", "onload", "onmouseover", "onmouseout",
        "onfocus", "onblur", "onchange", "onsubmit", "onkeydown",
        "onkeyup", "onkeypress", "onmousedown", "onmouseup", "onmousemove",
        "ondblclick", "oncontextmenu", "oninput", "oninvalid", "onreset",
        "onsearch", "onselect", "ondrag", "ondrop", "onscroll", "oncopy",
        "oncut", "onpaste", "onabort", "oncanplay", "oncanplaythrough",
        "oncuechange", "ondurationchange", "onemptied", "onended", "onloadeddata",
        "onloadedmetadata", "onloadstart", "onpause", "onplay", "onplaying",
        "onprogress", "onratechange", "onseeked", "onseeking", "onstalled",
        "onsuspend", "ontimeupdate", "onvolumechange", "onwaiting",
    ]
    for handler in event_handlers:
        # Remove event handler attributes
        value = re.sub(
            rf'\s+{handler}\s*=\s*["\'][^"\']*["\']',
            "",
            value,
            flags=re.IGNORECASE
        )

    # Strip other dangerous attributes
    dangerous_attrs = ["style", "formaction", "srcdoc", "data"]
    for attr in dangerous_attrs:
        # Remove dangerous attributes from all tags
        value = re.sub(
            rf'\s+{attr}\s*=\s*["\'][^"\']*["\']',
            "",
            value,
            flags=re.IGNORECASE
        )

    return value


def is_valid_url(url):
    """
    Check if URL is valid (internal or external).
    Args:
        url (str): The URL to check
    Returns:
        bool: True if URL is internal (starts with / or #) or external (starts with http:// or https://)
    """
    url = url.strip()
    return (
        url.startswith("/")
        or url.startswith("#")
        or url.startswith("http://")
        or url.startswith("https://")
    )
