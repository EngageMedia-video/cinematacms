import logging

from celery import shared_task
from django.conf import settings

from email_delivery.models import EmailKind
from email_delivery.service import EmailEnvelope, enqueue

logger = logging.getLogger(__name__)


def send_notification_email(notification_id):
    from .models import Notification

    try:
        notification = Notification.objects.select_related("recipient", "actor").get(id=notification_id)
    except Notification.DoesNotExist:
        logger.warning("Notification %s not found for email delivery", notification_id)
        return

    site_url = getattr(settings, "SSL_FRONTEND_HOST", "")
    portal_name = getattr(settings, "PORTAL_NAME", "CinemataCMS")

    recipient = notification.recipient
    if not recipient.email:
        return

    action_link = f"{site_url}{notification.action_url}" if notification.action_url else ""
    prefs_link = f"{site_url}/notifications/#preferences"

    body = f"Hi {recipient.username},\n\n{notification.message}."
    if action_link:
        body += f"\n\nView it here: {action_link}"
    body += f"\n\n---\nUpdate your notification preferences: {prefs_link}\n"

    return enqueue(
        EmailEnvelope(
            recipient=recipient.email,
            subject=f"[{portal_name}] {notification.message}",
            text_body=body,
            email_kind=EmailKind.ACTIVITY_NOTIFICATION,
            preference={"kind": "notification", "id": notification.id},
        )
    )


send_notification_email.delay = send_notification_email


@shared_task(name="notify_followers_new_media", queue="short_tasks")
def notify_followers_new_media(actor_id, media_id):
    from django.contrib.auth import get_user_model

    from files.models import Media

    from .services import NotificationService

    User = get_user_model()
    try:
        actor = User.objects.get(id=actor_id)
        media = Media.objects.get(id=media_id)
    except (User.DoesNotExist, Media.DoesNotExist):
        logger.warning("notify_followers_new_media: actor=%s or media=%s not found", actor_id, media_id)
        return

    NotificationService.on_new_media(actor=actor, media=media)
