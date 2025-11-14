# Generated manually to backfill filename fields
# This migration populates the filename field for existing Media and Encoding records
# that were created before the filename field was added in migration 0007.

import os
from django.db import migrations


def backfill_media_filenames(apps, schema_editor):
    """
    Backfill filename field for Media records.
    Extracts the filename from the media_file field path.
    """
    from django.db import transaction

    Media = apps.get_model('files', 'Media')

    # Find all Media records with empty filename field
    media_records = Media.objects.filter(filename='')

    if not media_records.exists():
        print("No Media records need filename backfill.")
        return

    print(f"Backfilling filename for {media_records.count()} Media records...")

    updated_count = 0
    batch_size = 500
    batch = []

    for media in media_records.iterator(chunk_size=batch_size):
        if media.media_file and media.media_file.name:
            # Extract just the filename from the full path
            filename = os.path.basename(media.media_file.name)
            media.filename = filename
            batch.append(media)

            # Bulk update when batch is full
            if len(batch) >= batch_size:
                with transaction.atomic():
                    Media.objects.bulk_update(batch, ['filename'], batch_size=batch_size)
                updated_count += len(batch)
                print(f"  Updated {updated_count} Media records...")
                batch = []

    # Update remaining records
    if batch:
        with transaction.atomic():
            Media.objects.bulk_update(batch, ['filename'], batch_size=batch_size)
        updated_count += len(batch)

    print(f"Successfully backfilled filename for {updated_count} Media records.")


def backfill_encoding_filenames(apps, schema_editor):
    """
    Backfill filename field for Encoding records.
    Extracts the filename from the media_file field path.
    """
    from django.db import transaction

    Encoding = apps.get_model('files', 'Encoding')

    # Find all Encoding records with empty filename field
    encoding_records = Encoding.objects.filter(filename='')

    if not encoding_records.exists():
        print("No Encoding records need filename backfill.")
        return

    print(f"Backfilling filename for {encoding_records.count()} Encoding records...")

    updated_count = 0
    batch_size = 500
    batch = []

    for encoding in encoding_records.iterator(chunk_size=batch_size):
        if encoding.media_file and encoding.media_file.name:
            # Extract just the filename from the full path
            filename = os.path.basename(encoding.media_file.name)
            encoding.filename = filename
            batch.append(encoding)

            # Bulk update when batch is full
            if len(batch) >= batch_size:
                with transaction.atomic():
                    Encoding.objects.bulk_update(batch, ['filename'], batch_size=batch_size)
                updated_count += len(batch)
                print(f"  Updated {updated_count} Encoding records...")
                batch = []

    # Update remaining records
    if batch:
        with transaction.atomic():
            Encoding.objects.bulk_update(batch, ['filename'], batch_size=batch_size)
        updated_count += len(batch)

    print(f"Successfully backfilled filename for {updated_count} Encoding records.")


class Migration(migrations.Migration):

    dependencies = [
        ('files', '0008_fix_invalid_state_and_country'),
    ]

    operations = [
        migrations.RunPython(
            backfill_media_filenames,
            reverse_code=migrations.RunPython.noop,  # Irreversible: cannot restore original empty state
        ),
        migrations.RunPython(
            backfill_encoding_filenames,
            reverse_code=migrations.RunPython.noop,  # Irreversible: cannot restore original empty state
        ),
    ]
