"""
Cache utilities for media permission management.

This module provides utilities for managing Redis cache related to media permissions.
It's designed to be imported by both models.py and secure_media_views.py to avoid
circular import issues.

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
from django.core.cache import cache

logger = logging.getLogger(__name__)

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
    return ELEVATED_ACCESS_KEY_TEMPLATE.format(user_id=user_id, media_uid=media_uid)


def get_cached_permission(cache_key: str) -> bool | None:
    """
    Get cached permission result with enhanced error handling.

    Args:
        cache_key: The cache key to look up

    Returns:
        bool or None: Cached permission result, or None if not found/error
    """
    try:
        result = cache.get(cache_key, version=CACHE_VERSION)
        if result is not None:
            logger.debug(f"Cache hit for key: {cache_key}")
        return result
    except Exception as e:
        logger.warning(f"Cache get failed for key {cache_key}: {e}")
        return None


def set_cached_permission(cache_key: str, permission_result: bool, timeout: int | None = None) -> bool:
    """
    Set cached permission result with enhanced error handling.

    Args:
        cache_key: The cache key to set
        permission_result: The permission result to cache
        timeout: Cache timeout in seconds (uses default if None)

    Returns:
        bool: True if cache was set successfully, False otherwise
    """
    if timeout is None:
        timeout = PERMISSION_CACHE_TIMEOUT

    try:
        cache.set(cache_key, permission_result, timeout, version=CACHE_VERSION)
        logger.debug(f"Cached permission result for key: {cache_key}")
        return True
    except Exception as e:
        logger.warning(f"Cache set failed for key {cache_key}: {e}")
        return False


def batch_get_cached_permissions(cache_keys: list) -> dict[str, bool | None]:
    """
    Get multiple cached permission results in a single operation.

    Args:
        cache_keys: List of cache keys to retrieve

    Returns:
        dict: Mapping of cache_key -> permission_result (or None if not found)
    """
    try:
        results = cache.get_many(cache_keys, version=CACHE_VERSION)
        logger.debug(f"Batch cache get: {len(results)}/{len(cache_keys)} hits")
        return results
    except Exception as e:
        logger.warning(f"Batch cache get failed: {e}")
        return {}


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

    try:
        cache.set_many(cache_data, timeout, version=CACHE_VERSION)
        logger.debug(f"Batch cache set: {len(cache_data)} entries")
        return True
    except Exception as e:
        logger.warning(f"Batch cache set failed: {e}")
        return False


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
    # Convert UUID to string if necessary
    if hasattr(media_uid, "hex"):
        media_uid = media_uid.hex
    try:
        if user_id:
            # Clear specific user's cache (base + restricted + elevated)
            if hasattr(cache, "delete_pattern"):
                patterns = [
                    f"{CACHE_KEY_PREFIX}:media_permission:{user_id}:{media_uid}*",
                    f"{CACHE_KEY_PREFIX}:elevated_access:{user_id}:{media_uid}",
                ]
                total_deleted = 0
                for pattern in patterns:
                    deleted_count = cache.delete_pattern(pattern, version=CACHE_VERSION)
                    total_deleted += deleted_count
                    logger.debug(f"Cleared {deleted_count} cache entries for pattern: {pattern}")
                logger.info(f"Cleared {total_deleted} cache entries for user {user_id}, media {media_uid}")
                return True
            else:
                # Fallback clears known keys; restricted variants cannot be enumerated
                cache_keys = [
                    get_permission_cache_key(user_id, media_uid),
                    get_elevated_access_cache_key(user_id, media_uid),
                ]
                cache.delete_many(cache_keys, version=CACHE_VERSION)
                logger.warning(
                    "delete_pattern not available; restricted permission keys may remain for "
                    f"user {user_id}, media {media_uid}"
                )
                return True
        else:
            # For clearing all users' cache for this media, we'd need to use
            # cache.delete_pattern() which requires django-redis
            # This is a more expensive operation and should be used sparingly
            try:
                # Try to use delete_pattern if available (django-redis)
                if hasattr(cache, "delete_pattern"):
                    patterns = [
                        f"{CACHE_KEY_PREFIX}:media_permission:*:{media_uid}*",
                        f"{CACHE_KEY_PREFIX}:elevated_access:*:{media_uid}",
                    ]
                    total_deleted = 0
                    for pattern in patterns:
                        deleted_count = cache.delete_pattern(pattern, version=CACHE_VERSION)
                        total_deleted += deleted_count
                        logger.debug(f"Cleared {deleted_count} cache entries for pattern: {pattern}")
                    logger.info(f"Cleared {total_deleted} total cache entries for media {media_uid}")
                    return True
                else:
                    logger.warning("delete_pattern not available, cannot clear all user caches for media")
                    return False
            except Exception as e:
                logger.warning(f"Pattern-based cache deletion failed: {e}")
                return False
    except Exception as e:
        logger.error(f"Failed to clear permission cache for media {media_uid}: {e}")
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
    try:
        if hasattr(cache, "delete_pattern"):
            patterns = [
                f"{CACHE_KEY_PREFIX}:media_permission:{user_id}:*",
                f"{CACHE_KEY_PREFIX}:elevated_access:{user_id}:*",
            ]
            total_deleted = 0
            for pattern in patterns:
                deleted_count = cache.delete_pattern(pattern, version=CACHE_VERSION)
                total_deleted += deleted_count
                logger.debug(f"Cleared {deleted_count} cache entries for user {user_id} with pattern: {pattern}")
            logger.info(f"Cleared {total_deleted} total cache entries for user {user_id}")
            return True
        else:
            logger.warning("delete_pattern not available, cannot clear all caches for user")
            return False
    except Exception as e:
        logger.error(f"Failed to clear permission cache for user {user_id}: {e}")
        return False


def invalidate_all_permission_cache() -> int:
    """
    Clear all permission-related cache entries.
    Use sparingly - mainly for maintenance or emergency situations.

    Returns:
        int: Number of cache entries cleared
    """
    try:
        patterns = [
            f"{CACHE_KEY_PREFIX}:media_permission:*",
            f"{CACHE_KEY_PREFIX}:elevated_access:*",
        ]

        total_cleared = 0
        if hasattr(cache, "delete_pattern"):
            for pattern in patterns:
                count = cache.delete_pattern(pattern, version=CACHE_VERSION)
                total_cleared += count
                logger.info(f"Cleared {count} entries for pattern: {pattern}")
            logger.info(f"Total permission cache entries cleared: {total_cleared}")
            return total_cleared
        else:
            logger.warning(
                "Pattern-based cache deletion not available. django-redis backend required for this feature."
            )
            return 0
    except Exception as e:
        logger.error(f"Error clearing all permission cache: {e}")
        return 0


def get_cache_stats() -> dict[str, Any]:
    """
    Get statistics about permission cache usage (if available).

    Returns:
        dict: Cache statistics or empty dict if not available
    """
    try:
        if hasattr(cache, "get_stats"):
            return cache.get_stats()
        else:
            return {"message": "Cache statistics not available"}
    except Exception as e:
        logger.warning(f"Failed to get cache stats: {e}")
        return {"error": str(e)}


def health_check() -> dict[str, Any]:
    """
    Perform a health check on the cache system.

    Returns:
        dict: Health check results including latency and connectivity
    """
    start_time = time.time()
    test_key = f"{CACHE_KEY_PREFIX}:health_check"
    test_value = "test"

    try:
        # Test cache set
        cache.set(test_key, test_value, 30, version=CACHE_VERSION)

        # Test cache get
        retrieved_value = cache.get(test_key, version=CACHE_VERSION)

        # Test cache delete
        cache.delete(test_key, version=CACHE_VERSION)

        latency = (time.time() - start_time) * 1000  # Convert to milliseconds

        if retrieved_value == test_value:
            return {"status": "healthy", "latency_ms": round(latency, 2), "timestamp": time.time()}
        else:
            return {
                "status": "unhealthy",
                "error": "Cache value mismatch",
                "latency_ms": round(latency, 2),
                "timestamp": time.time(),
            }
    except Exception as e:
        latency = (time.time() - start_time) * 1000
        return {"status": "unhealthy", "error": str(e), "latency_ms": round(latency, 2), "timestamp": time.time()}
