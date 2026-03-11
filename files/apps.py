from django.apps import AppConfig


class FilesConfig(AppConfig):
    name = "files"

    def ready(self):
        import files.metrics  # noqa: F401 — register Prometheus metrics at startup
