import ipaddress
from datetime import timedelta
from urllib.parse import urlsplit

from django.utils import timezone
from rest_framework import serializers

GENERIC_TRUSTED_URL_ERROR = "Link is not trustworthy. Please use a secure HTTPS link."
FUTURE_EVENT_DATE_ERROR = "Event date cannot be in the future."


def validate_past_event_date(value):
    # A viewer east of settings.TIME_ZONE can already be one calendar day
    # ahead of the server's date.
    if value > timezone.localdate() + timedelta(days=1):
        raise serializers.ValidationError(FUTURE_EVENT_DATE_ERROR)
    return value


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
