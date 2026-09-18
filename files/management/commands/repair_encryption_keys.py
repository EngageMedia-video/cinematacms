"""Regenerate encrypted HLS output for media missing its encryption key."""

import logging
import re

from django.core.management.base import BaseCommand

from files.models import Media
from files.tasks import create_hls

logger = logging.getLogger(__name__)
VALID_ENCRYPTION_KEY = re.compile(r"[0-9a-fA-F]{32}")


class Command(BaseCommand):
    help = "Dry-run or repair encrypted media whose HLS encryption key is missing"

    def add_arguments(self, parser):
        mode = parser.add_mutually_exclusive_group()
        mode.add_argument(
            "--repair",
            action="store_true",
            help="Regenerate HLS output and persist a new encryption key for each eligible media item",
        )
        mode.add_argument(
            "--dry-run",
            action="store_true",
            help="List eligible media without changing data (the default)",
        )

    def handle(self, *args, **options):
        affected = Media.objects.filter(is_encrypted=True, encryption_key="").order_by("pk")
        affected_count = affected.count()
        if not options["repair"]:
            for media in affected.iterator():
                self.stdout.write(f"token={media.friendly_token} action=would_repair result=dry_run")
            self.stdout.write(f"affected={affected_count} repaired=0 failed=0 skipped=0 mode=dry_run")
            return

        repaired = 0
        failed = 0
        for media in affected.iterator():
            previous_hls_file = media.hls_file
            try:
                if not create_hls(media.friendly_token):
                    raise RuntimeError("HLS regeneration did not start")
                media.refresh_from_db()
                if not VALID_ENCRYPTION_KEY.fullmatch(media.encryption_key):
                    raise RuntimeError("HLS regeneration did not persist a valid encryption key")
                if not media.hls_file or media.hls_file == previous_hls_file:
                    raise RuntimeError("HLS regeneration did not publish new output")
            except Exception as error:
                failed += 1
                logger.exception("Could not repair missing encryption key for media %s", media.friendly_token)
                self.stderr.write(f"token={media.friendly_token} action=repair result=failed error={error}")
                continue

            repaired += 1
            self.stdout.write(f"token={media.friendly_token} action=repair result=succeeded")

        self.stdout.write(f"affected={affected_count} repaired={repaired} failed={failed} skipped=0 mode=repair")
