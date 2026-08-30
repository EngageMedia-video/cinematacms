# CinemataCMS Installation Instructions

The instructions have been tested on Ubuntu 22.04. Ensure no other services are running in the system, specifically no nginx/Postgresql, as the installation script will install them and replace any configs.

As root, clone the repository under `/home/cinemata` and run the interactive
installer:

```
# cd /home
# mkdir cinemata && cd cinemata
# git clone https://github.com/EngageMedia-video/cinematacms cinematacms && cd cinematacms
# chmod +x install.sh install-nodejs.sh scripts/build_frontend.sh
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
