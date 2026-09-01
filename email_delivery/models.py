import uuid

from django.db import models


class DeliveryStatus(models.TextChoices):
    QUEUED = "queued", "Queued"
    SENDING = "sending", "Sending"
    RETRYING = "retrying", "Retrying"
    SMTP_ACCEPTED = "smtp_accepted", "SMTP accepted"
    FAILED = "failed", "Failed"
    SKIPPED = "skipped", "Skipped"
    UNKNOWN = "unknown", "Unknown"


class EmailKind(models.TextChoices):
    ACTIVITY_NOTIFICATION = "activity_notification", "Activity notification"
    MEDIA_LIFECYCLE = "media_lifecycle", "Media lifecycle"
    ROLE_CHANGE = "role_change", "Role change"
    ACCOUNT = "account", "Account"
    AUTHENTICATION = "authentication", "Authentication"
    CONTACT_FORM = "contact_form", "Contact form"
    ADMINISTRATIVE = "administrative", "Administrative"


class EmailDeliveryReceipt(models.Model):
    delivery_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    recipient_ref = models.CharField(max_length=80, db_index=True)
    email_kind = models.CharField(max_length=32, choices=EmailKind)
    status = models.CharField(max_length=16, choices=DeliveryStatus, default=DeliveryStatus.QUEUED)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    celery_task_id = models.CharField(max_length=255, blank=True)
    reason_code = models.CharField(max_length=32, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["status", "updated_at"], name="email_state_updated_idx")]
        constraints = [
            models.CheckConstraint(
                condition=models.Q(status__in=DeliveryStatus.values), name="email_receipt_valid_status"
            ),
            models.CheckConstraint(
                condition=models.Q(email_kind__in=EmailKind.values), name="email_receipt_valid_kind"
            ),
            models.CheckConstraint(condition=models.Q(attempt_count__lte=4), name="email_receipt_attempt_limit"),
        ]
