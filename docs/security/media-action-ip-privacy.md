# Media activity IP privacy and operations

`MASK_IPS_FOR_ACTIONS=True` protects `MediaAction.remote_ip` with HMAC-SHA256.
`MEDIA_ACTION_IP_HMAC_KEY` is independent of Django's `SECRET_KEY`. IPv6 addresses
are normalized before hashing. Stored masks are pseudonymous identifiers: rows
still contain the action, media, user or session, and time. An IP hash identifies
a network address, which may be shared by many visitors.

The model field masks literal ORM writes, including bulk writes, and normalizes
exact IP lookups. Literal `Value`, `Case`, and `Cast` expressions are supported.
Expressions that copy a database column or execute SQL are rejected when masking
is enabled. Direct SQL executed outside the ORM bypasses this application rule;
operators and maintenance scripts must use the owned cleanup command.

## Configure the key before deployment

Generate a separate random key with at least 32 bytes and store it as
`MEDIA_ACTION_IP_HMAC_KEY` in the deployment's secret configuration. For example,
generate 32 random bytes encoded as hexadecimal:

```bash
uv run python -c 'import secrets; print(secrets.token_hex(32))'
```

Keep the value out of source control, frontend variables, logs, and tickets.
Use the same key for every web process and Celery worker in an environment.
Use separate keys for development, staging, and production. Do not reuse
`SECRET_KEY`. Run the deployment's normal Django settings:

```bash
uv run python manage.py check
```

Checks `actions.E001`, `actions.E002`, and `actions.E003` reject a missing, short,
or reused key. Masking never falls back to `SECRET_KEY`. With masking disabled,
the key is not required and raw addresses can be stored, subject to the same
7-day IP retention policy.

## Roll out and sanitize existing records

1. Install the key in the web and worker environments before starting the new
   code. Pause old action writers during the cutover so they cannot store new
   raw IPs while cleanup runs.
2. Apply migrations, then inspect the count-only dry run:

   ```bash
   uv run python manage.py migrate
   uv run python manage.py cleanup_media_action_ips --dry-run
   ```

3. Run cleanup and repeat the dry run to verify no work remains:

   ```bash
   uv run python manage.py cleanup_media_action_ips --batch-size 1000
   uv run python manage.py cleanup_media_action_ips --dry-run
   ```

4. Restart all web processes, Celery workers, and Celery Beat with the new code
   and key. Verify that Beat publishes `cleanup_media_action_ips` and a worker
   consumes `short_tasks`.

Cleanup clears IP fields on actions at least 7 days old, masks recent legacy
raw addresses, and clears invalid legacy values. It never deletes action rows
or changes media counters, user/session links, or action timestamps. Output
contains counts only. Each batch commits separately; interrupted runs can be
repeated. The command scans a fixed upper primary key, so new traffic cannot
extend a cleanup run indefinitely. The field migration alone does not clean
historical rows.

Existing legacy hashes cannot be converted to HMAC without the original IP.
They remain unchanged until their action reaches the 7-day cutoff. During
the algorithm or dedicated-key cutover, the IP limiter may not match the previous
fingerprint for its 5-second window. Session cooldowns and stored counters remain
intact. Rotating Django's `SECRET_KEY` does not change new IP fingerprints.
Rotate the dedicated key through a coordinated web/worker restart; no previous
key fallback is maintained for IP correlation.

## Retention and monitoring

Celery Beat runs cleanup hourly. With a healthy scheduler and worker, an expired
IP field is cleared on the next successful run, normally within an hour of the
7-day cutoff plus execution time. This policy limits retained rows; a stable key
can still link repeat activity across the retained window. User and session
identifiers have their own lifecycle and are not anonymized by IP cleanup.

Use the existing scheduled-job metrics with
`scheduled_job="cleanup_media_action_ips"`:

- `cinematacms_scheduled_job_last_success_timestamp_seconds` should advance
  hourly. The registered absence window is 2 hours.
- `cinematacms_scheduled_job_runs_total` records success or failure.
- `cinematacms_scheduled_job_items_total` reports changed IP fields.

If the job is absent or failing, inspect Beat, the `short_tasks` worker, and the
database, then run the manual dry run and cleanup. Do not log IPs or fingerprints
to diagnose it. Size batches against the deployment's database load; each batch
locks only the selected action rows.

Apply the retention policy to database exports, backups, and infrastructure
access logs separately. This command does not modify those systems. Restored
backups must be sanitized before public traffic resumes. Run the deployment's
checks before rolling back code; never restore raw IPs as a rollback step.
