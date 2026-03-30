from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("files", "0016_add_encoding_drain_composite_index"),
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
            field=models.CharField(blank=True, help_text="Hex-encoded AES-128 encryption key", max_length=64),
        ),
        migrations.AddField(
            model_name="media",
            name="offline_access",
            field=models.CharField(
                blank=True,
                choices=[("stream_only", "Stream Only"), ("offline", "Offline")],
                default="stream_only",
                help_text="Controls whether offline playback is allowed",
                max_length=20,
            ),
        ),
    ]
