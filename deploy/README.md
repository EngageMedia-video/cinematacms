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
If a client has an uppercase legacy setting outside the migration contract, the
upgrade stops and reports only its name. Add an explicit environment mapping or
confirm that the setting is obsolete before retrying; values are never printed.

Existing installations must provision the runtime environment before installing
or restarting the new systemd units:

```bash
sudo git -C /home/cinemata/cinematacms pull --ff-only
sudo /home/cinemata/cinematacms/deploy/apply-release-config.sh --no-restart
sudo /home/cinemata/cinematacms/restart_script.sh
```

The CI deploy job performs these steps in this order. This ordering also makes
the first deployment safe when the currently running `restart_script.sh` comes
from a release that predates `app.env`.

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
and application tracing is disabled.

To add a local Grafana dashboard, follow the
[self-hosted observability tutorial](https://github.com/EngageMedia-video/cinematacms/wiki/Self-hosted-Observability).

Use `--observability managed` when another deployment system provides the
Prometheus and OpenTelemetry Collector services. This mode enables application
tracing to `http://127.0.0.1:4318/v1/traces`, stops the local observability
services, and does not install a second Collector.
The generated application environment also contains
`OBSERVABILITY_REFERENCE_LOOKUP_TOKEN` and
`OBSERVABILITY_REFERENCE_HMAC_KEY`. Give the lookup token only to the managed
monitoring service that calls the internal incident-reference endpoint. The
endpoint allows loopback callers by default, resolves forwarded addresses only
through `TRUSTED_PROXIES`, limits each caller to 30 requests per minute, rejects
bodies larger than 1 KiB, and emits audit events without the submitted value.
Configure `OBSERVABILITY_REFERENCE_ALLOWED_IPS` with explicit addresses or CIDR
ranges only when the monitoring service runs on another host, and use HTTPS or
mTLS for that connection.

## Nginx request handling

The deployment files split nginx ownership as follows:

- `deploy/nginx.conf` owns the complete nginx template, the `5800M` request-body
  limit, and the default `compression` access log.
- `deploy/nginx/cinematacms-http.conf` owns settings that the release updater
  installs into `/etc/nginx/conf.d/` on both new and existing servers. It defines
  the public-site log format and waits up to 300 seconds between reads from a
  client request body. The five-minute idle window supports slow 2 MB
  FineUploader chunks without leaving dead client connections open
  indefinitely.
- `deploy/mediacms.io` owns the public HTTP and HTTPS servers. Each user-facing
  uWSGI location waits up to 300 seconds between writes to the local uWSGI
  server and 900 seconds between reads from it. The longer read window covers
  the synchronous final-chunk combine and media-file save for large uploads.
- `deploy/nginx/cinematacms-metrics.conf` owns the loopback-only `/metrics`
  location. It is not a user-request path, so it keeps the nginx uWSGI timeout
  defaults.
- `deploy/cloudflare_real_ip.conf` owns the trusted Cloudflare address ranges
  installed when the deployment uses `--proxy cloudflare`.

The public uWSGI locations explicitly keep `uwsgi_request_buffering on`.
Nginx therefore receives each FineUploader chunk before assigning a uWSGI
worker and can retry an upstream that has not received the request body. Turning
buffering off would occupy an application worker for the duration of a slow
client upload and would prevent retry after nginx starts sending the body.

The default access log uses the `compression` format from `deploy/nginx.conf`.
The public servers use the `cinematacms` format from
`deploy/nginx/cinematacms-http.conf`. Both record `$request_time`,
`$upstream_response_time`, and `$request_length` so an operator can distinguish
a slow client transfer from slow application work. The timeout values are
initial operational bounds. Tune them from production logs rather than copying
proxy timeouts: the application locations use `uwsgi_pass`, not `proxy_pass`.

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
2. Installs the nginx request policy, metrics restriction, and selected proxy
   config.
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
