"""
Django management command to fix absolute file paths in Media and Encoding objects.

This command converts absolute filesystem paths to relative paths for:
- Media.preview_file_path
- Encoding.chunk_file_path

Usage:
    python manage.py fix_media_paths
    python manage.py fix_media_paths --dry-run
    python manage.py fix_media_paths --batch-size=500
    python manage.py fix_media_paths --media-only
    python manage.py fix_media_paths --encoding-only
"""

import logging
import os
from django.core.management.base import BaseCommand
from django.conf import settings
from files.models import Media, Encoding


logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Fix absolute file paths in Media and Encoding preview/chunk paths'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run without actually updating the database',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=1000,
            help='Number of records to process in each batch (default: 1000)',
        )
        parser.add_argument(
            '--media-only',
            action='store_true',
            help='Only process Media objects',
        )
        parser.add_argument(
            '--encoding-only',
            action='store_true',
            help='Only process Encoding objects',
        )

    def handle(self, **options):
        dry_run = options['dry_run']
        batch_size = options['batch_size']
        media_only = options['media_only']
        encoding_only = options['encoding_only']

        if dry_run:
            self.stdout.write(self.style.WARNING('\n=== DRY RUN MODE - No changes will be made ===\n'))

        # Get common root paths for path normalization
        common_roots = self._get_common_roots()
        self.stdout.write(f'Using root paths: {common_roots}\n')

        # Process Media objects (unless --encoding-only)
        media_fixed = 0
        media_errors = 0
        if not encoding_only:
            self.stdout.write(self.style.SUCCESS('\n=== Processing Media.preview_file_path ==='))
            media_fixed, media_errors = self.process_media(batch_size, dry_run, common_roots)

        # Process Encoding objects (unless --media-only)
        encoding_fixed = 0
        encoding_errors = 0
        if not media_only:
            self.stdout.write(self.style.SUCCESS('\n=== Processing Encoding.chunk_file_path ==='))
            encoding_fixed, encoding_errors = self.process_encoding(batch_size, dry_run, common_roots)

        # Summary
        self.stdout.write(self.style.SUCCESS('\n=== Summary ==='))
        self.stdout.write(f'Media paths fixed: {media_fixed} (errors: {media_errors})')
        self.stdout.write(f'Encoding paths fixed: {encoding_fixed} (errors: {encoding_errors})')
        self.stdout.write(f'Total fixed: {media_fixed + encoding_fixed}')
        self.stdout.write(f'Total errors: {media_errors + encoding_errors}')

        if dry_run:
            self.stdout.write(self.style.WARNING('\nDRY RUN - No actual changes were made'))
        else:
            self.stdout.write(self.style.SUCCESS('\n✓ Path fixing completed!'))

    def _get_common_roots(self):
        """Get list of common root paths to strip from absolute paths."""
        media_root = getattr(settings, 'MEDIA_ROOT', '')
        if not media_root:
            # Fallback pattern for fixing paths from production deployments
            return ['/home/cinemata/cinematacms/media_files/']
        else:
            # Convert pathlib.Path to string if needed
            media_root = os.fspath(media_root) if hasattr(media_root, '__fspath__') else str(media_root)
            # Ensure trailing slash for consistent prefix removal
            media_root = media_root if media_root.endswith('/') else media_root + '/'
            return [media_root]

    def _normalize_path(self, old_path, common_roots):
        """
        Normalize an absolute path to a relative path.

        Args:
            old_path: The absolute path to normalize
            common_roots: List of root paths to strip

        Returns:
            Normalized relative path
        """
        new_path = old_path

        # Remove any of the common root paths
        for root in common_roots:
            if old_path.startswith(root):
                new_path = old_path.replace(root, '', 1)
                break

        # Also handle paths that start with just /
        if new_path.startswith('/') and '/' in new_path[1:]:
            # Find where the actual media path starts (e.g., after encoded/, original/, etc.)
            for prefix in ['encoded/', 'original/', 'hls/', 'videos/']:
                if prefix in new_path:
                    idx = new_path.find(prefix)
                    new_path = new_path[idx:]
                    break

        return new_path

    def process_media(self, batch_size, dry_run, common_roots):
        """Process Media objects and fix preview_file_path."""
        # Count total records to process
        queryset = Media.objects.filter(
            preview_file_path__isnull=False
        ).exclude(preview_file_path='')

        total = queryset.count()
        self.stdout.write(f'Found {total} Media objects with preview_file_path set')

        if total == 0:
            self.stdout.write(self.style.SUCCESS('✓ No Media objects to process'))
            return 0, 0

        fixed_count = 0
        error_count = 0
        batch_count = 0

        # Process in batches
        for i in range(0, total, batch_size):
            batch_count += 1
            media_batch = list(queryset[i:i + batch_size])

            for media in media_batch:
                old_path = media.preview_file_path
                new_path = self._normalize_path(old_path, common_roots)

                if new_path != old_path:
                    if dry_run:
                        self.stdout.write(
                            self.style.WARNING(f'  Would fix Media {media.pk}: {old_path} → {new_path}')
                        )
                        fixed_count += 1
                    else:
                        try:
                            media.preview_file_path = new_path
                            media.save(update_fields=['preview_file_path'])
                            fixed_count += 1
                        except Exception as e:
                            error_count += 1
                            self.stdout.write(
                                self.style.ERROR(f'  Error updating Media {media.pk}: {e}')
                            )

            # Progress update
            self.stdout.write(
                f'  Batch {batch_count}: Processed {min(i + batch_size, total)}/{total} records '
                f'(Fixed: {fixed_count}, Errors: {error_count})'
            )

        return fixed_count, error_count

    def process_encoding(self, batch_size, dry_run, common_roots):
        """Process Encoding objects and fix chunk_file_path."""
        # Count total records to process
        queryset = Encoding.objects.filter(
            chunk_file_path__isnull=False
        ).exclude(chunk_file_path='')

        total = queryset.count()
        self.stdout.write(f'Found {total} Encoding objects with chunk_file_path set')

        if total == 0:
            self.stdout.write(self.style.SUCCESS('✓ No Encoding objects to process'))
            return 0, 0

        fixed_count = 0
        error_count = 0
        batch_count = 0

        # Process in batches
        for i in range(0, total, batch_size):
            batch_count += 1
            encoding_batch = list(queryset[i:i + batch_size])

            for encoding in encoding_batch:
                old_path = encoding.chunk_file_path
                new_path = self._normalize_path(old_path, common_roots)

                if new_path != old_path:
                    if dry_run:
                        self.stdout.write(
                            self.style.WARNING(f'  Would fix Encoding {encoding.pk}: {old_path} → {new_path}')
                        )
                        fixed_count += 1
                    else:
                        try:
                            encoding.chunk_file_path = new_path
                            encoding.save(update_fields=['chunk_file_path'])
                            fixed_count += 1
                        except Exception as e:
                            error_count += 1
                            self.stdout.write(
                                self.style.ERROR(f'  Error updating Encoding {encoding.pk}: {e}')
                            )

            # Progress update
            self.stdout.write(
                f'  Batch {batch_count}: Processed {min(i + batch_size, total)}/{total} records '
                f'(Fixed: {fixed_count}, Errors: {error_count})'
            )

        return fixed_count, error_count
