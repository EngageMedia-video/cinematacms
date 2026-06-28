from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0028_media_visibility_schedule"),
    ]

    operations = [
        migrations.AddField(
            model_name="media",
            name="sprite_num_secs",
            field=models.PositiveIntegerField(
                blank=True,
                null=True,
                help_text=(
                    "Seconds between consecutive tiles in the generated sprite sheet. Stored per "
                    "media because long videos use a widened interval (see SPRITE_MAX_TILES). The "
                    "thumbnail selector maps a chosen tile back to its timestamp as tile_index * "
                    "this value, so it must match what files/sprites.py used to space the tiles. "
                    "Null for legacy rows generated before this field existed; callers fall back "
                    "to settings.SPRITE_NUM_SECS."
                ),
            ),
        ),
    ]
