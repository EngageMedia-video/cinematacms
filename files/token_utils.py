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

from django.conf import settings

logger = logging.getLogger("files.security")

# Settings with defaults
TOKEN_KEY_PREFIX = getattr(settings, "MEDIA_TOKEN_KEY_PREFIX", "cinemata_media_token")
TOKEN_TTL = getattr(settings, "RESTRICTED_MEDIA_TOKEN_TTL", 14400)  # 4 hours
BRUTE_FORCE_MAX_ATTEMPTS = getattr(settings, "PASSWORD_BRUTE_FORCE_MAX_ATTEMPTS", 5)
BRUTE_FORCE_WINDOW = getattr(settings, "PASSWORD_BRUTE_FORCE_WINDOW", 900)  # 15 minutes

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
    pipe.setex(access_key, TOKEN_TTL, data)
    pipe.sadd(media_set_key, access_key)
    pipe.expire(media_set_key, TOKEN_TTL)
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


def invalidate_media_tokens(media_id: str) -> int:
    """Invalidate all active tokens for a media item. Atomic via Redis pipeline.

    Returns the number of tokens invalidated.
    """
    media_set_key = MEDIA_SET_KEY_TEMPLATE.format(media_id=media_id)

    try:
        redis = _get_redis()
        token_keys = redis.smembers(media_set_key)
        if not token_keys:
            return 0

        pipe = redis.pipeline()
        for key in token_keys:
            pipe.delete(key)
        pipe.delete(media_set_key)
        pipe.execute()

        count = len(token_keys)
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
        return not (attempts is not None and int(attempts) >= BRUTE_FORCE_MAX_ATTEMPTS)
    except Exception:
        logger.error("Redis unavailable during rate limit check — allowing request")
        return True


def record_failed_attempt(ip: str, friendly_token: str) -> int:
    """Record a failed password attempt. Returns the new attempt count."""
    key = RATE_LIMIT_KEY_TEMPLATE.format(ip=ip, friendly_token=friendly_token)

    try:
        redis = _get_redis()
        pipe = redis.pipeline()
        pipe.incr(key)
        pipe.expire(key, BRUTE_FORCE_WINDOW)
        results = pipe.execute()
        count = results[0]

        if count >= BRUTE_FORCE_MAX_ATTEMPTS:
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
        pass


# --- HLS manifest rewriting ---


def _append_token_to_uri(uri: str, token: str) -> str:
    """Append ?token= (or &token=) to a URI."""
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
