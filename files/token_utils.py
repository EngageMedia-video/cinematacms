"""
Token utilities for restricted media access.

Provides token lifecycle management, brute-force rate limiting,
and HLS manifest rewriting for password-restricted media.

Uses raw Redis client (django_redis.get_redis_connection) for SET operations
that have no equivalent in Django's cache API.
"""

import hmac
import json
import logging
import re
import secrets
from datetime import datetime, timezone
from urllib.parse import urlsplit

from django.conf import settings

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


def _get_redis():
    """Get raw Redis connection. Raises if unavailable."""
    from django_redis import get_redis_connection

    return get_redis_connection("default")


# --- Token lifecycle ---


def generate_token(media_id: str) -> str:
    """Generate a token and store it in Redis with dual-key structure.

    Returns the token string.
    """
    token = secrets.token_urlsafe(32)
    data = json.dumps({"media_id": media_id, "created_at": datetime.now(timezone.utc).isoformat()})

    access_key = ACCESS_KEY_TEMPLATE.format(token=token)
    media_set_key = MEDIA_SET_KEY_TEMPLATE.format(media_id=media_id)

    redis = _get_redis()
    pipe = redis.pipeline()
    ttl = _get_token_ttl()
    pipe.setex(access_key, ttl, data)
    pipe.sadd(media_set_key, access_key)
    pipe.expire(media_set_key, ttl)
    pipe.execute()

    return token


def validate_token(token: str, expected_media_id: str) -> bool:
    """Validate a token exists in Redis and is scoped to the expected media.

    Returns False (fail closed) if Redis is unavailable.
    """
    if not token:
        return False

    access_key = ACCESS_KEY_TEMPLATE.format(token=token)

    try:
        redis = _get_redis()
        data_raw = redis.get(access_key)
    except Exception:
        logger.error("Redis unavailable during token validation — failing closed")
        return False

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

    try:
        redis = _get_redis()
        count = redis.eval(_INVALIDATE_LUA, 1, media_set_key)
        count = int(count)

        if count:
            logger.info("Invalidated %d token(s) for media %s", count, media_id)
        return count
    except Exception:
        logger.error("Failed to invalidate tokens for media %s", media_id, exc_info=True)
        return 0


# --- Rate limiting ---


def check_rate_limit(ip: str, friendly_token: str) -> bool:
    """Check if the IP is rate-limited for this media.

    Returns True if the request is ALLOWED, False if BLOCKED.
    """
    key = RATE_LIMIT_KEY_TEMPLATE.format(ip=ip, friendly_token=friendly_token)

    try:
        redis = _get_redis()
        attempts = redis.get(key)
        return not (attempts is not None and int(attempts) >= _get_brute_force_max_attempts())
    except Exception:
        logger.error("Redis unavailable during rate limit check — failing closed")
        return False


def record_failed_attempt(ip: str, friendly_token: str) -> int:
    """Record a failed password attempt. Returns the new attempt count."""
    key = RATE_LIMIT_KEY_TEMPLATE.format(ip=ip, friendly_token=friendly_token)

    try:
        redis = _get_redis()
        pipe = redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, _get_brute_force_window())
        results = pipe.execute()
        count = results[0]

        if count >= _get_brute_force_max_attempts():
            logger.warning(
                "Rate limit triggered: ip=%s media=%s attempts=%d",
                ip,
                friendly_token,
                count,
            )

        return count
    except Exception:
        logger.error("Failed to record rate limit attempt", exc_info=True)
        return 0


def reset_rate_limit(ip: str, friendly_token: str) -> None:
    """Reset rate limit counter after successful authentication."""
    key = RATE_LIMIT_KEY_TEMPLATE.format(ip=ip, friendly_token=friendly_token)

    try:
        redis = _get_redis()
        redis.delete(key)
    except Exception:
        logger.warning("Failed to reset rate limit", exc_info=True)


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
