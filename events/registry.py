"""The catalogue of Domain event types and the handlers that react to them."""

import contextlib
import json
import re
from collections.abc import Callable
from dataclasses import dataclass

from django.core.exceptions import ImproperlyConfigured

# <noun>.<past-tense verb>, such as media.published or comment.posted.
EVENT_TYPE_PATTERN = re.compile(r"[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*")
EVENT_TYPE_MAX_LENGTH = 100  # DomainEvent.type
HANDLER_NAME_MAX_LENGTH = 200


class UnknownEventType(LookupError):
    pass


class InvalidEventPayload(ValueError):
    pass


@dataclass(frozen=True)
class EventSpec:
    name: str
    version: int
    fields: tuple[str, ...]

    def validate(self, payload) -> None:
        if not isinstance(payload, dict):
            raise InvalidEventPayload(f"{self.name} payload must be a dict")
        missing = sorted(set(self.fields) - set(payload))
        unexpected = sorted(set(payload) - set(self.fields))
        if missing:
            raise InvalidEventPayload(f"{self.name} payload is missing {', '.join(missing)}")
        if unexpected:
            raise InvalidEventPayload(f"{self.name} payload has undeclared fields {', '.join(unexpected)}")
        try:
            json.dumps(payload, allow_nan=False)
        except (TypeError, ValueError) as error:
            raise InvalidEventPayload(f"{self.name} payload is not plain JSON: {error}") from error


@dataclass(frozen=True)
class Handler:
    event_type: str
    name: str
    func: Callable


class Registry:
    def __init__(self):
        self.specs: dict[str, EventSpec] = {}
        self._handlers: dict[tuple[str, str], Handler] = {}

    def define(self, spec: EventSpec) -> EventSpec:
        if not EVENT_TYPE_PATTERN.fullmatch(spec.name):
            raise ImproperlyConfigured(f"Event type {spec.name!r} must look like <noun>.<past_tense_verb>")
        if len(spec.name) > EVENT_TYPE_MAX_LENGTH:
            raise ImproperlyConfigured(f"Event type {spec.name!r} is longer than {EVENT_TYPE_MAX_LENGTH} characters")
        if not isinstance(spec.version, int) or spec.version < 1:
            raise ImproperlyConfigured(f"Event type {spec.name!r} needs a version of 1 or more")
        if len(set(spec.fields)) != len(spec.fields):
            raise ImproperlyConfigured(f"Event type {spec.name!r} declares a payload field twice")
        if spec.name in self.specs and self.specs[spec.name] != spec:
            raise ImproperlyConfigured(f"Event type {spec.name!r} is already defined")
        self.specs[spec.name] = spec
        return spec

    def spec(self, event_type: str) -> EventSpec:
        try:
            return self.specs[event_type]
        except KeyError:
            raise UnknownEventType(f"Unknown event type {event_type!r}") from None

    def add_handler(self, event_type: str, func: Callable) -> Handler:
        name = f"{func.__module__}.{func.__qualname__}"
        if len(name) > HANDLER_NAME_MAX_LENGTH:
            raise ImproperlyConfigured(f"Handler name {name!r} is longer than {HANDLER_NAME_MAX_LENGTH} characters")
        handler = Handler(event_type=event_type, name=name, func=func)
        self._handlers[(event_type, name)] = handler
        return handler

    def handlers_for(self, event_type: str) -> list[Handler]:
        return sorted(
            (handler for (handled_type, _), handler in self._handlers.items() if handled_type == event_type),
            key=lambda handler: handler.name,
        )

    def handler(self, event_type: str, name: str) -> Handler | None:
        return self._handlers.get((event_type, name))

    def all_handlers(self) -> list[Handler]:
        return list(self._handlers.values())


_registry = Registry()


def get_registry() -> Registry:
    return _registry


def define(spec: EventSpec) -> EventSpec:
    """Add an event type to the catalogue. Call it from ``events/catalog.py``."""

    return _registry.define(spec)


def handles(event_type: str):
    """Run the decorated function, with the DomainEvent, once for every event of this type.

    Put handlers in an ``event_handlers`` module of the consumer's app, which is imported when apps load.
    A handler runs at least once and in no particular order, so it must be idempotent.
    """

    def decorator(func):
        get_registry().add_handler(event_type, func)
        return func

    return decorator


@contextlib.contextmanager
def isolated_registry():
    """Swap in an empty registry, for tests that define their own event types and handlers."""

    global _registry
    previous = _registry
    _registry = Registry()
    try:
        yield _registry
    finally:
        _registry = previous
