# Repair missing HLS encryption keys

Use `repair_encryption_keys` when an encrypted media row has an empty
`encryption_key`. The command regenerates the HLS output and creates a new
AES-128 key. Existing encrypted HLS segments use the missing key and cannot be
recovered, so the command intentionally creates new HLS output instead of
changing the database value alone.

Run the default dry run first. It lists only media where `is_encrypted` is true
and `encryption_key` is empty.

```bash
uv run python manage.py repair_encryption_keys
```

After reviewing the tokens and count, run the repair explicitly:

```bash
uv run python manage.py repair_encryption_keys --repair
```

The command invokes HLS regeneration inline so each token can report its final
result. A successful line means both a valid key and a new HLS playlist were
saved. A failed item does not stop later items. Rerunning the command is safe:
media with a valid key and unencrypted media are ignored.

If HLS generation is interrupted before the playlist is published, the new key
is not saved. The media remains eligible for a later repair run.
