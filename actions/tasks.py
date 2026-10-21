from celery import shared_task

from .ip_cleanup import expire_action_ips


@shared_task(name="cleanup_media_action_ips", queue="short_tasks")
def cleanup_media_action_ips():
    expired = expire_action_ips()
    return {"outcome": "succeeded", "processed": expired, "changed": expired}
