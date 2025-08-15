# files/migrations/0XXX_add_apac_languages.py
from django.db import migrations

def load_apac_languages(apps, schema_editor):
    Language = apps.get_model('files', 'Language')
    languages = [
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
    for lang in languages:
        Language.objects.get_or_create(code=lang["code"], defaults={"title": lang["title"]})

def reverse_load_apac_languages(apps, schema_editor):
    Language = apps.get_model('files', 'Language')
    codes = [
        "en","zh","zh-TW","ja","ko","th","vi","id","ms","tl","hi","ta","bn","ur",
        "pa","te","kn","ml","gu","mr","ne","si","my","km","lo","automatic","automatic-translation"
    ]
    Language.objects.filter(code__in=codes).delete()

class Migration(migrations.Migration):
    dependencies = [
        ('files', '0003_alter_media_state_tinymcemedia'),  # ganti dengan migration terakhir yang ada
    ]
    operations = [
        migrations.RunPython(load_apac_languages, reverse_load_apac_languages),
    ]
