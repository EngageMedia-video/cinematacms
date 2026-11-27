from django.apps import AppConfig
from django.utils.module_loading import autodiscover_modules


class EventsConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "events"
    verbose_name = "Domain events"

    def ready(self):
        from . import catalog, checks  # noqa: F401

        autodiscover_modules("event_handlers")
