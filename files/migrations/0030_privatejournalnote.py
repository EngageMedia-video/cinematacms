import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0029_media_sprite_num_secs"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="PrivateJournalNote",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uid", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                ("text", models.TextField(help_text="text")),
                ("timestamp_seconds", models.FloatField(default=0)),
                ("add_date", models.DateTimeField(auto_now_add=True)),
                ("edit_date", models.DateTimeField(auto_now=True)),
                (
                    "media",
                    models.ForeignKey(
                        db_index=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="private_journal_notes",
                        to="files.media",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(
                        db_index=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "ordering": ["-add_date"],
                "indexes": [
                    models.Index(fields=["media", "user", "-add_date"], name="idx_pjn_media_user_date"),
                    models.Index(fields=["user", "-add_date"], name="idx_pjn_user_date"),
                ],
            },
        ),
    ]
