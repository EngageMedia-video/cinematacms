"""
Django management command to rebuild the full-text search vector for Media rows.

update_search_vector runs only from the post_save receiver, so a change to the
weighting, the stop-word list or the text-search configuration does not reach
rows that are already stored. This command rewrites the corpus.

Usage:
    python manage.py reindex_media_search
    python manage.py reindex_media_search --batch-size=1000
"""

from django.core.management.base import BaseCommand

from files.models import Media


class Command(BaseCommand):
    help = "Rebuild the search vector for existing Media rows"

    def add_arguments(self, parser):
        parser.add_argument(
            "--batch-size",
            type=int,
            default=500,
            help="Number of records to process in each batch (default: 500)",
        )

    def handle(self, *args, **options):
        batch_size = options["batch_size"]

        queryset = Media.objects.select_related("user").prefetch_related("tags").order_by("pk")
        total = queryset.count()
        if not total:
            self.stdout.write("No media to reindex.")
            return

        self.stdout.write(f"Reindexing {total} media rows...")

        done = 0
        for start in range(0, total, batch_size):
            for media in queryset[start : start + batch_size]:
                media.update_search_vector()
                done += 1
            self.stdout.write(f"  {done}/{total}")

        self.stdout.write(self.style.SUCCESS(f"Reindexed {done} media rows."))
