from celery import shared_task

from .ip_cleanup import cleanup_action_ips


@shared_task(name="cleanup_media_action_ips", queue="short_tasks")
def cleanup_media_action_ips():
    counts = cleanup_action_ips()
    changed = sum(counts.values())
    return {"outcome": "succeeded", "processed": changed, "changed": changed}
