from prometheus_client import Histogram

ENCODING_QUEUE_WAIT_SECONDS = Histogram(
    "cinemata_encoding_queue_wait_seconds",
    "Time an encoding task waited in the Celery queue before execution",
    buckets=(1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600),
)
