# Install CinemataCMS on Ubuntu 22.04

Use Ubuntu 22.04 on an `amd64` or `arm64` host. The installer configures nginx,
PostgreSQL, and Redis. Run it only on a new host that does not already use those
services.

As root, clone the repository under `/home/cinemata`:

```bash
# cd /home
# mkdir cinemata && cd cinemata
# git clone https://github.com/EngageMedia-video/cinematacms cinematacms && cd cinematacms
# chmod +x install.sh install-nodejs.sh scripts/build_frontend.sh
```

Check the host before installing:

```bash
# ./install.sh --check-platform
Supported platform: Ubuntu 22.04 (amd64)
```

Run the interactive installer:

```bash
# ./install.sh
```

For an automated installation, pass every required value:

```bash
# ./install.sh \
    --non-interactive \
    --domain video.example.org \
    --portal-name "Example Video" \
    --proxy cloudflare \
    --observability local
```

The installer runs database migrations and seeds django-waffle feature flag
switches. It saves the deployment choices in
`/etc/cinematacms/deployment.env`. Follow the
[deployment guide](../../deploy/README.md) to apply release configuration after
an upgrade.

The installer uses the Ubuntu FFmpeg package. It builds Bento4 from the pinned
source revision for the host architecture and installs it at `/opt/bento4`.
The installer exits with a non-zero status if a required download, build,
service, migration, or configuration step fails.
