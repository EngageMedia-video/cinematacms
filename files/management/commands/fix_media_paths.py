"""
Django management command to fix absolute file paths in the database.

Converts absolute filesystem paths (e.g., /home/cinemata/cinematacms/media_files/original/...)
to relative paths (e.g., original/...) across all file-path fields in Media, Encoding,
and Subtitle models.

Usage:
    python manage.py fix_media_paths --dry-run          # Preview changes
    python manage.py fix_media_paths                    # Apply fixes
    python manage.py fix_media_paths --media-only       # Only fix Media fields
    python manage.py fix_media_paths --encoding-only    # Only fix Encoding fields
    python manage.py fix_media_paths --subtitle-only    # Only fix Subtitle fields
"""

import os

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db.models import F, Value
from django.db.models.functions import Replace

from files.models import Encoding, Media, Subtitle

# Each entry: (Model, field_name)
MEDIA_FIELDS = [
    (Media, "thumbnail"),
    (Media, "poster"),
    (Media, "uploaded_thumbnail"),
    (Media, "uploaded_poster"),
    (Media, "sprites"),
    (Media, "media_file"),
    (Media, "preview_file_path"),
]

ENCODING_FIELDS = [
    (Encoding, "media_file"),
    (Encoding, "chunk_file_path"),
]

SUBTITLE_FIELDS = [
    (Subtitle, "subtitle_file"),
]


class Command(BaseCommand):
    help = "Fix absolute file paths stored in Media, Encoding, and Subtitle models"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be changed without modifying the database",
        )
        parser.add_argument(
            "--media-only",
            action="store_true",
            help="Only process Media model fields",
        )
        parser.add_argument(
            "--encoding-only",
            action="store_true",
            help="Only process Encoding model fields",
        )
        parser.add_argument(
            "--subtitle-only",
            action="store_true",
            help="Only process Subtitle model fields",
        )

    def _get_media_root(self):
        """Return MEDIA_ROOT as a string with a trailing slash."""
        media_root = getattr(settings, "MEDIA_ROOT", "")
        if not media_root:
            raise CommandError("MEDIA_ROOT is not configured. Set MEDIA_ROOT in your Django settings.")
        media_root = os.fspath(media_root) if hasattr(media_root, "__fspath__") else str(media_root)
        if not media_root.endswith("/"):
            media_root += "/"
        return media_root

    def _fix_field(self, model, field_name, media_root, dry_run):
        """Fix absolute paths in a single model field. Returns the number of rows affected."""
        affected = model.objects.filter(**{f"{field_name}__startswith": media_root}).count()

        if affected == 0:
            self.stdout.write(f"  {model.__name__}.{field_name}: 0 rows (already clean)")
            return 0

        if dry_run:
            self.stdout.write(self.style.WARNING(f"  {model.__name__}.{field_name}: {affected} rows would be fixed"))
            return affected

        updated = model.objects.filter(**{f"{field_name}__startswith": media_root}).update(
            **{field_name: Replace(F(field_name), Value(media_root), Value(""))}
        )
        self.stdout.write(self.style.SUCCESS(f"  {model.__name__}.{field_name}: {updated} rows fixed"))
        return updated

    def _verify_field(self, model, field_name, media_root):
        """Check that no absolute paths remain in a field."""
        remaining = model.objects.filter(**{f"{field_name}__startswith": media_root}).count()
        if remaining > 0:
            self.stdout.write(
                self.style.ERROR(f"  {model.__name__}.{field_name}: {remaining} absolute paths still remain!")
            )
        return remaining

    def handle(self, **options):
        dry_run = options["dry_run"]
        media_only = options["media_only"]
        encoding_only = options["encoding_only"]
        subtitle_only = options["subtitle_only"]

        # If no filter specified, process everything
        process_all = not (media_only or encoding_only or subtitle_only)

        media_root = self._get_media_root()

        if dry_run:
            self.stdout.write(self.style.WARNING("=== DRY RUN MODE ===\n"))
        self.stdout.write(f"MEDIA_ROOT prefix to strip: {media_root}\n")

        fields_to_process = []
        if process_all or media_only:
            fields_to_process.extend(MEDIA_FIELDS)
        if process_all or encoding_only:
            fields_to_process.extend(ENCODING_FIELDS)
        if process_all or subtitle_only:
            fields_to_process.extend(SUBTITLE_FIELDS)

        # Fix paths
        total_fixed = 0
        self.stdout.write(self.style.SUCCESS("=== Fixing absolute paths ==="))
        for model, field_name in fields_to_process:
            total_fixed += self._fix_field(model, field_name, media_root, dry_run)

        # Verification (skip in dry-run since nothing changed)
        if not dry_run:
            self.stdout.write(self.style.SUCCESS("\n=== Verification ==="))
            total_remaining = 0
            for model, field_name in fields_to_process:
                total_remaining += self._verify_field(model, field_name, media_root)

            if total_remaining == 0:
                self.stdout.write(self.style.SUCCESS("  All fields clean — no absolute paths remain."))

        # Summary
        self.stdout.write(self.style.SUCCESS("\n=== Summary ==="))
        action = "would be fixed" if dry_run else "fixed"
        self.stdout.write(f"Total rows {action}: {total_fixed}")

        if dry_run:
            self.stdout.write(
                self.style.WARNING("\nDRY RUN — no changes were made. Re-run without --dry-run to apply.")
            )
