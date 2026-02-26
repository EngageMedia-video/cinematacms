"""
Django management command to populate filename fields for existing Media and Encoding objects.

Usage:
    python manage.py populate_filenames
    python manage.py populate_filenames --dry-run
    python manage.py populate_filenames --batch-size=1000
"""

import os

from django.core.management.base import BaseCommand
from django.db import transaction

from files.models import Encoding, Media


class Command(BaseCommand):
    help = "Populate filename field for existing Media and Encoding objects"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Run without actually updating the database",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=500,
            help="Number of records to process in each batch (default: 500)",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        batch_size = options["batch_size"]

        if dry_run:
            self.stdout.write(self.style.WARNING("\n=== DRY RUN MODE - No changes will be made ===\n"))

        # Process Media objects
        self.stdout.write(self.style.SUCCESS("\n=== Processing Media objects ==="))
        media_updated = self.process_media(batch_size, dry_run)

        # Process Encoding objects
        self.stdout.write(self.style.SUCCESS("\n=== Processing Encoding objects ==="))
        encoding_updated = self.process_encoding(batch_size, dry_run)

        # Summary
        self.stdout.write(self.style.SUCCESS("\n=== Summary ==="))
        self.stdout.write(f"Media objects updated: {media_updated}")
        self.stdout.write(f"Encoding objects updated: {encoding_updated}")
        self.stdout.write(f"Total updated: {media_updated + encoding_updated}")

        if dry_run:
            self.stdout.write(self.style.WARNING("\nDRY RUN - No actual changes were made"))
        else:
            self.stdout.write(self.style.SUCCESS("\n✓ Filename population completed!"))

    def process_media(self, batch_size, dry_run):
        """Process Media objects and populate filename field."""
        # Count total records to process
        total = Media.objects.filter(filename="").count()
        self.stdout.write(f"Found {total} Media objects without filename")

        if total == 0:
            self.stdout.write(self.style.SUCCESS("✓ All Media objects already have filenames"))
            return 0

        # Dry-run mode: process a single queryset without mutation
        if dry_run:
            return self._process_media_dry_run(batch_size, total)

        # Actual mode: iterate and mutate
        return self._process_media_actual(batch_size, total)

    def _process_media_dry_run(self, batch_size, total):
        """Process Media in dry-run mode (no database updates)."""
        # Get queryset of all records that need updating
        media_queryset = Media.objects.filter(
            filename="",
            media_file__isnull=False,
        ).exclude(media_file="")

        updated_count = 0
        batch_count = 0

        # Iterate through the queryset (won't change during iteration)
        for i in range(0, total, batch_size):
            media_batch = list(media_queryset[i : i + batch_size])

            if not media_batch:
                break

            batch_count += 1

            # Count records that would be updated
            media_to_update = []
            for media in media_batch:
                if media.media_file:
                    media_to_update.append(media)

            updated_count += len(media_to_update)

            # Progress update
            self.stdout.write(
                f"  Batch {batch_count}: Would update {len(media_to_update)} records (Total: {updated_count}/{total})"
            )

        estimated_batches = (total + batch_size - 1) // batch_size
        self.stdout.write(
            self.style.WARNING(f"DRY RUN: Would process {total} total records in {estimated_batches} batches")
        )
        return updated_count

    def _process_media_actual(self, batch_size, total):
        """Process Media in actual mode (with database updates)."""
        updated_count = 0
        batch_count = 0

        while True:
            # Get a batch of records
            # Query each time because records are updated and removed from queryset
            media_batch = list(
                Media.objects.filter(
                    filename="",
                    media_file__isnull=False,
                ).exclude(media_file="")[:batch_size]
            )

            if not media_batch:
                break  # No more records to process

            batch_count += 1

            # Update filenames
            media_to_update = []
            for media in media_batch:
                if media.media_file:
                    media.filename = os.path.basename(media.media_file.name)
                    media_to_update.append(media)

            # Bulk update
            if media_to_update:
                with transaction.atomic():
                    Media.objects.bulk_update(media_to_update, ["filename"], batch_size=batch_size)

            updated_count += len(media_to_update)

            # Progress update
            self.stdout.write(
                f"  Batch {batch_count}: Updated {len(media_to_update)} records (Total: {updated_count}/{total})"
            )

        return updated_count

    def process_encoding(self, batch_size, dry_run):
        """Process Encoding objects and populate filename field."""
        # Count total records to process
        total = Encoding.objects.filter(filename="").count()
        self.stdout.write(f"Found {total} Encoding objects without filename")

        if total == 0:
            self.stdout.write(self.style.SUCCESS("✓ All Encoding objects already have filenames"))
            return 0

        # Dry-run mode: process a single queryset without mutation
        if dry_run:
            return self._process_encoding_dry_run(batch_size, total)

        # Actual mode: iterate and mutate
        return self._process_encoding_actual(batch_size, total)

    def _process_encoding_dry_run(self, batch_size, total):
        """Process Encoding in dry-run mode (no database updates)."""
        # Get queryset of all records that need updating
        encoding_queryset = Encoding.objects.filter(
            filename="",
            media_file__isnull=False,
        ).exclude(media_file="")

        updated_count = 0
        batch_count = 0

        # Iterate through the queryset (won't change during iteration)
        for i in range(0, total, batch_size):
            encoding_batch = list(encoding_queryset[i : i + batch_size])

            if not encoding_batch:
                break

            batch_count += 1

            # Count records that would be updated
            encodings_to_update = []
            for encoding in encoding_batch:
                if encoding.media_file:
                    encodings_to_update.append(encoding)

            updated_count += len(encodings_to_update)

            # Progress update
            self.stdout.write(
                f"  Batch {batch_count}: Would update {len(encodings_to_update)} records "
                f"(Total: {updated_count}/{total})"
            )

        estimated_batches = (total + batch_size - 1) // batch_size
        self.stdout.write(
            self.style.WARNING(f"DRY RUN: Would process {total} total records in {estimated_batches} batches")
        )
        return updated_count

    def _process_encoding_actual(self, batch_size, total):
        """Process Encoding in actual mode (with database updates)."""
        updated_count = 0
        batch_count = 0

        while True:
            # Get a batch of records
            # Query each time because records are updated and removed from queryset
            encoding_batch = list(
                Encoding.objects.filter(
                    filename="",
                    media_file__isnull=False,
                ).exclude(media_file="")[:batch_size]
            )

            if not encoding_batch:
                break  # No more records to process

            batch_count += 1

            # Update filenames
            encodings_to_update = []
            for encoding in encoding_batch:
                if encoding.media_file:
                    encoding.filename = os.path.basename(encoding.media_file.name)
                    encodings_to_update.append(encoding)

            # Bulk update
            if encodings_to_update:
                with transaction.atomic():
                    Encoding.objects.bulk_update(encodings_to_update, ["filename"], batch_size=batch_size)

            updated_count += len(encodings_to_update)

            # Progress update
            self.stdout.write(
                f"  Batch {batch_count}: Updated {len(encodings_to_update)} records (Total: {updated_count}/{total})"
            )

        return updated_count
