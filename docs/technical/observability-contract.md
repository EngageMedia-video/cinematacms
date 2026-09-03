# Application observability contract

This reference defines the telemetry that CinemataCMS emits. A deployment owns storage, collector endpoints, retention, thresholds, alert routing, and credentials.

## Email delivery

`email_delivery.service.enqueue()` validates an `EmailEnvelope`, creates an `EmailDeliveryReceipt`, and publishes `deliver_email` after the database transaction commits. One task handles one recipient on `email_tasks`.

A receipt stores the delivery UUID, a versioned keyed recipient reference, the email kind, the state, the attempt count, the Celery task ID, a bounded reason code, and timestamps. It does not store an address, a subject, a message body, or an outbox copy.

`smtp_accepted` means that the SMTP server accepted the message. It does not prove inbox delivery. A worker crash can leave acceptance ambiguous. `recover_stale_email_deliveries` changes stale `sending` receipts to `unknown` and does not resend them.

Set `EMAIL_RECIPIENT_HMAC_KEY` to an external secret. Set `EMAIL_RECIPIENT_HMAC_VERSION` when you rotate the key. Keep the previous key outside the application for no longer than the 30-day receipt window. Run a worker that consumes only `email_tasks`. The task has a 30-second SMTP timeout and a 60-second hard limit.

## Celery and domain outcomes

Celery execution states are `started`, `succeeded`, `failed`, `retried`, and `revoked`. Queue labels are `long_tasks`, `short_tasks`, `whisper_tasks`, `email_tasks`, or `default`. Unknown routing keys become `default`.

Domain outcomes are `succeeded`, `failed`, `skipped`, `retried`, and `cancelled`. A successful Celery execution does not imply a successful domain operation. Code records domain results with `files.metrics.record_domain_outcome()`.

## Traces and logs

The web process configures Django tracing during WSGI startup. A Celery child configures tracing from `worker_process_init`, after the fork. Set `OTEL_SERVICE_ROLE` to `web`, `long-task`, `short-task`, `transcription`, `email`, or `beat`. All roles use the `CinemataCMS` service namespace by default.

`OTEL_TRACES_SAMPLER_ARG` sets the ordinary trace ratio. `OTEL_PRIORITY_TRACES_SAMPLER_ARG` sets the ratio for Celery, media, transcription, HLS, and email spans. Parent sampling decisions propagate across queued work.

JSON logs add `trace_id`, `span_id`, `task_id`, `task_name`, and the normalized queue. Span filtering removes attributes whose names identify message bodies, addresses, authorization data, secrets, passwords, filenames, or URLs. Restricted email spans may contain only the delivery UUID, the recipient reference, the email kind, and the attempt number.

## Scheduled jobs

`cms.scheduled_jobs.SCHEDULED_JOBS` defines each job name, cadence, owner, and absence window. Scheduled-job metrics keep last-started and last-success timestamps separate. A skip does not update last success.

## Alert validation

`config/observability/alertability.json` maps each portable condition to its signal, semantic owner, bounded dimensions, data states, recovery condition, and initial guidance. `config/observability/fixtures.json` records healthy, degraded, unknown, and recovered inputs for representative condition families.

Validate the contract with:

```bash
uv run python scripts/validate_observability_contract.py
uv run python scripts/validate_observability_coverage.py
uv run python manage.py test cms.tests.test_alertability_contract cms.tests.test_observability cms.tests.test_scheduled_jobs email_delivery
```

When a feature adds or changes an operation, update
`config/observability/coverage.json` in the same pull request. Follow
[Make new behavior observable](../../CODING_STANDARDS.md#make-new-behavior-observable)
for the required inventory, privacy, test, and operator-query fields.
