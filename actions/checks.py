from django.conf import settings
from django.core.checks import Error, Tags, register


@register(Tags.security)
def validate_action_ip_key(app_configs, **kwargs):
    if not settings.MASK_IPS_FOR_ACTIONS:
        return []
    key = settings.MEDIA_ACTION_IP_HMAC_KEY
    if not key:
        return [Error("MEDIA_ACTION_IP_HMAC_KEY is required when MASK_IPS_FOR_ACTIONS is enabled", id="actions.E001")]
    if not isinstance(key, str) or len(key.encode("utf-8")) < 32:
        return [Error("MEDIA_ACTION_IP_HMAC_KEY must contain at least 32 bytes", id="actions.E002")]
    if key == settings.SECRET_KEY:
        return [Error("MEDIA_ACTION_IP_HMAC_KEY must differ from SECRET_KEY", id="actions.E003")]
    return []
