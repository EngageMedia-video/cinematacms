"""Remove CMS analytics data outside the 12-month reporting window."""

from django.core.management.base import BaseCommand
from django.utils import timezone

from files.models import DailySegmentMetric, PlaybackSummary


def twelve_month_cutoff(now):
    try:
        return now.replace(year=now.year - 1)
    except ValueError:  # February 29
        return now.replace(year=now.year - 1, day=28)


class Command(BaseCommand):
    help = "Purge playback summaries and daily segment counts older than 12 calendar months"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        cutoff = twelve_month_cutoff(timezone.now())
        queryset = PlaybackSummary.objects.filter(started_at__lt=cutoff)
        segments = DailySegmentMetric.objects.filter(day__lt=cutoff.date())
        if options["dry_run"]:
            self.stdout.write(f"{queryset.count()} playback summaries would be deleted")
            self.stdout.write(f"{segments.count()} daily segment counts would be deleted")
        else:
            deleted, _ = queryset.delete()
            self.stdout.write(f"{deleted} playback summaries deleted")
            deleted, _ = segments.delete()
            self.stdout.write(f"{deleted} daily segment counts deleted")
