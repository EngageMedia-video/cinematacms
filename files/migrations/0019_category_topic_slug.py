"""Add nullable slug fields to Category and Topic — backfilled in 0020."""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0018_add_hls_encryption_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="category",
            name="slug",
            field=models.SlugField(max_length=100, null=True),
        ),
        migrations.AddField(
            model_name="topic",
            name="slug",
            field=models.SlugField(max_length=100, null=True),
        ),
    ]
