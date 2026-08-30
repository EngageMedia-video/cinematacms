#!/bin/bash
# should be run as root and only on Ubuntu 22

usage() {
    cat <<'EOF'
Usage: sudo ./install.sh [options]

Options:
  --non-interactive       Do not prompt for installation values.
  --check-platform        Validate the host OS and architecture, then exit.
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

read_os_release_value() {
    local key="$1"
    local os_release_file="$2"
    awk -F= -v key="$key" '
        $1 == key {
            value = substr($0, index($0, "=") + 1)
            gsub(/^"|"$/, "", value)
            print value
            exit
        }
    ' "$os_release_file"
}

check_supported_platform() {
    local os_release_file="${CINEMATA_OS_RELEASE_FILE:-/etc/os-release}"
    local os_id
    local os_version

    [ -r "$os_release_file" ] || fail "cannot read OS information from $os_release_file"
    os_id=$(read_os_release_value ID "$os_release_file")
    os_version=$(read_os_release_value VERSION_ID "$os_release_file")
    [ "$os_id" = "ubuntu" ] && [ "$os_version" = "22.04" ] || \
        fail "Ubuntu 22.04 is required; found ${os_id:-unknown} ${os_version:-unknown}"
    command -v dpkg >/dev/null 2>&1 || fail "dpkg is required to detect the system architecture"

    SYSTEM_ARCHITECTURE=$(dpkg --print-architecture)
    case "$SYSTEM_ARCHITECTURE" in
        amd64|arm64) ;;
        *) fail "supported architectures are amd64 and arm64; found $SYSTEM_ARCHITECTURE" ;;
    esac

    echo "Supported platform: Ubuntu 22.04 ($SYSTEM_ARCHITECTURE)"
}

validate_domain() {
    local domain="$1"
    [[ "$domain" =~ ^([A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)*[A-Za-z0-9]([A-Za-z0-9-]{0,61}[A-Za-z0-9])?$ ]]
}

validate_portal_name() {
    local portal_name="$1"
    [[ "$portal_name" =~ ^[A-Za-z0-9._\ -]{1,100}$ ]]
}

wait_for_service() {
    local service_name="$1"
    shift
    local attempts="${CINEMATA_SERVICE_WAIT_ATTEMPTS:-30}"
    local delay="${CINEMATA_SERVICE_WAIT_DELAY:-1}"
    local attempt

    for ((attempt = 1; attempt <= attempts; attempt++)); do
        if "$@" >/dev/null 2>&1; then
            return 0
        fi
        sleep "$delay"
    done

    fail "$service_name did not become ready after $attempts attempts"
}

ensure_services_ready() {
    systemctl enable --now postgresql redis-server || \
        fail "could not start PostgreSQL and Redis"
    wait_for_service "PostgreSQL" pg_isready -q
    wait_for_service "Redis" redis-cli ping
}

bento4_target_for_arch() {
    case "$1" in
        amd64) echo "x86_64-unknown-linux" ;;
        arm64) echo "arm64-unknown-linux" ;;
        *) fail "cannot build Bento4 for unsupported architecture $1" ;;
    esac
}

fail_bento4_install() {
    local work_dir="$1"
    local message="$2"
    rm -rf "$work_dir"
    fail "$message"
}

install_bento4() {
    local architecture="$1"
    local version="v1.6.0-641"
    local expected_commit="dc264854d1f76c370b65b18d9f303a95f7f21ab1"
    local install_dir="${CINEMATA_BENTO4_INSTALL_DIR:-/opt/bento4}"
    local target
    local work_dir
    local source_dir
    local build_dir
    local sdk_dir
    local actual_commit

    target=$(bento4_target_for_arch "$architecture")
    [ ! -e "$install_dir" ] || fail "$install_dir already exists; remove it before a fresh installation"
    work_dir=$(mktemp -d)
    source_dir="$work_dir/source"
    build_dir="$source_dir/cmakebuild/$target"

    echo "Building Bento4 $version for $architecture"
    git clone --quiet --depth 1 --branch "$version" \
        https://github.com/axiomatic-systems/Bento4.git "$source_dir" || \
        fail_bento4_install "$work_dir" "could not download Bento4 $version"
    actual_commit=$(git -C "$source_dir" rev-parse HEAD) || \
        fail_bento4_install "$work_dir" "could not verify the Bento4 source revision"
    [ "$actual_commit" = "$expected_commit" ] || \
        fail_bento4_install "$work_dir" "Bento4 $version resolved to unexpected commit $actual_commit"
    git -C "$source_dir" checkout --quiet -b cinematacms-build || \
        fail_bento4_install "$work_dir" "could not prepare the Bento4 source tree"
    cmake -S "$source_dir" -B "$build_dir" -DCMAKE_BUILD_TYPE=Release || \
        fail_bento4_install "$work_dir" "could not configure the Bento4 build"
    cmake --build "$build_dir" --parallel "$(nproc)" || \
        fail_bento4_install "$work_dir" "could not build Bento4"
    (
        cd "$source_dir"
        python3 Scripts/SdkPackager.py "$target" . cmake
    ) || fail_bento4_install "$work_dir" "could not package Bento4"

    sdk_dir=$(find "$source_dir/SDK" -mindepth 1 -maxdepth 1 -type d \
        -name "Bento4-SDK-*.$target" -print -quit)
    [ -n "$sdk_dir" ] || fail_bento4_install "$work_dir" "Bento4 SDK output was not created"
    [ -x "$sdk_dir/bin/mp4hls" ] || \
        fail_bento4_install "$work_dir" "Bento4 mp4hls was not packaged"
    "$sdk_dir/bin/mp4hls" --help >/dev/null || \
        fail_bento4_install "$work_dir" "Bento4 mp4hls failed its smoke test"
    mkdir -p "$(dirname "$install_dir")"
    mv "$sdk_dir" "$install_dir" || \
        fail_bento4_install "$work_dir" "could not install Bento4 to $install_dir"
    [ -x "$install_dir/bin/mp4hls" ] || \
        fail_bento4_install "$work_dir" "Bento4 mp4hls was not installed"
    rm -rf "$work_dir"
    echo "Bento4 installed to $install_dir"
}

install_project_npm() {
    local package_file="$1"
    local package_manager
    local expected_version
    local installed_version

    [ -f "$package_file" ] || fail "frontend package file not found at $package_file"
    package_manager=$(node -e 'console.log(require(process.argv[1]).packageManager)' "$package_file") || \
        fail "could not read packageManager from $package_file"
    case "$package_manager" in
        npm@*) expected_version="${package_manager#npm@}" ;;
        *) fail "unsupported frontend package manager $package_manager" ;;
    esac
    npm install --global "$package_manager" || fail "could not install $package_manager"
    installed_version=$(npm -v) || fail "could not read the installed npm version"
    [ "$installed_version" = "$expected_version" ] || \
        fail "expected npm $expected_version after installation; found $installed_version"
}

configure_package_manager() {
    if [ "${NON_INTERACTIVE:-false}" = true ]; then
        export DEBIAN_FRONTEND=noninteractive
    fi
}

report_unexpected_failure() {
    local status="$1"
    local line="$2"
    trap - ERR
    echo "Error: installation failed during $CURRENT_STEP at line $line" >&2
    exit "$status"
}

if [[ "${BASH_SOURCE[0]}" != "$0" ]]; then
    return 0
fi

set -Eeuo pipefail
umask 022
CURRENT_STEP="startup checks"
trap 'report_unexpected_failure "$?" "$LINENO"' ERR

NON_INTERACTIVE=false
DRY_RUN=false
CHECK_PLATFORM=false
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
        --check-platform)
            CHECK_PLATFORM=true
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

if [ "$CHECK_PLATFORM" = true ]; then
    check_supported_platform
    exit 0
fi

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

configure_package_manager
echo "Welcome to the Cinemata installation!"

if [ "$(id -u)" -ne 0 ]; then
    fail "installer must run as root"
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


CURRENT_STEP="platform validation"
check_supported_platform
CURRENT_STEP="system dependency installation"
echo 'Performing system update and dependency installation, this will take a few minutes'
apt-get update && apt-get -y upgrade && apt-get install python3-venv python3-dev python3-virtualenv python3-pip virtualenv redis-server postgresql nginx git gcc vim unzip ffmpeg imagemagick telnet htop certbot make build-essential libssl-dev zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev wget curl llvm libncurses5-dev libncursesw5-dev xz-utils tk-dev libffi-dev liblzma-dev python3-openssl python3-certbot cmake libpq-dev python3-certbot-nginx -y

CURRENT_STEP="PostgreSQL and Redis startup"
ensure_services_ready

CURRENT_STEP="media dependency installation"
command -v ffmpeg >/dev/null 2>&1 || fail "Ubuntu ffmpeg package did not install ffmpeg"
command -v ffprobe >/dev/null 2>&1 || fail "Ubuntu ffmpeg package did not install ffprobe"
ffmpeg -version >/dev/null
ffprobe -version >/dev/null
install_bento4 "$SYSTEM_ARCHITECTURE"

echo 'Creating database to be used in CinemataCMS'

CURRENT_STEP="database initialization"
su -c "psql -c \"CREATE DATABASE mediacms\"" postgres
su -c "psql -c \"CREATE USER mediacms WITH ENCRYPTED PASSWORD 'mediacms'\"" postgres
su -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE mediacms TO mediacms\"" postgres

CURRENT_STEP="Node.js and npm installation"
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
        install_project_npm "$SCRIPT_DIR/frontend/package.json"
        hash -r
    else
        echo "Error: Node.js installation script failed"; exit 1
    fi
else
    echo "Warning: Could not install Node.js - install script not found"; exit 1
fi

CURRENT_STEP="Python dependency installation"
echo 'Creating python virtualenv on /home/cinemata'

cd /home/cinemata || exit 1
virtualenv . --python=python3
# shellcheck source=/dev/null
source /home/cinemata/bin/activate
cd cinematacms || exit 1
pip install -r requirements.txt
CURRENT_STEP="Whisper dependency installation"
cd .. && git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp/ || exit 1
bash ./models/download-ggml-model.sh base
make
cd ../cinematacms || exit 1

SECRET_KEY=$(python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')

CURRENT_STEP="application settings"
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
    echo "MP4HLS_COMMAND = '/opt/bento4/bin/mp4hls'"
} >> cms/local_settings.py

mkdir -p logs
mkdir -p pids

# Build frontend if Node.js is available
CURRENT_STEP="frontend build"
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


CURRENT_STEP="database migrations and fixtures"
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
CURRENT_STEP="administrator account creation"
echo "from users.models import User; User.objects.create_superuser('admin', 'admin@example.com', '$ADMIN_PASS')" | python manage.py shell

# Configure Django Site with proper error handling
CURRENT_STEP="site configuration"
echo "Configuring Django Site..."
if ! python manage.py update_site_name --name "$PORTAL_NAME" --domain "$FRONTEND_HOST"; then
    echo "Error: Failed to configure Django Site. Aborting installation."
    exit 1
fi

chown -R www-data. /home/cinemata/
CURRENT_STEP="nginx and service configuration"
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

CURRENT_STEP="TLS certificate configuration"
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

mkdir -p /home/cinemata/cinematacms/media_files/hls

# Create user logos directory and default avatar
CURRENT_STEP="media directory initialization"
echo "Creating default user avatar..."
mkdir -p /home/cinemata/cinematacms/media_files/userlogos
wget -O /home/cinemata/cinematacms/media_files/userlogos/user.jpg "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y"

# last, set default owner
chown -R www-data. /home/cinemata/

echo 'Cinemata installation completed, open browser on http://'"$FRONTEND_HOST"' and login with user admin and password '"$ADMIN_PASS"''
