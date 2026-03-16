"""Add nullable slug fields to Category and Topic — backfilled in 0018."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("files", "0016_add_encoding_drain_composite_index"),
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
