from django.core.exceptions import ValidationError
from django.core.mail.backends.base import BaseEmailBackend

from .models import EmailKind
from .service import EmailEnvelope, enqueue


def _email_kind(message):
    explicit = next(
        (value for key, value in (message.extra_headers or {}).items() if key.lower() == "x-cinemata-email-kind"),
        None,
    )
    if explicit:
        return explicit
    subject = message.subject.lower()
    if any(word in subject for word in ("password", "sign in", "verification", "confirm", "security")):
        return EmailKind.AUTHENTICATION
    return EmailKind.ACCOUNT


class EmailBackend(BaseEmailBackend):
    """Django email backend that publishes one delivery receipt per recipient."""

    def send_messages(self, email_messages):
        email_messages = list(email_messages or ())
        for message in email_messages:
            unsupported = []
            if message.cc:
                unsupported.append("cc")
            if message.bcc:
                unsupported.append("bcc")
            if message.attachments:
                unsupported.append("attachments")
            if unsupported:
                raise ValidationError(f"Queued email does not support: {', '.join(unsupported)}")

        queued = 0
        for message in email_messages:
            kind = _email_kind(message)
            html_body = next(
                (body for body, mimetype in getattr(message, "alternatives", ()) if mimetype == "text/html"),
                "",
            )
            for recipient in message.to:
                enqueue(
                    EmailEnvelope(
                        recipient=recipient,
                        subject=message.subject,
                        text_body=message.body,
                        html_body=html_body,
                        reply_to=tuple(message.reply_to),
                        email_kind=kind,
                        from_email=message.from_email,
                    )
                )
                queued += 1
        return queued
