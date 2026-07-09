import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cms.settings")

from cms.observability import configure_django_observability

configure_django_observability()

try:
    import uwsgi
    from prometheus_client.values import MultiProcessValue

    MultiProcessValue(process_identifier=lambda: uwsgi.worker_id())
except (ImportError, ModuleNotFoundError):
    pass

application = get_wsgi_application()
