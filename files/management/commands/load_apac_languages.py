from django.core.management.base import BaseCommand
from files.models import Language, MediaLanguage

class Command(BaseCommand):
    help = 'Load APAC languages safely without conflicts'

    def add_arguments(self, parser):
        parser.add_argument(
            '--update',
            action='store_true',
            help='Update existing entries if they exist',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created/updated without making changes',
        )

    def handle(self, *args, **options):
        languages_data = [
            {"code": "en", "title": "English"},
            {"code": "zh", "title": "Chinese (Simplified)"},
            {"code": "zh-TW", "title": "Chinese (Traditional)"},
            {"code": "ja", "title": "Japanese"},
            {"code": "ko", "title": "Korean"},
            {"code": "th", "title": "Thai"},
            {"code": "vi", "title": "Vietnamese"},
            {"code": "id", "title": "Indonesian"},
            {"code": "ms", "title": "Malay"},
            {"code": "tl", "title": "Filipino"},
            {"code": "hi", "title": "Hindi"},
            {"code": "ta", "title": "Tamil"},
            {"code": "bn", "title": "Bengali"},
            {"code": "ur", "title": "Urdu"},
            {"code": "pa", "title": "Punjabi"},
            {"code": "te", "title": "Telugu"},
            {"code": "kn", "title": "Kannada"},
            {"code": "ml", "title": "Malayalam"},
            {"code": "gu", "title": "Gujarati"},
            {"code": "mr", "title": "Marathi"},
            {"code": "ne", "title": "Nepali"},
            {"code": "si", "title": "Sinhala"},
            {"code": "my", "title": "Myanmar (Burmese)"},
            {"code": "km", "title": "Khmer"},
            {"code": "lo", "title": "Lao"},
            {"code": "automatic", "title": "Automatic Detection"},
            {"code": "automatic-translation", "title": "Auto-detect & Translate to English"},
        ]

        # Exclude automatic entries for MediaLanguage
        exclude_from_media_language = ["automatic", "automatic-translation"]

        created_languages = 0
        updated_languages = 0
        created_media_languages = 0
        updated_media_languages = 0

        for lang_data in languages_data:
            # Handle Language model
            if options['dry_run']:
                exists = Language.objects.filter(code=lang_data['code']).exists()
                if exists:
                    action = "update" if options.get("update") else "skip"
                    self.stdout.write(f"Would {action} Language: {lang_data['title']}")
                else:
                    self.stdout.write(f"Would create Language: {lang_data['title']}")
            else:
                language, created = Language.objects.get_or_create(
                    code=lang_data['code'],
                    defaults={'title': lang_data['title']}
                )

                if created:
                    created_languages += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'Created Language: {lang_data["title"]}')
                    )
                elif options['update']:
                    language.title = lang_data['title']
                    language.save()
                    updated_languages += 1
                    self.stdout.write(
                        self.style.WARNING(f'Updated Language: {lang_data["title"]}')
                    )
                else:
                    self.stdout.write(
                        self.style.NOTICE(f'Skipped existing Language: {lang_data["title"]}')
                    )

            # Handle MediaLanguage model (exclude automatic entries)
            if lang_data['code'] not in exclude_from_media_language:
                if options['dry_run']:
                    exists = MediaLanguage.objects.filter(title=lang_data['title']).exists()
                    if exists:
                        self.stdout.write(f"Would update MediaLanguage: {lang_data['title']}")
                    else:
                        self.stdout.write(f"Would create MediaLanguage: {lang_data['title']}")
                else:
                    # Using actual MediaLanguage model fields
                    media_language, created = MediaLanguage.objects.get_or_create(
                        title=lang_data['title'],
                        defaults={
                            'media_count': 0,
                            'listings_thumbnail': '',  # Empty string, not null
                        }
                    )
                    if created:
                        created_media_languages += 1
                        self.stdout.write(
                            self.style.SUCCESS(f'Created MediaLanguage: {lang_data["title"]}')
                        )
                    elif options['update']:
                        # Nothing to update for MediaLanguage currently; skipping.
                        self.stdout.write(self.style.WARNING(
                            f'No updatable fields for MediaLanguage: {lang_data["title"]}; skipped.'
                        ))
                    else:
                        self.stdout.write(
                            self.style.NOTICE(f'Skipped existing MediaLanguage: {lang_data["title"]}')
                        )

        if not options['dry_run']:
            self.stdout.write(
                self.style.SUCCESS(
                    f'\nSummary:\n'
                    f'Languages - Created: {created_languages}, Updated: {updated_languages}\n'
                    f'MediaLanguages - Created: {created_media_languages}, Updated: {updated_media_languages}'
                )
            )
        else:
            self.stdout.write(self.style.NOTICE('Dry run completed - no changes made'))