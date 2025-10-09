from django.core.management.base import BaseCommand
from django.db import transaction
from files.models import Language, Media, MediaLanguage


class Command(BaseCommand):
    help = "Populate MediaLanguage table from existing media with media_language field"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be created without making changes",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE("Starting MediaLanguage population..."))

        # Get all unique language codes from media (exclude automatic ones)
        unique_languages = (
            Media.objects.filter(media_language__isnull=False)
            .exclude(media_language="")
            .exclude(media_language__in=["automatic", "automatic-translation"])
            .values_list("media_language", flat=True)
            .distinct()
        )

        # Get language titles
        language_dict = dict(
            Language.objects.exclude(
                code__in=["automatic", "automatic-translation"]
            ).values_list("code", "title")
        )

        created_count = 0
        updated_count = 0

        for language_code in unique_languages:
            language_title = language_dict.get(language_code)

            if not language_title:
                self.stdout.write(
                    self.style.WARNING(
                        f'Language code "{language_code}" not found in Language model'
                    )
                )
                continue

            if options["dry_run"]:
                existing = MediaLanguage.objects.filter(title=language_title).first()
                if existing:
                    media_count = Media.objects.filter(
                        state="public", is_reviewed=True, media_language=language_code
                    ).count()
                    self.stdout.write(
                        f"Would update MediaLanguage: {language_title} (current count: {existing.media_count}, actual: {media_count})"
                    )
                else:
                    media_count = Media.objects.filter(
                        state="public", is_reviewed=True, media_language=language_code
                    ).count()
                    self.stdout.write(
                        f"Would create MediaLanguage: {language_title} (media count: {media_count})"
                    )
            else:
                # Create or get the MediaLanguage record
                language_obj, created = MediaLanguage.objects.get_or_create(
                    title=language_title
                )

                # Update the media count
                language_obj.update_language_media()

                if created:
                    created_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Created MediaLanguage: {language_title} (media count: {language_obj.media_count})"
                        )
                    )
                else:
                    updated_count += 1
                    self.stdout.write(
                        self.style.SUCCESS(
                            f"Updated MediaLanguage: {language_title} (media count: {language_obj.media_count})"
                        )
                    )

        if not options["dry_run"]:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\n{'=' * 80}\n"
                    f"FINAL SUMMARY:\n"
                    f"MediaLanguages - Created: {created_count}, Updated: {updated_count}\n"
                    f"{'=' * 80}"
                )
            )
        else:
            self.stdout.write(
                self.style.NOTICE("\nDry run completed - no changes made")
            )
