"""
Django management command for managing query result cache.

Usage:
    python manage.py manage_query_cache --action=stats
    python manage.py manage_query_cache --action=clear
    python manage.py manage_query_cache --action=health
"""

from django.core.management.base import BaseCommand
from files.query_cache import invalidate_all_query_cache
from files.cache_utils import health_check, get_cache_stats


class Command(BaseCommand):
    help = 'Manage query result cache (stats, clear, health check)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--action',
            type=str,
            choices=['stats', 'clear', 'health'],
            required=True,
            help='Action to perform: stats (show statistics), clear (clear all cache), health (health check)'
        )

    def handle(self, *args, **options):
        action = options['action']

        if action == 'stats':
            self.show_stats()
        elif action == 'clear':
            self.clear_cache()
        elif action == 'health':
            self.health_check()

    def show_stats(self):
        """Show cache statistics."""
        self.stdout.write(self.style.SUCCESS('\n=== Query Cache Statistics ===\n'))

        stats = get_cache_stats()
        if 'message' in stats or 'error' in stats:
            self.stdout.write(self.style.WARNING(str(stats)))
        else:
            for key, value in stats.items():
                self.stdout.write(f"{key}: {value}")

        self.stdout.write(self.style.SUCCESS('\n=== End Statistics ===\n'))

    def clear_cache(self):
        """Clear all query cache entries."""
        self.stdout.write(self.style.WARNING('Clearing all query cache entries...'))

        count = invalidate_all_query_cache()

        if count > 0:
            self.stdout.write(
                self.style.SUCCESS(f'✓ Successfully cleared {count} cache entries')
            )
        else:
            self.stdout.write(
                self.style.WARNING('⚠ No cache entries cleared (pattern deletion may not be available)')
            )

    def health_check(self):
        """Perform cache health check."""
        self.stdout.write(self.style.SUCCESS('\n=== Cache Health Check ===\n'))

        result = health_check()

        status = result.get('status', 'unknown')
        latency = result.get('latency_ms', 'N/A')
        error = result.get('error', '')

        if status == 'healthy':
            self.stdout.write(
                self.style.SUCCESS(f'✓ Cache is healthy (latency: {latency}ms)')
            )
        else:
            self.stdout.write(
                self.style.ERROR(f'✗ Cache is unhealthy: {error} (latency: {latency}ms)')
            )

        self.stdout.write(self.style.SUCCESS('\n=== End Health Check ===\n'))
