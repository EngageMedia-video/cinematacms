#!/bin/bash

# Node.js v20 LTS Installation Script
# This script installs Node Version Manager (nvm) and Node.js v20 LTS
# Designed to be run as root for building frontend static assets

set -Eeuo pipefail  # safer: exit on error, fail pipelines, and error on unset vars
umask 022
trap 'echo "Error on line $LINENO"; exit 1' ERR

echo "Starting Node.js v20 LTS installation..."

# Check if running as root
if [ "$(id -u)" != "0" ]; then
    echo "Error: This script must be run as root to install Node.js for building frontend assets."
    echo "WARNING: Running Node.js/npm as root may pose security risks in production environments."
    echo "Please run: sudo ./install-nodejs.sh"
    exit 1
fi

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
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# Load nvm for the current session
export NVM_DIR="$HOME/.nvm"
if [ -s "$NVM_DIR/nvm.sh" ]; then
    \. "$NVM_DIR/nvm.sh"
else
    echo "Error: nvm.sh not found at $NVM_DIR/nvm.sh"
    exit 1
fi
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Install Node.js v20 LTS
echo "Installing Node.js v20 LTS..."
nvm install 20 || { echo "Failed to install Node.js v20"; exit 1; }
nvm use 20 || { echo "Failed to use Node.js v20"; exit 1; }
nvm alias default 20 || { echo "Failed to set default Node.js version"; exit 1; }

# Verify installation
echo ""
echo "Verifying installation..."
NODE_VERSION=$(node -v 2>/dev/null) || { echo "Error: Node.js not found after installation"; exit 1; }
NPM_VERSION=$(npm -v 2>/dev/null) || { echo "Error: npm not found after installation"; exit 1; }
echo "Node.js version: $NODE_VERSION"
echo "npm version: $NPM_VERSION"

echo ""
echo "Node.js v20 LTS installation completed successfully!"
echo ""
echo "Node.js has been installed for the root user."
echo "To use Node.js in future sessions, run:"
echo "source /root/.nvm/nvm.sh"
echo ""
echo "You can now build the frontend static assets."