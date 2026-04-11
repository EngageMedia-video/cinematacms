"""
Django Management Command: hash_media_passwords

Hash all existing plaintext media passwords in the database.
This is a one-time operation for migrating from plaintext to hashed storage.

Usage:
    # Dry run -- show what would be hashed without changing anything
    python manage.py hash_media_passwords --dry-run

    # Hash all plaintext passwords
    python manage.py hash_media_passwords

    # Hash with explicit batch size
    python manage.py hash_media_passwords --batch-size 1000

Notes:
    - Idempotent: already-hashed passwords are skipped (uses identify_hasher)
    - Take a full database backup before running in production
    - The operation is irreversible -- hashing destroys the plaintext
"""

from django.contrib.auth.hashers import identify_hasher, make_password
from django.core.management.base import BaseCommand

from files.models import Media


class Command(BaseCommand):
    help = "Hash all existing plaintext media passwords (one-time migration)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be hashed without making changes",
        )
        parser.add_argument(
            "--batch-size",
            type=int,
            default=500,
            help="Number of records to process per batch (default: 500)",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        batch_size = options["batch_size"]

        queryset = Media.objects.exclude(password="").exclude(password__isnull=True)
        total = queryset.count()

        if total == 0:
            self.stdout.write(self.style.SUCCESS("No media with passwords found."))
            return

        self.stdout.write(f"Found {total} media with passwords to check.")
        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN -- no changes will be made.\n"))

        hashed = 0
        skipped = 0

        for media in queryset.iterator(chunk_size=batch_size):
            try:
                identify_hasher(media.password)
                skipped += 1
                continue
            except ValueError:
                pass

            if dry_run:
                self.stdout.write(f"  Would hash: {media.friendly_token} ({media.title[:50]})")
            else:
                media.password = make_password(media.password)
                media.save(update_fields=["password"])
            hashed += 1

        if dry_run:
            self.stdout.write(
                self.style.WARNING(f"\nDry run complete: {hashed} would be hashed, {skipped} already hashed.")
            )
        else:
            self.stdout.write(self.style.SUCCESS(f"\nDone: {hashed} hashed, {skipped} already hashed."))
