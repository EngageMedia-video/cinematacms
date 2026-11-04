"""Re-inspect videos whose stored video stream is an attached picture.

Older inspections could select a cover-art stream (``disposition.attached_pic``)
as the video. Encodes map that stream index explicitly, and ffmpeg writes
nothing for it. Inspection now skips attached pictures, so re-running it on the
original file stores the real video stream.
"""

import json
import logging
import os

from django.core.management.base import BaseCommand

from cms.error_tracking import capture_unexpected_exception
from files.models import Media

logger = logging.getLogger(__name__)

INSPECTED_FIELDS = ["media_info", "duration", "video_height"]


def stored_video_stream_is_attached_picture(media_info):
    try:
        return bool(json.loads(media_info)["video_info"]["disposition"]["attached_pic"])
    except (ValueError, KeyError, TypeError):
        return False


def refresh_stream_info(media):
    """Re-inspect the original file. Return None when saved, else why the row was left as is."""
    if not media.media_file or not os.path.isfile(media.media_file.path):
        return "media file is missing"
    media.set_media_type(save=False)
    if media.media_type != "video":
        return "inspection did not find a video stream"
    media.save(update_fields=INSPECTED_FIELDS)
    return None


class Command(BaseCommand):
    help = "Re-inspect videos whose stored video stream is an attached picture, so encodes map the real video"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="List the affected media without inspecting or changing anything",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        scanned = 0
        affected = []
        rows = Media.objects.filter(media_type="video").order_by("pk").values_list("pk", "friendly_token", "media_info")
        for pk, friendly_token, media_info in rows.iterator(chunk_size=500):
            scanned += 1
            if stored_video_stream_is_attached_picture(media_info):
                affected.append((pk, friendly_token))

        repaired = failed = 0
        for pk, friendly_token in affected:
            if dry_run:
                self.stdout.write(f"id={pk} token={friendly_token} action=would_repair result=dry_run")
                continue
            try:
                reason = refresh_stream_info(Media.objects.get(pk=pk))
            except Exception as error:
                logger.exception("Could not refresh stream info for media %s", friendly_token)
                capture_unexpected_exception(error)
                reason = str(error) or type(error).__name__
            if reason:
                failed += 1
                self.stderr.write(f"id={pk} token={friendly_token} action=repair result=failed error={reason}")
                continue
            repaired += 1
            self.stdout.write(f"id={pk} token={friendly_token} action=repair result=succeeded")

        mode = "dry_run" if dry_run else "repair"
        self.stdout.write(f"scanned={scanned} affected={len(affected)} repaired={repaired} failed={failed} mode={mode}")
