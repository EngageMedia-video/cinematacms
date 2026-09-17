# Remove orphaned encoding chunks

Use `cleanup_orphaned_encoding_chunks` to remove old segment files left by a
previous chunked encoding failure or media deletion. The command scans only
the configured `MEDIA_UPLOAD_DIR` tree under `MEDIA_ROOT`. It skips any path
referenced by `Media.media_file`. It also preserves a segment while a chunk
`Encoding` with `pending` or `running` status references its
`chunk_file_path`. Terminal `success` and `fail` rows do not preserve segments.

Run a dry run first. The command does not delete files unless you pass
`--delete`.

```bash
uv run python manage.py cleanup_orphaned_encoding_chunks --min-age-hours=24
```

Review the candidate count. Then run the same command with `--delete`.

```bash
uv run python manage.py cleanup_orphaned_encoding_chunks --min-age-hours=24 --delete
```

The command considers only `.mkv` segment names that match the current
nine-character encoding token format. It ignores files newer than the age
cutoff, files outside the original upload tree, and symlinks.

Both automatic cleanup and this command record the bounded
`storage_maintenance` domain outcome. A dry run or a run with no eligible
files is `skipped`; successful deletion is `succeeded`; filesystem removal
errors are `failed` with `cleanup_failed`. Telemetry failure never changes the
cleanup result.
