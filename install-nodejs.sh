#!/bin/bash

# Node.js LTS Installation Script
# This script installs Node Version Manager (nvm) and Node.js LTS
# Designed to be run as root for building frontend static assets

set -Eeuo pipefail  # safer: exit on error, fail pipelines, and error on unset vars
umask 022
trap 'echo "Error on line $LINENO"; exit 1' ERR

NODE_MAJOR=26

echo "Starting Node.js v${NODE_MAJOR} LTS installation..."

# Check if running as root
if [ "$(id -u)" != "0" ]; then
    echo "Error: This script must be run as root to install Node.js for building frontend assets."
    echo "WARNING: Running Node.js/npm as root may pose security risks in production environments."
    echo "Please run: sudo ./install-nodejs.sh"
    exit 1
fi

# The Node.js 26 binary links against libatomic.so.1, which a minimal
# Ubuntu install does not ship.
echo "Installing Node.js runtime libraries..."
apt-get update
apt-get install -y libatomic1

# Install nvm for root user
echo "Installing nvm for root user..."
# Download and install nvm
echo "Downloading nvm installer..."
NVM_VERSION="${NVM_VERSION:-v0.40.3}"
NVM_INSTALL_TMP="${NVM_INSTALL_TMP:-/tmp/nvm-install.sh}"
curl --fail --location --silent --show-error --max-time 120 \
  "https://raw.githubusercontent.com/nvm-sh/nvm/${NVM_VERSION}/install.sh" \
  -o "${NVM_INSTALL_TMP}"
# Optional integrity check: provide NVM_INSTALL_SHA256 env var to enforce pinning
if [ -n "${NVM_INSTALL_SHA256:-}" ]; then
  echo "${NVM_INSTALL_SHA256}  ${NVM_INSTALL_TMP}" | sha256sum -c -
fi
bash "${NVM_INSTALL_TMP}"

# Load nvm for the current session.
# nvm.sh is not compatible with `set -euo pipefail`, so relax strict mode
# (and suspend the ERR trap) while sourcing it, then restore.
export NVM_DIR="$HOME/.nvm"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
    echo "Error: nvm.sh not found at $NVM_DIR/nvm.sh"
    exit 1
fi
trap - ERR
set +euo pipefail
\. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"
set -Eeuo pipefail
trap 'echo "Error on line $LINENO"; exit 1' ERR
if ! command -v nvm >/dev/null 2>&1; then
    echo "Error: nvm did not load from $NVM_DIR/nvm.sh"
    exit 1
fi

echo "Installing Node.js v${NODE_MAJOR} LTS..."
nvm install "$NODE_MAJOR" || { echo "Failed to install Node.js v${NODE_MAJOR}"; exit 1; }
nvm use "$NODE_MAJOR" || { echo "Failed to use Node.js v${NODE_MAJOR}"; exit 1; }
nvm alias default "$NODE_MAJOR" || { echo "Failed to set default Node.js version"; exit 1; }

# restart_script.sh runs under sudo without loading nvm, so it finds Node.js
# through these links. Repoint them on every run so an upgrade replaces the
# previous release line.
NODE_LINK_DIR="${NODE_LINK_DIR:-/usr/local/bin}"
NODE_BIN_DIR=$(dirname "$(nvm which "$NODE_MAJOR")")
echo "Linking node, npm and npx into ${NODE_LINK_DIR}..."
for tool in node npm npx; do
    ln -sfn "${NODE_BIN_DIR}/${tool}" "${NODE_LINK_DIR}/${tool}"
done

# Verify installation
echo ""
echo "Verifying installation..."
NODE_VERSION=$("${NODE_LINK_DIR}/node" -v 2>/dev/null) || { echo "Error: Node.js not found after installation"; exit 1; }
NPM_VERSION=$("${NODE_LINK_DIR}/npm" -v 2>/dev/null) || { echo "Error: npm not found after installation"; exit 1; }
case "$NODE_VERSION" in
    "v${NODE_MAJOR}."*) ;;
    *) echo "Error: ${NODE_LINK_DIR}/node is $NODE_VERSION, expected v${NODE_MAJOR}"; exit 1 ;;
esac
echo "Node.js version: $NODE_VERSION"
echo "npm version: $NPM_VERSION"

echo ""
echo "Node.js v${NODE_MAJOR} LTS installation completed successfully!"
echo ""
echo "Node.js has been installed for the root user."
echo "To use Node.js in future sessions, run:"
echo "source /root/.nvm/nvm.sh"
echo ""
echo "You can now build the frontend static assets."
