from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0029_media_sprite_num_secs"),
    ]

    operations = [
        migrations.AddField(
            model_name="playlist",
            name="curator_note",
            field=models.TextField(blank=True, default="", help_text="Curator's editorial note for this playlist"),
        ),
    ]
