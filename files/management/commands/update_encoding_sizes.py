"""
Django management command to update file sizes for existing Encoding objects.

This command calculates and updates the size field for encodings that have a media_file
but are missing the size information.

Usage:
    python manage.py update_encoding_sizes
    python manage.py update_encoding_sizes --dry-run
    python manage.py update_encoding_sizes --batch-size=100
"""

import os
from django.core.management.base import BaseCommand
from django.db import transaction
from files.models import Encoding
from files import helpers


class Command(BaseCommand):
    help = 'Update size field for existing Encoding objects that are missing size information'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Run without actually updating the database',
        )
        parser.add_argument(
            '--batch-size',
            type=int,
            default=100,
            help='Number of records to process in each batch (default: 100)',
        )

    def handle(self, *args, **options):
        dry_run = options['dry_run']
        batch_size = options['batch_size']

        if dry_run:
            self.stdout.write(self.style.WARNING('\n=== DRY RUN MODE - No changes will be made ===\n'))

        # Process Encoding objects
        self.stdout.write(self.style.SUCCESS('=== Processing Encoding objects ==='))
        encoding_updated = self.process_encodings(batch_size, dry_run)

        # Summary
        self.stdout.write(self.style.SUCCESS('\n=== Summary ==='))
        self.stdout.write(f'Encoding objects updated: {encoding_updated}')

        if dry_run:
            self.stdout.write(self.style.WARNING('\nDRY RUN - No actual changes were made'))
        else:
            self.stdout.write(self.style.SUCCESS('\n✓ Size update completed!'))

    def process_encodings(self, batch_size, dry_run):
        """Process Encoding objects and calculate/update size field."""
        # Count total records to process (encodings with empty size and existing media_file)
        total = Encoding.objects.filter(
            size='',
            media_file__isnull=False,
        ).exclude(media_file='').count()

        self.stdout.write(f'Found {total} Encoding objects without size information')

        if total == 0:
            self.stdout.write(self.style.SUCCESS('✓ All Encoding objects already have size information'))
            return 0

        # Dry-run mode: process without mutation
        if dry_run:
            return self._process_encodings_dry_run(batch_size, total)

        # Actual mode: iterate and mutate
        return self._process_encodings_actual(batch_size, total)

    def _process_encodings_dry_run(self, batch_size, total):
        """Process Encodings in dry-run mode (no database updates)."""
        encoding_queryset = Encoding.objects.filter(
            size='',
            media_file__isnull=False,
        ).exclude(media_file='')

        updated_count = 0
        batch_count = 0
        missing_files = 0

        # Iterate through the queryset
        for i in range(0, total, batch_size):
            encoding_batch = list(encoding_queryset[i:i + batch_size])

            if not encoding_batch:
                break

            batch_count += 1

            # Count records that would be updated
            encodings_to_update = []
            for encoding in encoding_batch:
                if encoding.media_file:
                    try:
                        if os.path.exists(encoding.media_file.path):
                            file_size = os.path.getsize(encoding.media_file.path)
                            encodings_to_update.append(encoding)
                        else:
                            missing_files += 1
                            self.stdout.write(
                                self.style.WARNING(
                                    f'  Warning: File not found for encoding ID {encoding.id}: {encoding.media_file.path}'
                                )
                            )
                    except (OSError, ValueError) as e:
                        self.stdout.write(
                            self.style.ERROR(f'  Error processing encoding ID {encoding.id}: {e}')
                        )

            updated_count += len(encodings_to_update)

            # Progress update
            self.stdout.write(
                f'  Batch {batch_count}: Would update {len(encodings_to_update)} records '
                f'(Total: {updated_count}/{total})'
            )

        if missing_files > 0:
            self.stdout.write(
                self.style.WARNING(f'\nWarning: {missing_files} files not found on disk')
            )

        estimated_batches = (total + batch_size - 1) // batch_size
        self.stdout.write(
            self.style.WARNING(
                f'DRY RUN: Would process {total} total records in {estimated_batches} batches'
            )
        )
        return updated_count

    def _process_encodings_actual(self, batch_size, total):
        """Process Encodings in actual mode (with database updates)."""
        updated_count = 0
        batch_count = 0
        missing_files = 0

        # Use iterator to stream through all records once
        encoding_queryset = Encoding.objects.filter(
            size='',
            media_file__isnull=False,
        ).exclude(media_file='').iterator(chunk_size=batch_size)

        encodings_to_update = []

        for encoding in encoding_queryset:
            if encoding.media_file:
                try:
                    if os.path.exists(encoding.media_file.path):
                        file_size = os.path.getsize(encoding.media_file.path)
                        encoding.size = helpers.show_file_size(file_size)
                        encodings_to_update.append(encoding)
                    else:
                        missing_files += 1
                        self.stdout.write(
                            self.style.WARNING(
                                f'  Warning: File not found for encoding ID {encoding.id}: {encoding.media_file.path}'
                            )
                        )
                except (OSError, ValueError) as e:
                    self.stdout.write(
                        self.style.ERROR(f'  Error processing encoding ID {encoding.id}: {e}')
                    )

            # Bulk update when batch is full
            if len(encodings_to_update) >= batch_size:
                batch_count += 1
                with transaction.atomic():
                    Encoding.objects.bulk_update(
                        encodings_to_update,
                        ['size'],
                        batch_size=batch_size
                    )

                updated_count += len(encodings_to_update)

                # Progress update
                self.stdout.write(
                    f'  Batch {batch_count}: Updated {len(encodings_to_update)} records '
                    f'(Total: {updated_count}/{total})'
                )

                encodings_to_update = []

        # Flush remaining batch
        if encodings_to_update:
            batch_count += 1
            with transaction.atomic():
                Encoding.objects.bulk_update(
                    encodings_to_update,
                    ['size'],
                    batch_size=batch_size
                )

            updated_count += len(encodings_to_update)

            # Progress update
            self.stdout.write(
                f'  Batch {batch_count}: Updated {len(encodings_to_update)} records '
                f'(Total: {updated_count}/{total})'
            )

        if missing_files > 0:
            self.stdout.write(
                self.style.WARNING(f'\nWarning: {missing_files} files not found on disk')
            )

        return updated_count
