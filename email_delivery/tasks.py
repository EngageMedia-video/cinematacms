import random
import smtplib
import socket
from datetime import timedelta

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMultiAlternatives, get_connection
from django.utils import timezone

from .models import DeliveryStatus, EmailDeliveryReceipt
from .telemetry import delivery_span, record_event, record_terminal_metrics

TRANSIENT_ERRORS = (ConnectionError, TimeoutError, socket.timeout, smtplib.SMTPServerDisconnected)


def _reason(exc: Exception) -> tuple[bool, str]:
    if isinstance(exc, smtplib.SMTPAuthenticationError):
        return False, "authentication_error"
    if isinstance(exc, smtplib.SMTPResponseException):
        if 400 <= exc.smtp_code < 500:
            return True, "smtp_4xx"
        return False, "smtp_5xx"
    if isinstance(exc, TRANSIENT_ERRORS):
        return True, "transport_error"
    return False, "configuration_error"


def _preference_allows(spec: dict | None) -> bool:
    if not spec:
        return True
    if spec.get("kind") == "notification":
        from notifications.models import Notification, NotificationChannel
        from notifications.services import NotificationService

        notification = Notification.objects.select_related("recipient").filter(pk=spec.get("id")).first()
        return bool(
            notification
            and NotificationService._get_channel(notification.recipient, notification.notification_type)
            == NotificationChannel.EMAIL
        )
    return True


@shared_task(bind=True, name="deliver_email", queue="email_tasks", soft_time_limit=30, time_limit=60, acks_late=True)
def deliver_email(self, delivery_id: str, envelope: dict):
    receipt = EmailDeliveryReceipt.objects.get(delivery_id=delivery_id)
    if not _preference_allows(envelope.get("preference")):
        receipt.status = DeliveryStatus.SKIPPED
        receipt.reason_code = "preference_changed"
        receipt.save(update_fields=["status", "reason_code", "updated_at"])
        record_terminal_metrics(receipt)
        record_event(receipt, receipt.status, receipt.reason_code)
        return receipt.status

    receipt.status = DeliveryStatus.SENDING
    receipt.attempt_count += 1
    receipt.celery_task_id = self.request.id or receipt.celery_task_id
    receipt.reason_code = ""
    receipt.save(update_fields=["status", "attempt_count", "celery_task_id", "reason_code", "updated_at"])
    with delivery_span(receipt):
        try:
            connection = get_connection(
                backend=getattr(settings, "EMAIL_TRANSPORT_BACKEND", "django.core.mail.backends.smtp.EmailBackend"),
                timeout=30,
            )
            message = EmailMultiAlternatives(
                envelope["subject"],
                envelope["text_body"],
                envelope.get("from_email") or settings.DEFAULT_FROM_EMAIL,
                [envelope["recipient"]],
                reply_to=envelope.get("reply_to") or None,
                connection=connection,
            )
            if envelope.get("html_body"):
                message.attach_alternative(envelope["html_body"], "text/html")
            if message.send(fail_silently=False) != 1:
                raise smtplib.SMTPException("message not accepted")
        except Exception as exc:
            retryable, reason = _reason(exc)
            if retryable and self.request.retries < 3:
                receipt.status = DeliveryStatus.RETRYING
                receipt.reason_code = reason
                receipt.save(update_fields=["status", "reason_code", "updated_at"])
                record_event(receipt, receipt.status, reason)
                delay = min(240, 30 * (2**self.request.retries)) + random.randint(0, 10)
                raise self.retry(exc=exc, countdown=delay, max_retries=3)
            receipt.status = DeliveryStatus.FAILED
            receipt.reason_code = reason
            receipt.save(update_fields=["status", "reason_code", "updated_at"])
            record_terminal_metrics(receipt)
            record_event(receipt, receipt.status, reason)
            return receipt.status

    receipt.status = DeliveryStatus.SMTP_ACCEPTED
    receipt.save(update_fields=["status", "updated_at"])
    record_terminal_metrics(receipt)
    record_event(receipt, receipt.status)
    return receipt.status


@shared_task(name="recover_stale_email_deliveries", queue="email_tasks")
def recover_stale_email_deliveries():
    cutoff = timezone.now() - timedelta(minutes=2)
    stale = list(EmailDeliveryReceipt.objects.filter(status=DeliveryStatus.SENDING, updated_at__lt=cutoff)[:1000])
    for receipt in stale:
        receipt.status = DeliveryStatus.UNKNOWN
        receipt.reason_code = "worker_lost"
        receipt.save(update_fields=["status", "reason_code", "updated_at"])
        record_terminal_metrics(receipt)
        record_event(receipt, receipt.status, receipt.reason_code)
    return len(stale)


@shared_task(name="cleanup_email_delivery_receipts", queue="email_tasks")
def cleanup_email_delivery_receipts(batch_size=1000):
    cutoff = timezone.now() - timedelta(days=30)
    ids = list(EmailDeliveryReceipt.objects.filter(created_at__lt=cutoff).values_list("pk", flat=True)[:batch_size])
    if ids:
        EmailDeliveryReceipt.objects.filter(pk__in=ids).delete()
    return len(ids)
