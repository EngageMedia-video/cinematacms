# Video Sprite Backfill

The edit-media thumbnail selector uses each video's generated sprite sheet to show
selectable frames. Older videos, or videos whose sprite generation failed, can have an
empty `sprites` value and will keep showing the loading state until a sprite is generated.

Use the `backfill_video_sprites` management command to enqueue sprite generation for
existing videos:

```bash
python manage.py backfill_video_sprites --dry-run
python manage.py backfill_video_sprites --limit 100 --sleep 1
```

By default, the command targets videos that:

- have finished encoding (`encoding_status = "success"`),
- have an empty `sprites` value, and
- are at least 60 minutes old.

The encoding-status filter is the primary guard: sprite generation normally runs right after
encoding, so a video that has not finished encoding either has that step still pending or
failed encoding outright (no usable source). The age guard is an extra safety margin against
racing fresh uploads. The command also skips rows whose original `media_file` is missing,
because there is no source video to extract frames from.

Useful flags:

- `--dry-run`: report how many videos would be targeted without enqueueing jobs.
- `--limit N`: cap the total number of videos targeted in one run.
- `--batch-size N`: DB fetch/log cadence (does not change how many jobs run).
- `--sleep SECONDS`: pause between every job (Celery enqueue or inline run) to keep load on
  `long_tasks` and CPU smooth.
- `--user-id ID`: target one user's videos.
- `--inline`: generate sprites in the management command process for local or staging
  debugging.
- `--force`: regenerate sprites even when a sprite value already exists.
- `--repair-missing-files`: also target videos whose `sprites` database value is set but
  the sprite file is missing on disk.
- `--min-age-minutes N`: override the default age guard (`0` disables it).
- `--include-unencoded`: also target videos that have not finished encoding. Off by default;
  use only when you knowingly want to (re)generate sprites for non-`success` videos.

Sprite generation requires FFmpeg and ImageMagick. `FFMPEG_COMMAND` controls the FFmpeg
binary. `IMAGEMAGICK_COMMAND` can pin an ImageMagick binary; when unset, CinemataCMS
auto-detects `convert` first and then `magick`.

For production, run the command off-peak in small passes and watch `long_tasks` queue depth,
encoding latency, and temporary disk usage between passes. The command is resumable:
videos that already have sprite files are skipped unless `--force` or
`--repair-missing-files` applies.
