from django.core.management.base import BaseCommand

from files.models import Media
from files.storage_usage import calculate_media_storage_usage, invalidate_storage_usage_cache


class Command(BaseCommand):
    help = "Backfill aggregate storage usage bytes for Media objects"

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=100,
            help="Number of media rows to process in each batch (default: 100)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Calculate usage without writing updates",
        )
        parser.add_argument(
            "--user-id",
            type=int,
            help="Only backfill media owned by this user ID",
        )

    def handle(self, *args, **options):
        batch_size = options["batch_size"]
        dry_run = options["dry_run"]
        user_id = options.get("user_id")

        queryset = Media.objects.prefetch_related("encodings", "subtitles").all().order_by("id")
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        total = queryset.count()
        processed = 0
        changed = 0
        pending_updates = []

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN: no storage usage values will be written"))

        for media in queryset.iterator(chunk_size=batch_size):
            used_bytes = calculate_media_storage_usage(media)
            processed += 1

            if media.storage_usage_bytes != used_bytes:
                changed += 1
                if not dry_run:
                    media.storage_usage_bytes = used_bytes
                    pending_updates.append(media)

            if len(pending_updates) >= batch_size:
                Media.objects.bulk_update(pending_updates, ["storage_usage_bytes"], batch_size=batch_size)
                pending_updates = []

            if processed % batch_size == 0:
                self.stdout.write(f"Processed {processed}/{total} media rows")

        if pending_updates:
            Media.objects.bulk_update(pending_updates, ["storage_usage_bytes"], batch_size=batch_size)

        if not dry_run:
            invalidate_storage_usage_cache(user_id=user_id)

        self.stdout.write(
            self.style.SUCCESS(
                f"Storage usage backfill complete: processed={processed}, changed={changed}, dry_run={dry_run}"
            )
        )
