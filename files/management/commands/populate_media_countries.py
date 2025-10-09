from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count
from files.models import Media, MediaCountry
from files import lists


class Command(BaseCommand):
    help = 'Populate MediaCountry table from existing media with media_country field'

    def add_arguments(self, parser):
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created without making changes',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Starting MediaCountry population...'))

        # Fetch all media counts in a single query
        media_counts = dict(
            Media.objects.filter(state="public", is_reviewed=True, media_country__isnull=False)
            .exclude(media_country="")
            .values("media_country")
            .annotate(count=Count("id"))
            .values_list("media_country", "count")
        )

        created_count = 0
        updated_count = 0

        if options['dry_run']:
            # Fetch all existing MediaCountry records in one query for dry run
            existing_countries = {
                mc.title: mc
                for mc in MediaCountry.objects.only('title', 'media_count')
            }

        for country_code, country_title in lists.video_countries:
            # Get media count from the pre-fetched dictionary using country_code
            media_count = media_counts.get(country_code, 0)

            if options['dry_run']:
                existing = existing_countries.get(country_title)
                if existing:
                    self.stdout.write(
                        f'Would update MediaCountry: {country_title} (code: {country_code}, current count: {existing.media_count}, actual: {media_count})'
                    )
                else:
                    self.stdout.write(
                        f'Would create MediaCountry: {country_title} (code: {country_code}, media count: {media_count})'
                    )
            else:
                # Create or get the MediaCountry record using country_title
                country_obj, created = MediaCountry.objects.get_or_create(
                    title=country_title
                )

                # Update the media count only if it changed
                if country_obj.media_count != media_count:
                    country_obj.media_count = media_count
                    country_obj.save(update_fields=['media_count'])

                if created:
                    created_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'Created MediaCountry: {country_title} (code: {country_code}, media count: {media_count})'
                        )
                    )
                else:
                    updated_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'Updated MediaCountry: {country_title} (code: {country_code}, media count: {media_count})'
                        )
                    )

        if not options['dry_run']:
            self.stdout.write(
                self.style.SUCCESS(
                    f'\n{"="*80}\n'
                    f'FINAL SUMMARY:\n'
                    f'MediaCountries - Created: {created_count}, Updated: {updated_count}\n'
                    f'{"="*80}'
                )
            )
        else:
            self.stdout.write(self.style.NOTICE('\nDry run completed - no changes made'))
