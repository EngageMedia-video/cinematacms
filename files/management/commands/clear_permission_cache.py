"""
Django Management Command: clear_permission_cache

This command provides manual cache management for the permission caching system.
It allows administrators to clear cached permission entries in various ways:

Usage Examples:
    # Clear all permission cache entries
    python manage.py clear_permission_cache --all

    # Clear cache for specific media (all users)
    python manage.py clear_permission_cache --media-uid a1b2c3d4e5f6...

    # Clear cache for specific media and user
    python manage.py clear_permission_cache --media-uid a1b2c3d4e5f6... --user-id 42

    # Clear cache by pattern (requires django-redis)
    python manage.py clear_permission_cache --pattern "media_permission:42:*"

When to Use:
    - Debugging permission issues
    - After manual database changes
    - During system maintenance
    - Emergency cache clearing

Note: This command is for manual administrative use only.
The automatic cache invalidation system handles normal operations.
"""

from django.core.management.base import BaseCommand
from django.core.cache import cache
from files.models import Media
from files.cache_utils import (
    clear_media_permission_cache,
    invalidate_all_permission_cache,
    CACHE_KEY_PREFIX,
    CACHE_VERSION,
)

class Command(BaseCommand):
    help = 'Clear permission cache for media files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--media-uid',
            type=str,
            help='Clear cache for specific media UID',
        )
        parser.add_argument(
            '--user-id',
            type=int,
            help='Clear cache for specific user ID (must be used with --media-uid)',
        )
        parser.add_argument(
            '--all',
            action='store_true',
            help='Clear all permission cache entries',
        )
        parser.add_argument(
            '--pattern',
            type=str,
            help='Clear cache entries matching a pattern (requires django-redis)',
        )

    def handle(self, *args, **options):
        if options['all']:
            self.clear_all_permission_cache()
        elif options['pattern']:
            self.clear_cache_by_pattern(options['pattern'])
        elif options['media_uid']:
            self.clear_media_cache(options['media_uid'], options.get('user_id'))
        else:
            self.stdout.write(
                self.style.ERROR('Please specify --all, --pattern, or --media-uid')
            )

    def clear_all_permission_cache(self):
        """Clear all permission-related cache entries."""
        try:
            total_cleared = invalidate_all_permission_cache()
            self.stdout.write(
                self.style.SUCCESS(f'Total entries cleared: {total_cleared}')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error clearing cache: {e}')
            )

    def clear_cache_by_pattern(self, pattern):
        """Clear cache entries matching a specific pattern."""
        try:
            if hasattr(cache, 'delete_pattern'):
                normalized = (
                    pattern if pattern.startswith(f"{CACHE_KEY_PREFIX}:")
                    else f"{CACHE_KEY_PREFIX}:{pattern}"
                )
                count = cache.delete_pattern(normalized, version=CACHE_VERSION)
                self.stdout.write(
                    self.style.SUCCESS(f'Cleared {count} entries for pattern: {normalized}')
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        'Pattern-based cache deletion not available. '
                        'django-redis backend required for this feature.'
                    )
                )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error clearing cache with pattern {pattern}: {e}')
            )
    def clear_media_cache(self, media_uid, user_id=None):
        """Clear cache for a specific media and optionally specific user."""
        try:
            if user_id:
                self.stdout.write(f'Clearing cache for media {media_uid} and user {user_id}')
            else:
                self.stdout.write(f'Clearing cache for media {media_uid} (all users)')

            clear_media_permission_cache(media_uid, user_id)

            self.stdout.write(
                self.style.SUCCESS('Cache cleared successfully')
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error clearing cache for media {media_uid}: {e}')
            )
