from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0027_media_is_draft_alter_media_summary"),
    ]

    operations = [
        migrations.AddField(
            model_name="media",
            name="visibility_start_date",
            field=models.DateTimeField(
                blank=True,
                db_index=True,
                help_text="When the film becomes visible at its chosen Status. Stored in UTC. Blank = immediate.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="media",
            name="visibility_expires_at",
            field=models.DateTimeField(
                blank=True,
                db_index=True,
                help_text="When visibility ends and the film flips to the after-expiry state. Stored in UTC. Blank = never.",
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="media",
            name="visibility_after_expiry",
            field=models.CharField(
                blank=True,
                choices=[("private", "Private"), ("unlisted", "Unlisted")],
                help_text="State the film flips to after the window ends.",
                max_length=20,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="media",
            name="visibility_window_state",
            field=models.CharField(
                blank=True,
                choices=[
                    ("private", "Private"),
                    ("public", "Public"),
                    ("restricted", "Restricted"),
                    ("unlisted", "Unlisted"),
                ],
                help_text="Chosen Status to restore while the visibility window is active. Set automatically.",
                max_length=20,
                null=True,
            ),
        ),
    ]
