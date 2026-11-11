from celery import shared_task

from .ip_cleanup import expire_action_ips

# A minute under the short_tasks worker's 300-second soft limit; a slower last batch can still reach it.
TIME_BUDGET_SECONDS = 240


@shared_task(name="cleanup_media_action_ips", queue="short_tasks")
def cleanup_media_action_ips():
    expired = expire_action_ips(time_budget_seconds=TIME_BUDGET_SECONDS)
    return {"outcome": "succeeded", "processed": expired, "changed": expired}
