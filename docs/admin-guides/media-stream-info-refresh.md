# Refresh stored media stream info

Use `refresh_media_stream_info` when video encodes fail with ffmpeg reporting
`Could not write header` or `Nothing was written into output file`. Older
inspections could record a file's attached cover art (an MJPEG stream with
`disposition.attached_pic`) as its video stream. Encodes map that stream index
explicitly, so every encode and re-encode of such a video writes nothing.

The command scans every video row, selects the rows whose stored
`media_info.video_info` is an attached picture, re-inspects each original file,
and saves the corrected `media_info`, `duration` and `video_height`. It does
not encode anything and does not change the media state, visibility, or edit
date.

List the affected rows first:

```bash
uv run python manage.py refresh_media_stream_info --dry-run
```

Then repair them:

```bash
uv run python manage.py refresh_media_stream_info
```

Each row prints one line with its id and token. A row the command could not
repair prints `result=failed` or `result=skipped` with the reason on stderr and
is left unchanged. The run ends with
`scanned=N affected=N repaired=N skipped=N failed=N mode=repair`.

The failure reasons are:

- `media file is missing`. The row stays selected until its file is restored.
- `inspection found audio only`. The file is an audio file whose embedded cover
  art was stored as its video stream. The command does not reclassify media, so
  the row stays listed until someone reviews it and reclassifies it by hand.
- `inspection did not find a video stream`. The file is unreadable or has no
  usable stream. The row stays selected until its file is replaced.

A row reports `result=skipped` with `media file changed during inspection` when
its original was replaced while the command inspected it. The command keeps the
replacement's stored info. The next run selects the row again only if that
stored info still points at an attached picture.

Rerunning the command is safe. A repaired row no longer matches, so a second
run reports `affected=0`.

Repairing the stored info does not retry the encodes that already failed.
Start a new encode for each repaired video afterwards, for example through the
media API with an editor or manager token:

```bash
curl -X POST -H "Authorization: Token <token>" -H "Content-Type: application/json" \
  -d '{"type": "encode"}' https://<host>/api/v1/media/<friendly_token>
```
