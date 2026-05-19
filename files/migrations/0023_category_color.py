from django.db import migrations, models

DEFAULT_CATEGORY_COLORS = {
    "animation": "cinemata-amber-600p",
    "documentary": "cinemata-pacific-deep-600p",
    "experimental": "cinemata-coral-reef-700",
    "explainer": "cinemata-sandy-shore-700",
    "fiction": "cinemata-strait-blue-600p",
    "hybrid": "cinemata-neutral-600",
    "music-video": "cinemata-red-700p",
    "news-reel": "cinemata-green-700p",
    "participatory-video": "cinemata-sunset-horizon-600",
    "podcast": "cinemata-coral-reef-400p",
    "trailers": "cinemata-amber-700",
}


def seed_category_colors(apps, schema_editor):
    Category = apps.get_model("files", "Category")
    for slug, color in DEFAULT_CATEGORY_COLORS.items():
        Category.objects.filter(slug=slug).update(color=color)


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0022_contentsensitivity_media_content_sensitivity"),
    ]

    operations = [
        migrations.AddField(
            model_name="category",
            name="color",
            field=models.CharField(
                blank=True,
                default="",
                help_text="Badge color as a design token (e.g. cinemata-pacific-deep-600p) or hex (#1a3f61)",
                max_length=50,
            ),
        ),
        migrations.RunPython(seed_category_colors, migrations.RunPython.noop),
    ]
