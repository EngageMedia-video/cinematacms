#!/bin/bash

# Node.js v20 LTS Installation Script
# This script installs Node Version Manager (nvm) and Node.js v20 LTS
# Designed to be run as root for building frontend static assets

set -e  # Exit on any error

echo "Starting Node.js v20 LTS installation..."

# Check if running as root
if [ "$(id -u)" != "0" ]; then
    echo "Error: This script must be run as root to install Node.js for building frontend assets."
    echo "Please run: sudo ./install-nodejs.sh"
    exit 1
fi

# Install nvm for root user
echo "Installing nvm for root user..."
export NVM_DIR="/root/.nvm"

# Download and install nvm
echo "Downloading and installing nvm..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

# Load nvm for the current session
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

# Install Node.js v20 LTS
echo "Installing Node.js v20 LTS..."
nvm install 20
nvm use 20
nvm alias default 20

# Verify installation
echo ""
echo "Verifying installation..."
echo "Node.js version: $(node -v)"
echo "npm version: $(npm -v)"

echo ""
echo "Node.js v20 LTS installation completed successfully!"
echo ""
echo "Node.js has been installed for the root user."
echo "To use Node.js in future sessions, run:"
echo "source /root/.nvm/nvm.sh"
echo ""
echo "You can now build the frontend static assets."