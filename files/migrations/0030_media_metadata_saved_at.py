from django.db import migrations, models
from django.db.models.functions import Coalesce


def backfill_metadata_saved_at(apps, schema_editor):
    Media = apps.get_model("files", "Media")
    Media.objects.filter(metadata_saved_at__isnull=True).update(metadata_saved_at=Coalesce("edit_date", "add_date"))


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0029_media_sprite_num_secs"),
    ]

    operations = [
        migrations.AddField(
            model_name="media",
            name="metadata_saved_at",
            field=models.DateTimeField(
                blank=True,
                help_text=(
                    "Set when the user submits the metadata form as a draft or full submission. "
                    "NULL means the upload completed but the form was never saved."
                ),
                null=True,
            ),
        ),
        migrations.RunPython(backfill_metadata_saved_at, migrations.RunPython.noop),
        migrations.AddIndex(
            model_name="media",
            index=models.Index(
                condition=models.Q(("metadata_saved_at__isnull", True)),
                fields=["add_date"],
                name="idx_media_unsaved_meta",
            ),
        ),
    ]
