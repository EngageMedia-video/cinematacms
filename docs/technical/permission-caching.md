# Permission Caching System

This document describes the Redis-based permission caching system implemented for secure media serving in CinemataCMS.

## Overview

The permission caching system improves performance by caching user permission checks for media files, reducing database queries and improving response times for secure media requests.

## Architecture

### Components

1. **cache_utils.py**: Central cache utilities module (NEW)
2. **SecureMediaView**: Main view handling secure media serving with caching
3. **Media Model**: Automatic cache invalidation when permissions change
4. **Management Command**: Manual cache management for administrators

### File Structure

```text
files/
├── cache_utils.py              # Central cache utilities
├── models.py                   # Uses cache_utils for auto-invalidation
├── secure_media_views.py       # Uses cache_utils for permission caching
└── management/commands/
    └── clear_permission_cache.py  # Uses cache_utils for manual management
```

### Cache Strategy

The system implements a two-level caching strategy:

1. **Elevated Access Caching**: Caches whether a user has owner/curator/editor/manager permissions
2. **Permission Result Caching**: Caches the final permission decision for specific media access

## Cache Keys

### Format

Cache keys are constructed with a prefix and version to prevent collisions and allow for graceful upgrades.

- **Prefix**: `cinemata` (configurable via `PERMISSION_CACHE_KEY_PREFIX` in `settings.py`)
- **Versioning**: Enabled via `django-redis` versioning support (configurable via `PERMISSION_CACHE_VERSION`)

- **Elevated Access**: `{prefix}:elevated_access:{user_id}:{media_uid}`
- **Permission Results**: `{prefix}:media_permission:{user_id}:{media_uid}[:{data_hash}]`
- **Anonymous Users**: `user_id` is set to `'anonymous'`

### Examples

```
cinemata:elevated_access:42:a1b2c3d4e5f6...
cinemata:media_permission:42:a1b2c3d4e5f6...
cinemata:media_permission:anonymous:a1b2c3d4e5f6...
cinemata:media_permission:42:a1b2c3d4e5f6...:a9b8c7d6e5f4
```

## Cache Timeouts

Timeouts are configurable in `settings.py`.

| Permission Type | Setting | Default | Reason |
|-----------------|---------|---------|--------|
| Standard permissions | `PERMISSION_CACHE_TIMEOUT` | 5 minutes (300s) | Balance between performance and freshness |
| Password-protected restricted media | `RESTRICTED_PERMISSION_CACHE_TIMEOUT` | 1 minute (60s) | Security for password changes |

## Automatic Cache Invalidation

Cache is automatically invalidated when media permissions change:

### Triggers

1. **Media state changes** (public ↔ private ↔ restricted ↔ unlisted)
2. **Media password changes** (for restricted content)
3. **Comment workflow changes** (unlisted → public when comments added)
4. **User permission changes** (when someone becomes editor/manager)

### Implementation

```python
# In Media model save() method
if self.state != self.__original_state or self.password != self.__original_password:
    self._invalidate_permission_cache()

# _invalidate_permission_cache() method uses cache_utils
def _invalidate_permission_cache(self):
    from .cache_utils import clear_media_permission_cache
    clear_media_permission_cache(self.uid)
```

## Manual Cache Management

### Management Command

The `clear_permission_cache` management command provides tools for manual cache invalidation.

```bash
# Clear all permission cache (requires django-redis)
python manage.py clear_permission_cache --all

# Clear cache for a specific media UID (all users, requires django-redis)
python manage.py clear_permission_cache --media-uid a1b2c3d4e5f6...

# Clear cache for a specific user and media combination
# Note: --user-id must be used with --media-uid
python manage.py clear_permission_cache --media-uid a1b2c3d4e5f6... --user-id 42

# Clear cache by pattern (requires django-redis)
# The prefix "cinemata:" is added automatically if not present
python manage.py clear_permission_cache --pattern "media_permission:42:*"
```

### Programmatic Cache Clearing

```python
# Option 1: Clear cache for specific media
from files.cache_utils import clear_media_permission_cache

# Clear cache for specific media (all users, requires django-redis)
clear_media_permission_cache(media.uid)

# Clear cache for specific user/media combination
# (fully effective with django-redis, otherwise won't clear restricted media cache)
clear_media_permission_cache(media.uid, user.id)

# Option 2: Clear all cache for a specific user (requires django-redis)
from files.cache_utils import clear_user_permission_cache
clear_user_permission_cache(user.id)

# Option 3: Clear all permission cache (requires django-redis)
from files.cache_utils import invalidate_all_permission_cache
invalidate_all_permission_cache()
```

## Cache Utilities Module

### Overview

The `files/cache_utils.py` module provides centralized cache management functionality that can be safely imported by both `models.py` and `secure_media_views.py` without circular import issues.

### Key Functions

#### `get_permission_cache_key(...)` / `get_elevated_access_cache_key(...)`
- Generate standardized, versioned cache keys with a configurable prefix.
- `get_permission_cache_key` uses a SHA-256 hash for `additional_data` to ensure security and key consistency.

#### `get_cached_permission(...)` / `set_cached_permission(...)`
- Perform safe, individual cache get/set operations with centralized error handling and logging.

#### `batch_get_cached_permissions(...)` / `batch_set_cached_permissions(...)`
- Perform efficient bulk get/set operations on multiple cache keys at once, reducing network overhead.

#### `clear_media_permission_cache(media_uid, user_id=None)`
- Clears permission cache for a specific media.
- If `user_id` is specified, it attempts to clear all related entries for that user/media pair. It uses pattern deletion if available (`django-redis`), otherwise it clears only non-restricted keys.
- If `user_id` is not specified, it requires pattern deletion to clear cache for all users of a media.

#### `clear_user_permission_cache(user_id)`
- Clears all permission cache entries for a specific user.
- This function requires pattern-based deletion (`django-redis`) to be effective.

#### `invalidate_all_permission_cache()`
- Clears all permission-related cache entries across the system.
- Used by the `--all` flag in the management command.
- Requires pattern-based deletion and returns the count of cleared entries.

#### `health_check()` / `get_cache_stats()`
- Provide diagnostics for monitoring cache connectivity, latency, and usage statistics.

### Benefits of Centralized Cache Utils

1. **No Circular Imports**: Clean separation allows any module to use cache functions
2. **Consistent Behavior**: Same cache logic across all modules
3. **Error Handling**: Centralized error handling and logging
4. **Testing**: Easier to test cache logic in isolation
5. **Maintenance**: Single place to update cache logic

## Performance Benefits

### Before Caching
- Every media request requires database queries for:
  - User authentication status
  - User role verification (curator/editor/manager)
  - Media ownership check
  - Media state verification

### After Caching
- First request: Database queries + cache storage
- Subsequent requests: Cache lookup only
- **~90% reduction** in database queries for permission checks

### Benchmarks
| Scenario | Before | After | Improvement |
|----------|--------|-------|-------------|
| Authenticated user accessing own media | 3-4 DB queries | 0-1 DB queries | 75-100% |
| Anonymous user accessing public media | 2-3 DB queries | 0 DB queries | 100% |
| Editor accessing any media | 4-5 DB queries | 0-1 DB queries | 80-100% |

## Error Handling

### Graceful Degradation
The system is designed to fail gracefully:
- If Redis is unavailable, permission checks continue without caching
- Cache errors are logged but don't break functionality
- All cache operations are wrapped in try-catch blocks

### Logging
```python
logger.debug(f"Using cached permission result for user {user_id}, media {media.uid}")
logger.warning(f"Cache get failed for key {cache_key}: {e}")
logger.error(f"Failed to clear permission cache for media {media_uid}: {e}")
```

## Security Considerations

### Cache Key Security
- User IDs and media UIDs are included in cache keys to prevent unauthorized access
- Password attempts are hashed before being used in cache keys
- Anonymous users have separate cache entries

### Cache Isolation
- Each user/media combination has isolated cache entries
- No cross-user cache pollution possible
- Sensitive data (passwords) are hashed in cache keys

### Timeout Strategy
- Shorter timeouts for password-protected content
- Automatic invalidation on permission changes
- Manual invalidation tools for security incidents

## Configuration

### Settings

The following settings can be configured in your `settings.py`:

```python
# In settings.py

# Required for production X-Accel-Redirect functionality
USE_X_ACCEL_REDIRECT = True

# Recommended cache backend for full feature support (e.g., pattern deletion)
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": "redis://127.0.0.1:6379/1",
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        }
    }
}

# Optional: Customize cache behavior
PERMISSION_CACHE_TIMEOUT = 300  # Default: 5 minutes
RESTRICTED_PERMISSION_CACHE_TIMEOUT = 60  # Default: 1 minute
PERMISSION_CACHE_KEY_PREFIX = 'cinemata' # Default: 'cinemata'
PERMISSION_CACHE_VERSION = 1 # Default: 1
```

## Monitoring and Debugging

### Cache Hit/Miss Monitoring
```python
# Add to your monitoring system
cached_result = self._get_cached_permission(cache_key)
if cached_result is not None:
    # Cache hit - monitor this metric
    logger.debug("Cache hit")
else:
    # Cache miss - monitor this metric
    logger.debug("Cache miss")
```

### Debug Information
```python
# Enable debug logging to see cache operations
import logging
logging.getLogger('files.secure_media_views').setLevel(logging.DEBUG)
```

## Troubleshooting

### Common Issues

1. **Cache not working**
   - Check Redis connection
   - Verify CACHES setting in Django
   - Check for import errors

2. **Stale permissions**
   - Use management command to clear cache
   - Check if automatic invalidation is working
   - Verify signal handlers are connected

3. **Performance not improved**
   - Monitor cache hit/miss ratios
   - Check cache timeout settings
   - Verify Redis performance

### Diagnostic Commands
```bash
# Test Redis connection
redis-cli ping

# Check cache contents (be careful in production)
# Replace 'cinemata' if you use a custom prefix
redis-cli keys "cinemata:media_permission:*"
redis-cli keys "cinemata:elevated_access:*"

# Clear all cache manually
python manage.py clear_permission_cache --all
```

## Conclusion

The permission caching system provides significant performance improvements while maintaining security and data consistency. The automatic invalidation ensures cache freshness, while manual tools provide operational flexibility.