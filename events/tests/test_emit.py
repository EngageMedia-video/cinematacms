from datetime import timedelta
from unittest.mock import patch

from django.contrib.auth.models import AnonymousUser
from django.db import transaction
from django.db.transaction import TransactionManagementError
from django.test import TestCase, TransactionTestCase

from events.models import DomainEvent
from events.registry import InvalidEventPayload, UnknownEventType
from events.service import emit
from events.tasks import recover_domain_events
from users.models import User

from .helpers import PAYLOAD, EventTestMixin


class EmitTests(EventTestMixin, TestCase):
    def test_emit_records_the_event_and_dispatches_only_after_commit(self):
        actor = User.objects.create_user(username="actor", email="actor@example.org", password="pw")
        with patch("events.tasks.dispatch_domain_event.apply_async") as publish:
            with self.captureOnCommitCallbacks(execute=False) as callbacks, transaction.atomic():
                event = emit("thing.happened", actor=actor, payload=dict(PAYLOAD))
            publish.assert_not_called()
            self.assertEqual(len(callbacks), 1)
            callbacks[0]()

        publish.assert_called_once_with(args=[str(event.id)], queue="short_tasks")
        stored = DomainEvent.objects.get()
        self.assertEqual(
            (stored.type, stored.version, stored.actor_id, stored.payload, stored.dispatched_at),
            ("thing.happened", 1, actor.id, {"thing_id": 7, "title": "Private title"}, None),
        )

    def test_an_anonymous_or_missing_actor_is_stored_as_no_actor(self):
        for actor in (None, AnonymousUser()):
            with self.subTest(actor=actor), patch("events.tasks.dispatch_domain_event.apply_async"):
                event = self.emit_and_commit(actor=actor)
                self.assertIsNone(DomainEvent.objects.get(pk=event.pk).actor_id)

    def test_an_unknown_type_or_invalid_payload_records_nothing(self):
        cases = [
            ("unknown type", "thing.vanished", PAYLOAD, UnknownEventType),
            ("missing field", "thing.happened", {"thing_id": 7}, InvalidEventPayload),
            ("undeclared field", "thing.happened", {**PAYLOAD, "token": "secret"}, InvalidEventPayload),
        ]
        for label, event_type, payload, error in cases:
            with self.subTest(label), self.assertRaises(error), transaction.atomic():
                emit(event_type, actor=None, payload=payload)
        self.assertFalse(DomainEvent.objects.exists())

    def test_emit_logs_the_event_without_its_payload(self):
        with patch("events.tasks.dispatch_domain_event.apply_async"), self.assertLogs("events", "INFO") as logs:
            event = self.emit_and_commit()
        (record,) = [record for record in logs.records if record.getMessage() == "cinematacms.domain_event.emitted"]
        self.assertEqual((record.domain_event_id, record.domain_event_type), (str(event.id), "thing.happened"))
        self.assertNotIn("Private title", str(vars(record)))

    def test_a_dispatch_that_cannot_be_queued_is_recovered_later(self):
        with patch("events.tasks.dispatch_domain_event.apply_async", side_effect=ConnectionError("broker down")):
            event = self.emit_and_commit()
        self.assertIsNone(DomainEvent.objects.get(pk=event.pk).dispatched_at)

        DomainEvent.objects.filter(pk=event.pk).update(occurred_at=event.occurred_at - timedelta(minutes=3))
        recover_domain_events()
        self.assertIsNotNone(DomainEvent.objects.get(pk=event.pk).dispatched_at)


class EmitTransactionTests(EventTestMixin, TransactionTestCase):
    def test_emit_outside_a_transaction_is_rejected(self):
        with self.assertRaises(TransactionManagementError):
            emit("thing.happened", actor=None, payload=dict(PAYLOAD))
        self.assertFalse(DomainEvent.objects.exists())

    def test_a_rolled_back_change_takes_its_event_and_dispatch_with_it(self):
        with patch("events.tasks.dispatch_domain_event.apply_async") as publish:
            with self.assertRaises(RuntimeError), transaction.atomic():
                User.objects.create_user(username="changed", email="changed@example.org", password="pw")
                emit("thing.happened", actor=None, payload=dict(PAYLOAD))
                raise RuntimeError("the change failed")
        publish.assert_not_called()
        self.assertFalse(DomainEvent.objects.exists())
        self.assertFalse(User.objects.filter(username="changed").exists())

    def test_a_committed_change_dispatches_its_event(self):
        with patch("events.tasks.dispatch_domain_event.apply_async") as publish:
            with transaction.atomic():
                event = emit("thing.happened", actor=None, payload=dict(PAYLOAD))
        publish.assert_called_once_with(args=[str(event.id)], queue="short_tasks")
