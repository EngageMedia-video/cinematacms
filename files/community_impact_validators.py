import ipaddress
from urllib.parse import urlsplit

from django.utils import timezone
from django.utils.html import strip_tags
from rest_framework import serializers

from .models import CommunityImpact

GENERIC_TRUSTED_URL_ERROR = "Link is not trustworthy. Please use a secure HTTPS link."
MIN_IMPACT_YEAR = 1900

IMPACT_DETAIL_FIELD_DEFAULTS = {
    "year": None,
    "is_online": False,
    "city": "",
    "country": "",
    "organiser": "",
    "organiser_private": False,
    "creator": "",
    "publication": "",
    "medium": "",
    "award_result": "",
}
IMPACT_TEXT_FIELDS = ("city", "organiser", "creator", "publication")

# Detail fields each submission form collects. Anything else sent with the
# category is reset so a record never carries another category's data.
IMPACT_CATEGORY_FIELDS = {
    CommunityImpact.SCREENING: {
        "required": ("year", "city", "country", "organiser"),
        "optional": ("is_online", "organiser_private"),
    },
    CommunityImpact.ARTICLE: {
        "required": ("year", "creator"),
        "optional": ("publication",),
    },
    CommunityImpact.REFERENCED: {
        "required": ("year", "creator", "medium"),
        "optional": (),
    },
    CommunityImpact.AWARD: {
        "required": ("year", "organiser", "award_result"),
        "optional": (),
    },
    CommunityImpact.TEACHING: {
        "required": ("year", "creator"),
        "optional": ("organiser",),
    },
}
ONLINE_SCREENING_FIELDS = ("city", "country")


def validate_impact_year(value):
    if value is None:
        return value

    # One year of slack: on 1 January a submitter east of the server's time
    # zone is already in the new year.
    latest_year = timezone.localdate().year + 1
    if not MIN_IMPACT_YEAR <= value <= latest_year:
        raise serializers.ValidationError(f"Enter a year between {MIN_IMPACT_YEAR} and {latest_year}.")
    return value


def validate_impact_category_fields(attrs):
    """Require and keep only the detail fields the chosen category collects."""
    category = attrs.get("category")
    rules = IMPACT_CATEGORY_FIELDS.get(category)
    if rules is None:
        return attrs

    for field in IMPACT_TEXT_FIELDS:
        if field in attrs:
            attrs[field] = strip_tags(attrs[field] or "").strip()

    required = set(rules["required"])
    kept = required | set(rules["optional"])
    if category == CommunityImpact.SCREENING and attrs.get("is_online"):
        required -= set(ONLINE_SCREENING_FIELDS)
        kept -= set(ONLINE_SCREENING_FIELDS)

    errors = {field: ["This field is required."] for field in sorted(required) if attrs.get(field) in (None, "")}
    if errors:
        raise serializers.ValidationError(errors)

    for field, default in IMPACT_DETAIL_FIELD_DEFAULTS.items():
        if field not in kept:
            attrs[field] = default
    return attrs


def validate_trusted_url(value):
    if not value:
        return value

    try:
        parts = urlsplit(value)
    except ValueError:
        raise serializers.ValidationError(GENERIC_TRUSTED_URL_ERROR)

    if parts.scheme != "https":
        raise serializers.ValidationError(GENERIC_TRUSTED_URL_ERROR)

    if parts.username or parts.password:
        raise serializers.ValidationError(GENERIC_TRUSTED_URL_ERROR)

    host = (parts.hostname or "").lower().rstrip(".")
    if not host:
        raise serializers.ValidationError(GENERIC_TRUSTED_URL_ERROR)

    try:
        ipaddress.ip_address(host)
        raise serializers.ValidationError(GENERIC_TRUSTED_URL_ERROR)
    except ValueError:
        pass

    return value
