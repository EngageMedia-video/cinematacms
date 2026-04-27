import logging
from smtplib import SMTPException

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMessage, get_connection

logger = logging.getLogger(__name__)


@shared_task(
    name="send_notification_email",
    queue="short_tasks",
    autoretry_for=(SMTPException, ConnectionError, OSError),
    retry_kwargs={"max_retries": 3, "countdown": 60},
)
def send_notification_email(notification_id):
    from .models import Notification

    try:
        notification = Notification.objects.select_related("recipient", "actor").get(id=notification_id)
    except Notification.DoesNotExist:
        logger.warning("Notification %s not found for email delivery", notification_id)
        return

    site_url = getattr(settings, "SSL_FRONTEND_HOST", "")
    portal_name = getattr(settings, "PORTAL_NAME", "CinemataCMS")

    # Re-check deliverability at send time (preferences may have changed since enqueue)
    recipient = notification.recipient
    if not recipient.email:
        logger.info("Skipping notification email %s: recipient has no email", notification_id)
        return

    from .models import NotificationChannel
    from .services import NotificationService

    channel = NotificationService._get_channel(recipient, notification.notification_type)
    if channel != NotificationChannel.EMAIL:
        logger.info("Skipping notification email %s: preference changed to %s", notification_id, channel)
        return

    action_link = f"{site_url}{notification.action_url}" if notification.action_url else ""
    prefs_link = f"{site_url}/notifications/#preferences"

    body = f"Hi {recipient.username},\n\n{notification.message}."
    if action_link:
        body += f"\n\nView it here: {action_link}"
    body += f"\n\n---\nUpdate your notification preferences: {prefs_link}\n"

    try:
        real_backend = getattr(settings, "CELERY_EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
        connection = get_connection(backend=real_backend)
        email = EmailMessage(
            subject=f"[{portal_name}] {notification.message}",
            body=body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[recipient.email],
            connection=connection,
        )
        email.send(fail_silently=False)
    except Exception:
        logger.exception("Failed to send notification email %s", notification_id)
        raise


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
