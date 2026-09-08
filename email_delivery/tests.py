import logging
import smtplib
from datetime import timedelta
from unittest.mock import Mock, patch

from django.core import mail
from django.core.exceptions import ValidationError
from django.core.mail import EmailMultiAlternatives
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from django.utils import timezone

from .backend import EmailBackend
from .models import DeliveryStatus, EmailDeliveryReceipt, EmailKind
from .service import EmailEnvelope, enqueue, recipient_reference, recipient_reference_candidates
from .tasks import _reason, cleanup_email_delivery_receipts, deliver_email, recover_stale_email_deliveries


@override_settings(EMAIL_RECIPIENT_HMAC_KEY="test-key", EMAIL_RECIPIENT_HMAC_VERSION="v7")
class EnqueueTests(TestCase):
    def envelope(self, **values):
        defaults = {
            "recipient": "Person@Example.com",
            "subject": "Account notice",
            "text_body": "Body",
            "email_kind": EmailKind.ACCOUNT,
        }
        defaults.update(values)
        return EmailEnvelope(**defaults)

    def test_enqueue_persists_only_receipt_metadata_and_publishes_after_commit(self):
        with patch("email_delivery.tasks.deliver_email.apply_async") as publish:
            publish.return_value.id = "task-1"
            with self.captureOnCommitCallbacks(execute=False) as callbacks:
                receipt = enqueue(self.envelope())

            publish.assert_not_called()
            self.assertEqual(len(callbacks), 1)
            callbacks[0]()

        receipt.refresh_from_db()
        self.assertEqual(receipt.status, DeliveryStatus.QUEUED)
        self.assertEqual(receipt.celery_task_id, "task-1")
        self.assertEqual(receipt.recipient_ref, recipient_reference("person@example.com"))
        persisted = str(receipt.__dict__)
        self.assertNotIn("Person@Example.com", persisted)
        self.assertNotIn("Account notice", persisted)
        self.assertNotIn("Body", persisted)

    def test_publish_failure_becomes_a_bounded_terminal_receipt(self):
        with patch("email_delivery.tasks.deliver_email.apply_async", side_effect=ConnectionError("broker address")):
            with self.captureOnCommitCallbacks(execute=True):
                receipt = enqueue(self.envelope())
        receipt.refresh_from_db()
        self.assertEqual(receipt.status, DeliveryStatus.FAILED)
        self.assertEqual(receipt.reason_code, "queue_publish_failed")

    def test_invalid_envelope_creates_no_receipt(self):
        for values in (
            {"recipient": "invalid"},
            {"subject": ""},
            {"subject": "bad\nheader"},
            {"text_body": "", "html_body": ""},
            {"email_kind": "custom"},
        ):
            with self.subTest(values=values), self.assertRaises(ValidationError):
                enqueue(self.envelope(**values))
        self.assertFalse(EmailDeliveryReceipt.objects.exists())

    def test_recipient_reference_is_normalized_versioned_and_keyed(self):
        self.assertEqual(recipient_reference(" A@Example.com "), recipient_reference("a@example.com"))
        self.assertTrue(recipient_reference("a@example.com").startswith("v7:"))
        self.assertNotIn("a@example.com", recipient_reference("a@example.com"))

    @override_settings(EMAIL_RECIPIENT_HMAC_PREVIOUS_KEY="old-key", EMAIL_RECIPIENT_HMAC_PREVIOUS_VERSION="v6")
    def test_lookup_candidates_cover_current_and_previous_key_versions(self):
        candidates = recipient_reference_candidates("a@example.com")
        self.assertEqual(len(candidates), 2)
        self.assertTrue(candidates[0].startswith("v7:"))
        self.assertTrue(candidates[1].startswith("v6:"))

    def test_database_rejects_an_unknown_receipt_state(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            EmailDeliveryReceipt.objects.create(
                recipient_ref="v7:opaque",
                email_kind=EmailKind.ACCOUNT,
                status="not-a-state",
            )

    @override_settings(EMAIL_BACKEND="email_delivery.backend.EmailBackend")
    def test_django_backend_creates_one_receipt_per_recipient(self):
        message = EmailMultiAlternatives(
            "Notice",
            "Text",
            "sender@example.test",
            ["one@example.test", "two@example.test"],
            reply_to=["reply@example.test"],
            headers={"X-Cinemata-Email-Kind": EmailKind.CONTACT_FORM},
        )
        message.attach_alternative("<p>HTML</p>", "text/html")
        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            self.assertEqual(message.send(), 2)
        self.assertEqual(len(callbacks), 2)
        self.assertEqual(EmailDeliveryReceipt.objects.count(), 2)
        self.assertEqual(
            set(EmailDeliveryReceipt.objects.values_list("email_kind", flat=True)),
            {EmailKind.CONTACT_FORM},
        )

    @override_settings(EMAIL_BACKEND="email_delivery.backend.EmailBackend")
    def test_django_backend_preserves_custom_sender(self):
        message = EmailMultiAlternatives("Notice", "Text", "custom@example.test", ["one@example.test"])
        with patch("email_delivery.backend.enqueue") as publish:
            self.assertEqual(message.send(), 1)
        self.assertEqual(publish.call_args.args[0].from_email, "custom@example.test")

    @override_settings(EMAIL_BACKEND="email_delivery.backend.EmailBackend")
    def test_django_backend_rejects_unsupported_fields_before_enqueueing(self):
        supported = EmailMultiAlternatives("First", "Text", None, ["one@example.test"])
        unsupported = EmailMultiAlternatives(
            "Second",
            "Text",
            None,
            ["two@example.test"],
            cc=["copy@example.test"],
            bcc=["hidden@example.test"],
        )
        unsupported.attach("report.txt", "contents", "text/plain")
        with patch("email_delivery.backend.enqueue") as publish, self.assertRaises(ValidationError):
            EmailBackend().send_messages([supported, unsupported])
        publish.assert_not_called()

    @override_settings(EMAIL_BACKEND="email_delivery.backend.EmailBackend")
    def test_django_account_mail_uses_bounded_account_kinds(self):
        with self.captureOnCommitCallbacks(execute=False):
            EmailMultiAlternatives("Confirm your email", "Body", None, ["one@example.test"]).send()
            EmailMultiAlternatives("Profile updated", "Body", None, ["two@example.test"]).send()
        self.assertEqual(
            list(EmailDeliveryReceipt.objects.order_by("pk").values_list("email_kind", flat=True)),
            [EmailKind.AUTHENTICATION, EmailKind.ACCOUNT],
        )


@override_settings(
    EMAIL_RECIPIENT_HMAC_KEY="test-key",
    EMAIL_TRANSPORT_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    DEFAULT_FROM_EMAIL="noreply@example.test",
)
class DeliveryTaskTests(TestCase):
    def setUp(self):
        self.receipt = EmailDeliveryReceipt.objects.create(recipient_ref="v1:opaque", email_kind=EmailKind.ACCOUNT)
        self.envelope = {
            "recipient": "person@example.test",
            "subject": "Notice",
            "text_body": "Body",
            "html_body": "<p>Body</p>",
            "reply_to": ["reply@example.test"],
            "email_kind": EmailKind.ACCOUNT,
            "preference": None,
            "from_email": "sender@example.test",
        }

    def test_smtp_acceptance_is_terminal_success(self):
        result = deliver_email.apply(args=[str(self.receipt.delivery_id), self.envelope]).get()
        self.receipt.refresh_from_db()
        self.assertEqual(result, DeliveryStatus.SMTP_ACCEPTED)
        self.assertEqual(self.receipt.status, DeliveryStatus.SMTP_ACCEPTED)
        self.assertEqual(self.receipt.attempt_count, 1)
        self.assertEqual(mail.outbox[0].from_email, "sender@example.test")

    def test_terminal_failure_records_attempts_and_latency(self):
        with (
            patch("email_delivery.tasks.EmailMultiAlternatives.send", side_effect=smtplib.SMTPDataError(550, b"no")),
            patch("email_delivery.telemetry.DELIVERY_ATTEMPTS") as attempts,
            patch("email_delivery.telemetry.DELIVERY_LATENCY_SECONDS") as latency,
        ):
            deliver_email.apply(args=[str(self.receipt.delivery_id), self.envelope]).get()
        attempts.observe.assert_called_once_with(1)
        latency.observe.assert_called_once()

    def test_preference_skip_records_latency_without_an_attempt(self):
        with (
            patch("email_delivery.tasks._preference_allows", return_value=False),
            patch("email_delivery.telemetry.DELIVERY_ATTEMPTS") as attempts,
            patch("email_delivery.telemetry.DELIVERY_LATENCY_SECONDS") as latency,
        ):
            deliver_email.apply(args=[str(self.receipt.delivery_id), self.envelope]).get()
        attempts.observe.assert_not_called()
        latency.observe.assert_called_once()

    def test_smtp_5xx_is_not_retried(self):
        with patch("email_delivery.tasks.EmailMultiAlternatives.send", side_effect=smtplib.SMTPDataError(550, b"no")):
            result = deliver_email.apply(args=[str(self.receipt.delivery_id), self.envelope]).get()
        self.receipt.refresh_from_db()
        self.assertEqual(result, DeliveryStatus.FAILED)
        self.assertEqual(self.receipt.reason_code, "smtp_5xx")

    def test_failure_classification_separates_retryable_and_terminal_errors(self):
        self.assertEqual(_reason(smtplib.SMTPDataError(421, b"later")), (True, "smtp_4xx"))
        self.assertEqual(_reason(TimeoutError()), (True, "transport_error"))
        self.assertEqual(_reason(smtplib.SMTPAuthenticationError(535, b"bad auth")), (False, "authentication_error"))
        self.assertEqual(_reason(smtplib.SMTPDataError(550, b"no")), (False, "smtp_5xx"))

    def test_task_has_the_delivery_time_limits(self):
        self.assertEqual(deliver_email.soft_time_limit, 30)
        self.assertEqual(deliver_email.time_limit, 60)

    def test_logs_do_not_contain_raw_message_data(self):
        handler = Mock()
        logger = logging.getLogger("email_delivery")
        logger.addHandler(handler)
        try:
            deliver_email.apply(args=[str(self.receipt.delivery_id), self.envelope]).get()
        finally:
            logger.removeHandler(handler)
        rendered = str(handler.handle.call_args_list)
        self.assertNotIn("person@example.test", rendered)
        self.assertNotIn("Notice", rendered)
        self.assertNotIn("Body", rendered)


class MaintenanceTaskTests(TestCase):
    def test_stale_sending_receipt_becomes_unknown(self):
        receipt = EmailDeliveryReceipt.objects.create(
            recipient_ref="v1:opaque",
            email_kind=EmailKind.ACCOUNT,
            status=DeliveryStatus.SENDING,
            attempt_count=1,
        )
        EmailDeliveryReceipt.objects.filter(pk=receipt.pk).update(updated_at=timezone.now() - timedelta(minutes=3))
        with (
            patch("email_delivery.telemetry.DELIVERY_ATTEMPTS") as attempts,
            patch("email_delivery.telemetry.DELIVERY_LATENCY_SECONDS") as latency,
        ):
            self.assertEqual(recover_stale_email_deliveries(), 1)
        receipt.refresh_from_db()
        self.assertEqual(receipt.status, DeliveryStatus.UNKNOWN)
        self.assertEqual(receipt.reason_code, "worker_lost")
        attempts.observe.assert_called_once_with(1)
        latency.observe.assert_called_once()

    def test_cleanup_is_bounded_and_keeps_recent_receipts(self):
        old = EmailDeliveryReceipt.objects.create(recipient_ref="v1:old", email_kind=EmailKind.ACCOUNT)
        recent = EmailDeliveryReceipt.objects.create(recipient_ref="v1:new", email_kind=EmailKind.ACCOUNT)
        EmailDeliveryReceipt.objects.filter(pk=old.pk).update(created_at=timezone.now() - timedelta(days=31))
        self.assertEqual(cleanup_email_delivery_receipts(batch_size=1), 1)
        self.assertFalse(EmailDeliveryReceipt.objects.filter(pk=old.pk).exists())
        self.assertTrue(EmailDeliveryReceipt.objects.filter(pk=recent.pk).exists())
