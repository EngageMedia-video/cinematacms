# Deploy CinemataCMS

Use `install.sh` for a new Ubuntu 22.04 server. Use
`deploy/apply-release-config.sh` after an application upgrade. Both commands use
the same nginx, systemd, and observability files.

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
| `CINEMATA_WEB_WORKERS` | uWSGI workers, each with 10 threads | 8 | 4 |
| `CINEMATA_CELERY_LONG_CONCURRENCY` | `celery_long` pool, which runs the encodings | 4 | 1 |
| `CINEMATA_CELERY_SHORT_CONCURRENCY` | `celery_short` pool | 10 | 2 |
| `CINEMATA_CELERY_EMAIL_CONCURRENCY` | `celery_email` pool | 4 | 1 |
| `CINEMATA_CELERY_WHISPER_CONCURRENCY` | `celery_whisper` pool | 1 | 1 |

The defaults live in `uwsgi.ini` and in the `deploy/celery_*.service` units. A
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
sudo bash -c 'set -a; source /etc/cinematacms/app.env; set +a; /home/cinemata/bin/celery -A cms control pool_shrink 3 -d "long@$(hostname)"'
```

Then check the live sizes. The first command counts the uWSGI workers. In the
output of the second, the length of each `pool.processes` list is the live size
of that pool. `max-concurrency` keeps the size the worker started with, so it
does not show a later `pool_shrink`.

```bash
pgrep -c -P "$(systemctl show -p MainPID --value mediacms)"
sudo bash -c 'set -a; source /etc/cinematacms/app.env; set +a; /home/cinemata/bin/celery -A cms inspect stats'
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
  which reopen the logs after rotation, uWSGI and the Celery services. The
  installer also grants the full-stack observability collector an ACL entry so
  it can ingest them.
  The release updater points an existing site's logs there; files already
  written under `/var/log/nginx/` age out under the distribution's nginx
  rotation.
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
supports `RENAME_EXCHANGE`, such as ext4, XFS, Btrfs, or overlayfs. Ubuntu 22.04
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
