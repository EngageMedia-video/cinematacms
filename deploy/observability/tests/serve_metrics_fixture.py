#!/usr/bin/env python3
import argparse
import json
import os
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]

PREFERRED_VALUES = {
    "queue": "whisper_tasks",
    "service_role": "transcription",
    "worker_ref": "v1:" + "a" * 64,
    "status_code": "200",
    "status_class": "2xx",
    "event": "completed",
    "outcome": "succeeded",
    "reason_code": "none",
}


def labels_for(schema: dict, registries: dict) -> dict[str, str]:
    labels = {}
    for label in schema.get("labels", []):
        if label in PREFERRED_VALUES:
            labels[label] = PREFERRED_VALUES[label]
            continue
        registry = registries[schema["dimension_registries"][label]]
        labels[label] = str(registry.get("values", ["fixture"])[0] or "fixture")
    return labels


def format_labels(labels: dict[str, str]) -> str:
    if not labels:
        return ""
    rendered = ",".join(f'{key}="{value}"' for key, value in labels.items())
    return "{" + rendered + "}"


def exposition() -> str:
    coverage = json.loads((ROOT / "config/observability/coverage.json").read_text())
    lines = []
    counter_value = int(time.time())
    for name, schema in sorted(coverage["metric_schemas"].items()):
        metric_type = schema["type"]
        labels = labels_for(schema, coverage["registries"])
        lines.append(f"# HELP {name} Contract fixture for {name}")
        lines.append(f"# TYPE {name} {metric_type}")
        if metric_type == "histogram":
            for bucket in schema["buckets"]:
                lines.append(f"{name}_bucket{format_labels(labels | {'le': str(bucket)})} {counter_value}")
            lines.append(f"{name}_bucket{format_labels(labels | {'le': '+Inf'})} {counter_value}")
            lines.append(f"{name}_sum{format_labels(labels)} {counter_value / 100}")
            lines.append(f"{name}_count{format_labels(labels)} {counter_value}")
        else:
            value = counter_value if metric_type == "counter" or name.endswith("_timestamp_seconds") else 1
            lines.append(f"{name}{format_labels(labels)} {value}")
    return "\n".join(lines) + "\n"


class MetricsHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != "/metrics":
            self.send_error(404)
            return
        body = exposition().encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; version=0.0.4")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        if self.path != "/internal/observability/references":
            self.send_error(404)
            return
        expected = os.environ.get("INCIDENT_REFERENCE_LOOKUP_TOKEN", "fixture-lookup-token")
        if self.headers.get("Authorization") != f"Bearer {expected}":
            self.send_error(403)
            return
        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length))
            kind = payload["kind"]
            if kind not in {"actor", "media"} or not payload["value"]:
                raise ValueError
        except (json.JSONDecodeError, KeyError, TypeError, ValueError):
            self.send_error(400)
            return
        prefix = "c" if payload["value"] == "nobody@example.invalid" else "a" if kind == "actor" else "b"
        log_field = "actor_ref" if kind == "actor" else "media_ref"
        span_field = "cinematacms.actor_ref" if kind == "actor" else "cinematacms.media_ref"
        body = json.dumps(
            {
                "kind": kind,
                "references": [{"reference": f"v1:{prefix * 64}", "log_field": log_field, "span_field": span_field}],
            }
        ).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format, *args):
        return


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dump", action="store_true")
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()
    if args.dump:
        print(exposition(), end="")
        return
    ThreadingHTTPServer(("127.0.0.1", args.port), MetricsHandler).serve_forever()


if __name__ == "__main__":
    main()
