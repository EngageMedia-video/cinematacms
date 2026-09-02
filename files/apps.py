from django.apps import AppConfig


class FilesConfig(AppConfig):
    name = "files"

    def ready(self):
        from files.metrics import validate_telemetry_settings

        validate_telemetry_settings()
