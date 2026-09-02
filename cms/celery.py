import os

from celery import Celery
from celery.signals import worker_process_init

from cms.observability import configure_celery_worker_process

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cms.settings")
app = Celery("cms")

app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()

app.conf.broker_transport_options = {"visibility_timeout": 60 * 60 * 24}  # 1 day
# http://docs.celeryproject.org/en/latest/getting-started/brokers/redis.html#redis-caveats


app.conf.worker_prefetch_multiplier = 1


@worker_process_init.connect(weak=False, dispatch_uid="cinematacms_otel_worker_process")
def configure_worker_observability(**kwargs):
    configure_celery_worker_process()


@app.task(bind=True)
def debug_task(self):
    print(f"Request: {self.request!r}")


@app.task(name="record_beat_freshness", queue="short_tasks")
def record_beat_freshness():
    import time

    from files.metrics import CELERY_BEAT_FRESHNESS_TIMESTAMP

    CELERY_BEAT_FRESHNESS_TIMESTAMP.set(time.time())
    return {"outcome": "succeeded"}
