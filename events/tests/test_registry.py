import math
from datetime import datetime

from django.core.checks import run_checks
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase

from events.checks import check_handled_event_types
from events.registry import EventSpec, InvalidEventPayload, UnknownEventType, handles, isolated_registry


class EventSpecTests(SimpleTestCase):
    def test_define_rejects_a_malformed_spec(self):
        cases = [
            ("no verb", EventSpec("media", 1, ())),
            ("capitals", EventSpec("Media.Published", 1, ())),
            ("three parts", EventSpec("media.published.now", 1, ())),
            ("leading digit", EventSpec("1media.published", 1, ())),
            ("hyphen", EventSpec("media.visibility-changed", 1, ())),
            ("too long", EventSpec("media." + "x" * 95, 1, ())),
            ("version zero", EventSpec("media.published", 0, ())),
            ("field twice", EventSpec("media.published", 1, ("media_id", "media_id"))),
        ]
        for label, spec in cases:
            with self.subTest(label), isolated_registry() as registry, self.assertRaises(ImproperlyConfigured):
                registry.define(spec)

    def test_define_rejects_a_second_spec_with_the_same_name(self):
        with isolated_registry() as registry:
            registry.define(EventSpec("media.published", 1, ("media_id",)))
            registry.define(EventSpec("media.published", 1, ("media_id",)))
            with self.assertRaises(ImproperlyConfigured):
                registry.define(EventSpec("media.published", 2, ("media_id", "owner_id")))

    def test_lookup_of_an_undefined_type_raises(self):
        with isolated_registry() as registry, self.assertRaises(UnknownEventType):
            registry.spec("media.published")

    def test_payload_must_match_the_declared_fields_and_be_plain_json(self):
        spec = EventSpec("comment.posted", 1, ("comment_id", "media_id"))
        cases = [
            ("missing field", {"comment_id": 1}),
            ("undeclared field", {"comment_id": 1, "media_id": 2, "email": "a@example.com"}),
            ("not a dict", [1, 2]),
            ("datetime", {"comment_id": 1, "media_id": datetime(2026, 1, 1)}),
            ("set", {"comment_id": 1, "media_id": {2}}),
            ("nan", {"comment_id": 1, "media_id": math.nan}),
        ]
        for label, payload in cases:
            with self.subTest(label), self.assertRaises(InvalidEventPayload):
                spec.validate(payload)
        spec.validate({"comment_id": 1, "media_id": None})


class HandlerRegistrationTests(SimpleTestCase):
    def test_handles_registers_the_function_under_its_dotted_name_for_one_type(self):
        with isolated_registry() as registry:

            @handles("media.published")
            def second(event):
                pass

            @handles("media.published")
            def first(event):
                pass

            @handles("comment.posted")
            def other(event):
                pass

            names = [handler.name for handler in registry.handlers_for("media.published")]
            self.assertEqual(
                names,
                [
                    f"{__name__}.HandlerRegistrationTests.{self._testMethodName}.<locals>.first",
                    f"{__name__}.HandlerRegistrationTests.{self._testMethodName}.<locals>.second",
                ],
            )
            self.assertIs(registry.handler("media.published", names[0]).func, first)
            self.assertIsNone(registry.handler("comment.posted", names[0]))

    def test_system_check_fails_on_a_handler_for_an_undefined_type(self):
        with isolated_registry() as registry:
            registry.define(EventSpec("media.published", 1, ("media_id",)))

            @handles("media.published")
            def known(event):
                pass

            self.assertEqual(check_handled_event_types(), [])

            @handles("media.publishd")
            def misspelled(event):
                pass

            errors = check_handled_event_types()
            self.assertEqual([error.id for error in errors], ["events.E001"])
            self.assertIn("media.publishd", errors[0].msg)

    def test_check_is_registered_with_django(self):
        with isolated_registry():

            @handles("nothing.defined")
            def orphan(event):
                pass

            self.assertIn("events.E001", [message.id for message in run_checks()])
