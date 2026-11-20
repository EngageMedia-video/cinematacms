# Deploy CinemataCMS

Use `install.sh` for a new Ubuntu 24.04 server. Use
`deploy/apply-release-config.sh` after an application upgrade. Both commands use
the same nginx, systemd, and observability files. To move an existing Ubuntu
22.04 server to 24.04, follow
[Upgrade a server from Ubuntu 22.04 to 24.04](#upgrade-a-server-from-ubuntu-2204-to-2404).

## Runtime configuration

CinemataCMS reads deployment-varying application settings only from environment
variables. Local development loads the repository `.env` file. Systemd services
load `/etc/cinematacms/app.env`; `deploy/apply-release-config.sh` creates it with
mode `0640`, preserves operator-managed values, and supplies stable telemetry
worker identity values. `install.sh` creates it before its first management
command and loads it, so installation runs with the same settings and keys as
the services.

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

### Restart after a Python package change

A running process imports modules on first use. A process that keeps running
after the Python packages change can load a new module beside an old one and
fail. A Celery worker in that state can lose its tracing, which
`CinemataTracingUnconfigured` reports (see the
[observability contract](../docs/technical/observability-contract.md#traces-and-logs)).

`restart_script.sh` and `rollback.sh` restart the six application units
(`mediacms`, `celery_long`, `celery_short`, `celery_whisper`, `celery_email`,
and `celery_beat`) once `pip install -r requirements.txt` starts. They restart
`mediacms` first, then reload nginx, then restart the Celery units, so nginx
serves the new site configuration as soon as gunicorn listens. A failed nginx
reload fails the deploy, and the Celery units still restart. They restart
the units even when a later step fails or the script receives `SIGTERM` or
`SIGHUP`, and still exit with the failure status. A signal can reach the
script but not `pip`, so the restart waits until `pip` exits. The restart does
not run after `SIGKILL` or a host crash.

After a failed frontend build or migration, the units therefore run the new
code with the previous static files or a partly migrated database. Fix the
failure and run `restart_script.sh` again, or run `rollback.sh`.

If you change the Python packages by hand, restart all six units before you do
anything else:

```bash
sudo systemctl restart mediacms celery_long celery_short celery_whisper celery_email celery_beat
```

## Size the process budget for a small server

The released process counts suit a server with memory to spare. On a small
server, set a lower count for each service in `/etc/cinematacms/app.env`:

| Key | Sets | Default | Trial value |
| --- | --- | ---: | ---: |
| `CINEMATA_WEB_WORKERS` | gunicorn workers, each with 10 threads | 8 | 4 |
| `CINEMATA_CELERY_LONG_CONCURRENCY` | `celery_long` pool, which runs the encodings | 4 | 1 |
| `CINEMATA_CELERY_SHORT_CONCURRENCY` | `celery_short` pool | 10 | 2 |
| `CINEMATA_CELERY_EMAIL_CONCURRENCY` | `celery_email` pool | 4 | 1 |
| `CINEMATA_CELERY_WHISPER_CONCURRENCY` | `celery_whisper` pool | 1 | 1 |

The defaults live in `deploy/gunicorn.conf.py` and in the `deploy/celery_*.service` units. A
key in `app.env` replaces its default, and a missing key keeps it. The release
updater preserves the keys. It accepts only a positive integer for each, with
no comment on the same line. For any other value it stops before it restarts a
service.

The trial values come from one development server with about 6 GiB of memory,
recorded in
[issue #999](https://github.com/EngageMedia-video/cinematacms/issues/999). Use
them as a starting point, not as a rule. No out-of-memory kill occurred in the
51 hours after the change, but one heavy encoding still left less than 1 GiB
available. Measure available memory under your own encoding load and adjust.

A drop-in that already sets `CELERYD_OPTS` with its own `--concurrency` still
decides that pool size. Remove the option from the drop-in when you move the
value to `app.env`.

### Return freed web memory to the system

The trial also set a fixed glibc `mmap` threshold for the web service. Every
unit loads `app.env`, so set it in a drop-in for the web unit only,
`/etc/systemd/system/mediacms.service.d/allocator.conf`:

```ini
[Service]
Environment=MALLOC_MMAP_THRESHOLD_=131072
```

By default, glibc raises this threshold as a process frees large blocks, up to
32 MiB on a 64-bit system, and keeps the freed blocks in the heap of the
process. A fixed 128 KiB
threshold makes glibc map each larger block separately and return it to the
system when the process frees it. The cost is a system call and new page faults
for each of those allocations. The trial did not measure this setting apart
from the lower process counts, so its share of the saving is unknown. Leave it
out unless measurements on your server show that web memory stays high after
traffic falls.

The release updater replaces only the unit files, so a drop-in directory stays
in place.

### Apply and verify

First let the release updater check the new values. It reports an invalid count
and changes no service:

```bash
sudo /home/cinemata/cinematacms/deploy/apply-release-config.sh --no-restart
```

A restart of the web service does not touch a running task, so it is safe at
any time:

```bash
sudo systemctl daemon-reload
sudo systemctl restart mediacms
```

Do not restart any Celery unit while an encoding runs. The restart of one
worker, including `celery_short` or `celery_email`, can stop an encoding that
another worker runs. When no encoding is active, restart the Celery units:

```bash
sudo systemctl restart celery_long celery_short celery_email celery_whisper
```

While an encoding runs, leave the units running and remove idle processes from
each pool instead. The key in `app.env` then takes effect at the next restart.
The number is how many processes to remove, and the name before `@` is `long`,
`short`, `email`, or `whisper`:

```bash
cd /home/cinemata/cinematacms
sudo bash -c 'set -a; source /etc/cinematacms/app.env; set +a; /home/cinemata/venv/bin/celery -A cms control pool_shrink 3 -d "long@$(hostname)"'
```

Then check the live sizes. The first command counts the gunicorn workers. In the
output of the second, the length of each `pool.processes` list is the live size
of that pool. `max-concurrency` keeps the size the worker started with, so it
does not show a later `pool_shrink`.

```bash
pgrep -c -P "$(systemctl show -p MainPID --value mediacms)"
sudo bash -c 'set -a; source /etc/cinematacms/app.env; set +a; /home/cinemata/venv/bin/celery -A cms inspect stats'
```

To roll back, delete the keys from `app.env` and the drop-in, then repeat the
steps above. The defaults return. `pool_grow` adds processes to a running pool
as `pool_shrink` removes them.

### Add swap for short peaks

Swap is an optional capacity measure that an operator provisions outside this
repository. It absorbs a short memory peak, such as one heavy encoding, that
would otherwise end in an out-of-memory kill. On the trial server, 2 GiB of
swap peaked at 187 MiB of use over 51 hours. Swap that stays in heavy use means
the process budget is too large for the server.

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

To remove it, run `sudo swapoff /swapfile`, delete the `/swapfile` line from
`/etc/fstab`, and delete the file.

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
services, and does not install a second Collector. When
`deploy/observability/install.sh` has installed the full stack, its
`cinematacms-otelcol` unit reads `/etc/cinematacms-observability/otelcol.yml`;
each later apply leaves that unit in place and keeps the Collector running.
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

### Upgrade Node.js on an existing server

`install.sh` runs `install-nodejs.sh`, which installs the Node.js LTS release
line that the frontend requires, makes it the nvm default for root, and points
`/usr/local/bin/node`, `npm` and `npx` at it. `restart_script.sh` finds Node.js
through those links, because `sudo` does not load nvm. When a
release raises that line, run the release's `install-nodejs.sh` on each
existing server before you deploy the release. Otherwise the server builds the
frontend with the old Node.js. The script also installs `libatomic1` with
`apt-get`, because Node.js 26 does not start without `libatomic.so.1`.

```bash
cd /home/cinemata/cinematacms
git fetch origin
git show <commit-sha>:install-nodejs.sh > /tmp/install-nodejs.sh
sudo bash /tmp/install-nodejs.sh
sudo sh -c 'command -v node; node --version; npm --version'
```

Use the commit that you are about to deploy as `<commit-sha>`. The last
command shows the `node` that `restart_script.sh` finds on the `PATH` that
`sudo` sets. It must be `/usr/local/bin/node` and report the major version in
`frontend/.nvmrc`. If `command -v node` shows another path, an earlier entry on
the `sudo` `PATH` holds an old Node.js. Remove that install before you deploy.

The deploy runs `npm ci`, which installs from the lockfile and does not rewrite
it, so the npm that the new Node.js bundles is enough.

## Upgrade a server from Ubuntu 22.04 to 24.04

This procedure moves an existing server to Ubuntu 24.04 with
`do-release-upgrade`. It does not change the PostgreSQL cluster. Run it on a
test copy of the server before you run it on a server that serves visitors.

An in-place release upgrade cannot be undone. Ubuntu has no downgrade path, so
the only rollback is to restore the whole server from the snapshot that you
take in step 2.

### Before the upgrade

1. Check that the application does not run on Ubuntu's Python. Ubuntu 24.04
   does not ship Python 3.10, so an application virtualenv built from
   `/usr/bin/python3.10` stops working after the upgrade:

   ```bash
   readlink -f /home/cinemata/venv/bin/python 2>/dev/null || readlink -f /home/cinemata/bin/python
   ```

   The command shows the interpreter that the services run: the one behind
   the `/home/cinemata/venv` link, or the one in `/home/cinemata` on an install
   that has no link yet. If the path starts with `/usr/bin/python3`, move the
   application to the uv-managed interpreter first ([#1072](https://github.com/EngageMedia-video/cinematacms/issues/1072)).
   Do not continue until the check shows no `/usr/bin` interpreter.

   After that move, `/home/cinemata/bin/python` still points at
   `/usr/bin/python3.10`. It belongs to the previous virtualenv that
   `migrate-python-runtime.sh --rollback` returns to. The upgrade breaks that
   virtualenv, so after the upgrade the Python rollback has nothing to return to.
2. Take a snapshot of the whole server disk from the hosting provider. Also
   copy these off the server: a database backup made with your usual backup
   procedure, `/home/cinemata/cinematacms/media_files/`, `/etc/cinematacms/`,
   `/etc/nginx/`, `/etc/letsencrypt/`, and `/etc/cinematacms-observability/`
   when it exists.
3. Bring Ubuntu 22.04 fully up to date, and reboot if the system asks for it:

   ```bash
   sudo apt-get update && sudo apt-get full-upgrade
   [ -f /var/run/reboot-required ] && sudo reboot
   ```

4. List held packages. The upgrader cannot upgrade a held package and can stop
   on one. Release each hold that you do not need, and note the rest:

   ```bash
   apt-mark showhold
   sudo apt-mark unhold <package>
   ```

5. List the third-party apt sources. The upgrader disables them, and you
   re-enable them in step 3 of the next section. Record each file and its
   suite, such as the PostgreSQL project's repository (PGDG) or Grafana:

   ```bash
   grep -rh '^deb\|^Suites\|^URIs' /etc/apt/sources.list.d/
   ```

6. Check the free space on `/` and `/boot`. The upgrader calculates the space
   that it needs and stops before it changes anything when the space is too
   small:

   ```bash
   df -h / /boot
   ```

7. Stop the application units so that no upload or encode starts during the
   upgrade:

   ```bash
   sudo systemctl stop mediacms celery_long celery_short celery_whisper celery_email celery_beat
   ```

### Run the upgrade

1. Start the upgrade. Over SSH, the upgrader also starts a fallback SSH server
   on port 1022:

   ```bash
   sudo do-release-upgrade
   ```

2. When the upgrader asks about a configuration file that you or CinemataCMS
   changed, such as `/etc/nginx/nginx.conf` or `/etc/redis/redis.conf`, keep
   the installed version. `deploy/apply-release-config.sh` owns the nginx
   files.
3. Reboot when the upgrader finishes.

### After the upgrade

1. Confirm the release:

   ```bash
   cd /home/cinemata/cinematacms && sudo ./install.sh --check-platform
   ```

   The command prints `Supported platform: Ubuntu 24.04 (amd64)` or `(arm64)`.
2. Check that no unit failed:

   ```bash
   systemctl --failed
   systemctl status nginx redis-server postgresql mediacms celery_long celery_short celery_whisper celery_email celery_beat
   ```

3. Re-enable each third-party source that you recorded, with its Ubuntu 24.04
   (`noble`) suite where the source has one, then run `sudo apt-get update`.
4. Apply the release configuration. It validates nginx with `nginx -t` and
   restarts the application units:

   ```bash
   sudo ./deploy/apply-release-config.sh
   ```

5. If the full observability stack is installed, run its installer again with
   the environment file that you installed it with. It rebuilds the Celery
   exporter virtualenv with Ubuntu 24.04's `python3` (3.12), because the
   virtualenv built with Python 3.10 cannot run any more. Do not run this
   installer before the upgrade: the pinned exporter needs Python 3.11 or
   later, and Ubuntu 22.04 has 3.10. Then verify the stack:

   ```bash
   sudo deploy/observability/install.sh --env <environment file>
   sudo deploy/observability/install.sh --env <environment file> --verify-only
   ```

6. Check that the media tools still run:

   ```bash
   ffmpeg -version | head -1
   convert -version | head -1
   /opt/bento4/bin/mp4hls --help | head -1
   /home/cinemata/whisper.cpp/build/bin/whisper-cli --help | head -1
   ```

7. Upload a short video with an audio track. Confirm that the encodings, the
   poster, the sprite sheet, the animated preview, and HLS playback all
   complete, and that a transcription request produces subtitles.
8. Check that Certbot can still renew the certificate:

   ```bash
   sudo certbot renew --dry-run
   ```

### Roll back

Restore the snapshot from step 2 of the preparation. Content uploaded after the
snapshot is lost unless you copy it out first. Redis 7 on Ubuntu 24.04 writes
its dump file in a format that Redis 6 on Ubuntu 22.04 cannot read, so do not
copy `/var/lib/redis/dump.rdb` back to the restored server.

## Nginx request handling

The deployment files split nginx ownership as follows:

- `deploy/nginx.conf` owns the complete nginx template, the `5800M` request-body
  limit, and the default `compression` access log.
- `deploy/nginx/cinematacms-http.conf` owns settings that the release updater
  installs into `/etc/nginx/conf.d/` on both new and existing servers. It defines
  the public-site log format and waits up to 300 seconds between reads from a
  client request body. The five-minute idle window supports slow upload
  requests (8 MiB tus chunks) without leaving dead client connections open
  indefinitely.
- `deploy/mediacms.io` owns the public HTTP and HTTPS servers. Each user-facing
  location passes requests over HTTP to the local gunicorn server. It waits up
  to 300 seconds between writes to gunicorn and 900 seconds between reads from
  it. The longer read window covers the synchronous final-chunk combine and
  media-file save for large uploads.
- `deploy/nginx/cinematacms-upstream.conf` owns the address of the
  `cinematacms_app` upstream, which every location that passes to gunicorn
  names. Gunicorn reads its listen address from this file. The release updater
  installs it into `/etc/nginx/conf.d/`, and so does
  `deploy/observability/install.sh`, whose application metrics listener names
  the same upstream.
- `deploy/nginx/cinematacms-proxy.conf` owns the request headers of every
  location that passes to gunicorn: `Host`, `X-Real-IP`, and
  `X-Forwarded-Proto`. Each line replaces what the client sent, except that
  `cinematacms-http.conf` keeps the scheme that Cloudflare reports. See
  [Application server](#application-server).
- `deploy/nginx/cinematacms-metrics.conf` owns the loopback-only `/metrics`
  location. It is not a user-request path, so it keeps the nginx proxy timeout
  defaults.
- `deploy/nginx/cinematacms-rate-limits.conf` owns per-client-network request
  limits for `/view` (10 r/s, burst 40), media reactions (5 r/s, burst 20), and
  restricted-media passwords (1 r/s, burst 10). Rejected requests get `429`. The
  zones in `cinematacms-http.conf` key an IPv4 address, or the /64 of an IPv6
  address, matching the application limiters. The application's own limits still
  apply behind these edge limits.
- `deploy/logrotate-cinematacms-nginx` rotates the public-site access and error
  logs in `/var/log/cinematacms/nginx/` daily and deletes them after 14 days.
  These logs hold raw client IPs, so the directory (`root:www-data`, `0750`)
  admits only root and processes running as `www-data`: the nginx workers,
  which reopen the logs after rotation, gunicorn and the Celery services. The
  installer also grants the full-stack observability collector an ACL entry so
  it can ingest them.
  The release updater points an existing site's logs there; files already
  written under `/var/log/nginx/` age out under the distribution's nginx
  rotation.
- `deploy/cloudflare_real_ip.conf` owns the trusted Cloudflare address ranges
  installed when the deployment uses `--proxy cloudflare`.

The public locations explicitly keep `proxy_request_buffering on`.
Nginx therefore receives each upload request (one tus `PATCH`) before assigning a gunicorn
worker and can retry an upstream that has not received the request body. Turning
buffering off would occupy an application worker for the duration of a slow
client upload and would prevent retry after nginx starts sending the body.

The default access log uses the `compression` format from `deploy/nginx.conf`.
The public servers use the `cinematacms` format from
`deploy/nginx/cinematacms-http.conf`. Both record `$request_time`,
`$upstream_response_time`, and `$request_length` so an operator can distinguish
a slow client transfer from slow application work. The timeout values are
initial operational bounds. Tune them from the access logs.

Run a dry run to validate installer options without changing the server:

```bash
./install.sh \
  --non-interactive \
  --domain video.example.org \
  --proxy none \
  --observability none \
  --dry-run
```

## Application server

`deploy/mediacms.service` runs gunicorn with the settings in
`deploy/gunicorn.conf.py`: `CINEMATA_WEB_WORKERS` workers of 10 threads each,
as `www-data`, on the address of the `cinematacms_app` upstream in
`deploy/nginx/cinematacms-upstream.conf`. Gunicorn writes its own messages and
the output of the application to `logs/errorlog.txt`. It reopens that log on
`SIGUSR1`, which the full-stack log rotation sends after it renames the log.

The application takes the client address from `X-Real-IP` and the scheme from
`X-Forwarded-Proto` only when nginx on the same host sends the request over
loopback. nginx sets both on every request: the client address after realip,
and the scheme the request reached nginx with. A request that realip accepted
from Cloudflare keeps Cloudflare's `X-Forwarded-Proto`, which holds the
visitor's scheme. A client that reaches nginx directly cannot set either
header.

`sudo systemctl reload mediacms` starts new workers with the code on disk and
stops the old ones after their requests finish. A restart also lets requests in
progress finish, for up to 25 seconds, but nginx answers `502` until gunicorn
listens again.

Releases before gunicorn ran uWSGI behind `uwsgi_pass 127.0.0.1:9000`. On such
a server the release updater turns every such pass into a pass to the
`cinematacms_app` upstream and stops when a `uwsgi_pass` names any other
address. When the full observability stack is installed, it also renders that
stack's nginx listener and log rotation again. Gunicorn does not listen on
uWSGI's address, so nginx running the uWSGI site finds no listener there and
answers `502` at once. A uwsgi request that reached gunicorn would wait for an
HTTP request line until nginx's 900-second read timeout.

The first deploy of gunicorn runs the `restart_script.sh` of the uWSGI release
it replaces. That script restarts nginx only after every Celery unit, and not at
all when the deploy fails after the updater installed the gunicorn unit. So
that nginx serves the new site as soon as gunicorn listens,
`deploy/mediacms.service` queues an nginx reload each time gunicorn starts:

```ini
ExecStartPost=+/bin/systemctl --no-block try-reload-or-restart nginx.service
```

Delete that line together with `uwsgi.ini` once no server deploys from a uWSGI
release.

### Roll back to a uWSGI release

`rollback.sh` refuses to go from a gunicorn release to a uWSGI release, because
it installs neither the units nor the nginx files of its target. Run
`sudo ./rollback.sh --dry-run` first. It lists the commits to revert and the
apps whose migrations changed, then stops at this refusal.

Save the following script as `/root/rollback-to-uwsgi.sh` and run it with
`sudo bash /root/rollback-to-uwsgi.sh`. It stops at the first command that
fails. Fix the reported cause and run the remaining commands by hand.

```bash
set -Eeuo pipefail
cd /home/cinemata/cinematacms
source restart_script.sh
deploy/migrate-python-runtime.sh --adopt-legacy-venv
source /home/cinemata/venv/bin/activate
# Django reads its settings, SECRET_KEY among them, from this file.
set -a; source /etc/cinematacms/app.env; set +a
TARGET="$(tail -n 1 /var/log/cinemata/deploy.log | cut -f2)"
DEPLOYED="$(tail -n 1 /var/log/cinemata/deploy.log | cut -f3)"
[ "$(git rev-parse HEAD)" = "$DEPLOYED" ] || { echo "HEAD is not the last deployed commit" >&2; exit 1; }
# The same refusal as rollback.sh. See "Move to another Python".
if ! git cat-file -e "$TARGET:deploy/migrate-python-runtime.sh" 2>/dev/null &&
  [ ! /home/cinemata/venv -ef /home/cinemata ]; then
  echo "Run deploy/migrate-python-runtime.sh --rollback first" >&2
  exit 1
fi

# The same steps as rollback.sh: the code, the Python packages and the frontend.
adopt_served_frontend
git checkout --detach "$TARGET"
install_python_requirements
roll_back_static_release "$TARGET"
reset_app_ownership

# Undo the conversion of the site to gunicorn.
sed -i \
  -e 's|^\([[:space:]]*\)include /etc/nginx/snippets/cinematacms-proxy\.conf;|\1include /etc/nginx/sites-enabled/uwsgi_params;|' \
  -e 's|^\([[:space:]]*\)proxy_read_timeout 900s;|\1uwsgi_read_timeout 900s;|' \
  -e 's|^\([[:space:]]*\)proxy_send_timeout 300s;|\1uwsgi_send_timeout 300s;|' \
  -e 's|^\([[:space:]]*\)proxy_request_buffering on;|\1uwsgi_request_buffering on;|' \
  -e 's|^\([[:space:]]*\)proxy_pass http://cinematacms_app;|\1uwsgi_pass 127.0.0.1:9000;|' \
  /etc/nginx/sites-available/mediacms.io
# The full observability stack, when installed, gets its uWSGI nginx listener and
# log rotation back. At a uWSGI release, render_nginx_app_metrics writes its file.
if [ -f /etc/cinematacms-observability/stack.env ]; then
  (
    set -a; source /etc/cinematacms-observability/stack.env; set +a
    source deploy/observability/install.sh
    render_nginx_app_metrics
    render_app_log_rotation > /etc/cinematacms-observability/app-logs.logrotate
  )
fi
# Installs the target's uwsgi_params, nginx snippets and units, then runs nginx -t.
deploy/apply-release-config.sh --no-restart

systemctl restart mediacms
systemctl reload nginx
systemctl restart celery_long celery_short celery_whisper celery_email celery_beat
printf '%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$DEPLOYED" "$TARGET" rollback >> /var/log/cinemata/deploy.log
```

Requests fail with `502` between the restart of `mediacms` and the reload of
nginx, usually for a few seconds. Then reverse the migrations that the dry run
listed, as its warning describes.

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

## Move to another Python

The services, `restart_script.sh`, and `rollback.sh` reach the Python
virtualenv only through the link `/home/cinemata/venv`. The link names one of
two virtualenvs:

| Virtualenv | Python | Made by |
| --- | --- | --- |
| `/home/cinemata/venvs/py3.14` | 3.14 from uv | `install.sh`, or `deploy/migrate-python-runtime.sh` on an existing install |
| `/home/cinemata` itself | the Ubuntu `python3` | an install made before versioned virtualenvs |

uv and its interpreters live in `/opt/cinematacms/bin/uv` and
`/opt/cinematacms/python`. Both stay owned by root and readable by `www-data`.
The script pins the uv release and the checksum of its download.

### First deploy on an existing install

An existing install has no link. The first deploy of a release with versioned
virtualenvs links `/home/cinemata/venv` to `/home/cinemata` and changes nothing
else. The services keep the same interpreter and packages. A deploy runs the
`restart_script.sh` of the release it replaces, which calls
`deploy/apply-release-config.sh` of the new release before it installs the new
units. That script makes the link, and so do `restart_script.sh` and
`rollback.sh` before they activate the virtualenv. Each of them leaves an
existing link alone.

On such an install the link points at its own parent directory. `chown -R` and
`find` do not follow it. A backup or copy tool that follows links must exclude
`/home/cinemata/venv`.

`uwsgi.ini` still sets `virtualenv = /home/cinemata`, for a uWSGI unit that an
older release installed. The uWSGI unit of the last uWSGI release passes
`--virtualenv /home/cinemata/venv` after `--ini`, and uWSGI uses the value it
reads last.

### Upgrade

Commit `52e0ac01` is the last release that runs on Python 3.10. Later releases
neither install nor import on it. A server on Python 3.10 therefore runs the
migration from commit `52e0ac01` before it deploys anything newer.

1. Deploy commit `52e0ac01` as usual
   (`sudo /home/cinemata/cinematacms/restart_script.sh --revision 52e0ac010f6ec6312e57b3024bb57ea7aaf901ee`).
   The services still run on the old virtualenv.
2. Run the migration:

   ```bash
   sudo /home/cinemata/cinematacms/deploy/migrate-python-runtime.sh
   ```

3. Confirm the interpreter:

   ```bash
   /home/cinemata/venv/bin/python --version
   systemctl status mediacms celery_long celery_short celery_whisper celery_email celery_beat
   ```

4. Deploy the newer release as usual.

The script installs uv and Python 3.14 when they are missing. It builds
`/home/cinemata/venvs/py3.14` from `requirements.txt`. It runs
`manage.py check` as `www-data` with `/etc/cinematacms/app.env`. Only then does
it point the link at the new
virtualenv, record the old one as `/home/cinemata/venvs/previous`, and run
`deploy/apply-release-config.sh` to install the units and restart the services.
A failure before the switch leaves the services on the old virtualenv.

The script runs no database migration and changes no code. Running it again
builds nothing new. It installs the requirements of the checkout, checks, and
restarts. Do not run it while a deploy runs.

### Roll back

Roll back in the reverse order of the upgrade. Each commit then runs on an
interpreter that its code and its deploy scripts support.

To move the services back to the previous virtualenv:

```bash
sudo /home/cinemata/cinematacms/deploy/migrate-python-runtime.sh --rollback
```

Deploys since the migration installed packages only into the virtualenv in use.
The rollback therefore installs the requirements of the checkout into the
previous virtualenv and checks it as `www-data` before it switches. A failure
leaves the services where they were. The Python 3.14 virtualenv stays, so a
later migration reuses it.

A commit from before versioned virtualenvs knows only `/home/cinemata`. Its
`restart_script.sh` would install packages there while the units run from the
link. `rollback.sh` refuses such a commit while the link names another
virtualenv. Run `migrate-python-runtime.sh --rollback` first, then `rollback.sh`.

Once a release needs Python 3.14, the order reverses. Roll back the code to a
release that still supports the old Python, then the interpreter. Never move
the interpreter back under code that needs the newer one.

## Upgrade PostgreSQL to 18

New servers get PostgreSQL 18 from `install.sh`. A server installed with an
older PostgreSQL keeps that cluster until you upgrade it with
`deploy/upgrade-postgresql.sh`. The script handles exactly one cluster older
than 18 and refuses to run when it finds more than one.

On an Ubuntu 22.04 server, upgrade PostgreSQL before you
[upgrade the server to Ubuntu 24.04](#upgrade-a-server-from-ubuntu-2204-to-2404).
The release upgrade then keeps the 18 cluster, and you re-enable PGDG for 24.04
with the other third-party sources. If the release upgrade runs first, it can
add a PostgreSQL 16 cluster beside 14, and this script will not choose between
them.

The upgrade uses `pg_upgradecluster` in copy mode. The old cluster's data
directory is not changed, so you can roll back until the application writes to
the new cluster. Copy mode needs free space under `/var/lib/postgresql` for a
second copy of the data, and the script checks it first.

1. Prepare while the site is live. This installs PostgreSQL 18 from the
   PostgreSQL apt repository beside the running cluster and runs
   `pg_upgrade --check` against it:

   ```bash
   sudo ./deploy/upgrade-postgresql.sh prepare
   ```

2. In a maintenance window, stop every database client, then take a database
   dump. A dump taken before the clients stop misses their last writes:

   ```bash
   sudo systemctl stop mediacms celery_beat celery_email celery_long celery_short celery_whisper
   sudo systemctl stop postgres-exporter  # if local observability is installed
   ```

3. Upgrade. The script refuses to start while any client is still connected.
   The new cluster takes the old cluster's port, so the application settings
   do not change. The script counts the rows in every table before and after
   the upgrade, and stops with the differences if any count changed; roll back
   in that case. Counting reads every table twice, so it adds time in
   proportion to the data size:

   ```bash
   sudo ./deploy/upgrade-postgresql.sh upgrade
   ```

4. Start the services you stopped and check the site.

To roll back before the application writes to PostgreSQL 18, stop the clients
again, then run:

```bash
sudo ./deploy/upgrade-postgresql.sh rollback
```

The rollback stops PostgreSQL 18, gives the old cluster its port back, and
starts it. Writes made on PostgreSQL 18 are lost. To try the upgrade again
after a rollback, drop the stopped cluster with `pg_dropcluster 18 main` first.

Once the upgraded server has run long enough that you no longer need a
rollback, drop the old cluster, for example `pg_dropcluster 14 main`.

## Deploy a prebuilt frontend

By default, `restart_script.sh` builds the frontend on the server with `npm ci`
and `npm run build`. On a server with little free memory, give the script a
frontend that CI already built:

```bash
sudo /home/cinemata/cinematacms/restart_script.sh \
  --revision <commit-sha> \
  --frontend-artifact /absolute/path/to/artifact
```

`--frontend-artifact` requires `--revision`. The artifact directory holds two
files, which `deploy/frontend-artifact.py pack` writes from a finished build:

| File | Contents |
| --- | --- |
| `frontend-build.tar.gz` | Every file under `frontend/build/production/static/`, including `.vite/manifest.json`. |
| `frontend-build.json` | `commit`, the commit the build came from, and `sha256`, the checksum of the archive. |

The `Frontend Lint & Build` CI job packs every build. For a push to `main`, it
uploads the two files as the artifact `frontend-build-<commit-sha>`. The
`Deploy to Dev VPS` job downloads that artifact, checks it, copies it to the
server, and passes its directory to `restart_script.sh`.

The server runs the `restart_script.sh` of the release that it already has. The
first deploy after this option arrives therefore builds the frontend on the
server once more. The CI job reports that case with a notice.

### Releases

No deploy and no rollback writes into a directory that is served. Each one
builds a new release directory and then makes that release the served one with
one rename. This holds for an artifact, for a build from source, and for a
rollback.

```text
/home/cinemata/cinematacms/
├── static_releases/
│   ├── current  -> release.Ab12Cd     the release that is served
│   ├── previous -> release.Ef34Gh     the release that was served before it
│   ├── release.Ab12Cd/
│   │   ├── REVISION                   commit of the artifact, if one supplied the build
│   │   ├── build/                     Vite build with .vite/manifest.json
│   │   └── collected/                 output of collectstatic
│   └── release.Ef34Gh/
├── static_collected                   -> static_releases/current/collected
└── frontend/build/production/static   -> ../../../static_releases/current/build
```

nginx serves `/static/` from `static_collected`, and Django reads the Vite
manifest from `frontend/build/production/static`. Both paths are links into
`static_releases/current`, so they change together when `current` changes. The
nginx configuration and the settings of the running services stay as they are.

With `--frontend-artifact`, the script runs neither `npm` nor Vite. It does
these steps instead:

1. Before it moves the checkout, it deletes every release that neither
   `current` nor `previous` names. It then unpacks the artifact into a new
   release with a new random name and checks it. The recorded commit must
   equal `--revision`, and the archive must match the recorded checksum. The
   archive must hold only regular files inside the build directory. Every file
   that the manifest references must be present, and every chunk that a chunk
   imports must be in the manifest. If a check fails, the script stops. The
   checkout, the served frontend, and the services stay as they were. After
   the checks pass, it writes the commit into `REVISION`.
2. It fast-forwards the checkout to `--revision`. The checkout must then be at
   exactly that commit. If it is already at a later commit, the script stops
   before it installs anything, because the artifact belongs to another commit
   than the code. This check applies to every `--revision` deploy, with or
   without an artifact.
3. After it installs the Python requirements and reconciles the release
   configuration, it copies the collected files of the current release into
   the new release. A service that is still running renders the bundle names
   of the old manifest until it restarts, so the new release must also hold
   the old bundles.
4. It runs `collectstatic` from the build of the new release into the
   `collected` directory of the new release. See
   [How collectstatic gets its directories](#how-collectstatic-gets-its-directories).
5. It gives the release to `www-data` and runs `sync`, so that the release is
   on disk before a link names it.
6. It points `previous` at the current release and then `current` at the new
   release. From that rename on, nginx and Django use the new frontend.
7. It runs the migrations, installs the units, and restarts the services, as it
   does after a source build.

If the script stops before step 6, also after `SIGTERM`, `SIGHUP`, `SIGKILL`,
or a host crash, the served frontend is the complete old one. No recovery step
exists and none is needed. The unfinished release stays on disk until the next
deploy or rollback deletes it. A Vite build or a `collectstatic` that outlives
its deploy writes only into that unfinished release. If it writes again after
the release is deleted, it creates a directory that no later deploy serves or
reuses, because each release gets a new random name. The application units
restart as described in
[Restart after a Python package change](#restart-after-a-python-package-change),
so they can run the new code with the old frontend. Fix the reported failure
and deploy again, or run `rollback.sh`.

Do not run two deploys on one server at the same time. A deploy deletes the
unfinished release of another deploy. The CI job runs one deploy at a time.

The checks detect a truncated, corrupted, or mislabeled artifact. They do not
prove who built it, because the commit and the checksum arrive beside the
archive. An account that may run `restart_script.sh` with this option can supply
any frontend, so protect that account as you protect the deploy key.

### Build from source

Without `--frontend-artifact`, the script skips the artifact in step 1. After
step 2, it runs `npm ci` and then `npm run build` with `--outDir` set to the
`build` directory of a new release. Steps 3 to 7 then run as they do for an
artifact. The build still needs the memory that Vite needs, but the served
frontend stays whole while it runs. If Vite or `collectstatic` fails, the
script stops and the served frontend is the complete old one.

A release that was built on the server has no `REVISION` file. Only a checked
artifact shows which commit a build came from.

`make quick-build` is a development command. It writes through the two links
into the release that is served. Do not run it on a server. If you do, delete
`static_releases/current/REVISION` first, because the release then no longer
holds the frontend of that commit. `make frontend-clean` deletes the two links,
and a build after it creates real directories again. The next deploy converts
them as described in
[First deploy with releases on an existing server](#first-deploy-with-releases-on-an-existing-server).

### How collectstatic gets its directories

`collectstatic` has no option for its source or its destination. Both come
from the settings. For each run, the script writes a settings module into a
temporary directory and names it in `DJANGO_SETTINGS_MODULE` for that one
command. The module imports everything from `cms.settings` and then replaces
three values with the directories of the new release: `STATIC_ROOT`, the Vite
build in `STATICFILES_DIRS`, and the manifest path in `DJANGO_VITE`.

`cms/settings.py` has no key for these directories, so the same step works for
any commit that a rollback checks out. If `STATICFILES_DIRS` of that commit
does not name `frontend/build/production/static`, the command stops with an
error before it collects a file.

### First deploy with releases on an existing server

A server that was deployed before releases existed serves two real
directories. The first deploy or rollback converts them before it moves the
checkout or installs a package:

1. It copies both directories into a new release, runs `sync`, and points
   `current` at the release.
2. It swaps `static_collected` for a link to `static_releases/current/collected`.
3. It swaps `frontend/build/production/static` for a link to
   `static_releases/current/build`.

Each swap is one `renameat2` call with `RENAME_EXCHANGE`, which
`deploy/exchange-paths.py` makes. The path is never absent, and the link leads
to a copy of what the directory held, so nothing that is served changes. The
script then deletes the directory that the swap moved aside. If the script
stops during the conversion, the next deploy starts the conversion again from
the paths that are still directories.

The conversion needs free disk space equal to the size of both directories.
The release that it creates has no `REVISION` file.

### Swap the directories by hand

The swap needs Linux 3.15 or later, glibc 2.28 or later, and a filesystem that
supports `RENAME_EXCHANGE`, such as ext4, XFS, Btrfs, or overlayfs. Ubuntu 24.04
has both. Every deploy and every rollback needs the two links, with or without
an artifact. If the script reports `Error: static_collected is still a directory`,
it stopped before it moved the checkout. The served frontend, the code, and the
services are unchanged, and `static_releases/current` holds a copy of the
served frontend. Swap the directories
with two commands each. `/static/` answers with 404 in the moment between the
two commands, so choose a quiet moment:

```bash
cd /home/cinemata/cinematacms
sudo mv static_collected static_collected.old && \
  sudo ln -s static_releases/current/collected static_collected
sudo mv frontend/build/production/static frontend/build/production/static.old && \
  sudo ln -s ../../../static_releases/current/build frontend/build/production/static
```

Run the deploy again. After it succeeds, delete `static_collected.old` and
`frontend/build/production/static.old`.

### Roll back

`rollback.sh` checks out the commit before the most recent deploy and installs
its Python requirements. It then restores the frontend of that commit in a new
release, in one of three ways:

| State of the releases | What the rollback does |
| --- | --- |
| `current/REVISION` names the target | Nothing. The reverted deploy stopped before it served its frontend. |
| `previous/REVISION` names the target | It copies that release into a new one, without `npm`. |
| No release names the target | It builds from source into a new release, as a deploy without an artifact does. |

The copy takes the build, with its manifest, and `REVISION` from the previous
release. Its `collected` directory starts with the files that are served now.
The collected files of the previous release are then copied over them. The
files of the previous release win, and the bundles that only the reverted
deploy has stay in place.

The services restart only after the links change. Until then they render the
bundle names of the manifest that they read at their start, which is the
manifest of the reverted deploy. The new release holds those bundles, so no
request for them fails in that interval. A page that a user opened before the
rollback also keeps working.

The script then points `current` at the new release and `previous` at the
release that it replaces, and restarts the services. If a step fails before the
rename, the script stops and the served frontend is the complete one of the
reverted deploy. The checkout is then at the target commit, and the application
units restart as described in
[Restart after a Python package change](#restart-after-a-python-package-change).
Fix the reported failure and run `rollback.sh` again. It finds the checkout at
the target commit with another frontend served, and it resumes from the package
installation. When the target's frontend is already served, it reports that
nothing is left to roll back. A release built from source has no `REVISION`,
so with such a release served the script cannot tell that it finished, and it
runs the remaining steps again. Each of them is safe to repeat.

A checkout that Git refuses, for example over local changes, stops the script
before any package changes, so no unit restarts.

A build from source runs with the checkout at the target commit. It uses the
`frontend/node_modules` that the server has, as it did before releases existed.
The step in
[How collectstatic gets its directories](#how-collectstatic-gets-its-directories)
needs nothing from the target commit, so it also works for a commit that
predates releases.

The script keeps two releases because `rollback.sh` reverts only the most
recent deploy. A deploy or a rollback deletes every older release.

### Disk space

Each release holds one collected tree and one build. The server keeps two
releases, and a third one exists while a deploy or a rollback runs. The first
deploy with releases on an existing server needs a fourth copy for a short
time.

`collectstatic` never deletes a file, and each release starts as a copy of the
one before it. A release therefore grows with every deploy that changes a
bundle, as `static_collected/` did before. Check the use on the server with
`du -sh /home/cinemata/cinematacms/static_releases/*`.

## Placeholder certificates

The `.pem` files in this directory are placeholder self-signed certificates
for initial installation. The installer copies them to `/etc/cinematacms/tls/`,
outside the Certbot-owned `/etc/letsencrypt`, and a new nginx site points at
them. For a real domain, the installer runs Certbot once, and Certbot replaces
the site's certificate paths with its own. Do not use the placeholder
certificates in production.
