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

Each row prints one line with its id and token. A row whose file is missing, or
whose inspection finds no video stream, prints `result=failed` with the reason
on stderr and is left unchanged. The run ends with
`scanned=N affected=N repaired=N failed=N mode=repair`.

Rerunning the command is safe. A repaired row no longer matches, so a second
run reports `affected=0`. A failed row stays selected until its file is
restored.

Repairing the stored info does not retry the encodes that already failed.
Start a new encode for each repaired video afterwards, for example through the
media actions API with `{"type": "encode"}`:

```bash
curl -X POST -H "Authorization: Token <token>" -H "Content-Type: application/json" \
  -d '{"type": "encode"}' https://<host>/api/v1/media/<friendly_token>/actions
```
