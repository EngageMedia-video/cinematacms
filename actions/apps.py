from django.apps import AppConfig


class ActionsConfig(AppConfig):
    name = "actions"

    def ready(self):
        from . import checks  # noqa: F401
