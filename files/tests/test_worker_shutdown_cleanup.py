import json
import os
import shutil
import signal
import subprocess
import sys
import tempfile
import time

from django.conf import settings
from django.test import SimpleTestCase

# A Celery worker on a host named ffmpeg-node, as the systemd units start it
# with `-n long@%H`.
WORKER_NAME_ARGS = ["-n", "long@ffmpeg-node"]

# The shutting-down worker. It runs in a session of its own, as systemd and
# `celery worker --detach` start each worker, and carries the host name in
# its argv. It starts a prefork-like child with the same argv, an encoder,
# and an encoder whose parent exits so init adopts it.
SHUTTING_DOWN_WORKER = """
import json, os, subprocess, sys
import django

django.setup()
from files.tasks import worker_shutdown_handler

stand_in = json.loads(os.environ["ENCODER_STAND_IN"])
prefork_child = subprocess.Popen(
    [sys.executable, "-c", "import time; time.sleep(120)", *sys.argv[1:]],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
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

worker_shutdown_handler(sender="long@ffmpeg-node")

try:
    attached.wait(timeout=5)
    attached_alive = False
except subprocess.TimeoutExpired:
    attached_alive = True
print(
    json.dumps(
        {
            "attached_alive": attached_alive,
            "orphan_pid": orphan_pid,
            "prefork_child_alive": prefork_child.poll() is None,
        }
    )
)
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


def _kill_group_quietly(pgid):
    try:
        os.killpg(pgid, signal.SIGKILL)
    except ProcessLookupError:
        pass


class WorkerShutdownCleanupTests(SimpleTestCase):
    def setUp(self):
        # An executable named ffmpeg stands in for the encoder, so the test
        # needs no ffmpeg binary. It is the Python interpreter, not sleep:
        # multi-call coreutils (uutils on Ubuntu 26.04) choose the tool from
        # the invoked name and exit at once when it is "ffmpeg".
        bin_dir = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, bin_dir)
        encoder = os.path.join(bin_dir, "ffmpeg")
        os.symlink(os.path.realpath(sys.executable), encoder)
        self.encoder_stand_in = [encoder, "-c", "import time; time.sleep(120)"]

    def test_shutdown_stops_own_encoders_and_spares_other_processes(self):
        other_worker_encoder = subprocess.Popen(
            self.encoder_stand_in,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            start_new_session=True,
        )
        self.addCleanup(other_worker_encoder.wait)
        self.addCleanup(_kill_group_quietly, other_worker_encoder.pid)

        worker = subprocess.Popen(
            [sys.executable, "-", *WORKER_NAME_ARGS],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=settings.BASE_DIR,
            env={**os.environ, "ENCODER_STAND_IN": json.dumps(self.encoder_stand_in)},
            start_new_session=True,
        )
        self.addCleanup(_kill_group_quietly, worker.pid)
        stdout, stderr = worker.communicate(SHUTTING_DOWN_WORKER, timeout=60)

        self.assertEqual(
            worker.returncode, 0, f"worker with ffmpeg in its name was killed by its own shutdown\n{stderr}"
        )
        result = json.loads(stdout.strip().splitlines()[-1])
        self.assertTrue(result["prefork_child_alive"], "worker process with ffmpeg in its argv was killed")
        self.assertFalse(result["attached_alive"], "worker's own encoder survived its shutdown")
        self.assertTrue(
            _wait_until_gone(result["orphan_pid"]),
            "worker's encoder orphaned to init survived its shutdown",
        )
        self.assertIsNone(
            other_worker_encoder.poll(),
            f"another worker's encoder stopped with status {other_worker_encoder.returncode}",
        )
