"""Backfill slug from title for existing Category and Topic rows, then enforce unique."""

from django.db import migrations, models
from django.template.defaultfilters import slugify


def populate_slugs(apps, schema_editor):
    def _fill_slugs(model, prefix):
        for obj in model.objects.filter(slug__isnull=True):
            base = (slugify(obj.title) or f"{prefix}-{obj.pk}")[:100]
            slug = base
            n = 1
            while model.objects.filter(slug=slug).exclude(pk=obj.pk).exists():
                suffix = f"-{n}"
                slug = f"{base[: 100 - len(suffix)]}{suffix}"
                n += 1
            obj.slug = slug
            obj.save(update_fields=["slug"])

    _fill_slugs(apps.get_model("files", "Category"), "category")
    _fill_slugs(apps.get_model("files", "Topic"), "topic")


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0019_category_topic_slug"),
    ]

    operations = [
        migrations.RunPython(populate_slugs, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="category",
            name="slug",
            field=models.SlugField(blank=True, max_length=100, unique=True),
        ),
        migrations.AlterField(
            model_name="topic",
            name="slug",
            field=models.SlugField(blank=True, max_length=100, unique=True),
        ),
    ]
