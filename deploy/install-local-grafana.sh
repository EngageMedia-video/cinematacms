#!/bin/bash
set -euo pipefail

GRAFANA_VERSION="13.2.1"
PUBLIC_URL=""
ADMIN_PASSWORD_FILE="/etc/cinematacms/grafana-admin-password"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

fail() { echo "Error: $*" >&2; exit 1; }
usage() {
    cat <<'EOF'
Usage: sudo deploy/install-local-grafana.sh --public-url URL [--admin-password-file FILE]

Install Grafana beside the CinemataCMS local observability services.
Grafana listens on 127.0.0.1:3000 and requires an HTTPS public URL.
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --public-url) [ "$#" -ge 2 ] || fail "--public-url requires a value"; PUBLIC_URL="$2"; shift 2 ;;
        --admin-password-file) [ "$#" -ge 2 ] || fail "--admin-password-file requires a value"; ADMIN_PASSWORD_FILE="$2"; shift 2 ;;
        --help) usage; exit 0 ;;
        *) fail "unknown option: $1" ;;
    esac
done

[ "$(id -u)" -eq 0 ] || fail "run this command as root"
[ -n "$PUBLIC_URL" ] || fail "--public-url is required"
case "$PUBLIC_URL" in https://*) ;; *) fail "--public-url must use HTTPS" ;; esac
[ -s "$ADMIN_PASSWORD_FILE" ] || fail "admin password file is missing or empty: $ADMIN_PASSWORD_FILE"
chmod 0600 "$ADMIN_PASSWORD_FILE"
command -v curl >/dev/null 2>&1 || fail "curl is required"
command -v gpg >/dev/null 2>&1 || fail "gpg is required"
systemctl is-active --quiet cinematacms-prometheus \
    || fail "cinematacms-prometheus must be active; install with --observability local first"

install -d -m 0755 /etc/apt/keyrings
key_file="$(mktemp)"
trap 'rm -f "$key_file"' EXIT
curl -fsSL https://apt.grafana.com/gpg.key | gpg --dearmor > "$key_file"
install -m 0644 "$key_file" /etc/apt/keyrings/grafana.gpg
printf '%s\n' 'deb [signed-by=/etc/apt/keyrings/grafana.gpg] https://apt.grafana.com stable main' \
    > /etc/apt/sources.list.d/grafana.list
apt-get update
apt-get install -y "grafana=${GRAFANA_VERSION}"

install -d -m 0755 /etc/systemd/system/grafana-server.service.d
cat > /etc/systemd/system/grafana-server.service.d/cinematacms.conf <<EOF
[Service]
Environment="GF_SERVER_HTTP_ADDR=127.0.0.1"
Environment="GF_SERVER_HTTP_PORT=3000"
Environment="GF_SERVER_ROOT_URL=${PUBLIC_URL%/}/"
Environment="GF_AUTH_ANONYMOUS_ENABLED=false"
Environment="GF_USERS_ALLOW_SIGN_UP=false"
EOF

bootstrap_env="/run/cinematacms-grafana-admin.env"
install -m 0600 /dev/null "$bootstrap_env"
printf 'GF_SECURITY_ADMIN_PASSWORD=%s\n' "$(<"$ADMIN_PASSWORD_FILE")" > "$bootstrap_env"
cat >> /etc/systemd/system/grafana-server.service.d/cinematacms.conf <<EOF
EnvironmentFile=-${bootstrap_env}
EOF

install -d -m 0755 /etc/grafana/provisioning/datasources /etc/grafana/provisioning/dashboards
install -d -m 0755 /var/lib/grafana/dashboards/cinematacms
install -m 0644 "$SCRIPT_DIR/grafana/datasource.yml" /etc/grafana/provisioning/datasources/cinematacms.yml
install -m 0644 "$SCRIPT_DIR/grafana/dashboard-provider.yml" /etc/grafana/provisioning/dashboards/cinematacms.yml
install -m 0644 "$SCRIPT_DIR/grafana/overview.json" /var/lib/grafana/dashboards/cinematacms/overview.json

systemctl daemon-reload
systemctl enable grafana-server
systemctl restart grafana-server
for _ in $(seq 1 30); do
    curl -fsS http://127.0.0.1:3000/api/health >/dev/null && break
    sleep 1
done
curl -fsS http://127.0.0.1:3000/api/health >/dev/null || fail "Grafana did not become healthy"
systemctl stop grafana-server
grafana cli --homepath /usr/share/grafana --config /etc/grafana/grafana.ini \
    admin reset-admin-password --password-from-stdin < "$ADMIN_PASSWORD_FILE" >/dev/null
rm -f "$bootstrap_env"
sed -i "/EnvironmentFile=-${bootstrap_env}/d" /etc/systemd/system/grafana-server.service.d/cinematacms.conf
systemctl daemon-reload
systemctl start grafana-server
for _ in $(seq 1 30); do
    curl -fsS http://127.0.0.1:3000/api/health >/dev/null && break
    sleep 1
done
curl -fsS http://127.0.0.1:3000/api/health >/dev/null || fail "Grafana did not recover after setting the administrator password"
ss -lnt | grep -q '127.0.0.1:3000' || fail "Grafana is not bound to 127.0.0.1:3000"
echo "Grafana is ready at ${PUBLIC_URL%/}/ after you configure the HTTPS reverse proxy."
