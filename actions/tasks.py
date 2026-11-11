from celery import shared_task

from .ip_cleanup import expire_action_ips

# The short_tasks worker's soft limit is 300 seconds; the spare minute covers the last batch.
TIME_BUDGET_SECONDS = 240


@shared_task(name="cleanup_media_action_ips", queue="short_tasks")
def cleanup_media_action_ips():
    expired = expire_action_ips(time_budget_seconds=TIME_BUDGET_SECONDS)
    return {"outcome": "succeeded", "processed": expired, "changed": expired}
