# Application observability contract

This reference defines the telemetry that CinemataCMS emits. A deployment owns storage, collector endpoints, retention, thresholds, alert routing, and credentials.

## Email delivery

`email_delivery.service.enqueue()` validates an `EmailEnvelope`, creates an `EmailDeliveryReceipt`, and publishes `deliver_email` after the database transaction commits. One task handles one recipient on `email_tasks`.

A receipt stores the delivery UUID, a versioned keyed recipient reference, the email kind, the state, the attempt count, the Celery task ID, a bounded reason code, and timestamps. It does not store an address, a subject, a message body, or an outbox copy.

`smtp_accepted` means that the SMTP server accepted the message. It does not prove inbox delivery. A worker crash can leave acceptance ambiguous. `recover_stale_email_deliveries` changes stale `sending` receipts to `unknown` and does not resend them.

Set `EMAIL_RECIPIENT_HMAC_KEY` to an external secret. Set `EMAIL_RECIPIENT_HMAC_VERSION` when you rotate the key. Keep the previous key outside the application for no longer than the 30-day receipt window. Run a worker that consumes only `email_tasks`. The task has a 30-second SMTP timeout and a 60-second hard limit.

## Celery and domain outcomes

Celery execution states are `started`, `succeeded`, `failed`, `retried`, and `revoked`. Queue labels are `long_tasks`, `short_tasks`, `whisper_tasks`, and `email_tasks`. A task from any other queue is counted as a contract violation and labelled `default`.

Domain outcomes are `succeeded`, `failed`, `skipped`, `retried`, and `cancelled`. A successful Celery execution does not imply a successful domain operation. Code records domain results with `files.metrics.record_domain_outcome()`.

## Traces and logs

The web process configures Django tracing during WSGI startup. A Celery child configures tracing from `worker_process_init`, after the fork. Set `OTEL_SERVICE_ROLE` to `web`, `long-task`, `short-task`, `transcription`, `email`, or `beat`. All roles use the `CinemataCMS` service namespace by default.

`OTEL_TRACES_SAMPLER_ARG` sets the ordinary trace ratio. `OTEL_PRIORITY_TRACES_SAMPLER_ARG` sets the ratio for Celery, media, transcription, HLS, and email spans. Parent sampling decisions propagate across queued work.

The deployment mode controls who owns the Collector. `local` installs the
repository's Collector, `managed` sends traces to a Collector managed by the
deployment, and `none` disables application tracing.

JSON logs add `trace_id`, `span_id`, `actor_ref`, `task_id`, `task_name`, and the
normalized queue. For an authenticated request, `actor_ref` is the same
versioned keyed reference used for an email recipient; the current request span
also carries `cinematacms.actor_ref`. This permits restricted incident lookup
without exporting an email address. A deployment may expose the token-protected
`POST /internal/observability/references` endpoint to its restricted monitoring
system. It resolves an actor email or public media token into the versioned,
keyed references used by telemetry without returning the input. Search logs by
`actor_ref` for general user activity or by `recipient_ref` for an email
delivery, then use the matching `trace_id` to follow downstream work. Span
filtering removes attributes whose names identify message bodies, addresses,
authorization data, secrets, passwords, filenames, or URLs. Restricted email
spans may contain only the delivery UUID, the recipient reference, the email
kind, and the attempt number.

The Collector reads each rotated application log together with its `.1` copy.
After a Collector outage that spans one rotation, it recovers the unread lines
from the `.1` copy. After an outage that spans two or more rotations, the lines
that moved into `.gz` backups are not backfilled; they stay in those backups for
14 rotations. Ingesting the `.gz` backups was rejected because switching to them
re-ingested every retained backup. Collector 0.159.0 was the version tested.

A 4xx response on the `upload_transfer` route group logs
`cinematacms.http.request.denied` with `route_group`, `operation`, `method`,
`status_code`, a bounded `reason_code`, `trace_id`, and `actor_ref` when the
session is authenticated. `reason_code` is `missing_credentials` or `forbidden`
for 401 and 403, `bad_request` for 400, `payload_too_large` for 413,
`rate_limited` for 429, and `other` otherwise. The event never carries the
path, query string, address, cookie, or email. nginx answers some upload errors
(408, 413, 499) before Django runs; those appear only in the nginx access log.

### Upload correlation: `upload_ref`

`upload_ref` joins an nginx upload line to the application events of the same
upload, and through them to `actor_ref` and `trace_id`. It is Fine Uploader's
per-file `qquuid`, a random version-4 UUID that the browser already sends in the
chunk body. The upload pages also send it as the `X-Upload-Id` header on every
chunk and on the chunks-done request, because nginx does not parse the body and
can log a header. It carries no personal data and grants no access; it only
attributes log lines. `config/observability/coverage.json` (`log_correlation`)
holds the one definition: header, pattern, maximum length (36), and the events
that carry it. `scripts/validate_observability_coverage.py` checks it, and it is
never a metric label.

- nginx (`deploy/nginx/cinematacms-http.conf`): the `cinematacms` `log_format`
  ends with `uid=$cinematacms_upload_id`. A `map` logs the header only when it
  matches the version-4 UUID pattern (lowercase, 36 characters) and logs `-`
  otherwise. A site must use this format to carry `upload_ref`. The
  `compression` format has no `uid`; its lines still parse but carry no
  `upload_ref`.
- Collector: the regex reads `uid=` into `upload_ref` only when the value is a
  well-formed id that ends the line. `-`, oversize, or any other value leaves
  the attribute unset. The attribute is kept on nginx and application lines.
- Django: `cms.http_telemetry.upload_reference` applies the same pattern to
  `X-Upload-Id` and returns an empty string for anything else. On the
  `upload_transfer` route group, `cinematacms.http.request.denied`, `.failed`,
  and `.slow` carry `upload_ref`, and `uploader.views` logs
  `cinematacms.upload.started` (first chunk, part 0) and
  `cinematacms.upload.finished` (media created), both with `upload_ref` and
  `actor_ref`. A client can send any well-formed id, so treat `upload_ref` as an
  attribution key and not as proof of ownership.
- CORS: `x-upload-id` is in `CORS_ALLOW_HEADERS`. It matters only when
  `UPLOAD_HOST` is a different origin from the site: without it the browser
  refuses the chunk after the preflight.
- Grafana, Incident Search: resolve the user, copy an `upload_ref` from "Upload
  sessions of the resolved user", paste it into "Upload ref". "One upload" shows
  the application and nginx lines for that id. "nginx upload lines ... of the
  resolved user's uploads" goes straight from the actor to the nginx lines.

The Collector reads every `*access.log` and `*error.log` file in
`/var/log/cinematacms/nginx/`, where the stock site writes `/fu/` chunk requests,
and in `/var/log/nginx/`, which holds the distribution's logs and any vhost an
operator adds. A site must use the `cinematacms` `log_format` to carry `upload_ref`
(`compression` also carries `rt=`, `urt=`, and `rl=` but no `uid=`). An nginx access line keeps
only `method`, `status_code`, `bytes_sent`, `request_time`, `upstream_time`,
`request_length`, `upload_ref`, `http.route`, and `route_group` (`nginx_upload` for
`/fu/` and `/upload/`). `http.route` is one of a fixed set of templates, never the
request path: `/api/:resource`, `/media/:resource`, `/static/:resource`,
`/fu/:resource`, `/upload/:resource`, `/metrics`, `/nginx_status`, and `/:other`
for every other path, including the configurable admin URL and scanner probes. The
path, query string, address, referrer, and user agent are dropped. A line the parser
cannot read, such as a request of `"-"` on a 400, keeps its `status_code`, `bytes_sent`,
and timings as fields and exports only `<unparsed-nginx-access>` as its body.
`upstream_time` is `-` when the request never reached Django, as for a 408.
Reading `/var/log/nginx/` needs the `adm` group, which the installer grants to
`otelcol-contrib`. The site log directory is `root:www-data`, `0750`; the
installer adds an ACL entry for the Collector only, so the `acl` package must
be present. The entry is read access (`setfacl -R -m u:otelcol-contrib:rX`) on
the directory and the logs in it, plus a default entry (`setfacl -d`) so logs
created later are readable too.

An nginx error line keeps its message and `server`. Its `client` becomes
`<redacted-ip>` for IPv4 and IPv6. Everything from the first `request`,
`subrequest`, `upstream`, `host`, or `referrer` field to the end of the line
becomes `request: "<redacted-request>"`. nginx writes these fields without
escaping them, so client text can imitate any of them, and no field shape tells
a real one from a fake one.

## Error tracking

CinemataCMS uses the Sentry protocol for exception events. The application
does not select or deploy an event store. A deployment owns the DSN, projects,
retention, storage, backups, alerts, and access controls.

Error tracking is off when `SENTRY_DSN` is empty. `SENTRY_ENVIRONMENT` separates
deployment environments, and `SENTRY_RELEASE` identifies the deployed build.
`SENTRY_SAMPLE_RATE` controls error-event sampling. The integration does not
send logs, traces, profiles, sessions, or default personal data.

The sanitizer removes request and transaction data, headers, cookies, query
strings, user data, breadcrumbs, performance spans, custom fingerprints, frame
variables, attachments, module inventories, SQL statements, email addresses,
and raw IP addresses. It keeps the exception type, a sanitized exception
message, stack locations, the release, the environment, the service role, and
trace identifiers. Native exception grouping remains enabled.

Django and Celery report exceptions that escape their execution boundaries.
Code that catches an unexpected `Exception` and returns a degraded result must
call `cms.error_tracking.capture_unexpected_exception()`. Expected validation,
permission, retry, media-processing, SMTP, rate-limit, and dependency outcomes
remain in the existing metrics and logs.

The permanent diagnostic endpoint is
`POST /internal/observability/error-probe`. It returns `404` unless
`ERROR_TRACKING_DIAGNOSTICS_ENABLED` is true and `SENTRY_ENVIRONMENT` is
`staging`. Nginx restricts the endpoint to loopback clients. Django also checks
the client address, the method, `ERROR_TRACKING_DIAGNOSTICS_TOKEN`, and a
fail-closed rate limit of at most 50 requests per hour. The endpoint ignores
the request body and raises a fixed exception.

Run `python manage.py verify_error_tracking` on a staging host to check both
the web process and the `long_tasks` Celery queue. The command posts through
the loopback Nginx route and dispatches the existing `sum_two_numbers_two`
diagnostic task. `--repeat` accepts values from 1 through 50. Keep diagnostics
disabled after the check. A deployment should retain error events for 30 days.

## Scheduled jobs

`cms.scheduled_jobs.SCHEDULED_JOBS` defines each job name, cadence, owner, and absence window. Scheduled-job metrics keep last-started and last-success timestamps separate. A skip does not update last success.

`cleanup_media_action_ips` uses this contract for hourly 7-day IP retention.
The [operator guide](../security/media-action-ip-privacy.md#retention-and-monitoring)
defines its cleanup checks and absence handling.

## Alert validation

`config/observability/alertability.json` maps each portable condition to its signal, semantic owner, bounded dimensions, data states, recovery condition, and initial guidance. `config/observability/fixtures.json` records healthy, degraded, unknown, and recovered inputs for representative condition families.

Validate the contract with:

```bash
uv run python scripts/validate_observability_contract.py
uv run python scripts/validate_observability_coverage.py
make test TEST_ARGS="cms.tests.test_alertability_contract cms.tests.test_observability cms.tests.test_scheduled_jobs email_delivery"
```

Before implementation, map each feature to this contract and
`config/observability/coverage.json`. If the contract does not cover the
feature's operation, outcomes, dependencies, or operator workflow, extend the
coverage matrix and contract tests first. Follow
[Make new behavior observable](../../CODING_STANDARDS.md#make-new-behavior-observable)
for the required inventory, privacy, test, and operator-query fields.
