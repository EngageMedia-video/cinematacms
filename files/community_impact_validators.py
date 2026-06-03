import ipaddress
from urllib.parse import urlsplit

from django.conf import settings
from rest_framework import serializers

GENERIC_TRUSTED_URL_ERROR = "Link is not trustworthy. Please use a known sharing service."


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

    allowed_hosts = {host.lower().rstrip(".") for host in settings.TRUSTED_IMPACT_LINK_HOSTS}
    if not any(host == allowed_host or host.endswith("." + allowed_host) for allowed_host in allowed_hosts):
        raise serializers.ValidationError(GENERIC_TRUSTED_URL_ERROR)

    return value
