import os
import time
from datetime import timedelta

from django.core.management.base import BaseCommand, CommandError
from django.db.models import Q
from django.utils import timezone

from files.models import Media
from files.sprites import generate_sprite_for_media
from files.tasks import produce_sprite_from_video


def _file_field_exists(field_file):
    if not field_file:
        return False
    try:
        return field_file.storage.exists(field_file.name)
    except (NotImplementedError, OSError, ValueError):
        try:
            return os.path.exists(field_file.path)
        except (NotImplementedError, OSError, ValueError):
            return False


class Command(BaseCommand):
    help = "Backfill missing sprite sheets for existing video media"

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=50,
            help="Number of media rows to fetch per DB batch (default: 50)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report matching media without enqueueing or generating sprites",
        )
        parser.add_argument(
            "--limit",
            type=int,
            help="Maximum number of sprite jobs to enqueue or run",
        )
        parser.add_argument(
            "--user-id",
            type=int,
            help="Only backfill media owned by this user ID",
        )
        parser.add_argument(
            "--sleep",
            type=float,
            default=1.0,
            help="Seconds to sleep between enqueueing jobs (default: 1.0)",
        )
        parser.add_argument(
            "--inline",
            action="store_true",
            help="Generate sprites synchronously in this process instead of enqueueing Celery tasks",
        )
        parser.add_argument(
            "--force",
            action="store_true",
            help="Regenerate sprites even when a sprite value already exists",
        )
        parser.add_argument(
            "--repair-missing-files",
            action="store_true",
            help="Also target rows whose sprites field is set but the sprite file is missing on disk",
        )
        parser.add_argument(
            "--min-age-minutes",
            type=int,
            default=60,
            help="Only target videos at least this old, to avoid racing fresh uploads (default: 60)",
        )
        parser.add_argument(
            "--include-unencoded",
            action="store_true",
            help=(
                "Also target videos that have not finished encoding "
                "(encoding_status != 'success'). Off by default so the backfill never "
                "races a video whose normal post-encoding sprite step has not run yet."
            ),
        )

    def handle(self, *args, **options):
        batch_size = options["batch_size"]
        if batch_size <= 0:
            raise CommandError("Invalid --batch-size: must be a positive integer")

        limit = options.get("limit")
        if limit is not None and limit <= 0:
            raise CommandError("Invalid --limit: must be a positive integer")

        sleep_seconds = options["sleep"]
        if sleep_seconds < 0:
            raise CommandError("Invalid --sleep: must be zero or a positive number")

        min_age_minutes = options["min_age_minutes"]
        if min_age_minutes < 0:
            raise CommandError("Invalid --min-age-minutes: must be zero or a positive integer")

        queryset = Media.objects.filter(media_type="video").order_by("id")
        user_id = options.get("user_id")
        if user_id:
            queryset = queryset.filter(user_id=user_id)

        # Primary race guard: only touch videos that finished encoding. Sprite
        # generation normally runs post-encoding, so a non-"success" video either
        # hasn't reached that step yet or failed encoding (no usable source) —
        # backfilling it would either duplicate pending work or fail anyway.
        if not options["include_unencoded"]:
            queryset = queryset.filter(encoding_status="success")

        # Belt-and-suspenders time floor on top of the encoding_status guard.
        if min_age_minutes:
            queryset = queryset.filter(add_date__lte=timezone.now() - timedelta(minutes=min_age_minutes))

        force = options["force"]
        repair_missing_files = options["repair_missing_files"]
        if not force and not repair_missing_files:
            queryset = queryset.filter(Q(sprites="") | Q(sprites__isnull=True))

        dry_run = options["dry_run"]
        inline = options["inline"]
        processed = 0
        targeted = 0
        enqueued = 0
        succeeded = 0
        failed = 0
        skipped_missing_media_file = 0
        skipped_existing_sprite = 0

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN: no sprite jobs will be enqueued or run"))

        for media in queryset.iterator(chunk_size=batch_size):
            processed += 1

            if not _file_field_exists(media.media_file):
                skipped_missing_media_file += 1
                continue

            sprite_exists = _file_field_exists(media.sprites)
            if not force and repair_missing_files and media.sprites and sprite_exists:
                skipped_existing_sprite += 1
                continue

            if limit is not None and targeted >= limit:
                break

            targeted += 1
            if dry_run:
                continue

            if inline:
                result = generate_sprite_for_media(media)
                if result["ok"]:
                    succeeded += 1
                else:
                    failed += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"Failed {media.friendly_token}: {result['reason']}"
                            + (f" ({result['error']})" if result.get("error") else "")
                        )
                    )
            else:
                produce_sprite_from_video.delay(media.friendly_token)
                enqueued += 1

            # Pause between every job (enqueue or inline run) to keep load on the
            # shared long_tasks queue / CPU smooth and predictable.
            if sleep_seconds:
                time.sleep(sleep_seconds)

        if dry_run:
            self.stdout.write(
                self.style.SUCCESS(
                    "Video sprite backfill dry run complete: "
                    f"processed={processed}, would_target={targeted}, "
                    f"skipped_missing_media_file={skipped_missing_media_file}, "
                    f"skipped_existing_sprite={skipped_existing_sprite}"
                )
            )
            return

        if inline:
            self.stdout.write(
                self.style.SUCCESS(
                    "Video sprite backfill complete: "
                    f"processed={processed}, targeted={targeted}, succeeded={succeeded}, failed={failed}, "
                    f"skipped_missing_media_file={skipped_missing_media_file}, "
                    f"skipped_existing_sprite={skipped_existing_sprite}"
                )
            )
        else:
            self.stdout.write(
                self.style.SUCCESS(
                    "Video sprite backfill enqueue complete: "
                    f"processed={processed}, targeted={targeted}, enqueued={enqueued}, "
                    f"skipped_missing_media_file={skipped_missing_media_file}, "
                    f"skipped_existing_sprite={skipped_existing_sprite}"
                )
            )
