"""
Cache utilities for media permission management.

This module provides utilities for managing Redis cache related to media permissions.
It's designed to be imported by both models.py and secure_media_views.py to avoid
circular import issues.

All cache access goes through the application-owned cache adapter, which records
one bounded telemetry observation per logical operation.

Functions:
    - clear_media_permission_cache: Clear permission cache for specific media
    - clear_user_permission_cache: Clear permission cache for specific user
    - get_permission_cache_key: Generate cache keys for permissions
    - invalidate_media_cache_patterns: Clear cache using patterns (if available)

Cache Key Patterns:
    - media_permission:{user_id}:{media_uid}[:{additional_data_hash}]
    - elevated_access:{user_id}:{media_uid}
"""

import hashlib
import logging
import time
from typing import Any

from django.conf import settings

from cms.cache_telemetry import owned_cache

logger = logging.getLogger(__name__)

permission_cache = owned_cache.bind("permission")

# Cache configuration constants

# Get cache configuration from Django settings with fallbacks
PERMISSION_CACHE_TIMEOUT = getattr(settings, "PERMISSION_CACHE_TIMEOUT", 300)  # Default: 5 minutes
RESTRICTED_MEDIA_CACHE_TIMEOUT = getattr(settings, "RESTRICTED_PERMISSION_CACHE_TIMEOUT", 60)  # Default: 1 minute
CACHE_KEY_PREFIX = getattr(settings, "PERMISSION_CACHE_KEY_PREFIX", "cinemata")
CACHE_VERSION = getattr(settings, "PERMISSION_CACHE_VERSION", 1)

# Cache key templates for better performance
PERMISSION_KEY_TEMPLATE = f"{CACHE_KEY_PREFIX}:media_permission:{{user_id}}:{{media_uid}}"
ELEVATED_ACCESS_KEY_TEMPLATE = f"{CACHE_KEY_PREFIX}:elevated_access:{{user_id}}:{{media_uid}}"
RESTRICTED_KEY_TEMPLATE = f"{CACHE_KEY_PREFIX}:media_permission:{{user_id}}:{{media_uid}}:{{data_hash}}"


def _normalize_media_uid(media_uid: str | Any) -> str:
    if hasattr(media_uid, "hex"):
        return media_uid.hex
    return str(media_uid)


def get_permission_cache_key(user_id: int | str, media_uid: str, additional_data: str | None = None) -> str:
    """
    Generate a cache key for user permission checks.

    Args:
        user_id: User ID (can be 'anonymous' for non-authenticated users)
        media_uid: Media UID string
        additional_data: Optional additional data to include in key (e.g., password hash)

    Returns:
        str: Cache key for the permission check
    """
    media_uid = _normalize_media_uid(media_uid)

    if additional_data:
        # Use SHA-256 for better security and consistency, truncated for cache efficiency
        data_hash = hashlib.sha256(additional_data.encode("utf-8")).hexdigest()[:12]
        return RESTRICTED_KEY_TEMPLATE.format(user_id=user_id, media_uid=media_uid, data_hash=data_hash)

    return PERMISSION_KEY_TEMPLATE.format(user_id=user_id, media_uid=media_uid)


def get_elevated_access_cache_key(user_id: int, media_uid: str) -> str:
    """
    Generate a cache key for elevated access checks.

    Args:
        user_id: User ID
        media_uid: Media UID string

    Returns:
        str: Cache key for the elevated access check
    """
    media_uid = _normalize_media_uid(media_uid)
    return ELEVATED_ACCESS_KEY_TEMPLATE.format(user_id=user_id, media_uid=media_uid)


def get_cached_permission(cache_key: str) -> bool | None:
    """
    Get cached permission result.

    The owned adapter is fail-soft: a cache backend error is observed and
    reported as a miss without raising.

    Args:
        cache_key: The cache key to look up

    Returns:
        bool or None: Cached permission result, or None if not found/error
    """
    return permission_cache.get(cache_key, version=CACHE_VERSION)


def set_cached_permission(cache_key: str, permission_result: bool, timeout: int | None = None) -> bool:
    """
    Set cached permission result.

    Args:
        cache_key: The cache key to set
        permission_result: The permission result to cache
        timeout: Cache timeout in seconds (uses default if None)

    Returns:
        bool: True if cache was set successfully, False otherwise
    """
    if timeout is None:
        timeout = PERMISSION_CACHE_TIMEOUT

    return permission_cache.set(cache_key, permission_result, timeout, version=CACHE_VERSION)


def batch_get_cached_permissions(cache_keys: list) -> dict[str, bool | None]:
    """
    Get multiple cached permission results in a single operation.

    Args:
        cache_keys: List of cache keys to retrieve

    Returns:
        dict: Mapping of cache_key -> permission_result (or None if not found)
    """
    return permission_cache.get_many(cache_keys, version=CACHE_VERSION)


def batch_set_cached_permissions(cache_data: dict[str, bool], timeout: int | None = None) -> bool:
    """
    Set multiple cached permission results in a single operation.

    Args:
        cache_data: Dictionary mapping cache_key -> permission_result
        timeout: Cache timeout in seconds (uses default if None)

    Returns:
        bool: True if all cache entries were set successfully, False otherwise
    """
    if timeout is None:
        timeout = PERMISSION_CACHE_TIMEOUT

    return permission_cache.set_many(cache_data, timeout, version=CACHE_VERSION)


def clear_media_permission_cache(media_uid: str | Any, user_id: int | None = None) -> bool:
    """
    Clear permission cache for a specific media.
    This can be called from models.py or other modules when media permissions change.

    Args:
        media_uid: The UID of the media file (can be string or UUID object)
        user_id: Optional specific user ID to clear cache for

    Returns:
        bool: True if cache was cleared successfully, False otherwise

    Example usage:
        # Clear cache for specific user/media combination
        clear_media_permission_cache(media.uid, user.id)

        # Clear cache for all users for a specific media
        clear_media_permission_cache(media.uid)
    """
    media_uid = _normalize_media_uid(media_uid)
    if user_id:
        # Clear specific user's cache (base + restricted + elevated)
        if permission_cache.supports("delete_pattern"):
            patterns = [
                f"{CACHE_KEY_PREFIX}:media_permission:{user_id}:{media_uid}*",
                f"{CACHE_KEY_PREFIX}:elevated_access:{user_id}:{media_uid}",
            ]
            for pattern in patterns:
                permission_cache.delete_pattern(pattern, version=CACHE_VERSION)
            return True
        else:
            # Fallback clears known keys; restricted variants cannot be enumerated
            cache_keys = [
                get_permission_cache_key(user_id, media_uid),
                get_elevated_access_cache_key(user_id, media_uid),
            ]
            permission_cache.delete_many(cache_keys, version=CACHE_VERSION)
            logger.warning("delete_pattern not available; restricted permission keys may remain")
            return True
    else:
        # For clearing all users' cache for this media, we'd need to use
        # cache.delete_pattern() which requires django-redis
        # This is a more expensive operation and should be used sparingly
        if permission_cache.supports("delete_pattern"):
            patterns = [
                f"{CACHE_KEY_PREFIX}:media_permission:*:{media_uid}*",
                f"{CACHE_KEY_PREFIX}:elevated_access:*:{media_uid}",
            ]
            for pattern in patterns:
                permission_cache.delete_pattern(pattern, version=CACHE_VERSION)
            return True
        else:
            logger.warning("delete_pattern not available, cannot clear all user caches for media")
            return False


def clear_user_permission_cache(user_id: int) -> bool:
    """
    Clear all permission cache entries for a specific user.
    Useful when user roles change (e.g., user becomes editor/manager).

    Args:
        user_id: The ID of the user

    Returns:
        bool: True if cache was cleared successfully, False otherwise
    """
    if permission_cache.supports("delete_pattern"):
        patterns = [
            f"{CACHE_KEY_PREFIX}:media_permission:{user_id}:*",
            f"{CACHE_KEY_PREFIX}:elevated_access:{user_id}:*",
        ]
        for pattern in patterns:
            permission_cache.delete_pattern(pattern, version=CACHE_VERSION)
        return True
    else:
        logger.warning("delete_pattern not available, cannot clear all caches for user")
        return False


def invalidate_all_permission_cache() -> int:
    """
    Clear all permission-related cache entries.
    Use sparingly - mainly for maintenance or emergency situations.

    Returns:
        int: Number of cache entries cleared
    """
    patterns = [
        f"{CACHE_KEY_PREFIX}:media_permission:*",
        f"{CACHE_KEY_PREFIX}:elevated_access:*",
    ]

    total_cleared = 0
    if permission_cache.supports("delete_pattern"):
        for pattern in patterns:
            total_cleared += permission_cache.delete_pattern(pattern, version=CACHE_VERSION)
        return total_cleared
    else:
        logger.warning("Pattern-based cache deletion not available. django-redis backend required for this feature.")
        return 0


def get_cache_stats() -> dict[str, Any]:
    """
    Get statistics about permission cache usage (if available).

    Returns:
        dict: Cache statistics or empty dict if not available
    """
    return owned_cache.get_stats()


def health_check() -> dict[str, Any]:
    """
    Perform a health check on the cache system.

    Returns:
        dict: Health check results including latency and connectivity
    """
    start_time = time.time()
    test_key = f"{CACHE_KEY_PREFIX}:health_check"
    test_value = "test"

    result = owned_cache.probe(test_key, test_value, 30)
    latency = (time.time() - start_time) * 1000

    if result.get("status") == "healthy":
        return {"status": "healthy", "latency_ms": round(latency, 2), "timestamp": time.time()}
    return {
        "status": "unhealthy",
        "error": "Cache value mismatch",
        "latency_ms": round(latency, 2),
        "timestamp": time.time(),
    }
