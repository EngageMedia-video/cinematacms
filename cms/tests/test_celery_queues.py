import re
from pathlib import Path

from django.conf import settings
from django.test import SimpleTestCase

from cms.celery import app

DEPLOY_DIR = Path(settings.BASE_DIR) / "deploy"
WORKER_QUEUE = re.compile(r'^Environment=CELERY_QUEUE="([^"]+)"', re.MULTILINE)


def consumed_queues() -> set[str]:
    queues = set()
    for unit in DEPLOY_DIR.glob("celery_*.service"):
        queues.update(WORKER_QUEUE.findall(unit.read_text()))
    return queues


class CeleryQueueContractTests(SimpleTestCase):
    def test_worker_units_consume_the_queues_the_contract_lists(self):
        self.assertEqual(consumed_queues(), set(settings.OBSERVABILITY_CELERY_QUEUES))

    def test_observability_installer_watches_the_queues_the_contract_lists(self):
        installer = (DEPLOY_DIR / "observability/install.sh").read_text()
        watched = re.search(r"^CELERY_CONSUMED_QUEUES=\(([^)]*)\)", installer, re.MULTILINE).group(1).split()
        self.assertEqual(set(watched), set(settings.OBSERVABILITY_CELERY_QUEUES))

    def test_unrouted_tasks_land_in_a_consumed_queue(self):
        self.assertIn(app.conf.task_default_queue, consumed_queues())

    def test_every_task_with_a_declared_queue_has_a_consumer(self):
        app.loader.import_default_modules()
        for name, task in app.tasks.items():
            declared = getattr(task, "queue", None)
            if declared:
                with self.subTest(task=name):
                    self.assertIn(declared, consumed_queues())
