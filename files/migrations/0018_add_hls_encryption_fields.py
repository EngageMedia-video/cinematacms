import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0017_add_my_uploads_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="media",
            name="is_encrypted",
            field=models.BooleanField(default=False, help_text="Enable AES-128 encryption for HLS streaming"),
        ),
        migrations.AddField(
            model_name="media",
            name="encryption_key",
            field=models.CharField(
                blank=True,
                help_text="Hex-encoded AES-128 encryption key",
                max_length=32,
                validators=[
                    django.core.validators.RegexValidator(
                        message="Must be blank or exactly 32 hex characters",
                        regex="^(?:[0-9A-Fa-f]{32})?$",
                    )
                ],
            ),
        ),
    ]
