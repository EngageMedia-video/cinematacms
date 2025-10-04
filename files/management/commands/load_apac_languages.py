from django.core.management.base import BaseCommand
from django.db import transaction
from files.models import Language, MediaLanguage, Subtitle

class Command(BaseCommand):
    help = 'Load APAC languages with BCP-47 standards and consolidate duplicates'

    def add_arguments(self, parser):
        parser.add_argument(
            '--update',
            action='store_true',
            help='Update existing entries, consolidate duplicates, and migrate subtitles',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be created/updated without making changes',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        # APAC and commonly used languages with BCP 47 codes (legacy ISO 639-1/3 preserved)
        languages_data = [
            # Abkhazian
            {"code": "ab", "title": "Abkhazian", "legacy_codes": [], "legacy_titles": []},

            # Arabic
            {"code": "ar", "title": "Arabic", "legacy_codes": [], "legacy_titles": []},

            # German
            {"code": "de", "title": "German", "legacy_codes": [], "legacy_titles": []},

            # Greek
            {"code": "el", "title": "Greek", "legacy_codes": [], "legacy_titles": []},

            # English
            {"code": "en", "title": "English", "legacy_codes": [], "legacy_titles": []},

            # English, British
            {"code": "en-GB", "title": "English (British)", "legacy_codes": ["en-gb"], "legacy_titles": ["English, British"]},

            # Spanish
            {"code": "es", "title": "Spanish", "legacy_codes": [], "legacy_titles": []},

            # Spanish, Mexican
            {"code": "es-MX", "title": "Spanish (Mexican)", "legacy_codes": ["es-mx"], "legacy_titles": ["Spanish, Mexican"]},

            # French
            {"code": "fr", "title": "French", "legacy_codes": [], "legacy_titles": []},

            # Interlingua
            {"code": "ia", "title": "Interlingua", "legacy_codes": [], "legacy_titles": []},

            # Italian
            {"code": "it", "title": "Italian", "legacy_codes": [], "legacy_titles": []},

            # Korean
            {"code": "ko", "title": "Korean", "legacy_codes": [], "legacy_titles": []},

            # Malay - Keep 'ms' as it's valid BCP 47
            {"code": "ms", "title": "Malay", "legacy_codes": [], "legacy_titles": []},

            # Burmese
            {"code": "my", "title": "Burmese", "legacy_codes": [], "legacy_titles": []},

            # Portuguese
            {"code": "pt", "title": "Portuguese", "legacy_codes": [], "legacy_titles": ["Portugese"]},  # Fix typo

            # Portuguese, Brazilian
            {"code": "pt-BR", "title": "Portuguese (Brazilian)", "legacy_codes": ["pt-br"], "legacy_titles": ["Portuguese, Brazilian"]},

            # Tetum
            {"code": "tet", "title": "Tetum", "legacy_codes": [], "legacy_titles": []},

            # Thai
            {"code": "th", "title": "Thai", "legacy_codes": [], "legacy_titles": []},

            # Tagalog (Filipino)
            {"code": "tl", "title": "Tagalog", "legacy_codes": [], "legacy_titles": []},

            # Chinese, Cantonese (Yue) - Fix from 'zh' which was incorrectly labeled
            {"code": "yue", "title": "Chinese (Cantonese)", "legacy_codes": ["zh-yue"], "legacy_titles": ["Chinese, Yue", "Cantonese", "Cantonese (Traditional)", "Cantonese (Simplified)"]},

            # Chinese, Simplified (includes generic Chinese and Mandarin as the most common form)
            {"code": "zh-Hans", "title": "Chinese (Simplified)", "legacy_codes": ["zh-cn", "zh-CN", "zh", "cmn", "man"], "legacy_titles": ["Chinese, Simplified", "Mandarin Chinese (Simplified)", "Chinese", "Chinese, Mandarin", "Mandarin Chinese", "Mandarin"]},

            # Chinese, Traditional
            {"code": "zh-Hant", "title": "Chinese (Traditional)", "legacy_codes": ["zh-tw", "zh-TW"], "legacy_titles": ["Chinese, Traditional", "Mandarin Chinese (Traditional)"]},

            # Japanese
            {"code": "ja", "title": "Japanese", "legacy_codes": [], "legacy_titles": []},

            # Vietnamese
            {"code": "vi", "title": "Vietnamese", "legacy_codes": [], "legacy_titles": []},

            # Hindi
            {"code": "hi", "title": "Hindi", "legacy_codes": [], "legacy_titles": []},

            # Tamil
            {"code": "ta", "title": "Tamil", "legacy_codes": [], "legacy_titles": []},

            # Urdu
            {"code": "ur", "title": "Urdu", "legacy_codes": [], "legacy_titles": []},

            # Punjabi
            {"code": "pa", "title": "Punjabi", "legacy_codes": [], "legacy_titles": []},

            # Telugu
            {"code": "te", "title": "Telugu", "legacy_codes": [], "legacy_titles": []},

            # Kannada
            {"code": "kn", "title": "Kannada", "legacy_codes": [], "legacy_titles": []},

            # Malayalam
            {"code": "ml", "title": "Malayalam", "legacy_codes": [], "legacy_titles": []},

            # Gujarati
            {"code": "gu", "title": "Gujarati", "legacy_codes": [], "legacy_titles": []},

            # Marathi
            {"code": "mr", "title": "Marathi", "legacy_codes": [], "legacy_titles": []},

            # Nepali
            {"code": "ne", "title": "Nepali", "legacy_codes": [], "legacy_titles": []},

            # Sinhala
            {"code": "si", "title": "Sinhala", "legacy_codes": [], "legacy_titles": []},

            # Bengali/Bangla - Consolidate duplicates (IDs 29 'be' and 37 'ba')
            {"code": "bn", "title": "Bengali", "legacy_codes": ["be", "ba"], "legacy_titles": ["Bangla"]},

            # Cebuano
            {"code": "ceb", "title": "Cebuano", "legacy_codes": ["ce"], "legacy_titles": []},

            # Chamorro
            {"code": "ch", "title": "Chamorro", "legacy_codes": [], "legacy_titles": ["Chammoro"]},  # Fix typo in production data

            # Dhivehi
            {"code": "dv", "title": "Dhivehi", "legacy_codes": ["dh"], "legacy_titles": ["Divehi"]},

            # Dzongkha
            {"code": "dz", "title": "Dzongkha", "legacy_codes": [], "legacy_titles": []},

            # Fijian
            {"code": "fj", "title": "Fijian", "legacy_codes": ["fi"], "legacy_titles": []},

            # Halia
            {"code": "haa", "title": "Halia", "legacy_codes": ["ha"], "legacy_titles": []},

            # Javanese
            {"code": "jv", "title": "Javanese", "legacy_codes": ["jw"], "legacy_titles": []},

            # Karen (multiple varieties, using sgaw-Karen as default)
            {"code": "kar", "title": "Karen", "legacy_codes": ["ka"], "legacy_titles": []},

            # Khmer
            {"code": "km", "title": "Khmer", "legacy_codes": ["kh"], "legacy_titles": ["Central Khmer"]},

            # Lao
            {"code": "lo", "title": "Lao", "legacy_codes": ["la"], "legacy_titles": []},

            # Madurese
            {"code": "mad", "title": "Madurese", "legacy_codes": ["ma"], "legacy_titles": []},

            # Malagasy
            {"code": "mg", "title": "Malagasy", "legacy_codes": [], "legacy_titles": []},

            # Maori
            {"code": "mi", "title": "Maori", "legacy_codes": [], "legacy_titles": []},

            # Mongolian
            {"code": "mn", "title": "Mongolian", "legacy_codes": ["mo"], "legacy_titles": []},

            # Palauan
            {"code": "pau", "title": "Palauan", "legacy_codes": ["pal"], "legacy_titles": []},

            # Pashto
            {"code": "ps", "title": "Pashto", "legacy_codes": ["pas"], "legacy_titles": ["Pashtu"]},

            # Pitcairn-Norfolk (Pitkern is a dialect)
            {"code": "pih", "title": "Pitcairn-Norfolk", "legacy_codes": ["pi"], "legacy_titles": ["Pitkern"]},

            # Russian
            {"code": "ru", "title": "Russian", "legacy_codes": [], "legacy_titles": []},

            # Samoan
            {"code": "sm", "title": "Samoan", "legacy_codes": [], "legacy_titles": []},

            # Sundanese
            {"code": "su", "title": "Sundanese", "legacy_codes": [], "legacy_titles": []},

            # Taiwanese (Min Nan Chinese)
            {"code": "nan", "title": "Taiwanese (Min Nan)", "legacy_codes": ["tai"], "legacy_titles": ["Taiwanese"]},

            # Tibetan
            {"code": "bo", "title": "Tibetan", "legacy_codes": [], "legacy_titles": []},

            # Tokelauan
            {"code": "tkl", "title": "Tokelauan", "legacy_codes": ["tok"], "legacy_titles": []},

            # Tongan
            {"code": "to", "title": "Tongan", "legacy_codes": [], "legacy_titles": []},

            # Indonesian
            {"code": "id", "title": "Indonesian", "legacy_codes": ["ind"], "legacy_titles": []},

            # Special entries for auto-generated content (not standard languages)
            {"code": "automatic", "title": "Auto-generated Transcription", "legacy_codes": [], "legacy_titles": []},
            {"code": "automatic-translation", "title": "Auto-generated English Translation", "legacy_codes": [], "legacy_titles": []},
        ]

        # Exclude automatic entries for MediaLanguage
        exclude_from_media_language = ["automatic", "automatic-translation"]

        created_languages = 0
        updated_languages = 0
        created_media_languages = 0
        updated_media_languages = 0

        for lang_data in languages_data:
            # Handle Language model
            # Build list of codes to check (current + legacy)
            lookup_codes = [lang_data['code']] + lang_data.get('legacy_codes', [])

            if options['dry_run']:
                existing = Language.objects.filter(code__in=lookup_codes).first()
                if existing:
                    if existing.code != lang_data['code'] and options.get("update"):
                        self.stdout.write(f"Would migrate Language code: {existing.code} -> {lang_data['code']} ({lang_data['title']})")
                    elif existing.title != lang_data['title'] and options.get("update"):
                        self.stdout.write(f"Would update Language: {lang_data['title']}")
                    else:
                        self.stdout.write(f"Would skip existing Language: {existing.title}")
                else:
                    self.stdout.write(f"Would create Language: {lang_data['title']}")
            else:
                # Check if language exists with current or legacy code
                existing = Language.objects.filter(code__in=lookup_codes).first()

                if existing is None:
                    # Create new language
                    Language.objects.create(
                        code=lang_data['code'],
                        title=lang_data['title']
                    )
                    created_languages += 1
                    self.stdout.write(
                        self.style.SUCCESS(f'Created Language: {lang_data["title"]}')
                    )
                elif options['update']:
                    # Update existing language (code and/or title)
                    updated = False
                    if existing.code != lang_data['code']:
                        old_code = existing.code
                        existing.code = lang_data['code']
                        updated = True
                        self.stdout.write(
                            self.style.WARNING(f'Migrated Language code: {old_code} -> {lang_data["code"]} ({lang_data["title"]})')
                        )
                    if existing.title != lang_data['title']:
                        existing.title = lang_data['title']
                        updated = True

                    if updated:
                        existing.save()
                        updated_languages += 1
                        if existing.code == lang_data['code']:
                            self.stdout.write(
                                self.style.WARNING(f'Updated Language: {lang_data["title"]}')
                            )
                else:
                    self.stdout.write(
                        self.style.NOTICE(f'Skipped existing Language: {existing.title}')
                    )

            # Handle MediaLanguage model (exclude automatic entries)
            if lang_data['code'] not in exclude_from_media_language:
                # Build list of titles to look up (current + legacy)
                lookup_titles = [lang_data['title']] + lang_data.get('legacy_titles', [])

                if options['dry_run']:
                    # Check if any of the lookup titles exist
                    existing_media_langs = MediaLanguage.objects.filter(title__in=lookup_titles)
                    if existing_media_langs.exists():
                        for exists in existing_media_langs:
                            if exists.title != lang_data['title'] and options.get('update'):
                                self.stdout.write(f"Would update MediaLanguage: {exists.title} -> {lang_data['title']}")
                            else:
                                self.stdout.write(f"Would skip existing MediaLanguage: {exists.title}")
                    else:
                        self.stdout.write(f"Would create MediaLanguage: {lang_data['title']}")
                else:
                    # Try to find existing MediaLanguage by any title (current or legacy)
                    # Get all matching entries for consolidation
                    existing_media_langs = MediaLanguage.objects.filter(title__in=lookup_titles).order_by('id')

                    if not existing_media_langs.exists():
                        # No existing entry found, create new one
                        MediaLanguage.objects.create(
                            title=lang_data['title'],
                            media_count=0,
                            listings_thumbnail='',  # Empty string, not null
                        )
                        created_media_languages += 1
                        self.stdout.write(
                            self.style.SUCCESS(f'Created MediaLanguage: {lang_data["title"]}')
                        )
                    else:
                        # Found one or more existing entries
                        # First check if target title already exists (not in our lookup list)
                        target_exists = MediaLanguage.objects.filter(title=lang_data['title']).exists()

                        if target_exists:
                            # Target title already exists, need to merge all lookup_titles into it
                            # Use filter().order_by().first() to safely handle potential duplicates
                            target = MediaLanguage.objects.filter(title=lang_data['title']).order_by('id').first()

                            if target is None:
                                # Should not happen given target_exists check, but handle gracefully
                                self.stdout.write(
                                    self.style.WARNING(f'Could not find MediaLanguage with title: {lang_data["title"]}')
                                )
                                continue

                            duplicates_to_merge = existing_media_langs.exclude(id=target.id)

                            if duplicates_to_merge.exists() and options['update']:
                                # Consolidate media_count from all duplicates
                                total_count = target.media_count
                                for dup in duplicates_to_merge:
                                    total_count += dup.media_count
                                    self.stdout.write(
                                        self.style.WARNING(f'Merging and deleting duplicate MediaLanguage: {dup.title} (ID: {dup.id})')
                                    )
                                    dup.delete()

                                target.media_count = total_count
                                target.save(update_fields=['media_count'])
                                updated_media_languages += 1
                                self.stdout.write(
                                    self.style.SUCCESS(f'Merged duplicates into existing MediaLanguage: {target.title}')
                                )
                            else:
                                self.stdout.write(
                                    self.style.NOTICE(f'Skipped existing MediaLanguage: {target.title}')
                                )
                        else:
                            # Target title doesn't exist yet, so we can safely rename
                            primary = existing_media_langs.first()
                            duplicates = list(existing_media_langs[1:])

                            # Update the primary entry if needed
                            if primary.title != lang_data['title'] and options['update']:
                                old_title = primary.title

                                # Consolidate media_count from duplicates
                                total_count = primary.media_count
                                for dup in duplicates:
                                    total_count += dup.media_count

                                primary.title = lang_data['title']
                                primary.media_count = total_count
                                primary.save(update_fields=['title', 'media_count'])
                                updated_media_languages += 1
                                self.stdout.write(
                                    self.style.WARNING(f'Updated MediaLanguage title: {old_title} -> {lang_data["title"]}')
                                )

                                # Delete duplicates if they exist
                                if duplicates:
                                    for dup in duplicates:
                                        self.stdout.write(
                                            self.style.WARNING(f'Deleting duplicate MediaLanguage: {dup.title} (ID: {dup.id})')
                                        )
                                        dup.delete()
                            else:
                                self.stdout.write(
                                    self.style.NOTICE(f'Skipped existing MediaLanguage: {primary.title}')
                                )

        # Step 2: Consolidate duplicate languages and migrate subtitles if --update is used
        if options['update']:
            self.stdout.write(self.style.NOTICE('\n' + '='*80))
            self.stdout.write(self.style.NOTICE('CONSOLIDATING DUPLICATE LANGUAGES'))
            self.stdout.write(self.style.NOTICE('='*80))

            # Define consolidation mapping (old_code -> new_code)
            consolidation_map = {
                'be': 'bn',  # Bengali
                'ba': 'bn',  # Bangla -> Bengali
                'zh-yue': 'yue',  # Chinese (Cantonese) old format -> Cantonese BCP-47
                'zh': 'zh-Hans',  # Generic Chinese -> Chinese, Simplified (most common)
                'zh-cn': 'zh-Hans',  # Chinese, Simplified
                'zh-CN': 'zh-Hans',  # Chinese, Simplified (uppercase)
                'zh-tw': 'zh-Hant',  # Chinese, Traditional
                'zh-TW': 'zh-Hant',  # Chinese, Traditional (uppercase)
                'man': 'zh-Hans',  # Mandarin -> Chinese, Simplified
                'cmn': 'zh-Hans',  # Chinese Mandarin ISO 639-3 -> Chinese, Simplified
                'ind': 'id',  # Indonesian
                'ce': 'ceb',  # Cebuano
                'dh': 'dv',  # Dhivehi
                'fi': 'fj',  # Fijian (fix confusion with Finnish)
                'ha': 'haa',  # Halia
                'jw': 'jv',  # Javanese
                'ka': 'kar',  # Karen
                'kh': 'km',  # Khmer
                'la': 'lo',  # Lao
                'ma': 'mad',  # Madurese
                'mo': 'mn',  # Mongolian
                'pal': 'pau',  # Palauan
                'pas': 'ps',  # Pashto
                'pi': 'pih',  # Pitcairn-Norfolk
                'tai': 'nan',  # Taiwanese
                'tok': 'tkl',  # Tokelauan
                'en-gb': 'en-GB',  # English, British
                'es-mx': 'es-MX',  # Spanish, Mexican
                'pt-br': 'pt-BR',  # Portuguese, Brazilian
            }

            total_subtitles_migrated = 0
            total_languages_removed = 0

            for old_code, new_code in consolidation_map.items():
                try:
                    old_language = Language.objects.get(code=old_code)

                    # Check if target language exists
                    try:
                        new_language = Language.objects.get(code=new_code)
                    except Language.DoesNotExist:
                        self.stdout.write(
                            self.style.WARNING(f'Target language {new_code} does not exist, skipping {old_code}')
                        )
                        continue

                    # Count affected subtitles
                    subtitle_count = Subtitle.objects.filter(language=old_language).count()

                    if options['dry_run']:
                        if subtitle_count > 0:
                            self.stdout.write(
                                f'Would migrate {subtitle_count} subtitles from {old_code} to {new_code}'
                            )
                        self.stdout.write(f'Would remove language: {old_code} ({old_language.title})')
                    else:
                        # Migrate subtitles
                        if subtitle_count > 0:
                            updated = Subtitle.objects.filter(language=old_language).update(language=new_language)
                            total_subtitles_migrated += updated
                            self.stdout.write(
                                self.style.SUCCESS(
                                    f'Migrated {updated} subtitles from {old_code} to {new_code}'
                                )
                            )

                        # Delete the old language
                        old_title = old_language.title
                        old_language.delete()
                        total_languages_removed += 1
                        self.stdout.write(
                            self.style.SUCCESS(f'Removed duplicate language: {old_code} ({old_title})')
                        )

                except Language.DoesNotExist:
                    # Old language doesn't exist, nothing to consolidate
                    pass

            if not options['dry_run'] and total_languages_removed > 0:
                self.stdout.write(self.style.SUCCESS(
                    f'\nConsolidation Summary:\n'
                    f'Subtitles migrated: {total_subtitles_migrated}\n'
                    f'Duplicate languages removed: {total_languages_removed}'
                ))

        # Final summary
        if not options['dry_run']:
            self.stdout.write(
                self.style.SUCCESS(
                    f'\n{"="*80}\n'
                    f'FINAL SUMMARY:\n'
                    f'Languages - Created: {created_languages}, Updated: {updated_languages}\n'
                    f'MediaLanguages - Created: {created_media_languages}, Updated: {updated_media_languages}'
                )
            )
            if options['update']:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Subtitles migrated: {total_subtitles_migrated}\n'
                        f'Duplicate languages removed: {total_languages_removed}'
                    )
                )
            self.stdout.write(self.style.SUCCESS('='*80))
        else:
            self.stdout.write(self.style.NOTICE('\nDry run completed - no changes made'))