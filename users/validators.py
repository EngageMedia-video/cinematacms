import re

from django.core import validators
from django.utils.deconstruct import deconstructible
from django.utils.translation import gettext_lazy as _

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
    Sanitize HTML by removing disallowed tags and attributes
    """
    soup = BeautifulSoup(html, 'html.parser')

    # Remove disallowed tags
    for tag in soup.find_all():
        if tag.name not in allowed_tags:
            tag.unwrap()
        else:
            # Remove disallowed attributes
            tag_allowed_attrs = allowed_attrs.get(tag.name, [])
            for attr in list(tag.attrs.keys()):
                if attr not in tag_allowed_attrs:
                    del tag.attrs[attr]

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
    """Check if URL is internal to the portal"""
    return url.startswith('/') or url.startswith('#')
