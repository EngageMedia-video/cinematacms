"""
Query result caching utilities for Media API endpoints.

This module provides Redis-based caching for expensive database queries
to improve API response times. It works alongside the query optimizations
in views.py to provide multi-layer performance improvements.

Cache Strategy:
    - MediaDetail: Cache full media objects with relations (TTL: 5 minutes)
    - PlaylistDetail: Cache playlist with media items (TTL: 10 minutes)
    - MediaList/Search: Cache paginated results (TTL: 2 minutes)
    - Categories/Tags: Cache lists (TTL: 15 minutes)

Cache Invalidation:
    - Automatic on Media/Playlist save/delete via signals
    - Pattern-based deletion for related queries
    - User-specific cache keys for personalized content
"""

import hashlib
import json
import logging
from typing import Any

from django.conf import settings
from django.core.cache import cache
from django.core.serializers.json import DjangoJSONEncoder

logger = logging.getLogger(__name__)

# Cache configuration
QUERY_CACHE_VERSION = getattr(settings, "QUERY_CACHE_VERSION", 1)
CACHE_KEY_PREFIX = "cinemata:query"
CACHE_VERSION_PREFIX = "cinemata:cache_version"

# Cache timeouts (in seconds)
MEDIA_DETAIL_TIMEOUT = 300  # 5 minutes
PLAYLIST_DETAIL_TIMEOUT = 600  # 10 minutes
MEDIA_LIST_TIMEOUT = 120  # 2 minutes
MEDIA_SEARCH_TIMEOUT = 120  # 2 minutes
CATEGORY_LIST_TIMEOUT = 900  # 15 minutes
TAG_LIST_TIMEOUT = 900  # 15 minutes
RELATED_MEDIA_TIMEOUT = 300  # 5 minutes
CACHE_VERSION_TIMEOUT = 86400 * 7  # 7 days - version keys live longer than data


def _get_cache_version_key(scope: str, identifier: str) -> str:
    """
    Generate a cache version key for a specific scope and identifier.

    Args:
        scope: Cache scope (e.g., 'media', 'playlist', 'media_list')
        identifier: Identifier within scope (e.g., friendly_token, 'all')

    Returns:
        str: Cache version key
    """
    return f"{CACHE_VERSION_PREFIX}:{scope}:{identifier}"


def _get_cache_version(scope: str, identifier: str) -> int:
    """
    Get current cache version for a scope/identifier.

    Args:
        scope: Cache scope
        identifier: Identifier within scope

    Returns:
        int: Current version number (defaults to 1)
    """
    try:
        version_key = _get_cache_version_key(scope, identifier)
        version = cache.get(version_key)
        if version is None:
            # Initialize version to 1 with TTL on first access
            cache.set(version_key, 1, CACHE_VERSION_TIMEOUT)
            return 1
        return int(version)
    except Exception as e:
        logger.warning(f"Failed to get cache version for {scope}:{identifier}: {e}")
        return 1


def _bump_cache_version(scope: str, identifier: str) -> int:
    """
    Increment cache version for a scope/identifier.

    This is the core of backend-agnostic cache invalidation.
    When a version is bumped, all cache keys using that version become stale.

    Args:
        scope: Cache scope
        identifier: Identifier within scope

    Returns:
        int: New version number
    """
    try:
        version_key = _get_cache_version_key(scope, identifier)

        # Check if key exists first
        current_version = cache.get(version_key)
        if current_version is None:
            # Initialize on first bump with TTL
            cache.set(version_key, 1, CACHE_VERSION_TIMEOUT)
            logger.debug(f"Initialized cache version for {scope}:{identifier} to 1")
            return 1

        # Try atomic increment (Redis, Memcached)
        try:
            new_version = cache.incr(version_key)
            # Do NOT call cache.set() here - it would create a race condition
            # The TTL was set during initialization and persists across incr() calls
            logger.debug(f"Bumped cache version for {scope}:{identifier} to {new_version}")
            return new_version
        except (AttributeError, ValueError):
            # Fallback for backends without incr support
            new_version = current_version + 1
            cache.set(version_key, new_version, CACHE_VERSION_TIMEOUT)
            logger.debug(f"Bumped cache version for {scope}:{identifier} to {new_version} (fallback)")
            return new_version

    except Exception as e:
        logger.exception(f"Failed to bump cache version for {scope}:{identifier}: {e}")
        return 1


def _generate_cache_key(*args, **kwargs) -> str:
    """
    Generate a cache key from arguments.

    Args:
        *args: Positional arguments to include in key
        **kwargs: Keyword arguments to include in key

    Returns:
        str: MD5 hash-based cache key
    """
    # Create a stable representation of arguments
    key_parts = [str(arg) for arg in args]

    # Sort kwargs for consistent hashing
    if kwargs:
        sorted_kwargs = sorted(kwargs.items())
        key_parts.extend([f"{k}={v}" for k, v in sorted_kwargs])

    key_string = ":".join(key_parts)
    key_hash = hashlib.md5(key_string.encode("utf-8")).hexdigest()[:16]

    return f"{CACHE_KEY_PREFIX}:{key_hash}"


def get_media_detail_cache_key(friendly_token: str, user_id: int | None = None) -> str:
    """
    Generate cache key for media detail endpoint with versioning.

    The cache key includes a version token that gets bumped when media is updated.
    This makes the cache backend-agnostic (works without delete_pattern).

    Args:
        friendly_token: Media friendly token
        user_id: Optional user ID for personalized content

    Returns:
        str: Cache key with version token
    """
    user_part = user_id if user_id else "anon"
    version = _get_cache_version("media", friendly_token)
    return f"{CACHE_KEY_PREFIX}:media_detail:{friendly_token}:{user_part}:v{version}"


def get_playlist_detail_cache_key(friendly_token: str, user_id: int | None = None) -> str:
    """
    Generate cache key for playlist detail endpoint with versioning.

    Args:
        friendly_token: Playlist friendly token
        user_id: Optional user ID for personalized content

    Returns:
        str: Cache key with version token
    """
    user_part = user_id if user_id else "anon"
    version = _get_cache_version("playlist", friendly_token)
    return f"{CACHE_KEY_PREFIX}:playlist_detail:{friendly_token}:{user_part}:v{version}"


def get_media_list_cache_key(
    show: str = "latest", category: str | None = None, tag: str | None = None, page: int = 1, user_id: int | None = None
) -> str:
    """
    Generate cache key for media list endpoint with versioning.

    Args:
        show: Show parameter (latest/featured/recommended)
        category: Optional category filter
        tag: Optional tag filter
        page: Page number
        user_id: Optional user ID for personalized content

    Returns:
        str: Cache key with version token
    """
    # Use a global media_list version for all list queries
    version = _get_cache_version("media_list", "all")
    parts = [
        CACHE_KEY_PREFIX,
        "media_list",
        show,
        category or "all",
        tag or "all",
        str(page),
        str(user_id) if user_id else "anon",
        f"v{version}",
    ]
    return ":".join(parts)


def get_media_search_cache_key(query_params: dict[str, Any], page: int = 1) -> str:
    """
    Generate cache key for media search endpoint with versioning.

    Args:
        query_params: Search query parameters dict
        page: Page number

    Returns:
        str: Cache key with version token
    """
    # Create stable hash of query params
    sorted_params = sorted(query_params.items())
    params_str = json.dumps(sorted_params, cls=DjangoJSONEncoder)
    params_hash = hashlib.md5(params_str.encode("utf-8")).hexdigest()[:16]

    # Use same version as media_list (search results affected by media changes)
    version = _get_cache_version("media_list", "all")
    return f"{CACHE_KEY_PREFIX}:media_search:{params_hash}:p{page}:v{version}"


def get_related_media_cache_key(friendly_token: str, limit: int = 100) -> str:
    """
    Generate cache key for related media with versioning.

    Args:
        friendly_token: Media friendly token
        limit: Number of related items

    Returns:
        str: Cache key with version token
    """
    # Related media depends both on this specific media and the overall media list
    media_version = _get_cache_version("media", friendly_token)
    list_version = _get_cache_version("media_list", "all")
    return f"{CACHE_KEY_PREFIX}:related_media:{friendly_token}:{limit}:v{media_version}_{list_version}"


def get_cached_result(cache_key: str) -> Any | None:
    """
    Get cached query result with error handling.

    Args:
        cache_key: Cache key to retrieve

    Returns:
        Cached result or None if not found
    """
    try:
        result = cache.get(cache_key, version=QUERY_CACHE_VERSION)
        if result is not None:
            logger.debug(f"Query cache HIT: {cache_key}")
            return result
        else:
            logger.debug(f"Query cache MISS: {cache_key}")
            return None
    except Exception as e:
        logger.warning(f"Cache get failed for {cache_key}: {e}")
        return None


def set_cached_result(cache_key: str, data: Any, timeout: int) -> bool:
    """
    Set cached query result with error handling.

    Args:
        cache_key: Cache key to set
        data: Data to cache
        timeout: Cache timeout in seconds

    Returns:
        bool: True if successful
    """
    try:
        cache.set(cache_key, data, timeout, version=QUERY_CACHE_VERSION)
        logger.debug(f"Query cache SET: {cache_key} (TTL: {timeout}s)")
        return True
    except Exception as e:
        logger.warning(f"Cache set failed for {cache_key}: {e}")
        return False


def invalidate_media_cache(friendly_token: str) -> int:
    """
    Invalidate all cache entries for a specific media using version bumping.

    This is backend-agnostic and works with any Django cache backend.
    When the version is bumped, all cached queries for this media become stale
    because their cache keys no longer match.

    Called when media is updated/deleted.

    Args:
        friendly_token: Media friendly token

    Returns:
        int: Always returns 1 (version was bumped)
    """
    try:
        # Bump version for this specific media
        # This invalidates: media_detail, related_media for this media
        _bump_cache_version("media", friendly_token)

        # Also bump the global media_list version
        # This invalidates: related_media for ALL media (since relationships changed)
        _bump_cache_version("media_list", "all")

        logger.info(f"Invalidated cache for media {friendly_token} via version bump")
        return 1  # Indicate success

    except Exception as e:
        logger.error(f"Cache invalidation failed for media {friendly_token}: {e}")
        return 0


def invalidate_playlist_cache(friendly_token: str) -> int:
    """
    Invalidate all cache entries for a specific playlist using version bumping.

    Args:
        friendly_token: Playlist friendly token

    Returns:
        int: Always returns 1 (version was bumped)
    """
    try:
        # Bump version for this specific playlist
        _bump_cache_version("playlist", friendly_token)

        logger.info(f"Invalidated cache for playlist {friendly_token} via version bump")
        return 1

    except Exception as e:
        logger.error(f"Cache invalidation failed for playlist {friendly_token}: {e}")
        return 0


def invalidate_media_list_cache() -> int:
    """
    Invalidate all media list cache entries using version bumping.

    This affects: media_list, media_search, and related_media queries.
    Called when new media is added or media state changes.

    Returns:
        int: Always returns 1 (version was bumped)
    """
    try:
        # Bump the global media_list version
        # This invalidates ALL media_list, media_search, and related_media caches
        _bump_cache_version("media_list", "all")

        logger.info("Invalidated media list/search cache via version bump")
        return 1

    except Exception as e:
        logger.error(f"Media list cache invalidation failed: {e}")
        return 0


def invalidate_category_cache(category_title: str | None = None) -> int:
    """
    Invalidate category-related cache entries using version bumping.

    Args:
        category_title: Optional specific category title (currently unused,
                       all category changes invalidate the entire media_list)

    Returns:
        int: Always returns 1 (version was bumped)
    """
    try:
        # Bump the global media_list version
        # Category changes affect media lists and searches
        _bump_cache_version("media_list", "all")

        logger.info(f"Invalidated cache for category {category_title} via version bump")
        return 1

    except Exception as e:
        logger.error(f"Category cache invalidation failed: {e}")
        return 0


def invalidate_all_query_cache() -> int:
    """
    Clear all query cache entries by bumping all version keys.

    This is backend-agnostic and works on any Django cache backend.
    Use sparingly - for maintenance or emergency.

    Returns:
        int: Number of version keys bumped
    """
    try:
        # Bump the global media_list version (affects lists, searches, related)
        _bump_cache_version("media_list", "all")

        # Note: Individual media and playlist versions are NOT bumped here
        # because there could be thousands of them. They'll naturally expire.
        # If you need to clear everything immediately, use cache.clear() instead.

        logger.info("Bumped global cache versions (media_list)")
        return 1

    except Exception as e:
        logger.error(f"Full cache clear failed: {e}")
        return 0
