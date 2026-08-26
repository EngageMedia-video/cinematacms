import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cms.settings")

# Under uWSGI, key each worker's multiprocess metric files by uWSGI worker id
# instead of the default pid. A respawned worker then reuses its predecessor's
# files rather than leaving orphans behind in PROMETHEUS_MULTIPROC_DIR.
# Must run before the first metric is constructed, hence before the WSGI app.
try:
    import uwsgi
    from prometheus_client import values

    values.ValueClass = values.MultiProcessValue(process_identifier=uwsgi.worker_id)
except ImportError:
    pass

application = get_wsgi_application()
