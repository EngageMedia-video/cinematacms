#!/bin/bash
# Moves the application virtualenv of an existing install to a uv-managed
# Python, or back to the virtualenv it used before. See "Move to another Python"
# in deploy/README.md. install.sh sources this file for the build functions, so
# nothing below runs until main.

PYTHON_RUNTIME_VERSION=3.14
# uv picks the patch release of PYTHON_RUNTIME_VERSION, so this pin also fixes the interpreter build.
UV_VERSION=0.13.9

RUNTIME_ROOT="${CINEMATA_DEPLOY_ROOT:-/}"
RUNTIME_ROOT="${RUNTIME_ROOT%/}"
# Root-owned and outside /root, so the services, which run as www-data, can run the interpreter.
UV="$RUNTIME_ROOT/opt/cinematacms/bin/uv"
export UV_PYTHON_INSTALL_DIR="$RUNTIME_ROOT/opt/cinematacms/python"
CINEMATA_HOME="$RUNTIME_ROOT/home/cinemata"
CINEMATA_APP_DIR="$CINEMATA_HOME/cinematacms"
# Installs made before versioned virtualenvs use the home directory itself as the virtualenv.
LEGACY_PYTHON_VENV="$CINEMATA_HOME"
PYTHON_VENV_LINK="$CINEMATA_HOME/venv"
PYTHON_VENVS="$CINEMATA_HOME/venvs"
PYTHON_RUNTIME_VENV="$PYTHON_VENVS/py$PYTHON_RUNTIME_VERSION"
PREVIOUS_PYTHON_VENV_LINK="$PYTHON_VENVS/previous"

uv_archive_sha256() {
    case "$1" in
        x86_64) echo a7fbaff2b9a271d85c1bdb540941090fd1ce011797b4abeb48e4dcd39c2471d5 ;;
        aarch64) echo 0797542018e541a9288855df555c8077eed06f7a47d206362030480e8ecc9f3d ;;
        *) return 1 ;;
    esac
}

install_uv() {
    local architecture expected archive work
    # No uv yet is the usual case, not a failure. install.sh traps every failing command.
    case "$("$UV" --version 2>/dev/null || true)" in
        "uv $UV_VERSION" | "uv $UV_VERSION "*) return 0 ;;
    esac
    architecture=$(uname -m)
    expected=$(uv_archive_sha256 "$architecture") || {
        echo "Error: no uv $UV_VERSION build is pinned for $architecture." >&2
        return 1
    }
    archive="uv-$architecture-unknown-linux-gnu.tar.gz"
    work=$(mktemp -d)
    (
        trap 'rm -rf "$work"' EXIT
        echo "Installing uv $UV_VERSION to $UV"
        curl --fail --silent --show-error --location --proto '=https' --tlsv1.2 \
            --output "$work/$archive" "https://github.com/astral-sh/uv/releases/download/$UV_VERSION/$archive"
        if ! echo "$expected  $work/$archive" | sha256sum --check --status; then
            echo "Error: $archive does not match the checksum pinned for uv $UV_VERSION." >&2
            exit 1
        fi
        tar -xzf "$work/$archive" -C "$work"
        install -D -m 0755 "$work/${archive%.tar.gz}/uv" "$UV"
    )
}

# A virtualenv whose interpreter runs is kept, because building it again recompiles uWSGI.
build_python_venv() {
    local venv=$1
    install_uv
    "$UV" python install --no-config --no-bin "$PYTHON_RUNTIME_VERSION"
    if ! "$venv/bin/python" -c '' 2>/dev/null; then
        echo "Creating the Python $PYTHON_RUNTIME_VERSION virtualenv at $venv"
        mkdir -p "$(dirname "$venv")"
        "$UV" venv --no-project --no-config --managed-python --seed --clear \
            --python "$PYTHON_RUNTIME_VERSION" "$venv"
    fi
    install_python_requirements_into "$venv"
}

install_python_requirements_into() {
    local venv=$1
    echo "Installing $CINEMATA_APP_DIR/requirements.txt into $venv"
    "$venv/bin/pip" install --disable-pip-version-check -r "$CINEMATA_APP_DIR/requirements.txt"
}

# The services run as www-data with /etc/cinematacms/app.env, so the check does too.
check_python_venv() {
    local venv=$1
    echo "Checking the application with $venv as www-data"
    (
        set -a
        # shellcheck source=/dev/null
        source "$RUNTIME_ROOT/etc/cinematacms/app.env"
        set +a
        cd "$CINEMATA_APP_DIR"
        runuser -u www-data -- "$venv/bin/python" manage.py check
    )
}

# rename(2) puts the new link in place of the old one in one step.
point_python_venv_link() {
    local link=$1 venv=$2
    rm -f "$link.new"
    ln -s "$venv" "$link.new"
    python3 -c 'import os, sys; os.replace(sys.argv[1], sys.argv[2])' "$link.new" "$link"
}

adopt_legacy_python_venv() {
    if [ -e "$PYTHON_VENV_LINK" ]; then
        return 0
    fi
    if [ -L "$PYTHON_VENV_LINK" ]; then
        echo "Error: $PYTHON_VENV_LINK points at $(readlink "$PYTHON_VENV_LINK"), which does not exist." >&2
        return 1
    fi
    if [ ! -x "$LEGACY_PYTHON_VENV/bin/python" ]; then
        echo "Error: $PYTHON_VENV_LINK is missing and $LEGACY_PYTHON_VENV holds no virtualenv to link it to." >&2
        return 1
    fi
    echo "Linking $PYTHON_VENV_LINK to the virtualenv at $LEGACY_PYTHON_VENV"
    point_python_venv_link "$PYTHON_VENV_LINK" "$LEGACY_PYTHON_VENV"
}

# Installs the units of the checkout, which run from the link, and restarts the services.
restart_on_python_venv() {
    "$CINEMATA_APP_DIR/deploy/apply-release-config.sh"
}

switch_python_venv() {
    local venv=$1
    point_python_venv_link "$PYTHON_VENV_LINK" "$venv"
    # Deploys reset the ownership of /home/cinemata to www-data. The interpreter itself stays root's.
    chown -R www-data: "$PYTHON_VENVS"
    chown -h www-data: "$PYTHON_VENV_LINK"
    restart_on_python_venv
    echo "The application now runs on $("$PYTHON_VENV_LINK/bin/python" --version) from $venv."
}

migrate_python_runtime() {
    local active
    active=$(readlink -f "$PYTHON_VENV_LINK")
    build_python_venv "$PYTHON_RUNTIME_VENV"
    check_python_venv "$PYTHON_RUNTIME_VENV"
    if [ ! "$active" -ef "$PYTHON_RUNTIME_VENV" ]; then
        point_python_venv_link "$PREVIOUS_PYTHON_VENV_LINK" "$active"
    fi
    switch_python_venv "$PYTHON_RUNTIME_VENV"
}

# Deploys since the migration installed packages only into the active virtualenv,
# so the previous one gets the requirements of the checkout before it serves again.
roll_back_python_runtime() {
    local previous
    if [ ! -L "$PREVIOUS_PYTHON_VENV_LINK" ]; then
        echo "Error: $PREVIOUS_PYTHON_VENV_LINK does not exist, so no earlier virtualenv is known." >&2
        return 1
    fi
    previous=$(readlink -f "$PREVIOUS_PYTHON_VENV_LINK")
    install_python_requirements_into "$previous"
    check_python_venv "$previous"
    switch_python_venv "$previous"
}

main() {
    set -Eeuo pipefail
    umask 022
    local mode=migrate
    case "${1:-}" in
        "") ;;
        --rollback) mode=rollback ;;
        --adopt-legacy-venv) mode=adopt ;;
        -h | --help)
            cat <<EOF
Usage: sudo $0 [--rollback]

Without an option, builds $PYTHON_RUNTIME_VENV from a uv-managed Python
$PYTHON_RUNTIME_VERSION and requirements.txt, checks the application with it,
points $PYTHON_VENV_LINK at it, and restarts the services. The virtualenv that
the link named before is kept and recorded as the previous one.

Options:
  --rollback           Point $PYTHON_VENV_LINK back at the previous virtualenv
                       and restart the services.
  --adopt-legacy-venv  Only link $PYTHON_VENV_LINK to an older install's
                       virtualenv when the link is missing. The deploy scripts
                       run this before they use the link.

Runs no database migration and changes no code.
EOF
            return 0
            ;;
        *)
            echo "Unknown argument: $1 (try --help)" >&2
            return 2
            ;;
    esac
    if [ "$#" -gt 1 ]; then
        echo "Unexpected argument: $2 (try --help)" >&2
        return 2
    fi
    if [ "${CINEMATA_SKIP_ROOT_CHECK:-0}" != 1 ] && [ "$(id -u)" -ne 0 ]; then
        echo "Error: run this command as root." >&2
        return 1
    fi

    adopt_legacy_python_venv
    case "$mode" in
        migrate) migrate_python_runtime ;;
        rollback) roll_back_python_runtime ;;
    esac
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
    main "$@"
fi
