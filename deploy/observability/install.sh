#!/usr/bin/env bash
set -Eeuo pipefail

on_error() {
  local status="$?"
  printf 'ERROR: installer failed at line %s in %s (status %s)\n' \
    "${BASH_LINENO[0]:-unknown}" "${FUNCNAME[1]:-main}" "$status" >&2
  exit "$status"
}

trap on_error ERR

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_DIR="${SCRIPT_DIR}/templates"
INSTALL_ROOT="/opt/cinematacms-observability"
BIN_DIR="${INSTALL_ROOT}/bin"
ETC_DIR="/etc/cinematacms-observability"
ENV_FILE=""
VERIFY_ONLY=0

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

usage() {
  cat <<'EOF'
Usage: sudo deploy/observability/install.sh [--env FILE] [--verify-only]

Installs and verifies all observability phases in one stack:
metrics, logs, external exporters, traces, alerting, and Grafana provisioning.
Production-specific values belong in a root-readable environment file.
Setup guide: https://github.com/EngageMedia-video/cinematacms/wiki/Self-hosted-Observability
EOF
}

parse_args() {
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --env)
        ENV_FILE="${2:-}"
        [[ -n "$ENV_FILE" ]] || fail "--env requires a file"
        shift 2
        ;;
      --verify-only) VERIFY_ONLY=1; shift ;;
      -h|--help) usage; exit 0 ;;
      *) fail "unknown argument: $1" ;;
    esac
  done
}

load_config() {
  # shellcheck source=/dev/null
  source "${SCRIPT_DIR}/manifest.env"
  if [[ -n "$ENV_FILE" ]]; then
    [[ -f "$ENV_FILE" ]] || fail "environment file not found: $ENV_FILE"
    # shellcheck source=/dev/null
    source "$ENV_FILE"
  fi
  APP_METRICS_PORT="${APP_METRICS_PORT:-8001}"
  [[ "$APP_METRICS_PORT" =~ ^[0-9]+$ ]] \
    && (( APP_METRICS_PORT >= 1 && APP_METRICS_PORT <= 65535 )) \
    || fail "APP_METRICS_PORT must be between 1 and 65535"
  APP_LOG_PATH="${APP_LOG_PATH:-/home/cinemata/cinematacms/logs/app.json.log}"
  APP_SERVICE_LOG_DIR="${APP_SERVICE_LOG_DIR:-$(dirname "$APP_LOG_PATH")}"
  EXTERNAL_HEALTH_URL="${EXTERNAL_HEALTH_URL:-http://127.0.0.1:${APP_METRICS_PORT}/metrics}"
  OBSERVABILITY_ENVIRONMENT="${OBSERVABILITY_ENVIRONMENT:-production}"
  METRICS_RETENTION="${METRICS_RETENTION:-90d}"
  LOGS_RETENTION="${LOGS_RETENTION:-30d}"
  TRACES_RETENTION="${TRACES_RETENTION:-14d}"
  VICTORIAMETRICS_PORT="${VICTORIAMETRICS_PORT:-8428}"
  VICTORIALOGS_PORT="${VICTORIALOGS_PORT:-9428}"
  VICTORIATRACES_PORT="${VICTORIATRACES_PORT:-10428}"
  ALERTMANAGER_PORT="${ALERTMANAGER_PORT:-9093}"
  VMALERT_PORT="${VMALERT_PORT:-8880}"
  GRAFANA_URL="${GRAFANA_URL:-http://127.0.0.1:3000}"
  GRAFANA_API_TOKEN="${GRAFANA_API_TOKEN:-}"
  INCIDENT_REFERENCE_LOOKUP_URL="${INCIDENT_REFERENCE_LOOKUP_URL:-http://127.0.0.1:${APP_METRICS_PORT}/internal/observability/references}"
  INCIDENT_REFERENCE_LOOKUP_ORIGIN="${INCIDENT_REFERENCE_LOOKUP_ORIGIN:-http://127.0.0.1:${APP_METRICS_PORT}}"
  INCIDENT_REFERENCE_LOOKUP_TOKEN="${INCIDENT_REFERENCE_LOOKUP_TOKEN:-}"
  POSTGRES_DSN="${POSTGRES_DSN:-postgresql://cinematacms_monitor@127.0.0.1:5432/mediacms?sslmode=disable}"
  POSTGRES_MONITOR_PASSWORD="${POSTGRES_MONITOR_PASSWORD:-}"
  REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379/1}"
  SMTP_SMARTHOST="${SMTP_SMARTHOST:-127.0.0.1:25}"
  SMTP_FROM="${SMTP_FROM:-disabled@example.invalid}"
  SMTP_USER="${SMTP_USER:-}"
  SMTP_PASSWORD="${SMTP_PASSWORD:-}"
  SMTP_TO="${SMTP_TO:-disabled@example.invalid}"
  if [[ "$SMTP_TO" == "disabled@example.invalid" ]]; then
    # Used indirectly by render_file.
    # shellcheck disable=SC2034
    ALERT_RECEIVER="null"
  else
    # Used indirectly by render_file.
    # shellcheck disable=SC2034
    ALERT_RECEIVER="email"
  fi
  export APP_METRICS_PORT APP_LOG_PATH EXTERNAL_HEALTH_URL OBSERVABILITY_ENVIRONMENT
  export VICTORIAMETRICS_PORT VICTORIALOGS_PORT VICTORIATRACES_PORT
  export ALERTMANAGER_PORT VMALERT_PORT GRAFANA_URL GRAFANA_API_TOKEN
  export INCIDENT_REFERENCE_LOOKUP_URL INCIDENT_REFERENCE_LOOKUP_ORIGIN INCIDENT_REFERENCE_LOOKUP_TOKEN
  [[ -n "$INCIDENT_REFERENCE_LOOKUP_TOKEN" ]] \
    || fail "INCIDENT_REFERENCE_LOOKUP_TOKEN is required"
  [[ -n "$GRAFANA_API_TOKEN" ]] || fail "GRAFANA_API_TOKEN is required"
  python3 - "$INCIDENT_REFERENCE_LOOKUP_URL" <<'PY' \
    || fail "reference lookup URL must use loopback HTTP or HTTPS"
import ipaddress
import sys
from urllib.parse import urlparse

parsed = urlparse(sys.argv[1])
is_https = parsed.scheme == "https"
try:
    is_loopback = ipaddress.ip_address(parsed.hostname or "").is_loopback
except ValueError:
    is_loopback = parsed.hostname == "localhost"
raise SystemExit(0 if is_https or (parsed.scheme == "http" and is_loopback) else 1)
PY
  python3 - "$GRAFANA_URL" <<'PY' \
    || fail "GRAFANA_URL must use loopback HTTP or HTTPS"
import ipaddress
import sys
from urllib.parse import urlparse

parsed = urlparse(sys.argv[1])
try:
    is_loopback = ipaddress.ip_address(parsed.hostname or "").is_loopback
except ValueError:
    is_loopback = parsed.hostname == "localhost"
raise SystemExit(0 if parsed.scheme == "https" or (parsed.scheme == "http" and is_loopback) else 1)
PY
}

require_managed_application_mode() {
  if systemctl is-active --quiet cinematacms-prometheus; then
    fail "the local starter Prometheus service is active; switch CinemataCMS to --observability managed before installing the full stack"
  fi
}

architecture() {
  case "$(dpkg --print-architecture)" in
    amd64) printf 'amd64' ;;
    arm64) printf 'arm64' ;;
    *) fail "supported architectures are amd64 and arm64" ;;
  esac
}

checksum_for() {
  local prefix="$1" arch="$2" variable
  variable="${prefix}_${arch^^}_SHA256"
  printf '%s' "${!variable}"
}

install_archive_binary() {
  local name="$1" version="$2" url="$3" checksum="$4" archive_name="$5"
  local marker="${INSTALL_ROOT}/.${name}.version" temporary archive found
  if [[ -x "${BIN_DIR}/${name}" && -f "$marker" ]] && grep -qx "$version" "$marker"; then
    return
  fi
  temporary="$(mktemp -d)"
  archive="${temporary}/archive.tar.gz"
  curl -fsSL "$url" -o "$archive"
  printf '%s  %s\n' "$checksum" "$archive" | sha256sum --check --status \
    || fail "checksum mismatch for $name"
  tar -xzf "$archive" -C "$temporary"
  found="$(find "$temporary" -type f -name "$archive_name" -print -quit)"
  [[ -n "$found" ]] || fail "$archive_name not found in $url"
  install -D -m 0755 "$found" "${BIN_DIR}/${name}"
  printf '%s\n' "$version" > "$marker"
  rm -rf "$temporary"
}

install_binaries() {
  local arch checksum base
  arch="$(architecture)"
  install_otelcol

  checksum="$(checksum_for VICTORIAMETRICS "$arch")"
  base="https://github.com/VictoriaMetrics/VictoriaMetrics/releases/download/${VICTORIAMETRICS_VERSION}"
  install_archive_binary victoria-metrics-prod "$VICTORIAMETRICS_VERSION" \
    "${base}/victoria-metrics-linux-${arch}-${VICTORIAMETRICS_VERSION}.tar.gz" "$checksum" victoria-metrics-prod

  checksum="$(checksum_for VICTORIALOGS "$arch")"
  base="https://github.com/VictoriaMetrics/VictoriaLogs/releases/download/${VICTORIALOGS_VERSION}"
  install_archive_binary victoria-logs-prod "$VICTORIALOGS_VERSION" \
    "${base}/victoria-logs-linux-${arch}-${VICTORIALOGS_VERSION}.tar.gz" "$checksum" victoria-logs-prod

  checksum="$(checksum_for VICTORIATRACES "$arch")"
  base="https://github.com/VictoriaMetrics/VictoriaTraces/releases/download/${VICTORIATRACES_VERSION}"
  install_archive_binary victoria-traces-prod "$VICTORIATRACES_VERSION" \
    "${base}/victoria-traces-linux-${arch}-${VICTORIATRACES_VERSION}.tar.gz" "$checksum" victoria-traces-prod

  checksum="$(checksum_for VMUTILS "$arch")"
  base="https://github.com/VictoriaMetrics/VictoriaMetrics/releases/download/${VMUTILS_VERSION}"
  install_archive_binary vmalert-prod "$VMUTILS_VERSION" \
    "${base}/vmutils-linux-${arch}-${VMUTILS_VERSION}.tar.gz" "$checksum" vmalert-prod
  install_archive_binary vmalert-tool-prod "$VMUTILS_VERSION" \
    "${base}/vmutils-linux-${arch}-${VMUTILS_VERSION}.tar.gz" "$checksum" vmalert-tool-prod

  checksum="$(checksum_for ALERTMANAGER "$arch")"
  base="https://github.com/prometheus/alertmanager/releases/download/${ALERTMANAGER_VERSION}"
  install_archive_binary alertmanager "$ALERTMANAGER_VERSION" \
    "${base}/alertmanager-${ALERTMANAGER_VERSION#v}.linux-${arch}.tar.gz" "$checksum" alertmanager
  install_archive_binary amtool "$ALERTMANAGER_VERSION" \
    "${base}/alertmanager-${ALERTMANAGER_VERSION#v}.linux-${arch}.tar.gz" "$checksum" amtool

  checksum="$(checksum_for POSTGRES_EXPORTER "$arch")"
  base="https://github.com/prometheus-community/postgres_exporter/releases/download/${POSTGRES_EXPORTER_VERSION}"
  install_archive_binary postgres_exporter "$POSTGRES_EXPORTER_VERSION" \
    "${base}/postgres_exporter-${POSTGRES_EXPORTER_VERSION#v}.linux-${arch}.tar.gz" "$checksum" postgres_exporter

  checksum="$(checksum_for REDIS_EXPORTER "$arch")"
  base="https://github.com/oliver006/redis_exporter/releases/download/${REDIS_EXPORTER_VERSION}"
  install_archive_binary redis_exporter "$REDIS_EXPORTER_VERSION" \
    "${base}/redis_exporter-${REDIS_EXPORTER_VERSION}.linux-${arch}.tar.gz" "$checksum" redis_exporter

  checksum="$(checksum_for NGINX_EXPORTER "$arch")"
  base="https://github.com/nginx/nginx-prometheus-exporter/releases/download/${NGINX_EXPORTER_VERSION}"
  install_archive_binary nginx-prometheus-exporter "$NGINX_EXPORTER_VERSION" \
    "${base}/nginx-prometheus-exporter_${NGINX_EXPORTER_VERSION#v}_linux_${arch}.tar.gz" "$checksum" nginx-prometheus-exporter

  install_celery_exporter
}

install_otelcol() {
  local arch checksum package temporary
  if command -v otelcol-contrib >/dev/null 2>&1 \
    && otelcol-contrib --version | grep -q "${OTELCOL_VERSION}"; then
    return
  fi
  arch="$(architecture)"
  checksum="$(checksum_for OTELCOL "$arch")"
  temporary="$(mktemp -d)"
  package="${temporary}/otelcol-contrib.deb"
  curl -fsSL "https://github.com/open-telemetry/opentelemetry-collector-releases/releases/download/v${OTELCOL_VERSION}/otelcol-contrib_${OTELCOL_VERSION}_linux_${arch}.deb" -o "$package"
  printf '%s  %s\n' "$checksum" "$package" | sha256sum --check --status \
    || fail "OpenTelemetry Collector checksum mismatch"
  DEBIAN_FRONTEND=noninteractive apt-get install -y "$package"
  rm -rf "$temporary"
}

install_celery_exporter() {
  local venv="${INSTALL_ROOT}/celery-exporter" installed_version=""
  if [[ -x "${venv}/bin/python" ]]; then
    installed_version="$("${venv}/bin/python" -m pip show prometheus-exporter-celery 2>/dev/null \
      | sed -n 's/^Version: //p' || true)"
  fi
  if [[ "$installed_version" == "$CELERY_EXPORTER_VERSION" ]]; then
    return
  fi
  DEBIAN_FRONTEND=noninteractive apt-get install -y python3-venv
  python3 -m venv "$venv"
  "${venv}/bin/python" -m pip install --disable-pip-version-check \
    "prometheus-exporter-celery @ https://github.com/danihodovic/celery-exporter/archive/${CELERY_EXPORTER_COMMIT}.tar.gz"
}

render_file() {
  local src="$1" dest="$2" content variable encoded
  content="$(<"$src")"
  for variable in ALERT_RECEIVER SMTP_SMARTHOST SMTP_FROM SMTP_USER SMTP_PASSWORD SMTP_TO INCIDENT_REFERENCE_LOOKUP_URL INCIDENT_REFERENCE_LOOKUP_ORIGIN INCIDENT_REFERENCE_LOOKUP_TOKEN; do
    encoded="$(python3 -c 'import json, sys; print(json.dumps(sys.argv[1]))' "${!variable}")"
    content="${content//\$\{$variable\}/$encoded}"
  done
  printf '%s\n' "$content" > "$dest"
}

write_environment_files() {
  {
    printf 'APP_METRICS_PORT=%q\n' "$APP_METRICS_PORT"
    printf 'APP_LOG_PATH=%q\n' "$APP_LOG_PATH"
    printf 'APP_SERVICE_LOG_DIR=%q\n' "$APP_SERVICE_LOG_DIR"
    printf 'EXTERNAL_HEALTH_URL=%q\n' "$EXTERNAL_HEALTH_URL"
    printf 'OBSERVABILITY_ENVIRONMENT=%q\n' "$OBSERVABILITY_ENVIRONMENT"
    printf 'VICTORIAMETRICS_PORT=%q\n' "$VICTORIAMETRICS_PORT"
    printf 'VICTORIALOGS_PORT=%q\n' "$VICTORIALOGS_PORT"
    printf 'VICTORIATRACES_PORT=%q\n' "$VICTORIATRACES_PORT"
    printf 'ALERTMANAGER_PORT=%q\n' "$ALERTMANAGER_PORT"
    printf 'VMALERT_PORT=%q\n' "$VMALERT_PORT"
    printf 'LOGS_RETENTION=%q\n' "$LOGS_RETENTION"
    printf 'TRACES_RETENTION=%q\n' "$TRACES_RETENTION"
  } > "${ETC_DIR}/stack.env"
  printf 'DATA_SOURCE_NAME=%q\n' "$POSTGRES_DSN" > "${ETC_DIR}/postgres-exporter.env"
  printf 'REDIS_ADDR=%q\n' "$REDIS_URL" > "${ETC_DIR}/redis-exporter.env"
  printf 'CE_BROKER_URL=%q\n' "$REDIS_URL" > "${ETC_DIR}/celery-exporter.env"
  rm -f "${ETC_DIR}/exporters.env"
  chown root:otelcol-contrib "${ETC_DIR}/stack.env"
  chown root:cinematacms-postgres-exporter "${ETC_DIR}/postgres-exporter.env"
  chown root:cinematacms-redis-exporter "${ETC_DIR}/redis-exporter.env"
  chown root:cinematacms-celery-exporter "${ETC_DIR}/celery-exporter.env"
  chmod 0640 "${ETC_DIR}/stack.env" "${ETC_DIR}"/*-exporter.env
}

install_configuration() {
  getent group cinematacms-observability >/dev/null 2>&1 || groupadd --system cinematacms-observability
  id -u cinematacms-observability >/dev/null 2>&1 \
    || useradd --system --gid cinematacms-observability --home-dir /var/lib/cinematacms-observability --shell /usr/sbin/nologin cinematacms-observability
  local identity
  for identity in cinematacms-alertmanager cinematacms-postgres-exporter cinematacms-redis-exporter cinematacms-celery-exporter; do
    getent group "$identity" >/dev/null 2>&1 || groupadd --system "$identity"
    id -u "$identity" >/dev/null 2>&1 \
      || useradd --system --gid "$identity" --home-dir /nonexistent --shell /usr/sbin/nologin "$identity"
  done
  usermod -a -G systemd-journal otelcol-contrib
  usermod -a -G cinematacms-observability otelcol-contrib
  getent group adm >/dev/null 2>&1 && usermod -a -G adm otelcol-contrib
  prepare_application_log
  prepare_service_logs
  install -d -m 0755 "$BIN_DIR"
  install -d -m 0755 -o root -g root "$ETC_DIR"
  install -d -m 0750 -o otelcol-contrib -g otelcol-contrib /var/lib/otelcol-contrib/cinematacms
  local directory
  for directory in victoriametrics victorialogs victoriatraces; do
    install -d -m 0750 -o cinematacms-observability -g cinematacms-observability "/var/lib/${directory}"
  done
  install -d -m 0750 -o cinematacms-alertmanager -g cinematacms-alertmanager /var/lib/alertmanager
  write_environment_files
  install -m 0640 -o root -g otelcol-contrib "${TEMPLATE_DIR}/otelcol.yml" "${ETC_DIR}/otelcol.yml"
  install -d -m 0755 "${ETC_DIR}/rules"
  install -m 0644 "${TEMPLATE_DIR}/alerts.yml" "${ETC_DIR}/rules/alerts.yml"
  install -m 0644 "${TEMPLATE_DIR}/alerts-tests.yml" "${ETC_DIR}/rules/alerts-tests.yml"
  install -m 0644 "${SCRIPT_DIR}/celery_exporter_runner.py" "${INSTALL_ROOT}/celery_exporter_runner.py"
  render_file "${TEMPLATE_DIR}/alertmanager.yml" "${ETC_DIR}/alertmanager.yml"
  chown root:cinematacms-alertmanager "${ETC_DIR}/alertmanager.yml"
  chmod 0640 "${ETC_DIR}/alertmanager.yml"

  local template
  for template in victoriametrics victorialogs victoriatraces cinematacms-otelcol postgres-exporter redis-exporter nginx-prometheus-exporter celery-exporter alertmanager vmalert; do
    install -m 0644 "${TEMPLATE_DIR}/${template}.service" "/etc/systemd/system/${template}.service"
  done
  render_victoriametrics_unit
  install_grafana_provisioning
  if command -v nginx >/dev/null 2>&1; then
    install -m 0644 "${TEMPLATE_DIR}/nginx-stub-status.conf" /etc/nginx/conf.d/cinematacms-observability.conf
    render_nginx_app_metrics
    nginx -t
  fi
  configure_postgres_monitor_role
}

prepare_application_log() {
  local log_directory
  log_directory="$(dirname "$APP_LOG_PATH")"
  install -d -m 0750 -o www-data -g cinematacms-observability "$log_directory"
  touch "$APP_LOG_PATH"
  chown www-data:cinematacms-observability "$APP_LOG_PATH"
  chmod 0640 "$APP_LOG_PATH"
}

prepare_service_logs() {
  local filename path
  install -d -m 0750 -o www-data -g cinematacms-observability "$APP_SERVICE_LOG_DIR"
  for filename in errorlog.txt celery_long.log celery_short.log celery_whisper.log celery_email.log beatcelery_beat.log; do
    path="${APP_SERVICE_LOG_DIR}/${filename}"
    touch "$path"
    chown www-data:cinematacms-observability "$path"
    chmod 0640 "$path"
  done
}

render_nginx_app_metrics() {
  local content
  content="$(<"${TEMPLATE_DIR}/nginx-app-metrics.conf")"
  content="${content//\$\{APP_METRICS_PORT\}/$APP_METRICS_PORT}"
  printf '%s\n' "$content" > /etc/nginx/conf.d/cinematacms-app-metrics.conf
}

configure_postgres_monitor_role() {
  [[ -n "$POSTGRES_MONITOR_PASSWORD" ]] || return 0
  command -v psql >/dev/null 2>&1 || return 0
  runuser -u postgres -- psql -v ON_ERROR_STOP=1 \
    --set="monitor_password=${POSTGRES_MONITOR_PASSWORD}" \
    --file="${TEMPLATE_DIR}/postgres-monitor-role.sql" postgres
}

render_victoriametrics_unit() {
  local content
  content="$(<"${TEMPLATE_DIR}/victoriametrics.service")"
  content="${content//\$\{VICTORIAMETRICS_PORT\}/$VICTORIAMETRICS_PORT}"
  content="${content//\$\{METRICS_RETENTION\}/$METRICS_RETENTION}"
  printf '%s\n' "$content" > /etc/systemd/system/victoriametrics.service
}

install_grafana_provisioning() {
  command -v grafana >/dev/null 2>&1 \
    || fail "Grafana must be installed before provisioning the dashboard"
  install -d -m 0755 /etc/grafana/provisioning/datasources /etc/grafana/provisioning/dashboards
  install -d -m 0755 /var/lib/grafana/dashboards/cinematacms
  # The starter installer uses the same dashboard directory. Retire its provider
  # before installing ours so Grafana does not provision each file twice.
  rm -f /etc/grafana/provisioning/dashboards/cinematacms.yml
  # The starter Prometheus datasource is also marked as default. Remove its
  # provisioning file before VictoriaMetrics becomes the default datasource.
  rm -f /etc/grafana/provisioning/datasources/cinematacms.yml
  render_file "${TEMPLATE_DIR}/grafana-datasources.yml" /etc/grafana/provisioning/datasources/cinematacms-observability.yml
  chown root:grafana /etc/grafana/provisioning/datasources/cinematacms-observability.yml
  chmod 0640 /etc/grafana/provisioning/datasources/cinematacms-observability.yml
  install -m 0644 "${TEMPLATE_DIR}/grafana-dashboard-provider.yml" /etc/grafana/provisioning/dashboards/cinematacms-observability.yml
  install -m 0644 "${TEMPLATE_DIR}/grafana-logs.json" /var/lib/grafana/dashboards/cinematacms/logs.json
  install -m 0644 "${TEMPLATE_DIR}/grafana-overview.json" /var/lib/grafana/dashboards/cinematacms/overview.json
  install -m 0644 "${TEMPLATE_DIR}/grafana-traces.json" /var/lib/grafana/dashboards/cinematacms/traces.json
  install -m 0644 "${TEMPLATE_DIR}/grafana-incidents.json" /var/lib/grafana/dashboards/cinematacms/incidents.json
  install -m 0644 "${TEMPLATE_DIR}/grafana-server-health.json" /var/lib/grafana/dashboards/cinematacms/server-health.json
  if ! grafana cli --homepath /usr/share/grafana plugins ls 2>/dev/null \
    | grep -q 'victoriametrics-logs-datasource'; then
    grafana cli --homepath /usr/share/grafana plugins install victoriametrics-logs-datasource
  fi
  if ! grafana cli --homepath /usr/share/grafana plugins ls 2>/dev/null \
    | grep -q 'yesoreyeram-infinity-datasource'; then
    grafana cli --homepath /usr/share/grafana plugins install yesoreyeram-infinity-datasource
  fi
}

validate_configuration() {
  /usr/bin/otelcol-contrib validate --config="${ETC_DIR}/otelcol.yml"
  "${BIN_DIR}/amtool" check-config "${ETC_DIR}/alertmanager.yml"
  "${BIN_DIR}/vmalert-prod" -rule="${ETC_DIR}/rules/alerts.yml" -dryRun
  (
    cd "${ETC_DIR}/rules"
    "${BIN_DIR}/vmalert-tool-prod" unittest --files alerts-tests.yml
  )
  python3 -m json.tool "${TEMPLATE_DIR}/grafana-overview.json" >/dev/null
  python3 -m json.tool "${TEMPLATE_DIR}/grafana-logs.json" >/dev/null
  python3 -m json.tool "${TEMPLATE_DIR}/grafana-traces.json" >/dev/null
  python3 -m json.tool "${TEMPLATE_DIR}/grafana-incidents.json" >/dev/null
  systemd-analyze verify \
    /etc/systemd/system/victoriametrics.service \
    /etc/systemd/system/victorialogs.service \
    /etc/systemd/system/victoriatraces.service \
    /etc/systemd/system/cinematacms-otelcol.service \
    /etc/systemd/system/postgres-exporter.service \
    /etc/systemd/system/redis-exporter.service \
    /etc/systemd/system/nginx-prometheus-exporter.service \
    /etc/systemd/system/celery-exporter.service \
    /etc/systemd/system/alertmanager.service \
    /etc/systemd/system/vmalert.service
}

start_services() {
  systemctl disable --now otelcol-contrib.service >/dev/null 2>&1 || true
  systemctl daemon-reload
  systemctl enable --now victoriametrics victorialogs victoriatraces
  command -v nginx >/dev/null 2>&1 && systemctl reload nginx
  systemctl enable --now postgres-exporter redis-exporter nginx-prometheus-exporter celery-exporter
  systemctl enable --now alertmanager vmalert cinematacms-otelcol
  systemctl restart victoriametrics victorialogs victoriatraces
  systemctl restart postgres-exporter redis-exporter nginx-prometheus-exporter celery-exporter
  systemctl restart alertmanager vmalert cinematacms-otelcol
  systemctl enable grafana-server
  systemctl restart grafana-server
}

wait_http() {
  local url="$1"
  for _ in $(seq 1 90); do
    curl --connect-timeout 5 --max-time 15 -fsS "$url" >/dev/null && return
    sleep 1
  done
  fail "timed out waiting for $url"
}

assert_endpoint_contains() {
  local url="$1" pattern="$2" message="$3" response
  response="$(curl --connect-timeout 5 --max-time 15 -fsS "$url")"
  grep -q "$pattern" <<<"$response" || fail "$message"
}

grafana_curl() {
  if [[ -n "$GRAFANA_API_TOKEN" ]]; then
    curl --connect-timeout 5 --max-time 15 -fsS -H "Authorization: Bearer ${GRAFANA_API_TOKEN}" "$@"
  else
    curl --connect-timeout 5 --max-time 15 -fsS "$@"
  fi
}

verify_grafana_provisioning() {
  local anonymous_status
  printf 'Verifying Grafana provisioning...\n'
  wait_http "${GRAFANA_URL}/api/health"
  anonymous_status="$(curl --connect-timeout 5 --max-time 15 -sS -o /dev/null -w '%{http_code}' "${GRAFANA_URL}/api/dashboards/uid/cinematacms-incidents")"
  [[ "$anonymous_status" == "401" || "$anonymous_status" == "403" ]] \
    || fail "anonymous Grafana dashboard access must be disabled"
  grafana_curl "${GRAFANA_URL}/api/dashboards/uid/cinematacms-observability" \
    | grep -q '"uid":"cinematacms-observability"' \
    || fail "Grafana did not provision the Cinemata dashboard or API access is not configured"
  grafana_curl "${GRAFANA_URL}/api/dashboards/uid/cinematacms-logs" \
    | grep -q '"uid":"cinematacms-logs"' \
    || fail "Grafana did not provision the Cinemata logs dashboard"
  grafana_curl "${GRAFANA_URL}/api/dashboards/uid/cinematacms-traces" \
    | grep -q '"uid":"cinematacms-traces"' \
    || fail "Grafana did not provision the Cinemata traces dashboard"
  grafana_curl "${GRAFANA_URL}/api/dashboards/uid/cinematacms-incidents" \
    | grep -q '"uid":"cinematacms-incidents"' \
    || fail "Grafana did not provision the Cinemata incident dashboard"
  grafana_curl "${GRAFANA_URL}/api/dashboards/uid/cinematacms-server-health" \
    | grep -q '"uid":"cinematacms-server-health"' \
    || fail "Grafana did not provision the Cinemata server health dashboard"
  local datasource
  for datasource in victoriametrics victorialogs victoriatraces incident-reference-lookup; do
    grafana_curl "${GRAFANA_URL}/api/datasources/uid/${datasource}" \
      | grep -q "\"uid\":\"${datasource}\"" \
      || fail "Grafana did not provision datasource: ${datasource}"
  done
}

verify_metric_ingestion() {
  printf 'Verifying metric ingestion...\n'
  local names
  for _ in $(seq 1 12); do
    names="$(curl --connect-timeout 5 --max-time 15 -fsS "http://127.0.0.1:${VICTORIAMETRICS_PORT}/api/v1/label/__name__/values")"
    if grep -q 'cinematacms_' <<<"$names" \
      && grep -q 'otelcol_' <<<"$names" \
      && grep -q 'system.cpu.time' <<<"$names" \
      && grep -q 'system.disk.io' <<<"$names" \
      && grep -q 'node_filesystem_avail_bytes' <<<"$names" \
      && grep -q 'system.network.io' <<<"$names" \
      && grep -q 'system.uptime' <<<"$names"; then
      return
    fi
    sleep 5
  done
  fail "VictoriaMetrics did not ingest application, Collector, and host metrics"
}

verify_dashboard_queries() {
  printf 'Verifying dashboard queries...\n'
  python3 - "${TEMPLATE_DIR}/grafana-overview.json" "$VICTORIAMETRICS_PORT" <<'PY'
import json
import sys
import urllib.parse
import urllib.request

dashboard_path, port = sys.argv[1:]
with open(dashboard_path) as dashboard_file:
    dashboard = json.load(dashboard_file)

queries = (
    target["expr"].replace("$__rate_interval", "5m")
    for panel in dashboard["panels"]
    for target in panel.get("targets", [])
    if "expr" in target
)
for query in queries:
    parameters = urllib.parse.urlencode({"query": query})
    with urllib.request.urlopen(
        f"http://127.0.0.1:{port}/api/v1/query?{parameters}"
    ) as response:
        result = json.load(response)
    if result.get("status") != "success":
        raise RuntimeError(f"VictoriaMetrics rejected dashboard query: {query}")
PY
}

verify_log_dashboard_queries() {
  printf 'Verifying logs dashboard queries...\n'
  python3 - "${TEMPLATE_DIR}/grafana-logs.json" "$VICTORIALOGS_PORT" <<'PY'
import json
import sys
import urllib.parse
import urllib.request

dashboard_path, port = sys.argv[1:]
with open(dashboard_path) as dashboard_file:
    dashboard = json.load(dashboard_file)

paths = {
    "instant": "query",
    "stats": "stats_query",
    "statsRange": "stats_query_range",
}
for panel in dashboard["panels"]:
    for target in panel.get("targets", []):
        query = target["expr"].replace("${filter:raw}", "*").replace("$__interval", "5m")
        for variable in ("task_id", "delivery_uuid", "trace_id", "recipient_ref"):
            query = query.replace(f"${variable}", "installer-no-match")
        query_type = target["queryType"]
        parameters = {"query": query}
        if query_type == "instant":
            parameters["limit"] = "5"
        elif query_type == "statsRange":
            parameters.update(start="-6h", end="now", step="5m")
        url = (
            f"http://127.0.0.1:{port}/select/logsql/{paths[query_type]}?"
            + urllib.parse.urlencode(parameters)
        )
        with urllib.request.urlopen(url) as response:
            response.read(1)
PY
}

verify_log_ingestion() {
  printf 'Verifying readable log ingestion and privacy filtering...\n'
  local token="cinemata_observability_log_$RANDOM"
  local forbidden="forbidden_email_$RANDOM@example.invalid"
  local forbidden_body="forbidden_body_$RANDOM"
  local forbidden_nested="forbidden_nested_$RANDOM"
  local readable_task="${token}_readable"
  local readable_prefix="Worker completed installer diagnostic"
  local response
  [[ -f "$APP_LOG_PATH" ]] || fail "application log does not exist: $APP_LOG_PATH"
  runuser -u otelcol-contrib -- test -r "$APP_LOG_PATH" \
    || fail "Collector cannot read application log: $APP_LOG_PATH"
  printf '{"event":"%s","message":"%s","severity":"INFO","recipient_ref":"fixture-ref","email":"%s","context":{"token":"%s"}}\n' \
    "$token" "$forbidden_body" "$forbidden" "$forbidden_nested" >> "$APP_LOG_PATH"
  printf '{"message":"%s token=%s recipient=%s","name":"installer.fixture","level":"WARNING","task_id":"%s","operation":"installer_verification","outcome":"succeeded"}\n' \
    "$readable_prefix" "$forbidden_body" "$forbidden" "$readable_task" >> "$APP_LOG_PATH"
  for _ in $(seq 1 20); do
    response="$(curl -fsSG --data-urlencode "query=${token}" "http://127.0.0.1:${VICTORIALOGS_PORT}/select/logsql/query" || true)"
    if grep -q "$token" <<<"$response"; then
      for secret in "$forbidden" "$forbidden_body" "$forbidden_nested"; do
        response="$(curl -fsSG --data-urlencode "query=\"${secret}\"" "http://127.0.0.1:${VICTORIALOGS_PORT}/select/logsql/query" || true)"
        grep -q "$secret" <<<"$response" \
          && fail "VictoriaLogs stored forbidden log content"
      done
      response="$(curl -fsSG --data-urlencode "query=task_id:\"${readable_task}\"" "http://127.0.0.1:${VICTORIALOGS_PORT}/select/logsql/query" || true)"
      grep -q "$readable_prefix" <<<"$response" \
        || fail "VictoriaLogs discarded the readable log message"
      grep -q 'redacted' <<<"$response" \
        || fail "VictoriaLogs did not redact a secret-shaped message value"
      grep -q 'redacted-email' <<<"$response" \
        || fail "VictoriaLogs did not redact an email-shaped message value"
      grep -q '"severity_text":"WARN"' <<<"$response" \
        || fail "VictoriaLogs did not normalize application severity"
      grep -q '"level":"WARN"' <<<"$response" \
        || fail "VictoriaLogs did not expose Grafana-compatible application level"
      grep -q '"logger.name":"installer.fixture"' <<<"$response" \
        || fail "VictoriaLogs did not retain the application logger name"
      return 0
    fi
    sleep 2
  done
  fail "VictoriaLogs did not return the synthetic log"
}

verify_journal_ingestion() {
  [[ "$VERIFY_ONLY" -eq 0 ]] || return 0
  command -v nginx >/dev/null 2>&1 || return 0
  printf 'Verifying readable journald ingestion...\n'
  local response
  systemctl reload nginx
  for _ in $(seq 1 20); do
    response="$(curl -fsSG \
      --data-urlencode 'query=systemd.unit:"nginx.service" AND level:"INFO" AND _msg:~".*(signal process started|Reloaded A high performance).*"' \
      --data-urlencode 'limit=5' \
      "http://127.0.0.1:${VICTORIALOGS_PORT}/select/logsql/query" || true)"
    if grep -Eq 'signal process started|Reloaded A high performance' <<<"$response"; then
      grep -q '"systemd.unit":"nginx.service"' <<<"$response" \
        || fail "VictoriaLogs did not retain the journald unit"
      grep -q '"severity_text":"INFO"' <<<"$response" \
        || fail "VictoriaLogs did not normalize journald severity"
      grep -q '"level":"INFO"' <<<"$response" \
        || fail "VictoriaLogs did not expose Grafana-compatible journald level"
      grep -q 'cinematacms.structured_log' <<<"$response" \
        && fail "VictoriaLogs replaced the journald message with a placeholder"
      return 0
    fi
    sleep 2
  done
  fail "VictoriaLogs did not return the Nginx journald verification message"
}

verify_alerting() {
  printf 'Verifying Alertmanager routing...\n'
  local token="CinemataInstallerSynthetic$RANDOM" response
  curl -fsS -X POST -H 'Content-Type: application/json' \
    --data-binary "[{\"labels\":{\"alertname\":\"${token}\",\"severity\":\"info\"},\"annotations\":{\"summary\":\"Installer routing verification\"}}]" \
    "http://127.0.0.1:${ALERTMANAGER_PORT}/api/v2/alerts" >/dev/null
  response="$(curl -fsS "http://127.0.0.1:${ALERTMANAGER_PORT}/api/v2/alerts")"
  grep -q "$token" <<<"$response" || fail "Alertmanager did not return the synthetic alert"
}

verify_loopback_listeners() {
  printf 'Verifying loopback-only listeners...\n'
  command -v ss >/dev/null 2>&1 || return
  local port
  for port in "$VICTORIAMETRICS_PORT" "$VICTORIALOGS_PORT" "$VICTORIATRACES_PORT" \
    4317 4318 8888 13133 9187 9121 9113 9808 "$ALERTMANAGER_PORT" 9094 "$VMALERT_PORT"; do
    ss -ltnH "sport = :${port}" | awk '{print $4}' | grep -Eq '127\.0\.0\.1:' \
      || fail "expected loopback listener is missing on port ${port}"
    if ss -ltnH "sport = :${port}" | awk '{print $4}' | grep -Eq '(0\.0\.0\.0:|\[::\]:|\*:)'; then
      fail "public listener detected on port ${port}"
    fi
  done
}

verify_trace_ingestion() {
  printf 'Verifying trace ingestion, incident context, and log correlation...\n'
  local trace_id="11111111111111111111111111111111" now response log_response
  now="$(date +%s)000000000"
  response="$(mktemp)"
  log_response="$(mktemp)"
  curl -fsS -X POST -H 'Content-Type: application/json' \
    --data-binary "{\"resourceSpans\":[{\"resource\":{\"attributes\":[{\"key\":\"service.name\",\"value\":{\"stringValue\":\"CinemataCMS/email\"}}]},\"scopeSpans\":[{\"scope\":{\"name\":\"installer\"},\"spans\":[{\"traceId\":\"${trace_id}\",\"spanId\":\"2222222222222222\",\"name\":\"email.delivery\",\"kind\":1,\"startTimeUnixNano\":\"${now}\",\"endTimeUnixNano\":\"${now}\",\"status\":{\"code\":2},\"attributes\":[{\"key\":\"cinematacms.actor_ref\",\"value\":{\"stringValue\":\"v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}},{\"key\":\"domain.operation\",\"value\":{\"stringValue\":\"email_delivery\"}},{\"key\":\"domain.outcome\",\"value\":{\"stringValue\":\"failed\"}},{\"key\":\"email.recipient_ref\",\"value\":{\"stringValue\":\"fixture-ref\"}}]}]}]}]}" \
    http://127.0.0.1:4318/v1/traces >/dev/null
  curl -fsS -X POST -H 'Content-Type: application/json' \
    --data-binary "{\"resourceLogs\":[{\"resource\":{\"attributes\":[{\"key\":\"service.name\",\"value\":{\"stringValue\":\"CinemataCMS/email\"}}]},\"scopeLogs\":[{\"scope\":{\"name\":\"installer\"},\"logRecords\":[{\"timeUnixNano\":\"${now}\",\"severityText\":\"ERROR\",\"body\":{\"stringValue\":\"incident correlation fixture\"},\"traceId\":\"${trace_id}\",\"spanId\":\"2222222222222222\",\"attributes\":[{\"key\":\"actor_ref\",\"value\":{\"stringValue\":\"v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\"}}]}]}]}]}" \
    http://127.0.0.1:4318/v1/logs >/dev/null
  for _ in $(seq 1 20); do
    if curl -fsS "http://127.0.0.1:${VICTORIATRACES_PORT}/select/jaeger/api/traces/${trace_id}" -o "$response" \
      && grep -q "$trace_id" "$response" \
      && grep -q '"key":"domain.operation"' "$response" \
      && grep -q '"value":"email_delivery"' "$response" \
      && grep -q '"key":"email.recipient_ref"' "$response" \
      && grep -q '"key":"cinematacms.actor_ref"' "$response" \
      && curl -fsS -G "http://127.0.0.1:${VICTORIALOGS_PORT}/select/logsql/query" \
        --data-urlencode "query=trace_id:\"${trace_id}\" AND actor_ref:\"v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\" AND _msg:\"incident correlation fixture\"" \
        --data-urlencode 'limit=5' -o "$log_response" \
      && grep -q 'incident correlation fixture' "$log_response"; then
      grep -q '"actor_ref":"v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"' "$log_response" \
        || fail "VictoriaLogs discarded the pseudonymous actor reference"
      rm -f "$response" "$log_response"
      return
    fi
    sleep 2
  done
  rm -f "$response" "$log_response"
  fail "VictoriaTraces and VictoriaLogs did not return correlated incident context"
}

verify_installation() {
  printf 'Verifying service and endpoint health...\n'
  local service endpoint
  for service in victoriametrics victorialogs victoriatraces cinematacms-otelcol postgres-exporter redis-exporter nginx-prometheus-exporter celery-exporter alertmanager vmalert grafana-server; do
    systemctl is-active --quiet "$service" || fail "service is not active: $service"
  done
  for endpoint in \
    "http://127.0.0.1:${VICTORIAMETRICS_PORT}/health" \
    "http://127.0.0.1:${VICTORIALOGS_PORT}/health" \
    "http://127.0.0.1:${VICTORIATRACES_PORT}/health" \
    "http://127.0.0.1:13133/" \
    "http://127.0.0.1:9187/metrics" \
    "http://127.0.0.1:9121/metrics" \
    "http://127.0.0.1:9113/metrics" \
    "http://127.0.0.1:9808/metrics" \
    "http://127.0.0.1:${APP_METRICS_PORT}/metrics" \
    "http://127.0.0.1:${ALERTMANAGER_PORT}/-/ready" \
    "http://127.0.0.1:${VMALERT_PORT}/metrics"; do
    wait_http "$endpoint"
  done
  assert_endpoint_contains http://127.0.0.1:9187/metrics '^pg_up 1$' \
    "PostgreSQL exporter cannot query PostgreSQL"
  assert_endpoint_contains http://127.0.0.1:9121/metrics '^redis_up 1$' \
    "Redis exporter cannot query Redis"
  assert_endpoint_contains http://127.0.0.1:9113/metrics '^nginx_up 1$' \
    "Nginx exporter cannot query stub_status"
  assert_endpoint_contains http://127.0.0.1:9808/metrics '^# HELP celery_task_sent_total' \
    "Celery exporter did not expose its metric contract"
  assert_endpoint_contains "http://127.0.0.1:${APP_METRICS_PORT}/metrics" '^# HELP cinematacms_' \
    "CinemataCMS did not expose its metric contract on the loopback listener"
  verify_metric_ingestion
  verify_dashboard_queries
  verify_log_dashboard_queries
  verify_grafana_provisioning
  verify_log_ingestion
  verify_journal_ingestion
  verify_trace_ingestion
  verify_alerting
  verify_loopback_listeners
}

main() {
  parse_args "$@"
  [[ "$(id -u)" -eq 0 ]] || fail "run as root"
  load_config
  require_managed_application_mode
  if [[ "$VERIFY_ONLY" -eq 0 ]]; then
    DEBIAN_FRONTEND=noninteractive apt-get update
    DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl prometheus-node-exporter python3 python3-venv
    install -d -m 0755 "$BIN_DIR"
    getent group cinematacms-observability >/dev/null 2>&1 || groupadd --system cinematacms-observability
    id -u cinematacms-observability >/dev/null 2>&1 \
      || useradd --system --gid cinematacms-observability --home-dir /var/lib/cinematacms-observability --shell /usr/sbin/nologin cinematacms-observability
    install_binaries
    install_configuration
    validate_configuration
    start_services
  fi
  verify_installation
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
