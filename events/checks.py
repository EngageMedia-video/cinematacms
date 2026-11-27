from django.core.checks import Error, register

from .registry import get_registry


@register()
def check_handled_event_types(app_configs=None, **kwargs):
    registry = get_registry()
    return [
        Error(
            f"{handler.name} handles {handler.event_type!r}, which events/catalog.py does not define.",
            hint="Define the event type in events/catalog.py, or fix the name in @handles().",
            obj=handler.name,
            id="events.E001",
        )
        for handler in registry.all_handlers()
        if handler.event_type not in registry.specs
    ]
