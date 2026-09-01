#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def classify(condition, values, was_degraded=False):
    if not values:
        return "unknown"
    if condition == "email_terminal_failure":
        degraded = values["failed"] > 0
    elif condition == "scheduled_job_stale":
        degraded = values["age_seconds"] > values["absence_seconds"]
    elif condition == "queue_saturation":
        degraded = values["depth"] > values["capacity"]
    else:
        degraded = values["value"] > 0
    if degraded:
        return "degraded"
    return "recovered" if was_degraded else "healthy"


def validate(catalog_path, fixtures_path):
    catalog = json.loads(Path(catalog_path).read_text())
    fixtures = json.loads(Path(fixtures_path).read_text())
    conditions = {item["name"] for item in catalog["conditions"]}
    seen = set()
    degraded = set()
    errors = []
    for case in fixtures["cases"]:
        name = case["condition"]
        seen.add(name)
        actual = classify(name, case["values"], name in degraded)
        if actual != case["state"]:
            errors.append(f"{name}: expected {case['state']}, got {actual}")
        if actual == "degraded":
            degraded.add(name)
        elif actual == "recovered":
            degraded.discard(name)
    missing = conditions - seen
    if missing:
        errors.append(f"missing fixtures: {', '.join(sorted(missing))}")
    return errors


def main():
    parser = argparse.ArgumentParser(description="Validate portable CinemataCMS alert fixtures")
    parser.add_argument("--catalog", default="config/observability/alertability.json")
    parser.add_argument("--fixtures", default="config/observability/fixtures.json")
    args = parser.parse_args()
    errors = validate(args.catalog, args.fixtures)
    if errors:
        raise SystemExit("\n".join(errors))
    print("validated observability alert fixtures")


if __name__ == "__main__":
    main()
