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
    Validates HTML content to allow only safe internal links and basic formatting.
    Blocks dangerous tags, event handlers, and external URLs.
    """
    if not value:
        return value

    MAX_LENGTH = 10000  # 10KB limit - adjust as needed
    if len(value) > MAX_LENGTH:
        raise ValidationError(
            f"Content too large. Maximum {MAX_LENGTH} characters allowed."
        )

    if re.search(r"<\w+(?:\s+[^>]{0,500})?$", value.strip()):
        raise ValidationError(
            "Incomplete HTML tag detected. Please ensure all tags are properly closed."
        )
    link_pattern = (
        r'<a\s+(?:[^>]{0,500})?href=["\']([^"\']{1,2000})["\'](?:[^>]{0,500})?>'
    )
    links = re.findall(link_pattern, value, re.IGNORECASE)

    if not links and "<a" in value.lower():
        raise ValidationError(
            "All <a> tags must have an href attribute with proper quotes."
        )

    # Validate each URL in href attributes
    for url in links:
        if not is_valid_url(url):
            raise ValidationError(
                f"Invalid or external URL detected: {url}. Only internal links (starting with / or #) are allowed."
            )

    # Solution 2: Block dangerous HTML tags with bounded repetition
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
        if re.search(f"<{tag}(?:\\s+[^>]{{0,500}})?>", value, re.IGNORECASE):
            raise ValidationError(f"Dangerous tag not allowed: <{tag}>")

    # Block event handler attributes (with or without values)
    event_handlers = [
        "onclick",
        "ondblclick",
        "onmousedown",
        "onmouseup",
        "onmouseover",
        "onmousemove",
        "onmouseout",
        "onmouseenter",
        "onmouseleave",
        "onkeydown",
        "onkeypress",
        "onkeyup",
        "onload",
        "onunload",
        "onabort",
        "onerror",
        "onresize",
        "onscroll",
        "onselect",
        "onchange",
        "onsubmit",
        "onreset",
        "onfocus",
        "onblur",
        "oninput",
        "oninvalid",
        "onsearch",
        "oncontextmenu",
        "oncopy",
        "oncut",
        "onpaste",
        "ondrag",
        "ondragend",
        "ondragenter",
        "ondragleave",
        "ondragover",
        "ondragstart",
        "ondrop",
        "onloadstart",
        "onprogress",
        "onsuspend",
        "onemptied",
        "onstalled",
        "onloadedmetadata",
        "onloadeddata",
        "oncanplay",
        "oncanplaythrough",
        "onplaying",
        "onwaiting",
        "onseeking",
        "onseeked",
        "onended",
        "ondurationchange",
        "ontimeupdate",
        "onplay",
        "onpause",
        "onratechange",
        "onvolumechange",
    ]
    for handler in event_handlers:
        # Match handler with or without value assignment
        if re.search(f"{handler}\\s*=", value, re.IGNORECASE):
            raise ValidationError(f"Event handler not allowed: {handler}")

    # Block dangerous attributes
    dangerous_attrs = ["style", "formaction", "srcdoc", "data"]
    for attr in dangerous_attrs:
        if re.search(f"\\b{attr}\\s*=", value, re.IGNORECASE):
            raise ValidationError(f"Dangerous attribute not allowed: {attr}")

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
