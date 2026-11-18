# Gunicorn settings for deploy/mediacms.service. nginx reaches this server over
# HTTP on loopback with the headers in deploy/nginx/cinematacms-proxy.conf.
#
# Import no application code here: the master runs this file, and a metric built
# in the master would write a file that every forked worker then shares.
import itertools
import os
import re
from pathlib import Path

from prometheus_client import multiprocess, values

APPLICATION_UPSTREAM = "cinematacms_app"


def application_server(upstream_config):
    """The one address of the upstream that nginx passes application requests to.

    nginx balances across every server in the upstream, and gunicorn binds one
    address, so any other shape is a configuration error.
    """
    config = re.sub(r"#[^\n]*", "", upstream_config)
    blocks = re.findall(rf"\bupstream\s+{APPLICATION_UPSTREAM}\s*\{{([^}}]*)\}}", config)
    if len(blocks) != 1:
        raise ValueError(f"expected one upstream {APPLICATION_UPSTREAM} block, found {len(blocks)}")
    servers = re.findall(r"(?:^|;|\s)server\s+([^;]*);", blocks[0])
    if len(servers) != 1:
        raise ValueError(f"upstream {APPLICATION_UPSTREAM} must have exactly one server, found {len(servers)}")
    address = servers[0].strip()
    if not re.fullmatch(r"127\.0\.0\.1:\d+", address):
        raise ValueError(f"upstream {APPLICATION_UPSTREAM} server must be a bare 127.0.0.1:<port>, got {address!r}")
    return address


bind = application_server((Path(__file__).parent / "nginx/cinematacms-upstream.conf").read_text())
worker_class = "gthread"
workers = int(os.environ.get("CINEMATA_WEB_WORKERS", "8"))
threads = 10

# nginx overwrites X-Forwarded-Proto on every request. Gunicorn's other default
# scheme headers would reach it from the client unchanged.
secure_scheme_headers = {"X-FORWARDED-PROTO": "https"}

# The gunicornc control socket. Nothing on the host uses it, and its default
# directory is under www-data's home, which www-data cannot write.
control_socket_disable = True

errorlog = "/home/cinemata/cinematacms/logs/errorlog.txt"
capture_output = True
# Finish before systemd sends SIGKILL at the unit's TimeoutStopSec=30s.
graceful_timeout = 25


# Each worker takes the lowest slot no live worker holds and keys its
# multiprocess metric files by that slot instead of its pid. A replacement
# worker then reuses its predecessor's files, so the directory holds at most
# twice the worker count (old and new workers overlap during a reload).
def pre_fork(server, worker):
    taken = {other.metrics_slot for other in server.WORKERS.values()}
    worker.metrics_slot = next(slot for slot in itertools.count(1) if slot not in taken)


def post_fork(server, worker):
    values.ValueClass = values.MultiProcessValue(process_identifier=lambda: worker.metrics_slot)


def child_exit(server, worker):
    multiprocess.mark_process_dead(worker.metrics_slot)
