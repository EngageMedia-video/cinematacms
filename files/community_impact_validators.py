import ipaddress
from urllib.parse import urlsplit

from rest_framework import serializers

GENERIC_TRUSTED_URL_ERROR = "Link is not trustworthy. Please use a secure HTTPS link."


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
