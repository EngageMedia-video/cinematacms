#!/bin/bash

set -euo pipefail

VERSION="0.159.0"
TEMPORARY_DIR=""
CHANGE_SERVICE_STATE=true

fail() {
    echo "Error: $*" >&2
    exit 1
}

cleanup() {
    if [ -n "$TEMPORARY_DIR" ] && [ -d "$TEMPORARY_DIR" ]; then
        rm -f "$TEMPORARY_DIR/otelcol-contrib.deb"
        rmdir "$TEMPORARY_DIR"
    fi
}
trap cleanup EXIT

if [ "${1:-}" = "--no-service-changes" ]; then
    CHANGE_SERVICE_STATE=false
    shift
fi
[ "$#" -eq 0 ] || fail "unknown option: $1"

[ "$(id -u)" -eq 0 ] || fail "run this command as root"

if ! command -v prometheus >/dev/null 2>&1; then
    apt-get update
    apt-get install -y prometheus
fi

if ! command -v otelcol-contrib >/dev/null 2>&1; then
    command -v curl >/dev/null 2>&1 || fail "curl is required to install the OpenTelemetry Collector"
    architecture="$(dpkg --print-architecture)"
    case "$architecture" in
        amd64)
            checksum="4ede8d750d6bf845e353be46cc550f590e6ccdaeeb60aae941cde6ad561877db"
            ;;
        arm64)
            checksum="430469fbfb48f123d08dfc896973bdc205ba393901cc506e92c9c928698a6d5e"
            ;;
        *)
            fail "local observability supports amd64 and arm64"
            ;;
    esac

    TEMPORARY_DIR="$(mktemp -d)"
    package="$TEMPORARY_DIR/otelcol-contrib.deb"
    curl -fsSL \
        "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v${VERSION}/otelcol-contrib_${VERSION}_linux_${architecture}.deb" \
        -o "$package"
    printf '%s  %s\n' "$checksum" "$package" | sha256sum --check --status || fail "the OpenTelemetry Collector checksum did not match"
    apt-get install -y "$package"
fi

if ! getent group otelcol-contrib >/dev/null 2>&1; then
    groupadd --system otelcol-contrib
fi

if ! id -u otelcol-contrib >/dev/null 2>&1; then
    useradd --system --gid otelcol-contrib --home-dir /nonexistent --shell /usr/sbin/nologin otelcol-contrib
fi

stop_package_service() {
    local service="$1"
    local load_state

    load_state="$(systemctl show "$service" --property=LoadState --value 2>/dev/null)" || \
        fail "could not inspect package service $service"
    [ "$load_state" != "not-found" ] || return 0

    systemctl disable --now "$service" >/dev/null 2>&1 || \
        fail "could not stop package service $service"
    if systemctl is-active --quiet "$service"; then
        fail "package service $service is still active"
    fi
}

if [ "$CHANGE_SERVICE_STATE" = true ]; then
    # The release configuration owns loopback-only services with project config
    # files. Stop package defaults that may listen on broader addresses.
    stop_package_service prometheus
    stop_package_service otelcol-contrib
fi
