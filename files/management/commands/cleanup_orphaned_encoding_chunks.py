import os
import re
import time

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from files.metrics import record_domain_outcome
from files.models import Encoding, Media

CHUNK_FILE_NAME = re.compile(rf"^\d+_[A-Za-z0-9]{{{settings.FRIENDLY_TOKEN_LEN}}}_.+\.mkv$")


class Command(BaseCommand):
    help = "List or delete old, unreferenced chunked-encoding segment files"

    def add_arguments(self, parser):
        parser.add_argument(
            "--min-age-hours",
            type=float,
            default=24,
            help="Only consider files at least this old (default: 24)",
        )
        parser.add_argument(
            "--delete",
            action="store_true",
            help="Delete candidates. Without this flag the command is a dry run.",
        )

    def handle(self, *args, **options):
        min_age_hours = options["min_age_hours"]
        if min_age_hours < 0:
            raise CommandError("--min-age-hours must not be negative")

        media_root = os.path.realpath(settings.MEDIA_ROOT)
        if not os.path.isdir(media_root):
            self.stdout.write("No MEDIA_ROOT directory exists. candidates=0 would_delete=0 deleted=0")
            self._record_outcome("skipped")
            return

        upload_root = self._within_media_root(settings.MEDIA_UPLOAD_DIR, media_root)
        if upload_root is None or not os.path.isdir(upload_root):
            self.stdout.write("No original upload directory exists. candidates=0 would_delete=0 deleted=0")
            self._record_outcome("skipped")
            return

        referenced_paths = self._referenced_paths(media_root)
        cutoff = time.time() - (min_age_hours * 3600)
        candidates = list(self._orphaned_chunks(upload_root, referenced_paths, cutoff))
        deleted = 0
        cleanup_failed = False

        if options["delete"]:
            for path in candidates:
                try:
                    os.remove(path)
                    deleted += 1
                except OSError:
                    cleanup_failed = True
                    self.stderr.write("Failed to remove an orphaned encoding chunk")

        self.stdout.write(
            f"candidates={len(candidates)} would_delete={len(candidates)} deleted={deleted} dry_run={not options['delete']}"
        )
        if cleanup_failed:
            self._record_outcome("failed", "cleanup_failed")
        elif options["delete"] and candidates:
            self._record_outcome("succeeded")
        else:
            self._record_outcome("skipped")

    @staticmethod
    def _record_outcome(outcome, reason_code="none"):
        try:
            record_domain_outcome("storage_maintenance", outcome, reason_code)
        except Exception:
            # Cleanup is a recovery operation; telemetry must not change its result.
            return

    def _referenced_paths(self, media_root):
        paths = Media.objects.exclude(media_file="").values_list("media_file", flat=True)
        paths = list(paths) + list(
            Encoding.objects.exclude(chunk_file_path="").values_list("chunk_file_path", flat=True)
        )
        return {self._within_media_root(path, media_root) for path in paths} - {None}

    def _orphaned_chunks(self, media_root, referenced_paths, cutoff):
        for directory, directories, filenames in os.walk(media_root, followlinks=False):
            directories[:] = [name for name in directories if not os.path.islink(os.path.join(directory, name))]
            for filename in filenames:
                if not CHUNK_FILE_NAME.fullmatch(filename):
                    continue
                path = os.path.join(directory, filename)
                resolved_path = self._within_media_root(path, media_root)
                if resolved_path is None or os.path.islink(path) or resolved_path in referenced_paths:
                    continue
                try:
                    if os.path.getmtime(path) <= cutoff:
                        yield path
                except OSError:
                    self.stderr.write("Failed to inspect a candidate encoding chunk")

    @staticmethod
    def _within_media_root(path, media_root):
        if not path:
            return None
        path = os.path.realpath(path if os.path.isabs(path) else os.path.join(media_root, path))
        try:
            if os.path.commonpath([path, media_root]) == media_root:
                return path
        except ValueError:
            pass
        return None
