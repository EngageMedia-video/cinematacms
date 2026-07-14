from django.db import migrations


def merge_curator_notes_into_description(apps, schema_editor):
    """Preserve curator notes before the field is dropped (#805).

    The playlist page now treats description as the single source for the
    Curator's Notes section, so any note written through the removed dialog
    is folded into the description: copied when the description is empty,
    appended after a blank line otherwise.
    """
    Playlist = apps.get_model("files", "Playlist")
    for playlist in Playlist.objects.exclude(curator_note="").iterator():
        note = playlist.curator_note.strip()
        if not note:
            continue
        description = (playlist.description or "").strip()
        if not description:
            playlist.description = note
        elif note in description:
            continue
        else:
            playlist.description = f"{description}\n\n{note}"
        playlist.save(update_fields=["description"])


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0032_privatejournalnote"),
    ]

    operations = [
        migrations.RunPython(merge_curator_notes_into_description, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name="playlist",
            name="curator_note",
        ),
    ]
