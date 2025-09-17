#!/bin/bash

# Node.js v20 LTS Installation Script
# This script installs Node Version Manager (nvm) and Node.js v20 LTS
# Designed to work both standalone and when called from install.sh (as root)

set -e  # Exit on any error

echo "Starting Node.js v20 LTS installation..."

# Determine the target user and home directory
# If running as root (from install.sh), install for www-data user
if [ "$(id -u)" = "0" ]; then
    TARGET_USER="www-data"
    TARGET_HOME="/var/www"
    echo "Running as root, installing Node.js for user: $TARGET_USER"

    # Create home directory for www-data if it doesn't exist
    if [ ! -d "$TARGET_HOME" ]; then
        mkdir -p "$TARGET_HOME"
        chown $TARGET_USER:$TARGET_USER "$TARGET_HOME"
    fi
else
    TARGET_USER="$USER"
    TARGET_HOME="$HOME"
    echo "Installing Node.js for current user: $TARGET_USER"
fi

# Download and install nvm
echo "Downloading and installing nvm..."
if [ "$(id -u)" = "0" ]; then
    # Install as www-data user
    su - $TARGET_USER -s /bin/bash -c "curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash"

    # Also install for root to make it available during installation
    export NVM_DIR="/root/.nvm"
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
else
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
    export NVM_DIR="$TARGET_HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

# Load nvm for the current session
if [ "$(id -u)" = "0" ]; then
    # Load for root
    export NVM_DIR="/root/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

    # Install Node.js v20 LTS
    echo "Installing Node.js v20 LTS for root..."
    nvm install 20
    nvm use 20
    nvm alias default 20

    # Also install for www-data
    echo "Installing Node.js v20 LTS for $TARGET_USER..."
    su - $TARGET_USER -s /bin/bash -c '
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
        nvm install 20
        nvm use 20
        nvm alias default 20
    '
else
    export NVM_DIR="$TARGET_HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
    [ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

    # Install Node.js v20 LTS
    echo "Installing Node.js v20 LTS..."
    nvm install 20
    nvm use 20
    nvm alias default 20
fi

# Verify installations
echo "Verifying installations..."
if command -v node &> /dev/null; then
    echo "Node.js version: $(node -v)"
else
    echo "Warning: Node.js command not found in current shell"
fi

if command -v npm &> /dev/null; then
    echo "npm version: $(npm -v)"
else
    echo "Warning: npm command not found in current shell"
fi

echo "Node.js v20 LTS installation completed!"

if [ "$(id -u)" = "0" ]; then
    echo ""
    echo "Node.js has been installed for both root and $TARGET_USER users."
    echo "To use Node.js as $TARGET_USER, run:"
    echo "su - $TARGET_USER -c 'source ~/.nvm/nvm.sh && node -v'"
else
    echo ""
    echo "To use Node.js in new terminal sessions, run:"
    echo "source ~/.nvm/nvm.sh"
    echo ""
    echo "Or restart your terminal."
fi