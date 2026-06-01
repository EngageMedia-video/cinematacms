import uuid

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0024_media_storage_usage_bytes"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="CommunityImpact",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("uid", models.UUIDField(default=uuid.uuid4, editable=False, unique=True)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("screening", "Screened In"),
                            ("featured", "Featured In"),
                            ("saves", "Saves & Playlists"),
                            ("academic", "Academic Usage"),
                            ("curated", "Curated Into"),
                        ],
                        db_index=True,
                        max_length=20,
                    ),
                ),
                ("title", models.CharField(max_length=200)),
                ("details", models.TextField(blank=True, default="")),
                ("event_date", models.DateField()),
                ("url", models.URLField(blank=True, default="")),
                ("add_date", models.DateTimeField(auto_now_add=True)),
                ("edit_date", models.DateTimeField(auto_now=True)),
                (
                    "media",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="community_impacts",
                        to="files.media",
                    ),
                ),
                (
                    "user",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, to=settings.AUTH_USER_MODEL),
                ),
            ],
            options={
                "ordering": ["-event_date", "-add_date"],
                "indexes": [
                    models.Index(fields=["media", "category"], name="files_commu_media_i_e2a737_idx"),
                ],
            },
        ),
    ]
