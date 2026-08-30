#!/bin/bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEPLOY_ROOT="${CINEMATA_DEPLOY_ROOT:-/}"
SKIP_ROOT_CHECK="${CINEMATA_SKIP_ROOT_CHECK:-0}"
NO_RESTART=false
OBSERVABILITY_INSTALLER="${CINEMATA_OBSERVABILITY_INSTALLER:-$SCRIPT_DIR/install-local-observability.sh}"
CLI_DOMAIN=""
CLI_PROXY=""
CLI_OBSERVABILITY=""

usage() {
    cat <<'EOF'
Usage: sudo ./deploy/apply-release-config.sh [options]

Run without configuration options to reuse /etc/cinematacms/deployment.env.

Options:
  --domain HOST           Portal hostname without a scheme, path, or port.
  --proxy MODE            Reverse proxy mode: none or cloudflare.
  --observability MODE    Observability mode: none or local.
  --no-restart            Install and validate files without restarting services.
  -h, --help              Show this help text.
EOF
}

fail() {
    echo "Error: $*" >&2
    exit 1
}

root_path() {
    if [ "$DEPLOY_ROOT" = "/" ]; then
        printf '%s\n' "$1"
    else
        printf '%s%s\n' "${DEPLOY_ROOT%/}" "$1"
    fi
}

validate_domain() {
    local domain="$1"
    [[ "$domain" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)*[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$ ]]
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --domain)
            [ "$#" -ge 2 ] || fail "--domain requires a value"
            CLI_DOMAIN="$2"
            shift 2
            ;;
        --proxy)
            [ "$#" -ge 2 ] || fail "--proxy requires a value"
            CLI_PROXY="$2"
            shift 2
            ;;
        --observability)
            [ "$#" -ge 2 ] || fail "--observability requires a value"
            CLI_OBSERVABILITY="$2"
            shift 2
            ;;
        --no-restart)
            NO_RESTART=true
            shift
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            fail "unknown option: $1"
            ;;
    esac
done

if [ "$SKIP_ROOT_CHECK" != "1" ] && [ "$(id -u)" -ne 0 ]; then
    fail "run this command as root"
fi

CONFIG_DIR="$(root_path /etc/cinematacms)"
CONFIG_FILE="$CONFIG_DIR/deployment.env"
DOMAIN=""
PROXY_MODE=""
OBSERVABILITY_MODE=""
SAVED_DOMAIN=""

if [ -f "$CONFIG_FILE" ]; then
    while IFS='=' read -r key value; do
        case "$key" in
            CINEMATA_DOMAIN) DOMAIN="$value" ;;
            CINEMATA_PROXY) PROXY_MODE="$value" ;;
            CINEMATA_OBSERVABILITY) OBSERVABILITY_MODE="$value" ;;
        esac
    done < "$CONFIG_FILE"
fi

SAVED_DOMAIN="$DOMAIN"

if [ -n "$SAVED_DOMAIN" ] && [ -n "$CLI_DOMAIN" ] && [ "$SAVED_DOMAIN" != "$CLI_DOMAIN" ]; then
    fail "change the domain manually so that Certbot and nginx stay in sync"
fi

[ -z "$CLI_DOMAIN" ] || DOMAIN="$CLI_DOMAIN"
[ -z "$CLI_PROXY" ] || PROXY_MODE="$CLI_PROXY"
[ -z "$CLI_OBSERVABILITY" ] || OBSERVABILITY_MODE="$CLI_OBSERVABILITY"

[ -n "$DOMAIN" ] || fail "--domain is required on the first run"
[ -n "$PROXY_MODE" ] || fail "--proxy is required on the first run"
[ -n "$OBSERVABILITY_MODE" ] || fail "--observability is required on the first run"
validate_domain "$DOMAIN" || fail "--domain must contain a hostname without a scheme, path, or port"
case "$PROXY_MODE" in
    none|cloudflare) ;;
    *) fail "--proxy must be none or cloudflare" ;;
esac
case "$OBSERVABILITY_MODE" in
    none|local) ;;
    *) fail "--observability must be none or local" ;;
esac

if [ "$OBSERVABILITY_MODE" = "local" ]; then
    if [ "$NO_RESTART" = true ]; then
        if ! command -v prometheus >/dev/null 2>&1 || ! command -v otelcol-contrib >/dev/null 2>&1; then
            fail "--no-restart cannot install missing observability packages; run again without --no-restart"
        fi
        "$OBSERVABILITY_INSTALLER" --no-service-changes
    else
        "$OBSERVABILITY_INSTALLER"
    fi
    command -v prometheus >/dev/null 2>&1 || fail "the Prometheus installation did not provide its binary"
    command -v otelcol-contrib >/dev/null 2>&1 || fail "the OpenTelemetry Collector installation did not provide its binary"
fi

BACKUP_DIR="$(root_path /var/backups/cinematacms)/$(date -u +%Y%m%dT%H%M%SZ)-$$"
BACKUP_PATHS=()
BACKUP_FILES=()
BACKUP_EXISTED=()

backup_file() {
    local target="$1"
    local existing
    local backup
    for existing in "${BACKUP_PATHS[@]:-}"; do
        [ "$existing" != "$target" ] || return 0
    done
    mkdir -p "$BACKUP_DIR"
    backup="$BACKUP_DIR/$(printf '%s' "$target" | tr '/' '_')"
    BACKUP_PATHS+=("$target")
    BACKUP_FILES+=("$backup")
    if [ -e "$target" ] || [ -L "$target" ]; then
        cp -p "$target" "$backup"
        BACKUP_EXISTED+=("1")
    else
        BACKUP_EXISTED+=("0")
    fi
}

rollback() {
    local index
    for ((index=${#BACKUP_PATHS[@]}-1; index>=0; index--)); do
        if [ "${BACKUP_EXISTED[$index]}" = "1" ]; then
            mkdir -p "$(dirname "${BACKUP_PATHS[$index]}")"
            cp -p "${BACKUP_FILES[$index]}" "${BACKUP_PATHS[$index]}"
        else
            rm -f "${BACKUP_PATHS[$index]}"
        fi
    done
}

APPLY_VALIDATED=false
on_error() {
    local status="$?"
    trap - ERR
    if [ "$APPLY_VALIDATED" = false ]; then
        rollback
    fi
    exit "$status"
}
trap on_error ERR

install_managed_file() {
    local source="$1"
    local target="$2"
    local mode="${3:-0644}"
    backup_file "$target"
    mkdir -p "$(dirname "$target")"
    install -m "$mode" "$source" "$target"
}

write_config() {
    local target="$1"
    local mode="$2"
    local content="$3"
    local temporary
    backup_file "$target"
    mkdir -p "$(dirname "$target")"
    temporary="$(mktemp "$(dirname "$target")/.cinematacms.XXXXXX")"
    printf '%s' "$content" > "$temporary"
    chmod "$mode" "$temporary"
    mv "$temporary" "$target"
}

write_config "$CONFIG_FILE" 0600 "CINEMATA_DOMAIN=$DOMAIN
CINEMATA_PROXY=$PROXY_MODE
CINEMATA_OBSERVABILITY=$OBSERVABILITY_MODE
"

if [ "$OBSERVABILITY_MODE" = "local" ]; then
    otel_enabled="true"
else
    otel_enabled="false"
fi
write_config "$CONFIG_DIR/observability.env" 0640 "OTEL_ENABLED=$otel_enabled
OTEL_SERVICE_NAME=cinematacms
OTEL_EXPORTER_OTLP_ENDPOINT=http://127.0.0.1:4318/v1/traces
OTEL_EXPORTER_OTLP_HEADERS=
OTEL_TRACES_SAMPLER_ARG=1.0
"

NGINX_SNIPPET="$(root_path /etc/nginx/snippets/cinematacms-metrics.conf)"
NGINX_SITE="$(root_path /etc/nginx/sites-available/mediacms.io)"
NGINX_ENABLED="$(root_path /etc/nginx/sites-enabled/mediacms.io)"
NGINX_UWSGI_PARAMS="$(root_path /etc/nginx/sites-enabled/uwsgi_params)"
NGINX_MAIN="$(root_path /etc/nginx/nginx.conf)"
NGINX_CLOUDFLARE="$(root_path /etc/nginx/conf.d/cloudflare_real_ip.conf)"

install_managed_file "$SCRIPT_DIR/nginx/cinematacms-metrics.conf" "$NGINX_SNIPPET"
install_managed_file "$SCRIPT_DIR/uwsgi_params" "$NGINX_UWSGI_PARAMS"
if [ ! -e "$NGINX_MAIN" ]; then
    install_managed_file "$SCRIPT_DIR/nginx.conf" "$NGINX_MAIN"
fi

if [ "$PROXY_MODE" = "cloudflare" ]; then
    install_managed_file "$SCRIPT_DIR/cloudflare_real_ip.conf" "$NGINX_CLOUDFLARE"
elif [ -e "$NGINX_CLOUDFLARE" ]; then
    backup_file "$NGINX_CLOUDFLARE"
    rm -f "$NGINX_CLOUDFLARE"
fi

if [ ! -e "$NGINX_SITE" ]; then
    rendered_site="$(mktemp)"
    sed \
        -e "s/server_name localhost;/server_name $DOMAIN;/g" \
        -e "s#/live/localhost/#/live/$DOMAIN/#g" \
        "$SCRIPT_DIR/mediacms.io" > "$rendered_site"
    install_managed_file "$rendered_site" "$NGINX_SITE"
    rm -f "$rendered_site"
elif ! grep -qE 'location = /metrics|cinematacms-metrics\.conf' "$NGINX_SITE"; then
    rendered_site="$(mktemp)"
    awk '
        /^[[:space:]]*location \/ \{/ {
            print "    include /etc/nginx/snippets/cinematacms-metrics.conf;"
            found = 1
        }
        { print }
        END { if (!found) exit 42 }
    ' "$NGINX_SITE" > "$rendered_site" || {
        rm -f "$rendered_site"
        rollback
        fail "could not find a root location in $NGINX_SITE"
    }
    install_managed_file "$rendered_site" "$NGINX_SITE"
    rm -f "$rendered_site"
fi

if [ ! -e "$NGINX_ENABLED" ] && [ ! -L "$NGINX_ENABLED" ]; then
    backup_file "$NGINX_ENABLED"
    mkdir -p "$(dirname "$NGINX_ENABLED")"
    ln -s ../sites-available/mediacms.io "$NGINX_ENABLED"
fi

for unit in mediacms celery_long celery_short celery_whisper celery_beat; do
    install_managed_file "$SCRIPT_DIR/$unit.service" "$(root_path /etc/systemd/system/$unit.service)"
done

PROMETHEUS_UNIT="$(root_path /etc/systemd/system/cinematacms-prometheus.service)"
OTELCOL_UNIT="$(root_path /etc/systemd/system/cinematacms-otelcol.service)"
install_managed_file "$SCRIPT_DIR/cinematacms-prometheus.service" "$PROMETHEUS_UNIT"
install_managed_file "$SCRIPT_DIR/cinematacms-otelcol.service" "$OTELCOL_UNIT"
if [ "$OBSERVABILITY_MODE" = "local" ]; then
    install_managed_file "$SCRIPT_DIR/prometheus-cinematacms.yml" "$CONFIG_DIR/prometheus.yml"
    install_managed_file "$SCRIPT_DIR/otelcol-contrib-cinematacms.yml" "$CONFIG_DIR/otelcol-contrib.yml"
fi

if ! nginx -t; then
    rollback
    echo "Error: nginx validation failed; restored the previous configuration" >&2
    exit 1
fi

APPLY_VALIDATED=true
trap - ERR

systemctl daemon-reload
if [ "$NO_RESTART" = false ]; then
    systemctl enable --now mediacms celery_long celery_short celery_whisper celery_beat
    if [ "$OBSERVABILITY_MODE" = "local" ]; then
        systemctl enable --now cinematacms-prometheus cinematacms-otelcol
    else
        systemctl disable --now cinematacms-prometheus cinematacms-otelcol >/dev/null 2>&1 || true
    fi
    systemctl enable nginx
    systemctl reload-or-restart nginx
fi

echo "Applied CinemataCMS release configuration."
echo "  domain=$DOMAIN"
echo "  proxy=$PROXY_MODE"
echo "  observability=$OBSERVABILITY_MODE"
echo "  backup=$BACKUP_DIR"
