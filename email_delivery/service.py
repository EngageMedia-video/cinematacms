import hashlib
import hmac
from dataclasses import asdict, dataclass

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction

from .models import EmailDeliveryReceipt, EmailKind


@dataclass(frozen=True)
class EmailEnvelope:
    recipient: str
    subject: str
    text_body: str
    email_kind: str
    html_body: str = ""
    reply_to: tuple[str, ...] = ()
    preference: dict | None = None

    def validated(self):
        recipient = self.recipient.strip().lower()
        validate_email(recipient)
        if not self.subject.strip():
            raise ValidationError("Email subject is required")
        if "\n" in self.subject or "\r" in self.subject:
            raise ValidationError("Email subject contains an invalid header value")
        if not self.text_body and not self.html_body:
            raise ValidationError("Email body is required")
        if self.email_kind not in EmailKind.values:
            raise ValidationError("Unknown email kind")
        for address in self.reply_to:
            validate_email(address)
        return EmailEnvelope(
            recipient=recipient,
            subject=self.subject,
            text_body=self.text_body,
            html_body=self.html_body,
            reply_to=tuple(self.reply_to),
            email_kind=self.email_kind,
            preference=self.preference,
        )


def recipient_reference(address: str, *, key: str | None = None, version: str | None = None) -> str:
    version = version or str(getattr(settings, "EMAIL_RECIPIENT_HMAC_VERSION", "v1"))
    key = key or getattr(settings, "EMAIL_RECIPIENT_HMAC_KEY", "")
    if not key:
        raise ValidationError("EMAIL_RECIPIENT_HMAC_KEY is required")
    digest = hmac.new(key.encode(), address.strip().lower().encode(), hashlib.sha256).hexdigest()
    return f"{version}:{digest}"


def recipient_reference_candidates(address: str) -> tuple[str, ...]:
    candidates = [recipient_reference(address)]
    previous_key = getattr(settings, "EMAIL_RECIPIENT_HMAC_PREVIOUS_KEY", "")
    if previous_key:
        previous_version = str(getattr(settings, "EMAIL_RECIPIENT_HMAC_PREVIOUS_VERSION", "previous"))
        candidates.append(recipient_reference(address, key=previous_key, version=previous_version))
    return tuple(candidates)


def enqueue(envelope: EmailEnvelope) -> EmailDeliveryReceipt:
    from .tasks import deliver_email

    envelope = envelope.validated()
    receipt = EmailDeliveryReceipt.objects.create(
        recipient_ref=recipient_reference(envelope.recipient),
        email_kind=envelope.email_kind,
    )

    def publish():
        try:
            result = deliver_email.apply_async(args=[str(receipt.delivery_id), asdict(envelope)], queue="email_tasks")
            EmailDeliveryReceipt.objects.filter(pk=receipt.pk).update(celery_task_id=result.id)
        except Exception:
            EmailDeliveryReceipt.objects.filter(pk=receipt.pk).update(
                status="failed", reason_code="queue_publish_failed"
            )
            receipt.status = "failed"
            receipt.reason_code = "queue_publish_failed"
            from .telemetry import record_event

            record_event(receipt, receipt.status, receipt.reason_code)

    transaction.on_commit(publish)
    return receipt
