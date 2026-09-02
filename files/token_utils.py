"""
Token utilities for restricted media access.

Provides token lifecycle management, brute-force rate limiting,
and HLS manifest rewriting for password-restricted media.

All restricted-media Redis state goes through the application-owned Redis
adapter (cms.redis_telemetry), which records one bounded telemetry
observation per logical operation while keeping keys and values out of
metrics, logs, and spans.
"""

import hmac
import json
import logging
import re
import secrets
from datetime import datetime, timezone
from urllib.parse import urlsplit

from django.conf import settings

from cms.redis_telemetry import restricted_media_redis

logger = logging.getLogger("files.security")

# Settings with defaults
TOKEN_KEY_PREFIX = getattr(settings, "MEDIA_TOKEN_KEY_PREFIX", "cinemata_media_token")


def _get_token_ttl():
    return getattr(settings, "RESTRICTED_MEDIA_TOKEN_TTL", 14400)  # 4 hours


def _get_brute_force_max_attempts():
    return getattr(settings, "PASSWORD_BRUTE_FORCE_MAX_ATTEMPTS", 5)


def _get_brute_force_window():
    return getattr(settings, "PASSWORD_BRUTE_FORCE_WINDOW", 900)  # 15 minutes


# Redis key templates
ACCESS_KEY_TEMPLATE = f"{TOKEN_KEY_PREFIX}:access:{{token}}"
MEDIA_SET_KEY_TEMPLATE = f"{TOKEN_KEY_PREFIX}:media:{{media_id}}"
RATE_LIMIT_KEY_TEMPLATE = f"{TOKEN_KEY_PREFIX}:pw_attempts:{{ip}}:{{friendly_token}}"

# Regex for URI="..." attributes in M3U8 tags
_URI_ATTR_RE = re.compile(r'(URI=")([^"]+)(")')


# --- Token lifecycle ---


def generate_token(media_id: str) -> str:
    """Generate a token and store it in Redis with dual-key structure.

    Returns the token string.
    """
    token = secrets.token_urlsafe(32)
    data = json.dumps({"media_id": media_id, "created_at": datetime.now(timezone.utc).isoformat()})

    access_key = ACCESS_KEY_TEMPLATE.format(token=token)
    media_set_key = MEDIA_SET_KEY_TEMPLATE.format(media_id=media_id)

    ttl = _get_token_ttl()
    if not restricted_media_redis.store_token(access_key, media_set_key, data, ttl):
        # Fail closed loudly: callers report a server error instead of issuing
        # a token that cannot validate later.
        raise ConnectionError("restricted media token storage is unavailable")

    return token


def validate_token(token: str, expected_media_id: str) -> bool:
    """Validate a token exists in Redis and is scoped to the expected media.

    Returns False (fail closed) if Redis is unavailable.
    """
    if not token:
        return False

    access_key = ACCESS_KEY_TEMPLATE.format(token=token)

    data_raw = restricted_media_redis.get_token(access_key)

    if data_raw is None:
        return False

    try:
        data = json.loads(data_raw)
    except (json.JSONDecodeError, TypeError):
        return False

    stored_media_id = data.get("media_id", "")
    return hmac.compare_digest(str(stored_media_id), str(expected_media_id))


_INVALIDATE_LUA = """
local keys = redis.call('SMEMBERS', KEYS[1])
local count = 0
for _, key in ipairs(keys) do
    count = count + redis.call('DEL', key)
end
redis.call('DEL', KEYS[1])
return count
"""


def invalidate_media_tokens(media_id: str) -> int:
    """Invalidate all active tokens for a media item atomically via Lua script.

    Uses a Redis Lua script to ensure no race condition between reading the
    token set and deleting the keys — a concurrent generate_token() cannot
    slip a new key in between.

    Returns the number of tokens invalidated.
    """
    media_set_key = MEDIA_SET_KEY_TEMPLATE.format(media_id=media_id)

    count = restricted_media_redis.invalidate_tokens(media_set_key, _INVALIDATE_LUA)

    if count:
        logger.info("Invalidated %d token(s) for a media item", count)
    return count


# --- Rate limiting ---


def check_rate_limit(ip: str, friendly_token: str) -> bool:
    """Check if the IP is rate-limited for this media.

    Returns True if the request is ALLOWED, False if BLOCKED.
    """
    key = RATE_LIMIT_KEY_TEMPLATE.format(ip=ip, friendly_token=friendly_token)

    return restricted_media_redis.check_rate_limit(key, _get_brute_force_max_attempts())


def record_failed_attempt(ip: str, friendly_token: str) -> int:
    """Record a failed password attempt. Returns the new attempt count."""
    key = RATE_LIMIT_KEY_TEMPLATE.format(ip=ip, friendly_token=friendly_token)

    count = restricted_media_redis.record_failed_attempt(key, _get_brute_force_window())

    if count >= _get_brute_force_max_attempts():
        logger.warning("Rate limit triggered for a restricted-media password attempt")

    return count


def reset_rate_limit(ip: str, friendly_token: str) -> None:
    """Reset rate limit counter after successful authentication."""
    key = RATE_LIMIT_KEY_TEMPLATE.format(ip=ip, friendly_token=friendly_token)

    restricted_media_redis.reset_rate_limit(key)


# --- Shared password authentication ---


def authenticate_restricted_media(media, password, ip):
    """Validate password for restricted media.

    Returns (token, None) on success, or (None, error_dict) on failure.
    error_dict has keys: detail, status_code.
    """
    # Rate limit runs before reading password — blocked users get 429 even with empty body
    if not check_rate_limit(ip, media.friendly_token):
        return None, {
            "detail": "Too many failed attempts. Please try again later.",
            "status_code": 429,
        }

    if not password:
        return None, {"detail": "Password is required.", "status_code": 400}

    from django.contrib.auth.hashers import check_password

    if check_password(password, media.password):
        token = generate_token(media.uid_hex)
        reset_rate_limit(ip, media.friendly_token)
        return token, None
    else:
        record_failed_attempt(ip, media.friendly_token)
        return None, {"detail": "The password is incorrect.", "status_code": 403}


# --- HLS manifest rewriting ---


def _append_token_to_uri(uri: str, token: str) -> str:
    """Append ?token= (or &token=) to a URI.

    Skips absolute URIs (those with a scheme or netloc) to avoid leaking
    the bearer token to third-party hosts referenced in HLS manifests.
    """
    parts = urlsplit(uri)
    if parts.scheme or parts.netloc:
        return uri
    separator = "&" if "?" in uri else "?"
    return f"{uri}{separator}token={token}"


def rewrite_m3u8(content: str, token: str) -> str:
    """Rewrite an M3U8 manifest to inject token into all URIs.

    Handles:
    - Bare segment/playlist URIs (lines not starting with #)
    - URI="..." attributes in tags (#EXT-X-MAP, #EXT-X-KEY, #EXT-X-I-FRAME-STREAM-INF)
    """
    lines = content.split("\n")
    result = []

    for line in lines:
        stripped = line.strip()

        if not stripped or stripped.startswith("#"):
            # Rewrite URI="..." attributes in tags
            if 'URI="' in stripped:
                line = _URI_ATTR_RE.sub(
                    lambda m: m.group(1) + _append_token_to_uri(m.group(2), token) + m.group(3),
                    line,
                )
            result.append(line)
        else:
            # Bare URI line (segment or playlist reference)
            result.append(_append_token_to_uri(stripped, token))

    return "\n".join(result)
