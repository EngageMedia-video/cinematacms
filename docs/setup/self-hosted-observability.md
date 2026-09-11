# Install self-hosted observability

This tutorial adds Prometheus, an OpenTelemetry Collector, and Grafana to a
single-server CinemataCMS installation. Grafana will show application traffic,
errors, latency, Celery queues, and beat freshness.

The starter profile stores metrics on the application server. The Collector
writes trace summaries to the systemd journal. Use an external OTLP backend if
you need searchable traces or centralized logs.

## Before you start

Complete the standard Ubuntu 22.04 installation first. You also need root
access, an HTTPS hostname for Grafana, and at least 2 GB of free disk space.
Point the Grafana hostname to the server before you begin.

Run each command from the CinemataCMS checkout.

## Install application telemetry

```bash
sudo ./deploy/apply-release-config.sh --observability local
sudo systemctl is-active cinematacms-prometheus cinematacms-otelcol
curl --fail http://127.0.0.1:9090/-/healthy
```

Both services must report `active`. Prometheus listens on `127.0.0.1:9090`.
The Collector accepts OTLP HTTP traces on `127.0.0.1:4318`.

## Create the Grafana password

```bash
sudo install -d -m 0750 /etc/cinematacms
openssl rand -base64 32 | sudo tee \
  /etc/cinematacms/grafana-admin-password >/dev/null
sudo chmod 0600 /etc/cinematacms/grafana-admin-password
```

Store the password in your password manager. The installer does not print it.

## Install Grafana

Replace the example hostname with your Grafana hostname:

```bash
sudo ./deploy/install-local-grafana.sh \
  --public-url https://grafana.video.example.org
```

The installer pins Grafana, disables anonymous access and public sign-up,
binds Grafana to `127.0.0.1:3000`, and provisions the starter dashboard.

## Publish Grafana through nginx

Copy the example and replace its hostname:

```bash
sudo cp deploy/grafana/nginx.conf.example \
  /etc/nginx/sites-available/cinematacms-grafana
sudo sed -i 's/grafana.video.example.org/your-grafana-hostname.example.org/g' \
  /etc/nginx/sites-available/cinematacms-grafana
sudo ln -s /etc/nginx/sites-available/cinematacms-grafana \
  /etc/nginx/sites-enabled/cinematacms-grafana
sudo nginx -t
sudo systemctl reload nginx
```

Use Certbot or your existing TLS service to enable HTTPS. Do not publish ports
`3000`, `4318`, or `9090` directly.

## Open the dashboard

Open the Grafana hostname and sign in as `admin`. Retrieve the initial password
from the root-only file:

```bash
sudo cat /etc/cinematacms/grafana-admin-password
```

Open **Dashboards**, **CinemataCMS**, then **CinemataCMS overview**. Generate
application traffic if the request panels are empty.

## Verify the installation

```bash
sudo systemctl is-active \
  cinematacms-prometheus cinematacms-otelcol grafana-server
curl --fail http://127.0.0.1:9090/-/healthy
curl --fail http://127.0.0.1:3000/api/health
sudo ss -lntp | grep -E ':(3000|4318|9090)\b'
```

All services must report `active`. Each listener must use `127.0.0.1`.

## Understand the limits

This profile suits a small single-server installation. It does not provide
centralized logs, durable trace search, alert routing, or high availability.
The [application observability contract](../technical/observability-contract.md)
documents the metrics, trace attributes, privacy rules, and OTLP integration
points available to an external platform.

## Remove Grafana

```bash
sudo systemctl disable --now grafana-server
sudo rm -f /etc/systemd/system/grafana-server.service.d/cinematacms.conf
sudo rm -f /etc/grafana/provisioning/datasources/cinematacms.yml
sudo rm -f /etc/grafana/provisioning/dashboards/cinematacms.yml
sudo rm -rf /var/lib/grafana/dashboards/cinematacms
sudo systemctl daemon-reload
```

These commands keep the Grafana package and database. Remove them only if no
other application uses this Grafana instance.
