# Deploy CinemataCMS

Use `install.sh` for a new Ubuntu 22.04 server. Use
`deploy/apply-release-config.sh` after an application upgrade. Both commands use
the same nginx, systemd, and observability files.

## Runtime configuration

CinemataCMS reads deployment-varying application settings only from environment
variables. Local development loads the repository `.env` file. Systemd services
load `/etc/cinematacms/app.env`; `deploy/apply-release-config.sh` creates it with
mode `0640`, preserves operator-managed values, and supplies stable telemetry
worker identity values.

`/etc/cinematacms/deployment.env` contains only inputs owned by the release tool,
such as domain, proxy, and observability mode. It is not loaded by Django.

During the first upgrade, the release updater imports supported values from the
ignored legacy `cms/local_settings.py` and `/etc/cinematacms/observability.env`.
The application no longer imports either legacy configuration source.

## Install a new server

Run the interactive installer:

```bash
sudo ./install.sh
```

The installer asks for the portal hostname, portal name, reverse proxy mode,
and observability mode. Run the installer without prompts for an automated
deployment:

```bash
sudo ./install.sh \
  --non-interactive \
  --domain video.example.org \
  --portal-name "Example Video" \
  --proxy cloudflare \
  --observability local
```

Use `--proxy none` when nginx receives traffic directly. Use
`--proxy cloudflare` only when Cloudflare proxies the domain.

The `local` observability mode installs the Ubuntu Prometheus package and the
pinned OpenTelemetry Collector Contrib package when they are missing.
Prometheus listens on `127.0.0.1:9090` and scrapes the protected nginx
`/metrics` endpoint. The collector listens for OTLP HTTP traces on
`127.0.0.1:4318` and writes trace summaries to its systemd journal. Run these
commands to inspect each service:

```bash
curl --fail http://127.0.0.1:9090/-/healthy
sudo journalctl -u cinematacms-otelcol
```

Use `--observability none` when another deployment system manages Prometheus
and trace collection.

Run a dry run to validate installer options without changing the server:

```bash
./install.sh \
  --non-interactive \
  --domain video.example.org \
  --proxy none \
  --observability none \
  --dry-run
```

## Apply release configuration

The installer saves the selected domain, proxy, and observability modes in
`/etc/cinematacms/deployment.env`. After you update the repository, apply its
deployment files:

```bash
sudo ./deploy/apply-release-config.sh
```

The updater performs these actions:

1. Backs up every file that it changes under `/var/backups/cinematacms/`.
2. Installs the nginx metrics restriction and the selected proxy config.
3. Installs the application and observability systemd units.
4. Runs `nginx -t`.
5. Restores the backup if nginx rejects the configuration.
6. Restarts the application and Celery services, updates the selected
   observability services, and reloads nginx.

Use `--no-restart` to install and validate the files without changing any
service state. Run the updater without that option during a maintenance window
because the application restart briefly interrupts requests and background
tasks.

Pass new proxy or observability values to change the saved deployment settings:

```bash
sudo ./deploy/apply-release-config.sh \
  --proxy cloudflare \
  --observability local
```

The updater rejects domain changes because nginx and Certbot must change
together. To change the domain, update the nginx certificate and site config as
one maintenance operation.

Use `--no-restart` to install and validate files without restarting services.

## Placeholder certificates

The `.pem` files in this directory are placeholder self-signed certificates
for initial installation. The installer replaces them with Let's Encrypt
certificates for a real domain. Do not use the placeholder certificates in
production.
