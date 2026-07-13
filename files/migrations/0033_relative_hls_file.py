import os

from django.conf import settings
from django.db import migrations

# Rewrites Media.hls_file from absolute filesystem paths to MEDIA_ROOT-relative
# ones (#789). Logic is inlined (not imported from files.helpers) so the
# migration stays stable if the helper evolves.
#
# Forward is idempotent: already-relative rows are skipped, and absolute rows
# are anchored on the "/hls/" marker (HLS output always lives under
# MEDIA_ROOT/hls/), so it also converts rows whose stored prefix no longer
# matches the current MEDIA_ROOT — the exact failure the issue describes.
# Rows in neither form are left untouched; the tolerant reader on the model
# (Media.hls_file_path) still resolves them.

BATCH_SIZE = 500


def _to_relative(path):
    if not path or not os.path.isabs(path):
        return path
    idx = path.find("/hls/")
    if idx != -1:
        return path[idx + 1 :]
    media_root = settings.MEDIA_ROOT.rstrip("/") + "/"
    if path.startswith(media_root):
        return path[len(media_root) :]
    return path


def _to_absolute(path):
    if not path or os.path.isabs(path):
        return path
    return os.path.join(settings.MEDIA_ROOT, path)


def _rewrite(apps, transform):
    Media = apps.get_model("files", "Media")
    batch = []
    for media in Media.objects.exclude(hls_file="").only("id", "hls_file").iterator():
        new_value = transform(media.hls_file)
        if new_value != media.hls_file:
            media.hls_file = new_value
            batch.append(media)
        if len(batch) >= BATCH_SIZE:
            Media.objects.bulk_update(batch, ["hls_file"])
            batch = []
    if batch:
        Media.objects.bulk_update(batch, ["hls_file"])


def forwards(apps, schema_editor):
    _rewrite(apps, _to_relative)


def backwards(apps, schema_editor):
    _rewrite(apps, _to_absolute)


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0032_privatejournalnote"),
    ]

    operations = [
        migrations.RunPython(forwards, backwards),
    ]
