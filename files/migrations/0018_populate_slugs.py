"""Backfill slug from title for existing Category and Topic rows, then enforce unique."""

from django.db import migrations, models
from django.template.defaultfilters import slugify


def populate_slugs(apps, schema_editor):
    Category = apps.get_model("files", "Category")
    for obj in Category.objects.filter(slug__isnull=True):
        base = slugify(obj.title) or f"category-{obj.pk}"
        slug = base
        n = 1
        while Category.objects.filter(slug=slug).exclude(pk=obj.pk).exists():
            slug = f"{base}-{n}"
            n += 1
        obj.slug = slug
        obj.save(update_fields=["slug"])

    Topic = apps.get_model("files", "Topic")
    for obj in Topic.objects.filter(slug__isnull=True):
        base = slugify(obj.title) or f"topic-{obj.pk}"
        slug = base
        n = 1
        while Topic.objects.filter(slug=slug).exclude(pk=obj.pk).exists():
            slug = f"{base}-{n}"
            n += 1
        obj.slug = slug
        obj.save(update_fields=["slug"])


class Migration(migrations.Migration):

    dependencies = [
        ("files", "0017_category_topic_slug"),
    ]

    operations = [
        migrations.RunPython(populate_slugs, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="category",
            name="slug",
            field=models.SlugField(max_length=100, unique=True),
        ),
        migrations.AlterField(
            model_name="topic",
            name="slug",
            field=models.SlugField(max_length=100, unique=True),
        ),
    ]
