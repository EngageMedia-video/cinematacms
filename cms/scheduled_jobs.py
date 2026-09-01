from dataclasses import dataclass

from prometheus_client import Counter, Gauge

from files.metrics import record_domain_outcome


@dataclass(frozen=True)
class ScheduledJob:
    name: str
    cadence_seconds: int
    owner: str
    absence_seconds: int


SCHEDULED_JOBS = {
    job.name: job
    for job in (
        ScheduledJob("record_beat_freshness", 60, "cms", 180),
        ScheduledJob("recover_stale_email_deliveries", 60, "email_delivery", 180),
        ScheduledJob("cleanup_email_delivery_receipts", 86400, "email_delivery", 129600),
        ScheduledJob("clear_sessions", 604800, "cms", 691200),
        ScheduledJob("update_listings_thumbnails", 1800, "files", 5400),
        ScheduledJob("cleanup_orphaned_uploads", 86400, "uploader", 129600),
        ScheduledJob("cleanup_orphaned_draft_media", 86400, "files", 129600),
        ScheduledJob("dispatch_deferred_encodings", 60, "files", 180),
        ScheduledJob("apply_visibility_schedules", 60, "files", 180),
    )
}

SCHEDULED_JOB_RUNS_TOTAL = Counter(
    "cinemata_scheduled_job_runs_total",
    "Scheduled job domain outcomes",
    ["job", "outcome", "reason_code"],
)
SCHEDULED_JOB_LAST_STARTED = Gauge(
    "cinemata_scheduled_job_last_started_timestamp_seconds",
    "Last scheduled job start time",
    ["job"],
    multiprocess_mode="mostrecent",
)
SCHEDULED_JOB_LAST_SUCCESS = Gauge(
    "cinemata_scheduled_job_last_success_timestamp_seconds",
    "Last successful scheduled job completion time",
    ["job"],
    multiprocess_mode="mostrecent",
)
SCHEDULED_JOB_ITEMS_TOTAL = Counter(
    "cinemata_scheduled_job_items_total",
    "Items handled by scheduled jobs",
    ["job", "result"],
)


def record_scheduled_start(job: str, timestamp: float) -> None:
    if job not in SCHEDULED_JOBS:
        return
    SCHEDULED_JOB_LAST_STARTED.labels(job=job).set(timestamp)


def record_scheduled_outcome(
    job: str,
    outcome: str,
    reason_code: str = "none",
    *,
    processed: int = 0,
    changed: int = 0,
    failed: int = 0,
    timestamp: float,
) -> None:
    if job not in SCHEDULED_JOBS:
        return
    SCHEDULED_JOB_RUNS_TOTAL.labels(job=job, outcome=outcome, reason_code=reason_code).inc()
    record_domain_outcome(f"scheduled.{job}", outcome, reason_code)
    for result, count in (("processed", processed), ("changed", changed), ("failed", failed)):
        if count:
            SCHEDULED_JOB_ITEMS_TOTAL.labels(job=job, result=result).inc(count)
    if outcome == "succeeded":
        SCHEDULED_JOB_LAST_SUCCESS.labels(job=job).set(timestamp)
