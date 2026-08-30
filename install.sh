#!/bin/bash
# should be run as root and only on Ubuntu 22

usage() {
    cat <<'EOF'
Usage: sudo ./install.sh [options]

Options:
  --non-interactive       Do not prompt for installation values.
  --domain HOST           Portal hostname without a scheme, path, or port.
  --portal-name NAME      Portal name. Defaults to CinemataCMS.
  --proxy MODE            Reverse proxy mode: none or cloudflare.
  --observability MODE    Observability mode: none or local.
  --dry-run               Resolve and validate options without changing the system.
  -h, --help              Show this help text.
EOF
}

fail() {
    echo "Error: $*" >&2
    exit 1
}

validate_domain() {
    local domain="$1"
    [[ "$domain" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)*[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$ ]]
}

validate_portal_name() {
    local portal_name="$1"
    [[ "$portal_name" =~ ^[A-Za-z0-9._\ -]{1,100}$ ]]
}

NON_INTERACTIVE=false
DRY_RUN=false
FRONTEND_HOST=""
PORTAL_NAME=""
PROXY_MODE=""
OBSERVABILITY_MODE=""

while [ "$#" -gt 0 ]; do
    case "$1" in
        --non-interactive)
            NON_INTERACTIVE=true
            shift
            ;;
        --domain)
            [ "$#" -ge 2 ] || fail "--domain requires a value"
            FRONTEND_HOST="$2"
            shift 2
            ;;
        --portal-name)
            [ "$#" -ge 2 ] || fail "--portal-name requires a value"
            PORTAL_NAME="$2"
            shift 2
            ;;
        --proxy)
            [ "$#" -ge 2 ] || fail "--proxy requires a value"
            PROXY_MODE="$2"
            shift 2
            ;;
        --observability)
            [ "$#" -ge 2 ] || fail "--observability requires a value"
            OBSERVABILITY_MODE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
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

if [ "$NON_INTERACTIVE" = true ]; then
    [ -n "$FRONTEND_HOST" ] || fail "--domain is required with --non-interactive"
    [ -n "$PROXY_MODE" ] || fail "--proxy is required with --non-interactive"
    [ -n "$OBSERVABILITY_MODE" ] || fail "--observability is required with --non-interactive"
else
    if [ -z "$FRONTEND_HOST" ]; then
        read -r -p "Enter the portal hostname, or press Enter for localhost: " FRONTEND_HOST
    fi
    if [ -z "$PORTAL_NAME" ]; then
        read -r -p "Enter the portal name, or press Enter for CinemataCMS: " PORTAL_NAME
    fi
    if [ -z "$PROXY_MODE" ]; then
        read -r -p "Enter the reverse proxy mode [none/cloudflare], or press Enter for none: " PROXY_MODE
    fi
    if [ -z "$OBSERVABILITY_MODE" ]; then
        read -r -p "Enter the observability mode [none/local], or press Enter for none: " OBSERVABILITY_MODE
    fi
fi

[ -n "$FRONTEND_HOST" ] || FRONTEND_HOST="localhost"
[ -n "$PORTAL_NAME" ] || PORTAL_NAME="CinemataCMS"
[ -n "$PROXY_MODE" ] || PROXY_MODE="none"
[ -n "$OBSERVABILITY_MODE" ] || OBSERVABILITY_MODE="none"

FRONTEND_HOST="${FRONTEND_HOST#http://}"
FRONTEND_HOST="${FRONTEND_HOST#https://}"
FRONTEND_HOST="${FRONTEND_HOST%/}"
validate_domain "$FRONTEND_HOST" || fail "--domain must contain a hostname without a scheme, path, or port"
validate_portal_name "$PORTAL_NAME" || fail "--portal-name may contain letters, numbers, spaces, periods, underscores, and hyphens"
case "$PROXY_MODE" in
    none|cloudflare) ;;
    *) fail "--proxy must be none or cloudflare" ;;
esac
case "$OBSERVABILITY_MODE" in
    none|local) ;;
    *) fail "--observability must be none or local" ;;
esac

echo "Resolved installation configuration:"
echo "  domain=$FRONTEND_HOST"
echo "  portal_name=$PORTAL_NAME"
echo "  proxy=$PROXY_MODE"
echo "  observability=$OBSERVABILITY_MODE"

if [ "$DRY_RUN" = true ]; then
    echo "No changes were made."
    exit 0
fi

echo "Welcome to the Cinemata installation!"

if [ "$(id -u)" -ne 0 ]
  then echo "Please run as root"
  exit
fi

# This installer hardcodes the repository location /home/cinemata/cinematacms
# for the virtualenv, systemd services, NGINX config, media directories and
# ownership. Running it from any other location fails partway through with
# confusing errors, so verify the layout up front and fail fast otherwise.
EXPECTED_DIR="/home/cinemata/cinematacms"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ "$SCRIPT_DIR" != "$EXPECTED_DIR" ]; then
    echo "Error: this installer must be located at and run from $EXPECTED_DIR"
    echo "Current location: $SCRIPT_DIR"
    echo "Clone the repository to the expected path and re-run, for example:"
    echo "  git clone <repository-url> $EXPECTED_DIR"
    echo "  cd $EXPECTED_DIR && sudo ./install.sh"
    exit 1
fi


if [ "$NON_INTERACTIVE" = false ]; then
    while true; do
        read -r -p "
This script will attempt to perform a system update, install required dependencies, install and configure PostgreSQL, NGINX, Redis and a few other utilities.
It is expected to run on a new system **with no running instances of any these services**. Make sure you check the script before you continue. Then enter yes or no
" yn
        case $yn in
            [Yy]* ) echo "OK!"; break;;
            [Nn]* ) echo "Installation cancelled"; exit;;
            * ) echo "Enter yes or no.";;
        esac
    done
fi


osVersion=$(lsb_release -d)
if [[ $osVersion == *"Ubuntu 22"* ]]; then
    echo 'Performing system update and dependency installation, this will take a few minutes'
    apt-get update && apt-get -y upgrade && apt-get install python3-venv python3-dev python3-virtualenv python3-pip virtualenv redis-server postgresql nginx git gcc vim unzip ffmpeg imagemagick telnet htop certbot make build-essential libssl-dev zlib1g-dev  libbz2-dev libreadline-dev libsqlite3-dev wget curl llvm libncurses5-dev  libncursesw5-dev xz-utils tk-dev libffi-dev liblzma-dev python3-openssl python3-certbot cmake libpq-dev python3-certbot-nginx -y
else
    echo "This script is tested for Ubuntu 22 versions only"
    exit
fi

# install ffmpeg
echo "Downloading and installing ffmpeg"
wget -q https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz
mkdir -p tmp
tar -xf ffmpeg-release-amd64-static.tar.xz --strip-components 1 -C tmp
cp -v tmp/{ffmpeg,ffprobe,qt-faststart} /usr/local/bin
rm -rf tmp ffmpeg-release-amd64-static.tar.xz
echo "ffmpeg installed to /usr/local/bin"

echo 'Creating database to be used in CinemataCMS'

su -c "psql -c \"CREATE DATABASE mediacms\"" postgres
su -c "psql -c \"CREATE USER mediacms WITH ENCRYPTED PASSWORD 'mediacms'\"" postgres
su -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE mediacms TO mediacms\"" postgres

echo 'Installing Node.js v22 LTS...'
# Resolve install-nodejs.sh relative to this script's own location, so the
# installer works regardless of where the repository was cloned or the current
# working directory. Fall back to the legacy fixed path for compatibility.
NODEJS_SCRIPT="$SCRIPT_DIR/install-nodejs.sh"
if [ ! -f "$NODEJS_SCRIPT" ]; then
    NODEJS_SCRIPT="/home/cinemata/cinematacms/install-nodejs.sh"
fi

# Run the Node.js installation script
if [ -f "$NODEJS_SCRIPT" ]; then
    if bash "$NODEJS_SCRIPT"; then
        export NVM_DIR="/root/.nvm"
        # shellcheck source=/dev/null
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        # Ensure Node is on PATH in this shell
        nvm use --silent default >/dev/null 2>&1 || nvm use --silent 22 >/dev/null 2>&1
        if ! node -v || ! npm -v; then
            echo "Error: node/npm not on PATH after install"
            exit 1
        fi
        hash -r
    else
        echo "Error: Node.js installation script failed"; exit 1
    fi
else
    echo "Warning: Could not install Node.js - install script not found"; exit 1
fi

echo 'Creating python virtualenv on /home/cinemata'

cd /home/cinemata || exit 1
virtualenv . --python=python3
# shellcheck source=/dev/null
source /home/cinemata/bin/activate
cd cinematacms || exit 1
pip install -r requirements.txt
cd .. && git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp/ || exit 1
bash ./models/download-ggml-model.sh base
make
cd ../cinematacms || exit 1

SECRET_KEY=$(python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')

FRONTEND_HOST_HTTP_PREFIX="http://$FRONTEND_HOST"

{
    echo 'FRONTEND_HOST='\'"$FRONTEND_HOST_HTTP_PREFIX"\'
    echo 'PORTAL_NAME='\'"$PORTAL_NAME"\'
    echo "SSL_FRONTEND_HOST = FRONTEND_HOST.replace('http', 'https')"

    # Add the entered domain to ALLOWED_HOSTS. settings.py appends FRONTEND_HOST
    # before local_settings.py is imported, so this is the effective override.
    echo "ALLOWED_HOSTS = ['127.0.0.1', 'localhost', '$FRONTEND_HOST']"
    echo 'SECRET_KEY='\'"$SECRET_KEY"\'
    echo "LOCAL_INSTALL = True"
    echo "SITE_ID = 1"
} >> cms/local_settings.py

mkdir -p logs
mkdir -p pids

# Build frontend if Node.js is available
if command -v node &> /dev/null && command -v npm &> /dev/null; then
    echo "Building frontend assets..."
    if ! ./scripts/build_frontend.sh; then
        echo "Error: Frontend build failed. Aborting installation."; exit 1
    fi
else
    echo "Warning: Node.js/npm not found, skipping frontend build"
    echo "Running collectstatic only..."
    python manage.py collectstatic --noinput --verbosity=2
fi


python manage.py migrate
python manage.py backfill_media_storage_usage || echo "Warning: storage usage backfill encountered errors; continuing installation."
echo "Seeding feature flag switches..."
if ! python manage.py seed_waffle_switches --force; then
    echo "Error: Feature flag seeding failed. Aborting installation."
    exit 1
fi
python manage.py loaddata files/fixtures/creative_commons_licenses.json
python manage.py loaddata fixtures/encoding_profiles.json
python manage.py loaddata fixtures/categories.json
python manage.py load_apac_languages
python manage.py populate_media_languages
python manage.py populate_media_countries
python manage.py populate_topics
python manage.py populate_content_sensitivities

ADMIN_PASS=$(python -c "import secrets;chars = 'abcdefghijklmnopqrstuvwxyz0123456789';print(''.join(secrets.choice(chars) for i in range(10)))")
echo "from users.models import User; User.objects.create_superuser('admin', 'admin@example.com', '$ADMIN_PASS')" | python manage.py shell

# Configure Django Site with proper error handling
echo "Configuring Django Site..."
if ! python manage.py update_site_name --name "$PORTAL_NAME" --domain "$FRONTEND_HOST"; then
    echo "Error: Failed to configure Django Site. Aborting installation."
    exit 1
fi

chown -R www-data. /home/cinemata/
mkdir -p /etc/letsencrypt/live/mediacms.io/
mkdir -p "/etc/letsencrypt/live/$FRONTEND_HOST"
mkdir -p /etc/nginx/sites-enabled
mkdir -p /etc/nginx/sites-available
mkdir -p /etc/nginx/dhparams/
rm -rf /etc/nginx/conf.d/default.conf
rm -rf /etc/nginx/sites-enabled/default
cp deploy/mediacms.io_fullchain.pem "/etc/letsencrypt/live/$FRONTEND_HOST/fullchain.pem"
# this is just a self signed key, will be replaced by certbot
cp deploy/mediacms.io_privkey.pem "/etc/letsencrypt/live/$FRONTEND_HOST/privkey.pem"
cp deploy/dhparams.pem /etc/nginx/dhparams/dhparams.pem
mkdir -p /etc/nginx/conf.d

chmod +x deploy/apply-release-config.sh
deploy/apply-release-config.sh \
    --domain "$FRONTEND_HOST" \
    --proxy "$PROXY_MODE" \
    --observability "$OBSERVABILITY_MODE"

# attempt to get a valid certificate for specified domain

if [ "$FRONTEND_HOST" != "localhost" ]; then
    echo "Attempting to get a certificate for $FRONTEND_HOST"
    certbot --nginx -n --agree-tos --register-unsafely-without-email -d "$FRONTEND_HOST"
    certbot --nginx -n --agree-tos --register-unsafely-without-email -d "$FRONTEND_HOST"
    # unfortunately for some reason it needs to be run two times in order to create the entries
    # and directory structure!!!
    systemctl restart nginx
else
    echo "will not call certbot utility to update ssl certificate for url 'localhost', using default ssl certificate"
fi

# Generate individual DH params
if [ "$FRONTEND_HOST" != "localhost" ]; then
    # Only generate new DH params when using "real" certificates.
    openssl dhparam -out /etc/nginx/dhparams/dhparams.pem 4096
    systemctl restart nginx
else
    echo "will not generate new DH params for url 'localhost', using default DH params"
fi

# Bento4 utility installation, for HLS

cd /home/cinemata/cinematacms || exit 1
wget http://zebulon.bok.net/Bento4/binaries/Bento4-SDK-1-6-0-632.x86_64-unknown-linux.zip
unzip Bento4-SDK-1-6-0-632.x86_64-unknown-linux.zip
mkdir -p /home/cinemata/cinematacms/media_files/hls

# Create user logos directory and default avatar
echo "Creating default user avatar..."
mkdir -p /home/cinemata/cinematacms/media_files/userlogos
wget -O /home/cinemata/cinematacms/media_files/userlogos/user.jpg "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"

# last, set default owner
chown -R www-data. /home/cinemata/

echo 'Cinemata installation completed, open browser on http://'"$FRONTEND_HOST"' and login with user admin and password '"$ADMIN_PASS"''
