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
    - Validates HTML is well-formed (no incomplete tags)
    - Requires all <a> tags to have href attributes
    - Checks all <a> tags have valid URLs (internal: /, # or external: http://, https://)
    - Blocks dangerous tags (script, iframe, object, embed, form, input, base, link, meta, svg)
    - Blocks event handler attributes (onclick, onerror, etc.) with or without values
    - Blocks dangerous attributes (style, formaction, srcdoc, data) with or without values
    - Uses regex - no additional dependencies needed
    Args:
        value (str): The HTML content to validate
    Returns:
        str: The HTML content if valid
    Raises:
        ValidationError: If invalid or potentially dangerous content is found
    """
    if not value:
        return value

    # Check for malformed/incomplete HTML tags (tags not properly closed with >)
    # This prevents bypass attempts with incomplete tags like "<a onclick" or "<script"
    if re.search(r'<\w+[^>]*$', value.strip()):
        raise ValidationError(
            "Invalid HTML: Tag is not properly closed. All tags must end with '>'."
        )

    # Check for <a> tags without href attribute
    # Find all <a> opening tags and check if they contain href
    anchor_tags = re.findall(r'<a\s[^>]*>', value, re.IGNORECASE)
    for tag in anchor_tags:
        if not re.search(r'\bhref\s*=', tag, re.IGNORECASE):
            raise ValidationError(
                "Invalid HTML: <a> tags must have an href attribute."
            )

    # Check for <a> tags with no attributes at all
    if re.search(r'<a\s*>', value, re.IGNORECASE):
        raise ValidationError(
            "Invalid HTML: <a> tags must have an href attribute."
        )

    # Check for dangerous tags that could execute code
    dangerous_tags = [
        "script",
        "iframe",
        "object",
        "embed",
        "form",
        "input",
        "base",
        "link",
        "meta",
        "svg",
    ]
    for tag in dangerous_tags:
        # Check for opening tags (with or without attributes)
        if re.search(f"<{tag}[^>]*>", value, re.IGNORECASE):
            raise ValidationError(
                f"Dangerous tag detected: <{tag}>. "
                f"This tag is not allowed for security reasons."
            )
        # Check for self-closing tags
        if re.search(f"<{tag}[^>]*/>", value, re.IGNORECASE):
            raise ValidationError(
                f"Dangerous tag detected: <{tag}/>. "
                f"This tag is not allowed for security reasons."
            )

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

    # Block event handler attributes (onclick, onerror, onload, etc.)
    event_handlers = [
        "onclick",
        "onerror",
        "onload",
        "onmouseover",
        "onmouseout",
        "onfocus",
        "onblur",
        "onchange",
        "onsubmit",
        "onkeydown",
        "onkeyup",
        "onkeypress",
        "onmousedown",
        "onmouseup",
        "onmousemove",
        "ondblclick",
        "oncontextmenu",
        "oninput",
        "oninvalid",
        "onreset",
        "onsearch",
        "onselect",
        "ondrag",
        "ondrop",
        "onscroll",
        "oncopy",
        "oncut",
        "onpaste",
        "onabort",
        "oncanplay",
        "oncanplaythrough",
        "oncuechange",
        "ondurationchange",
        "onemptied",
        "onended",
        "onloadeddata",
        "onloadedmetadata",
        "onloadstart",
        "onpause",
        "onplay",
        "onplaying",
        "onprogress",
        "onratechange",
        "onseeked",
        "onseeking",
        "onstalled",
        "onsuspend",
        "ontimeupdate",
        "onvolumechange",
        "onwaiting",
    ]
    for handler in event_handlers:
        # Block if event handler attribute is found (with or without value)
        # Matches: onclick="..." or onclick='...' or onclick (boolean attribute)
        if re.search(rf'\s+{handler}(\s*=|\s|>)', value, flags=re.IGNORECASE):
            raise ValidationError(
                f"Event handler attributes are not allowed. Found: {handler}"
            )

    # Block dangerous attributes
    dangerous_attrs = ["style", "formaction", "srcdoc", "data"]
    for attr in dangerous_attrs:
        # Block if dangerous attribute is found (with or without value)
        if re.search(rf'\s+{attr}(\s*=|\s|>)', value, flags=re.IGNORECASE):
            raise ValidationError(
                f"Dangerous attributes are not allowed. Found: {attr}"
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
