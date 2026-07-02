from django.db import migrations, models
from django.db.models.functions import Coalesce


def backfill_metadata_saved_at(apps, schema_editor):
    # Batch the backfill so a large Media table is not updated in a single
    # long-held transaction (one row lock per row). Each chunk is its own
    # UPDATE; the next daily/deploy step is unaffected if this runs long.
    Media = apps.get_model("files", "Media")
    while True:
        ids = list(Media.objects.filter(metadata_saved_at__isnull=True).values_list("pk", flat=True)[:5000])
        if not ids:
            break
        Media.objects.filter(pk__in=ids).update(metadata_saved_at=Coalesce("edit_date", "add_date"))


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
                    "NULL means the upload completed but the form was never saved. "
                    "CONTRACT: the cleanup_orphaned_draft_media reaper deletes any row left NULL "
                    "past ORPHANED_DRAFT_CLEANUP_HOURS, so every Media creation path that is NOT "
                    "an abandonable upload (admin, management commands, imports, new API paths) "
                    "MUST stamp this field, or its rows will be silently reaped."
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
