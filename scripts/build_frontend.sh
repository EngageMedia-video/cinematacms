#!/bin/bash

# Exit on error
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting frontend build process...${NC}"

# Function to build a package
build_package() {
    local package_path=$1
    local package_name=$2

    echo -e "${YELLOW}Building ${package_name}...${NC}"
    cd "$package_path"

    # Check if package.json exists
    if [ ! -f "package.json" ]; then
        echo -e "${RED}Warning: package.json not found in ${package_path}${NC}"
        return 1
    fi

    # Always install dependencies to ensure consistency
    echo "Installing dependencies for ${package_name}..."
    npm install

    # Run build
    npm run build
    echo -e "${GREEN}✓ ${package_name} built successfully${NC}"
}

# Get the script directory (should be in scripts/)
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Build frontend packages
echo -e "${YELLOW}Building frontend packages...${NC}"

# Build vjs-plugin-font-icons
if [ -d "${PROJECT_ROOT}/frontend/packages/vjs-plugin-font-icons" ]; then
    build_package "${PROJECT_ROOT}/frontend/packages/vjs-plugin-font-icons" "vjs-plugin-font-icons"
fi

# Build vjs-plugin
if [ -d "${PROJECT_ROOT}/frontend/packages/vjs-plugin" ]; then
    build_package "${PROJECT_ROOT}/frontend/packages/vjs-plugin" "vjs-plugin"
fi

# Build media-player
if [ -d "${PROJECT_ROOT}/frontend/packages/media-player" ]; then
    build_package "${PROJECT_ROOT}/frontend/packages/media-player" "media-player"
fi

# Build main frontend application
echo -e "${YELLOW}Building main frontend application...${NC}"
cd "${PROJECT_ROOT}/frontend"

# Always install dependencies to ensure consistency
echo "Installing frontend dependencies..."
npm install

# Run the main build
npm run build
echo -e "${GREEN}✓ Main frontend built successfully${NC}"

# Return to project root
cd "${PROJECT_ROOT}"

# Run Django collectstatic (with error handling)
echo -e "${YELLOW}Running Django collectstatic...${NC}"
if python manage.py collectstatic --noinput 2>/dev/null; then
    echo -e "${GREEN}✅ Frontend build and deployment complete!${NC}"
    echo -e "${GREEN}Static files collected to: ${PROJECT_ROOT}/static_collected/${NC}"
else
    echo -e "${YELLOW}⚠️  Warning: collectstatic failed (possibly due to missing Python dependencies)${NC}"
    echo -e "${GREEN}✅ Frontend build complete!${NC}"
    echo -e "${GREEN}Frontend files built to: ${PROJECT_ROOT}/frontend/build/production/static/${NC}"
    echo -e "${YELLOW}To complete static file collection, fix any Python dependencies and run:${NC}"
    echo -e "${YELLOW}  python manage.py collectstatic --noinput${NC}"
fi