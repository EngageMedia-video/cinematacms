import json
import os
import signal
import subprocess
import sys
import time

from django.conf import settings
from django.test import SimpleTestCase

# The shutdown cleanup matches "ffmpeg" anywhere in a command line, so this
# argv stands in for a running encoder without needing the binary.
ENCODER_STAND_IN = [sys.executable, "-c", "import time; time.sleep(120)", "ffmpeg"]

# The shutting-down worker. It runs in a session of its own, as systemd and
# `celery worker --detach` start each worker. The script arrives on stdin and
# the stand-in argv in the environment, so the worker's own command line
# never matches the cleanup.
SHUTTING_DOWN_WORKER = """
import json, os, subprocess, sys
import django

django.setup()
from files.tasks import worker_shutdown_handler

stand_in = json.loads(os.environ["ENCODER_STAND_IN"])
attached = subprocess.Popen(stand_in, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
spawner = subprocess.run(
    [
        sys.executable,
        "-c",
        "import subprocess, sys; "
        "print(subprocess.Popen(sys.argv[1:], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).pid)",
        *stand_in,
    ],
    capture_output=True,
    text=True,
    check=True,
)
orphan_pid = int(spawner.stdout)

worker_shutdown_handler(sender="shutting-down@test")

try:
    attached.wait(timeout=5)
    attached_alive = False
except subprocess.TimeoutExpired:
    attached_alive = True
print(json.dumps({"attached_pid": attached.pid, "attached_alive": attached_alive, "orphan_pid": orphan_pid}))
"""


def _is_running(pid):
    state = subprocess.run(["ps", "-o", "stat=", "-p", str(pid)], capture_output=True, text=True).stdout.strip()
    return bool(state) and not state.startswith("Z")


def _wait_until_gone(pid, timeout=5):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if not _is_running(pid):
            return True
        time.sleep(0.1)
    return False


def _kill_quietly(pid):
    try:
        os.kill(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass


class WorkerShutdownCleanupTests(SimpleTestCase):
    def test_shutdown_stops_own_encoders_and_spares_another_workers(self):
        other_worker_encoder = subprocess.Popen(
            ENCODER_STAND_IN,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        self.addCleanup(other_worker_encoder.wait)
        self.addCleanup(_kill_quietly, other_worker_encoder.pid)

        worker = subprocess.run(
            [sys.executable, "-"],
            input=SHUTTING_DOWN_WORKER,
            capture_output=True,
            text=True,
            cwd=settings.BASE_DIR,
            env={**os.environ, "ENCODER_STAND_IN": json.dumps(ENCODER_STAND_IN)},
            start_new_session=True,
            timeout=60,
        )
        self.assertEqual(worker.returncode, 0, worker.stderr)
        result = json.loads(worker.stdout.strip().splitlines()[-1])
        self.addCleanup(_kill_quietly, result["attached_pid"])
        self.addCleanup(_kill_quietly, result["orphan_pid"])

        self.assertFalse(result["attached_alive"], "worker's own encoder survived its shutdown")
        self.assertTrue(
            _wait_until_gone(result["orphan_pid"]),
            "worker's encoder orphaned to init survived its shutdown",
        )
        self.assertIsNone(other_worker_encoder.poll(), "another worker's encoder was killed")
