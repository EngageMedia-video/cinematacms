# CinemataCMS Developer Onboarding Guide

Welcome to the CinemataCMS development team! This comprehensive guide will help you set up your local development environment across macOS, Linux, or Windows.

> **📖 Single Unified Guide:** All operating systems follow the same steps with OS-specific commands shown side-by-side.

## Table of Contents

- [Glossary](#glossary)
- [About CinemataCMS](#about-cinematacms)
- [Prerequisites](#prerequisites)
- [Installation Steps](#installation-steps)
- [Common Development Workflows](#common-development-workflows)
- [Project Architecture](#project-architecture)
- [Development Tools](#development-tools)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)
- [Contributing Guidelines](#contributing-guidelines)
  - [Git Strategy: Rebase for Linear History](#git-strategy-rebase-for-linear-history)
  - [Code Style](#code-style)

---

## Glossary

**ASR** - Automatic Speech Recognition; technology for converting spoken words to text, used for automated subtitling

**Celery** - Distributed task queue for async processing and scheduled jobs in Python applications

**CORS** - Cross-Origin Resource Sharing; security mechanism that allows controlled access to resources from different domains

**FFmpeg** - Open-source multimedia framework for video/audio processing, encoding, and streaming

**FIDO2** - Modern authentication standard used for multi-factor authentication and passwordless login

**HLS** - HTTP Live Streaming; adaptive bitrate streaming protocol for delivering video over HTTP

**MFA** - Multi-Factor Authentication; security measure requiring multiple verification methods to authenticate users

**nvm** - Node Version Manager; tool for managing multiple Node.js versions on a single machine

**TOCTOU** - Time-of-Check-Time-of-Use; race condition security vulnerability that occurs when a system's state changes between checking and using a resource

**WSL2** - Windows Subsystem for Linux 2; compatibility layer for running Linux environments directly on Windows

---

## About CinemataCMS

CinemataCMS is a Django-based video content management system built on MediaCMS, specifically enhanced for Asia-Pacific social issue filmmaking.

**Technology Stack:**
- **Backend:** Django (Python 3.10+), PostgreSQL (Docker), Redis (Docker)
- **Frontend:** React, webpack, SCSS
- **Task Processing:** Celery (beat, long, short, whisper queues)
- **Media Processing:** FFmpeg, WhisperCPP (ASR/transcription)
- **Package Management:** uv (Python), npm (JavaScript)
- **Infrastructure:** Docker & Docker Compose

**Core Features:**
- Video upload, encoding, and streaming
- Multi-format encoding (H.264, H.265, VP9)
- Automated speech recognition and subtitling
- User authentication with MFA support
- Role-based access control

**Development Architecture:**
- ✅ **Docker:** PostgreSQL, Redis
- 🐍 **Host:** Python/Django development server
- ⚛️ **Host:** Node.js/React frontend dev server
- 🔄 **Host:** Celery workers

---

## Quick Reference

> **⚡ TL;DR for experienced developers:**

```bash
# 1. Clone and setup
git clone https://github.com/EngageMedia-video/cinematacms
cd cinematacms
git clone https://github.com/ggerganov/whisper.cpp.git ../whisper.cpp
cd ../whisper.cpp && sh ./models/download-ggml-model.sh base && make && cd ../cinematacms

# 2. Start Docker services
make docker-up

# 3. Configure environment (follow Step 5 for details)
touch .env  # Add SECRET_KEY
# Create cms/local_settings.py and frontend/.env

# Create required directories
mkdir -p logs pids media_files/hls

# Make scripts executable
chmod +x scripts/build_frontend.sh

# 4. Install & build
uv sync
make frontend-build

# 5. Database setup
uv run manage.py makemigrations files users actions
uv run manage.py migrate
uv run manage.py loaddata fixtures/encoding_profiles.json
uv run manage.py loaddata fixtures/categories.json
uv run manage.py load_apac_languages
uv run manage.py populate_media_languages
uv run manage.py populate_media_countries
uv run manage.py populate_topics
uv run manage.py createsuperuser

# 6. Start services
make dev-server              # Django: http://127.0.0.1:8000
make celery-start-all        # Background workers
make frontend-dev            # React (optional): http://localhost:8088
```

**Access Points:**
- **Main App:** [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Admin Panel:** [http://127.0.0.1:8000/admin](http://127.0.0.1:8000/admin)
- **Frontend Dev (REST API pages only):** [http://localhost:8088](http://localhost:8088)
- **API:** [http://127.0.0.1:8000/api/v1](http://127.0.0.1:8000/api/v1)

**Important:** Frontend dev server (8088) only works for REST API pages. Django template pages (upload, edit) require port 8000.

---

## Prerequisites

### System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 8 GB | 16 GB |
| Storage | 20 GB free | 50 GB free |
| CPU | Dual-core | Quad-core or better |
| OS | macOS 13+, Ubuntu 22.04+, Windows 10/11 | Latest stable |

### Required Knowledge

- Python (Django basics)
- JavaScript/React (ES6+, hooks)
- Git (branching, PRs)
- Command line (bash/zsh/PowerShell)
- Docker (basic container concepts)

### Tested Dependencies

These versions are tested and confirmed working:

| Dependency | Version | Notes |
|------------|---------|-------|
| **Python** | 3.10+ | 3.10 recommended |
| **Node.js** | 20.x | **v20.19.1 recommended** — any Node.js 20.x version should work |
| **PostgreSQL** | 14+ | Via Docker (14-alpine) |
| **Redis** | 7+ | Via Docker (alpine) |
| **FFmpeg** | 4.4+ | For video processing |
| **Docker** | 20.10+ | Docker Compose included |
| **uv** | Latest | Python package manager |
| **npm** | 10+ | Comes with Node.js |

> **⚠️ Important:** Node.js v20.x is required for the frontend build. Version 20.19.1 is tested and recommended.

---

## Installation Steps

### Step 1: Install Package Manager & Docker

<details open>
<summary><strong>macOS</strong></summary>

```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Add Homebrew to PATH if prompted, then:
brew install docker
```

**Note:** Install Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop/) for GUI management.

</details>

<details>
<summary><strong>Ubuntu / Linux</strong></summary>

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install prerequisites
sudo apt install -y ca-certificates curl

# Add Docker's official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package index
sudo apt update

# Install Docker Engine, CLI, containerd, and Docker Compose plugin
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group (allows running Docker without sudo)
sudo usermod -aG docker $USER
newgrp docker

# Verify installation
docker --version
docker compose version
```

</details>

<details>
<summary><strong>Windows (WSL2)</strong></summary>

**In PowerShell (Administrator):**

```powershell
# Enable WSL2
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
Restart-Computer

# After restart, set WSL 2 as default
wsl --set-default-version 2

# Install Ubuntu 22.04
wsl --install -d Ubuntu-22.04
```

**Then install Docker Desktop:**
1. Download from [docker.com](https://www.docker.com/products/docker-desktop/)
2. Enable "Use WSL 2 instead of Hyper-V"
3. Settings → Resources → WSL Integration → Enable for Ubuntu-22.04

**All remaining steps run inside WSL2 Ubuntu terminal.**

</details>

---

### Step 2: Install Development Tools

<details open>
<summary><strong>macOS</strong></summary>

```bash
# Install system dependencies (excluding Node.js)
brew install wget openssl ffmpeg make cmake python bento4 uv

# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.zshrc  # or ~/.bash_profile for bash users

# Install the recommended Node.js version (any 20.x works, but 20.19.1 is tested)
nvm install 20.19.1 && nvm use 20.19.1 && nvm alias default 20.19.1

# Verify installations
node --version   # Should output v20.19.1 (recommended, any v20.x works)
uv --version
docker --version
```

</details>

<details>
<summary><strong>Ubuntu / Linux</strong></summary>

```bash
# Install system dependencies
sudo apt install -y git wget curl build-essential python3 python3-pip python3-dev python3-venv
sudo apt install -y libpq-dev libssl-dev libffi-dev ffmpeg cmake

# Install Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 20.19.1 && nvm use 20.19.1 && nvm alias default 20.19.1

# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc

# Verify installations
node --version
uv --version
docker --version
```

</details>

<details>
<summary><strong>Windows (WSL2)</strong></summary>

**In WSL2 Ubuntu terminal:**

```bash
# Install system dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install -y git wget curl build-essential libpq-dev libssl-dev libffi-dev ffmpeg cmake

# Install Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
source ~/.bashrc
nvm install 20.19.1 && nvm use 20.19.1 && nvm alias default 20.19.1

# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh
source ~/.bashrc

# Verify installations
node --version
uv --version
docker --version  # Should work if Docker Desktop is integrated
```

</details>

---

### Step 3: Clone Repositories

**All operating systems use the same commands:**

```bash
# Create working directory
mkdir -p ~/cinemata && cd ~/cinemata

# Clone CinemataCMS
git clone https://github.com/EngageMedia-video/cinematacms cinematacms
cd cinematacms

# The repository includes .nvmrc files specifying Node.js v20 (any 20.x version)
# nvm will automatically switch to Node 20.x when you cd into the directory
# Run 'nvm use' manually if auto-switching doesn't work
# Note: v20.19.1 is the tested/recommended version from the install steps above

# Clone Whisper.cpp for ASR
cd ~/cinemata
git clone https://github.com/ggerganov/whisper.cpp.git
cd whisper.cpp
sh ./models/download-ggml-model.sh base
make

# Return to cinematacms directory
cd ~/cinemata/cinematacms
```

---

### Step 4: Start Docker Services

**All operating systems use the same commands:**

```bash
# Start PostgreSQL and Redis containers
make docker-up

# Verify containers are running
make docker-ps
```

You should see two containers running:
- `cinematacms-db-1` (PostgreSQL on port 5432)
- `cinematacms-redis-1` (Redis on port 6379)

**Database connection details (auto-configured):**
- Host: `localhost` (127.0.0.1)
- Port: `5432`
- Database: `mediacms`
- User: `mediacms`
- Password: `mediacms`

---

### Step 5: Configure Environment

**All operating systems use the same commands:**

```bash
# Copy example environment file
cp .env.example .env

# Generate Django secret key
python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
```

**Edit `.env` file:**

<details open>
<summary><strong>macOS</strong></summary>

```bash
open -a TextEdit .env
```

</details>

<details>
<summary><strong>Ubuntu / Windows (WSL2)</strong></summary>

```bash
nano .env
# or
vim .env
```

</details>

Add the generated secret key:

```bash
SECRET_KEY='YOUR_GENERATED_SECRET_KEY_HERE'
```

**Create `cms/local_settings.py`:**

```bash
cat > cms/local_settings.py << 'EOF'
import os
from dotenv import load_dotenv
load_dotenv()

BASE_DIR = os.path.abspath('.')
FRONTEND_HOST='http://127.0.0.1:8000'
PORTAL_NAME='CinemataCMS'
SSL_FRONTEND_HOST=FRONTEND_HOST.replace('http', 'https')
SECRET_KEY=os.getenv('SECRET_KEY')
LOCAL_INSTALL=True
DEBUG = True
ACCOUNT_EMAIL_VERIFICATION = "none"
USE_X_ACCEL_REDIRECT = False
CORS_ALLOW_ALL_ORIGINS = True
MFA_REQUIRED_ROLES = ['superuser']

# Redis configuration
REDIS_LOCATION = "redis://127.0.0.1:6379/1"
BROKER_URL = REDIS_LOCATION
CELERY_RESULT_BACKEND = BROKER_URL
EOF
```

**Additional Configuration - MP4HLS (if using HLS streaming):**

Check if mp4hls is installed and configure the path:

```bash
# Check if mp4hls is available
which mp4hls

# If found, add to local_settings.py
if command -v mp4hls &> /dev/null; then
    echo "
# MP4HLS command path
MP4HLS_COMMAND = '$(which mp4hls)'
" >> cms/local_settings.py
    echo "✅ MP4HLS configured"
else
    echo "⚠️  MP4HLS not found - HLS streaming will be disabled"
    echo "   Install bento4 if you need HLS support:"
    echo "   - macOS: brew install bento4"
    echo "   - Ubuntu: Download from https://github.com/axiomatic-systems/Bento4/releases"
fi
```

<details>
<summary><strong>Installing Bento4/MP4HLS (Optional)</strong></summary>

**macOS:**
```bash
brew install bento4
```

**Ubuntu/Linux:**
```bash
# Download latest release
wget https://github.com/axiomatic-systems/Bento4/releases/download/v1-6-0-639/Bento4-SDK-1-6-0-639.x86_64-unknown-linux.zip
unzip Bento4-SDK-*.zip
sudo cp Bento4-SDK-*/bin/mp4hls /usr/local/bin/
sudo chmod +x /usr/local/bin/mp4hls
```

**Windows (WSL2):**
```bash
# Same as Ubuntu/Linux
wget https://github.com/axiomatic-systems/Bento4/releases/download/v1-6-0-639/Bento4-SDK-1-6-0-639.x86_64-unknown-linux.zip
unzip Bento4-SDK-*.zip
sudo cp Bento4-SDK-*/bin/mp4hls /usr/local/bin/
sudo chmod +x /usr/local/bin/mp4hls
```

</details>

---

### Step 6: Install Dependencies & Build

**All operating systems use the same commands:**

```bash
# Install Python dependencies
uv sync

# Create required directories
mkdir -p logs pids media_files/hls

# Make scripts executable
chmod +x scripts/build_frontend.sh

# Run database migrations
uv run manage.py makemigrations files users actions
uv run manage.py migrate

# Load initial data
uv run manage.py loaddata fixtures/encoding_profiles.json
uv run manage.py loaddata fixtures/categories.json
uv run manage.py load_apac_languages
uv run manage.py populate_media_languages
uv run manage.py populate_media_countries
uv run manage.py populate_topics

# Configure frontend environment
cat > frontend/.env << 'EOF'
# MediaCMS Environment Variables
WEBPACK_SERVE=false

# Site Configuration
MEDIACMS_ID=cinematacms-frontend
MEDIACMS_TITLE=Cinemata
MEDIACMS_URL=http://127.0.0.1:8000
MEDIACMS_API=http://127.0.0.1:8000/api/v1

# User Configuration (optional for dev)
MEDIACMS_USER_NAME=
MEDIACMS_USER_USERNAME=
MEDIACMS_USER_THUMB=
MEDIACMS_USER_IS_ADMIN=false
MEDIACMS_USER_IS_ANONYMOUS=true
EOF

# Build frontend
bash scripts/build_frontend.sh
```

**Expected build time:** 5-10 minutes for frontend build

---

### Step 7: Create Admin User

**All operating systems use the same commands:**

#### Option 1: Interactive (recommended)

```bash
uv run manage.py createsuperuser
```

#### Option 2: Auto-generated password

```bash
ADMIN_PASS=$(python3 -c "import secrets;chars='abcdefghijklmnopqrstuvwxyz0123456789';print(''.join(secrets.choice(chars) for i in range(12)))")
echo "from users.models import User; User.objects.create_superuser('admin', 'admin@example.com', '$ADMIN_PASS')" | uv run manage.py shell
echo "========================================="
echo "Admin username: admin"
echo "Admin password: $ADMIN_PASS"
echo "========================================="
echo "SAVE THIS PASSWORD!"
```

---

### Step 8: Start Development Server

**All operating systems use the same commands:**

```bash
# Start Django development server
make dev-server

# Or directly:
# uv run python manage.py runserver
```

**Access the application:**
- URL: **[http://127.0.0.1:8000](http://127.0.0.1:8000)**
- Admin: **[http://127.0.0.1:8000/admin](http://127.0.0.1:8000/admin)**
- Username: `admin`
- Password: (from Step 7)

---

### Step 9: Start Celery Workers (Optional)

**All operating systems use the same commands:**

Open new terminal windows/tabs for each worker:

```bash
# Terminal 1: Start all workers at once
make celery-start-all

# OR start individually:

# Terminal 1: Celery Beat (scheduler)
make celery-beat-start

# Terminal 2: Short tasks
make celery-short-start

# Terminal 3: Long tasks (video encoding)
make celery-long-start

# Terminal 4: Whisper tasks (transcription)
make celery-whisper-start

# Check status
make celery-status
```

---

### Step 10: Start Frontend Dev Server (Optional)

For frontend development with hot-reload:

```bash
# In a new terminal
make frontend-dev

# Or directly:
# cd frontend && npm start
```

Access at **http://localhost:8088**

> **⚠️ Important:** The frontend dev server (port 8088) only works for **REST API-based pages** (media viewing, profiles, search). Django template-based pages (upload, edit media, admin) must be accessed via the **Django server** (port 8000).
>
> See [Frontend Development Workflow](#frontend-development-workflow) for detailed information about the hybrid architecture and when to use each server.

---

## Post-Installation Verification

After completing the installation, verify everything is working correctly:

### ✅ Verification Checklist

#### 1. Check Docker Services

```bash
# Verify Docker containers are running
make docker-ps

# Expected output: Both 'db' and 'redis' containers should be running
# STATUS column should show 'Up'
```

#### 2. Verify Django Server

```bash
# Server should be running from Step 8
# Access: http://127.0.0.1:8000

# You should see the CinemataCMS homepage
# Check terminal for any errors
```

✅ **Expected:** Homepage loads without errors
❌ **If fails:** Check [Troubleshooting](#troubleshooting) section

#### 3. Test Admin Login

```bash
# Access: http://127.0.0.1:8000/admin
# Login with credentials from Step 7
```

✅ **Expected:** Admin dashboard loads
❌ **If fails:** Verify superuser creation in Step 7

#### 4. Verify Celery Workers (Optional but recommended)

```bash
# Check worker status
make celery-status

# Expected output: Shows running workers
# - celery_beat: Running
# - celery_long: Running
# - celery_short: Running
# - celery_whisper: Running
```

#### 5. Test File Upload

```bash
# 1. Login to admin panel: http://127.0.0.1:8000/admin
# 2. Navigate to: http://127.0.0.1:8000/upload
# 3. Try uploading a small test video/image
```

✅ **Expected:** Upload succeeds, file appears in media list
❌ **If fails:** Check Celery workers are running

#### 6. Check Database Connection

```bash
# Test database connectivity
make docker-shell-db
# or: docker-compose -f docker-compose.dev.yml exec db psql -U mediacms -d mediacms

# In psql prompt, run:
\dt  # Should list database tables
\q   # Exit
```

✅ **Expected:** Tables are listed (users_user, files_media, etc.)

#### 7. Verify Frontend Dev Server (If running)

```bash
# Access: http://localhost:8088
# Try navigating to a media page or search
```

✅ **Expected:** Hot reload works, page loads
❌ **If fails:** Check Node.js version (must be 20.19.1)

### Quick Health Check Script

Run this comprehensive check:

```bash
# Quick health check
echo "=== CinemataCMS Health Check ==="

echo "✓ Checking Docker containers..."
docker ps --filter "name=db" --filter "name=redis" --format "table {{.Names}}\t{{.Status}}"

echo -e "\n✓ Checking Django server..."
curl -s -o /dev/null -w "Django: HTTP %{http_code}\n" http://127.0.0.1:8000

echo -e "\n✓ Checking admin panel..."
curl -s -o /dev/null -w "Admin: HTTP %{http_code}\n" http://127.0.0.1:8000/admin

echo -e "\n✓ Checking API..."
curl -s -o /dev/null -w "API: HTTP %{http_code}\n" http://127.0.0.1:8000/api/v1

echo -e "\n✓ Checking Celery workers..."
ps aux | grep celery | grep -v grep | wc -l | xargs -I {} echo "Celery workers: {} running"

echo -e "\n=== Health Check Complete ==="
```

✅ **All checks passed?** You're ready to start developing!
❌ **Some checks failed?** See [Troubleshooting](#troubleshooting) below

---

## Common Development Workflows

### Daily Workflow

```bash
# 1. Start Docker services
make docker-up

# 2. Start Django
make dev-server

# 3. (Optional) Start Celery workers
make celery-start-all

# 4. (Optional) Start frontend dev server
make frontend-dev
```

### Working with Docker

```bash
# View running containers
make docker-ps

# View logs
make docker-logs

# Restart services
make docker-restart

# Stop services
make docker-down

# Clean up (removes volumes and data!)
make docker-clean
```

### Database Operations

```bash
# Run migrations
uv run manage.py migrate

# Create migrations
uv run manage.py makemigrations

# Access PostgreSQL shell
make docker-shell-db

# Django ORM shell
uv run manage.py shell
```

### Frontend Development

**Development Server (with Hot Reload):**

```bash
# Start frontend dev server
make frontend-dev

# Or directly
cd frontend && npm start

# Access at http://localhost:8088
# Sitemap at http://localhost:8088/sitemap.html
```

**Building for Production:**

```bash
# Full production build (all packages + Django static collection)
make frontend-build

# Or step-by-step:
cd frontend && npm run build
uv run manage.py collectstatic --noinput

# Quick build (main app only, skips packages)
make quick-build

# Clean build artifacts
make frontend-clean
# Or: cd frontend && npm run clean-build
```

**Frontend Package Development:**

If working on packages (`media-player`, `vjs-plugin`, etc.):

```bash
# Navigate to package
cd frontend/packages/media-player

# Install dependencies
npm install

# Build package
npm run build

# Return to main frontend and rebuild
cd ../..
npm run build
```

**Available NPM Scripts:**

- `npm run start` - Development server with hot reload
- `npm run build` - Production build
- `npm run clean-build` - Clean and rebuild
- `npm run serve-build` - Serve built files locally

**Creating New Components:**

See [Frontend Development Guide](../customization/frontend-development.md) for:
- Component structure and patterns
- Creating pages with `usePage` hook
- Using React contexts
- Styling with SCSS/CSS modules
- Best practices and examples

### Running Tests

```bash
# Run all tests
uv run manage.py test

# Run specific app tests
uv run manage.py test files
uv run manage.py test users

# With options
uv run manage.py test --keepdb --parallel
```

---

## Project Architecture

### Backend Structure

```text
cinematacms/
├── cms/                    # Django project settings
│   ├── settings.py         # Main configuration
│   ├── local_settings.py   # Local overrides
│   └── celery.py          # Celery config
├── files/                  # Media management (9,585 LOC)
│   ├── models.py          # Media, Encoding, Category
│   ├── views.py           # Upload/edit workflows
│   ├── tasks.py           # Async processing
│   └── helpers.py         # Utilities
├── users/                  # Authentication & MFA
├── uploader/              # Chunked upload handling
├── actions/               # Likes, comments, ratings
└── docker-compose.dev.yml # Docker services config
```

### Frontend Structure

```text
frontend/
├── src/
│   ├── static/
│   │   ├── js/
│   │   │   ├── pages/          # Page components
│   │   │   ├── components/     # Reusable components
│   │   │   ├── contexts/       # React contexts
│   │   │   └── stores/         # Flux stores
│   │   └── css/
│   │       ├── config/         # Theme definitions
│   │       └── includes/       # SCSS partials
│   └── config/                 # Frontend config
├── packages/                   # Build before main app
│   ├── media-player/
│   ├── vjs-plugin/
│   └── vjs-plugin-font-icons/
└── build/production/static/    # Build output
```

### Key Patterns

1. **Async Processing:** Celery workers (beat, long, short, whisper queues)
2. **Cache Strategy:** Redis-backed with signal-based invalidation
3. **Media Serving:** NGINX X-Accel-Redirect in production
4. **Theme System:** CSS custom properties for light/dark modes
5. **Component Architecture:** React functional components with hooks

---

## Understanding the Codebase

### Finding Your Way Around

**"I want to..."** → **"Look here"**

| Task | File/Directory | Line Reference |
|------|----------------|----------------|
| **Change upload behavior** | `uploader/views.py` | Upload workflow logic |
| **Modify media encoding** | `files/tasks.py` | Encoding task: `encode_media()` |
| **Add new API endpoint** | `files/views.py` | REST API views |
| **Change media models** | `files/models.py` | Media, Encoding, Subtitle models |
| **Modify user authentication** | `users/models.py` | Custom User model |
| **Add frontend page** | `frontend/src/static/js/pages/` | React pages |
| **Create UI component** | `frontend/src/static/js/components/-NEW-/` | Modern component patterns |
| **Change theme colors** | `frontend/src/static/css/config/` | `_light_theme.scss`, `_dark_theme.scss` |
| **Add Celery task** | `<app>/tasks.py` | Define task function |
| **Configure settings** | `cms/local_settings.py` | Local development config |
| **Modify database schema** | Run `makemigrations` after model changes | Then `migrate` |

### Code Navigation by Feature

#### Media Upload Flow

```text
1. Frontend: templates/cms/add-media (Django template)
2. Backend: uploader/views.py → validate_file()
3. Processing: files/tasks.py → encode_media()
4. Storage: media_files/ directory
5. Database: files/models.py → Media object created
```

**Key files:**
- `uploader/views.py:upload_media_view()` - Main upload handler
- `files/tasks.py:encode_media()` - Async encoding
- `files/helpers.py:get_file_type()` - File validation

#### Video Encoding Pipeline

```text
1. Upload complete → Signal triggers
2. files/tasks.py → encode_media() task queued
3. Celery long_tasks worker picks up task
4. FFmpeg processes video (multiple resolutions)
5. Thumbnails generated
6. HLS segments created (if mp4hls available)
7. Database updated with encoding status
```

**Key files:**
- `files/tasks.py:encode_media()` - Main encoding logic
- `files/models.py:Encoding` - Encoding profile model
- `fixtures/encoding_profiles.json` - Available profiles

#### User Authentication & MFA

```text
1. Login: users/views.py → authenticate()
2. MFA check: users/models.py → User.mfa_required()
3. FIDO2 validation: django-allauth integration
4. Session created: Django session middleware
```

**Key files:**
- `users/models.py:User` - Custom user model
- `cms/settings.py` - MFA configuration
- `cms/local_settings.py:MFA_REQUIRED_ROLES` - Role requirements

#### Frontend Page Rendering

**Django Template Pages:**
```text
templates/cms/<page>.html → Django renders → Served directly
```

**React SPA Pages:**
```text
1. Django serves shell: templates/root.html
2. webpack bundles loaded
3. React router: frontend/src/static/js/
4. API calls: http://127.0.0.1:8000/api/v1
```

### Common Code Patterns

#### Adding a New Celery Task

```python
# In files/tasks.py (or any app/tasks.py)

from celery import shared_task
from .models import Media

@shared_task(queue='short_tasks')  # or 'long_tasks', 'whisper_tasks'
def my_new_task(media_id):
    """
    Task description.
    """
    try:
        media = Media.objects.get(id=media_id)
        # Do work here
        return {'status': 'success', 'media_id': media_id}
    except Media.DoesNotExist:
        return {'status': 'error', 'message': 'Media not found'}

# To call the task:
from files.tasks import my_new_task
my_new_task.apply_async(args=[media_id], queue='short_tasks')
```

#### Adding a New API Endpoint

```python
# In files/views.py

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status

@api_view(['GET', 'POST'])
def my_api_endpoint(request):
    """
    API endpoint description.
    """
    if request.method == 'GET':
        # Handle GET request
        data = {'message': 'Hello'}
        return Response(data)

    elif request.method == 'POST':
        # Handle POST request
        return Response({'status': 'created'}, status=status.HTTP_201_CREATED)

# Add to urls.py:
# path('api/v1/my-endpoint/', my_api_endpoint, name='my-endpoint'),
```

#### Creating a React Component

```jsx
// In frontend/src/static/js/components/-NEW-/MyFeature.jsx

import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import axios from 'axios';

export const MyFeature = ({ mediaId, onUpdate }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`/api/v1/media/${mediaId}/`)
      .then(response => {
        setData(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error:', error);
        setLoading(false);
      });
  }, [mediaId]);

  if (loading) return <div>Loading...</div>;

  return (
    <div className="my-feature">
      <h3>{data.title}</h3>
      <button onClick={onUpdate}>Update</button>
    </div>
  );
};

MyFeature.propTypes = {
  mediaId: PropTypes.string.isRequired,
  onUpdate: PropTypes.func,
};

export default MyFeature;
```

### Database Schema Quick Reference

**Main Models:**

- `users.User` - Custom user with MFA support
- `files.Media` - Videos, images, audio, PDFs
- `files.Encoding` - Video encoding profiles & results
- `files.Category` - Media categories/tags
- `files.Subtitle` - Video subtitles/captions
- `actions.MediaAction` - Likes, views, comments
- `files.Playlist` - User playlists

**Relationships:**
```python
Media → User (foreign key: author)
Media → Category (many-to-many)
Media → Encoding (one-to-many)
Media → Subtitle (one-to-many)
MediaAction → Media (foreign key)
MediaAction → User (foreign key)
```

### Where to Find Documentation

**In the codebase:**
- `/docs/setup/` - Setup guides (this file!)
- `/docs/customization/` - Frontend development, theming
- `README.md` - Project overview
- Inline docstrings in Python files
- JSDoc comments in JavaScript files

**External resources:**
- Django docs: [https://docs.djangoproject.com/](https://docs.djangoproject.com/)
- React docs: [https://react.dev/](https://react.dev/)
- Celery docs: [https://docs.celeryq.dev/](https://docs.celeryq.dev/)
- Video.js docs: [https://docs.videojs.com/](https://docs.videojs.com/)

---

## Frontend Development Workflow

### Technology Stack

- **React 17** - UI library
- **Flux** - State management pattern
- **SCSS/Sass** - Styling with CSS preprocessor
- **webpack** - Module bundler
- **Video.js** - Custom media player foundation
- **Node.js v20.19.1** - Build environment

### ⚠️ Important Limitations

CinemataCMS uses a **hybrid architecture** with both Django templates and React SPA:

- **Django Template Pages**: Some features are server-side rendered via Django templates (e.g., upload pages, admin interfaces, certain management views)
- **REST API Pages**: React SPA pages that consume the REST API

**Development Server Usage:**

| Feature Type | Server to Use | URL | Hot Reload |
|-------------|---------------|-----|-----------|
| **REST API pages** (media viewing, profiles, search) | Frontend Dev Server | `http://localhost:8088` | ✅ Yes |
| **Django template pages** (upload, edit media, admin) | Django Server | `http://127.0.0.1:8000` | ❌ No |
| **Production build testing** | Django Server | `http://127.0.0.1:8000` | ❌ No |

**When developing:**
- Use `npm start` (port 8088) for **React component/page development** with hot reload
- Use Django server (port 8000) for **Django template-based features** or full integration testing
- Always test final changes on the Django server before committing

### Frontend Environment Configuration

The frontend has its own `.env` file for development configuration:

**File:** `frontend/.env`

```bash
# MediaCMS Environment Variables
WEBPACK_SERVE=false

# Site Configuration
MEDIACMS_ID=cinematacms-frontend
MEDIACMS_TITLE=Cinemata
MEDIACMS_URL=http://127.0.0.1:8000
MEDIACMS_API=http://127.0.0.1:8000/api/v1

# User Configuration (optional for dev)
MEDIACMS_USER_NAME=
MEDIACMS_USER_USERNAME=
MEDIACMS_USER_THUMB=
MEDIACMS_USER_IS_ADMIN=false
MEDIACMS_USER_IS_ANONYMOUS=true
```

**Configuration Notes:**

- `MEDIACMS_URL` and `MEDIACMS_API` must point to your running Django server (port 8000)
- The frontend dev server (port 8088) proxies API requests to the Django server
- User configuration is typically empty in development (uses actual login state)
- `WEBPACK_SERVE=false` - Set to `true` only when running `npm start`

**To create the `.env` file:**

```bash
cd frontend
touch .env
```

Copy the configuration above and adjust if your Django server runs on a different port.

### Project Structure

```text
frontend/
├── src/static/js/
│   ├── pages/              # Full page components
│   ├── components/         # Reusable UI components
│   │   └── -NEW-/         # Modern components (use these patterns)
│   ├── contexts/           # React Context providers
│   ├── stores/             # Flux stores
│   └── actions/            # Flux actions
├── src/static/css/
│   ├── config/             # Theme variables (light/dark)
│   └── includes/           # SCSS partials and mixins
├── packages/               # Independent packages
│   ├── media-player/       # Custom Video.js player
│   ├── vjs-plugin/         # Video.js plugins
│   └── vjs-plugin-font-icons/
└── config/                 # Build configuration
    └── cinemata.config.js  # Main webpack config
```

### Development Workflow

**1. Start Development Server:**

```bash
cd frontend
npm start

# Access at http://localhost:8088
# Sitemap: http://localhost:8088/sitemap.html
```

Changes will hot-reload automatically.

**2. Creating a New Component:**

```bash
# Create component file
touch frontend/src/static/js/components/-NEW-/MyComponent.jsx
```

```jsx
import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';

export const MyComponent = ({ title, onAction }) => {
  const [state, setState] = useState(null);

  useEffect(() => {
    // Component lifecycle logic
    return () => {
      // Cleanup
    };
  }, []);

  return (
    <div className="my-component">
      <h2>{title}</h2>
      <button onClick={onAction}>Action</button>
    </div>
  );
};

MyComponent.propTypes = {
  title: PropTypes.string.isRequired,
  onAction: PropTypes.func,
};

export default MyComponent;
```

**3. Creating a New Page:**

```bash
# Create page file
touch frontend/src/static/js/pages/MyPage.jsx
```

```jsx
import React from 'react';
import { usePage, PageLayout } from './page';

const MyPage = ({ pageTitle = 'My Page' }) => {
  usePage('my-page'); // Initialize page

  return (
    <PageLayout>
      <div className="my-page">
        <h1>{pageTitle}</h1>
        {/* Page content */}
      </div>
    </PageLayout>
  );
};

export default MyPage;
```

**4. Register Page:**

Edit `frontend/config/cinemata/cinemata.mediacms.pages.config.js`:

```javascript
const { mediacmsDefaultPages } = require("../__default/mediacms.pages.config.js");

pages['my-page'] = mediacmsDefaultPages(
  'my-page',        // Page ID
  'My Page',        // Page title
  'MyPage',         // Component name
  { /* config */ }
);
```

**5. Styling Components:**

Create SCSS file: `frontend/src/static/css/components/_my-component.scss`

```scss
.my-component {
  padding: 1rem;
  background: var(--body-bg-color);
  color: var(--body-text-color);

  &__title {
    font-size: 1.5rem;
    margin-bottom: 1rem;
  }
}
```

Import in main stylesheet or component.

**6. Building for Production:**

```bash
# Full build (packages + main app + collectstatic)
make frontend-build

# Or manually:
cd frontend
npm run build
cd ..
uv run manage.py collectstatic --noinput
```

**7. Working with Packages:**

If modifying `media-player` or `vjs-plugin`:

```bash
# Build package first
cd frontend/packages/media-player
npm install && npm run build

# Then build main app
cd ../..
npm run build
```

### Using React Contexts

Available contexts in `frontend/src/static/js/contexts/`:

- **ThemeContext** - Light/dark theme state
- **UserContext** - Current user authentication
- **SiteContext** - Global site configuration
- **ApiUrlContext** - API endpoint URLs
- **PlaylistsContext** - User playlists

**Example:**

```jsx
import React, { useContext } from 'react';
import { ThemeContext } from '../contexts/ThemeContext';

const MyComponent = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <button onClick={toggleTheme}>
      Current theme: {theme}
    </button>
  );
};
```

### Theme System

CinemataCMS uses CSS custom properties for theming:

**Theme Variables** (`frontend/src/static/css/config/`):
- `_light_theme.scss` - Light mode colors
- `_dark_theme.scss` - Dark mode colors

**Common Variables:**
```scss
--body-bg-color
--body-text-color
--btn-primary-bg-color
--header-bg-color
--sidebar-bg-color
```

Use these in your components for theme support.

### Best Practices

1. **Use functional components** with hooks (not class components)
2. **Use PropTypes** for type checking
3. **Use contexts** for global state, Flux for complex state
4. **Follow existing naming conventions** in components
5. **Use SCSS partials** for modular styling
6. **Test in both themes** (light/dark)
7. **Check responsive design** at different breakpoints

### Detailed Guide

For comprehensive frontend development documentation, see:

📖 **[Frontend Development Guide](../customization/frontend-development.md)**

Covers:
- Detailed component patterns
- Page creation walkthrough
- DemoComponent and DemoPage examples
- Flux integration
- Advanced patterns
- Troubleshooting

---

## Development Tools

### Make Commands Reference

**Docker:**
```bash
make docker-up          # Start services
make docker-down        # Stop services
make docker-restart     # Restart services
make docker-ps          # List containers
make docker-logs        # View logs
make docker-shell-db    # PostgreSQL shell
make docker-shell-redis # Redis CLI
make docker-clean       # Remove volumes
```

**Development:**
```bash
make sync               # Install Python deps
make dev-server         # Start Django
make frontend-dev       # Start frontend dev server
make frontend-build     # Build frontend
make quick-build        # Quick frontend build
make frontend-clean     # Clean build artifacts
```

**Celery:**
```bash
make celery-start-all   # Start all workers
make celery-stop-all    # Stop all workers
make celery-restart-all # Restart all workers
make celery-status      # Check status
make celery-beat-start  # Individual workers...
make celery-long-start
make celery-short-start
make celery-whisper-start
```

### uv Commands

```bash
# Install/update dependencies
uv sync

# Run Python commands
uv run python manage.py <command>

# Run in virtual environment
uv run <command>
```

---

## Testing

### Running Tests

```bash
# All tests
uv run manage.py test

# Specific app
uv run manage.py test files

# With options
uv run manage.py test --keepdb --parallel -v 2

# Specific test
uv run manage.py test files.tests.test_models.MediaTestCase
```

### Test Organization

- `files/tests/` - Media management
- `users/tests/` - Authentication
- `tests/test_index_page_featured.py` - HTML sanitization
- `files/tests/test_race_conditions.py` - Concurrency

---

## IDE Setup Guide

### VS Code (Recommended)

#### 1. Install VS Code Extensions

Essential extensions for CinemataCMS development:

```bash
# Install via command line
code --install-extension ms-python.python
code --install-extension ms-python.vscode-pylance
code --install-extension batisteo.vscode-django
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
```

**Or install via VS Code:**
- **Python** (ms-python.python) - Python language support
- **Pylance** (ms-python.vscode-pylance) - Fast Python language server
- **Django** (batisteo.vscode-django) - Django template support
- **ESLint** (dbaeumer.vscode-eslint) - JavaScript linting
- **Prettier** (esbenp.prettier-vscode) - Code formatting
- **Tailwind CSS** (bradlc.vscode-tailwindcss) - CSS IntelliSense

#### 2. Configure VS Code Settings

Create `.vscode/settings.json` in the project root:

```json
{
  "python.defaultInterpreterPath": "${workspaceFolder}/.venv/bin/python",
  "python.linting.enabled": true,
  "python.linting.pylintEnabled": false,
  "python.linting.flake8Enabled": true,
  "python.formatting.provider": "black",
  "python.languageServer": "Pylance",

  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  },

  "[python]": {
    "editor.defaultFormatter": "ms-python.python",
    "editor.tabSize": 4
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.tabSize": 2
  },
  "[javascriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode",
    "editor.tabSize": 2
  },

  "files.exclude": {
    "**/__pycache__": true,
    "**/*.pyc": true,
    "**/.pytest_cache": true,
    "**/node_modules": true
  },

  "emmet.includeLanguages": {
    "django-html": "html"
  },

  "django-html": {
    "format.enable": true
  }
}
```

#### 3. Set Up Python Interpreter

```bash
# Open command palette (Cmd/Ctrl + Shift + P)
# Type: "Python: Select Interpreter"
# Choose: ./.venv/bin/python
```

Or click on the Python version in the bottom-left status bar.

#### 4. Debugging Configuration

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Django: runserver",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/manage.py",
      "args": [
        "runserver",
        "0.0.0.0:8000"
      ],
      "django": true,
      "justMyCode": false,
      "env": {
        "PYTHONPATH": "${workspaceFolder}"
      }
    },
    {
      "name": "Django: shell",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/manage.py",
      "args": [
        "shell"
      ],
      "django": true,
      "justMyCode": false
    },
    {
      "name": "Django: test",
      "type": "python",
      "request": "launch",
      "program": "${workspaceFolder}/manage.py",
      "args": [
        "test",
        "${file}"
      ],
      "django": true,
      "justMyCode": false
    }
  ]
}
```

#### 5. Using Debugger

- Set breakpoints by clicking left of line numbers
- Press `F5` or go to Run → Start Debugging
- Select "Django: runserver" configuration
- Use Debug Console to inspect variables

#### 6. Useful VS Code Shortcuts

```text
Cmd/Ctrl + P          - Quick file open
Cmd/Ctrl + Shift + P  - Command palette
Cmd/Ctrl + B          - Toggle sidebar
Cmd/Ctrl + `          - Toggle terminal
Cmd/Ctrl + Shift + F  - Search across files
F12                   - Go to definition
Shift + F12           - Find all references
Cmd/Ctrl + Click      - Go to definition
```

### PyCharm/IntelliJ IDEA

#### 1. Configure Python Interpreter

- File → Settings → Project → Python Interpreter
- Click gear icon → Add
- Select "Existing environment"
- Choose `.venv/bin/python`

#### 2. Configure Django Support

- File → Settings → Languages & Frameworks → Django
- Enable Django support
- Django project root: `<project root>`
- Settings: `cms/settings.py`
- Manage script: `manage.py`

#### 3. Run Configurations

Create a Django Server run configuration:
- Run → Edit Configurations → + → Django Server
- Host: `127.0.0.1`
- Port: `8000`
- Python interpreter: Project venv
- Environment variables: `DJANGO_SETTINGS_MODULE=cms.settings`

#### 4. Debugging

- Set breakpoints with `Cmd/Ctrl + F8`
- Run in debug mode with `Shift + F9`
- Use Debug console to evaluate expressions

### General IDE Tips

#### File Watchers

Set up automatic code formatting on save:
- Python: Use `black` for formatting
- JavaScript: Use `prettier`

#### Git Integration

All modern IDEs have built-in Git support:
- View changes in sidebar
- Commit directly from IDE
- Resolve merge conflicts visually
- View git history and blame

#### Database Tools

Most IDEs can connect to PostgreSQL:
- Host: `localhost`
- Port: `5432`
- Database: `mediacms`
- User: `mediacms`
- Password: `mediacms`

Use this to browse tables, run queries, and inspect data.

#### Terminal Integration

Use the built-in terminal for:
```bash
# All your make commands
make dev-server
make celery-start-all

# Django management commands
uv run manage.py shell
uv run manage.py test

# Git operations
git status
git commit -m "message"
```

---

## Troubleshooting

### Docker Issues

**Containers not starting:**

```bash
# Check Docker is running
docker ps

# macOS: Ensure Docker Desktop is running
# Windows: Ensure Docker Desktop + WSL2 integration enabled
# Linux: Check docker service
sudo systemctl status docker

# Restart containers
make docker-restart

# Clean and rebuild
make docker-clean
make docker-up
```

**Port already in use (5432/6379):**

<details>
<summary><strong>macOS</strong></summary>

```bash
# Check what's using the port
lsof -i :5432
lsof -i :6379

# Stop native PostgreSQL/Redis if running
brew services stop postgresql
brew services stop redis
```

</details>

<details>
<summary><strong>Ubuntu / Linux</strong></summary>

```bash
# Check port usage
sudo lsof -i :5432
sudo lsof -i :6379

# Stop services
sudo systemctl stop postgresql
sudo systemctl stop redis
```

</details>

<details>
<summary><strong>Windows (WSL2)</strong></summary>

```bash
# Check port usage
sudo lsof -i :5432
sudo lsof -i :6379

# Stop services in WSL2
sudo service postgresql stop
sudo service redis-server stop
```

</details>

### Database Connection Errors

```bash
# Verify containers are running
make docker-ps

# Check PostgreSQL logs
docker-compose -f docker-compose.dev.yml logs db

# Test connection
docker-compose -f docker-compose.dev.yml exec db psql -U mediacms -d mediacms -c '\l'

# Restart database
make docker-restart
```

### Frontend Build Failures

```bash
# Clean and rebuild
make frontend-clean
cd frontend && npm install
make frontend-build

# Check Node version
node --version  # Should be v20.19.1

# Reinstall Node if needed
nvm install 20.19.1 && nvm use 20.19.1
```

### Celery Workers Not Processing

```bash
# Check worker status
make celery-status

# View logs
tail -f logs/celery-*.log

# Restart workers
make celery-restart-all

# Check Redis connection
docker-compose -f docker-compose.dev.yml exec redis redis-cli ping
```

### Permission Errors

<details>
<summary><strong>macOS</strong></summary>

```bash
# Fix permissions
chmod -R 755 ~/cinemata/cinematacms
```

</details>

<details>
<summary><strong>Ubuntu / Linux / Windows (WSL2)</strong></summary>

```bash
# Fix ownership and permissions
sudo chown -R $USER:$USER ~/cinemata
chmod -R 755 ~/cinemata/cinematacms
```

</details>

### Port Already in Use Errors

**Port 8000 (Django) or 8088 (Frontend) already in use:**

```bash
# Find process using the port
# macOS/Linux:
lsof -i :8000
lsof -i :8088

# Kill the process
kill -9 <PID>

# Or find and kill in one command
lsof -ti:8000 | xargs kill -9
lsof -ti:8088 | xargs kill -9

# Windows (PowerShell):
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

### Python Version Errors

#### Error: Python 3.10+ required

```bash
# Check current version
python --version
python3 --version

# Install Python 3.10 using pyenv (recommended)
pyenv install 3.10
pyenv local 3.10

# macOS with Homebrew
brew install python@3.10

# Ubuntu/Linux
sudo apt install python3.10 python3.10-venv
```

### Node.js Version Errors

#### Error: Node.js v20.19.1 required or webpack build fails

```bash
# Check current version
node --version

# Install correct version with nvm
nvm install 20.19.1
nvm use 20.19.1
nvm alias default 20.19.1

# Verify
node --version  # Should output v20.19.1

# Reinstall frontend dependencies
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Database Migration Errors

#### Error: "relation already exists" or migration conflicts

```bash
# Option 1: Reset migrations (⚠️ Development only!)
# This will delete all data
make docker-down
make docker-clean
rm -f db.sqlite3  # If using SQLite during testing
make docker-up
uv run manage.py migrate

# Option 2: Fake migrations
uv run manage.py migrate --fake <app_name> <migration_number>

# Option 3: Start fresh with database
make docker-down
docker volume rm cinematacms_postgres_data
make docker-up
uv run manage.py migrate
uv run manage.py createsuperuser
```

### Static Files Not Loading

**CSS/JS files not loading or 404 errors:**

```bash
# Rebuild frontend and collect static files
make frontend-build
uv run manage.py collectstatic --noinput --clear

# Check STATIC_ROOT in local_settings.py
# Should have: USE_X_ACCEL_REDIRECT = False for local dev

# Restart Django server
# Kill current server (Ctrl+C) and restart
make dev-server
```

### File Upload Failures

**Upload fails or "Permission denied" errors:**

```bash
# Create required directories
mkdir -p media_files/hls logs pids

# Fix permissions
chmod -R 755 media_files logs pids

# Check Celery workers are running
make celery-status

# Check logs for errors
tail -f logs/celery-short.log
tail -f logs/celery-long.log

# Restart Celery workers
make celery-restart-all
```

### Video Encoding Errors

**Videos stuck in "processing" or encoding fails:**

```bash
# Check FFmpeg is installed
ffmpeg -version

# macOS
brew install ffmpeg

# Ubuntu/Linux
sudo apt install ffmpeg

# Check Celery long tasks worker
make celery-status
tail -f logs/celery-long.log

# Restart encoding worker
make celery-long-restart

# Check encoding profiles
uv run manage.py shell
>>> from files.models import EncodeProfile
>>> EncodeProfile.objects.all()
```

### Memory/Performance Issues

**System running slow or out of memory:**

```bash
# Check running processes
htop  # or 'top' on macOS

# Reduce Celery worker concurrency
# Edit: celeryconfig.py or use environment variables
export CELERY_WORKER_CONCURRENCY=2

# Stop unnecessary workers for development
# Only run what you need:
make celery-beat-start    # Required for scheduled tasks
make celery-short-start   # For quick operations
# Skip long/whisper workers if not encoding

# Clear Python cache
find . -type d -name __pycache__ -exec rm -r {} +
find . -type f -name "*.pyc" -delete

# Clean Docker
docker system prune -a --volumes  # ⚠️ Removes all unused Docker data
```

### `uv` Package Manager Issues

**Error: `uv: command not found`**

```bash
# Install uv
curl -LsSf https://astral.sh/uv/install.sh | sh

# Reload shell configuration
source ~/.bashrc  # or ~/.zshrc

# Verify installation
uv --version
```

**Error: `uv sync` fails or dependency conflicts**

```bash
# Clear cache and reinstall
uv cache clean
rm -rf .venv
uv sync

# If still failing, use pip fallback
python3 -m venv .venv
source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
```

### Frontend Dev Server Issues

**Port 8088 works but pages show errors:**

```bash
# Check .env file exists in frontend/
cat frontend/.env

# Should have:
# MEDIACMS_URL=http://127.0.0.1:8000
# MEDIACMS_API=http://127.0.0.1:8000/api/v1

# Ensure Django server is running on port 8000
# Frontend dev server proxies API requests to Django

# Check browser console for CORS errors
# Should have in cms/local_settings.py:
# CORS_ALLOW_ALL_ORIGINS = True
```

### Still Having Issues?

If your problem isn't listed here:

1. **Check the logs:**
   ```bash
   # Django server output
   # Celery logs
   tail -f logs/celery-*.log
   # Docker container logs
   make docker-logs
   ```

2. **Search existing issues:** [GitHub Issues](https://github.com/EngageMedia-video/cinematacms/issues)

3. **Ask for help:** Create a new issue with:
   - Operating system and version
   - Python/Node.js versions (`python --version`, `node --version`)
   - Full error message
   - Steps to reproduce
   - What you've already tried

---

## Contributing Guidelines

### Development Process

#### 1. Fork the Repository

Go to the [CinemataCMS repository](https://github.com/EngageMedia-video/cinematacms) and click the "Fork" button to create your own copy.

#### 2. Clone Your Fork

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/cinematacms.git
cd cinematacms

# Add upstream remote (main repository)
git remote add upstream https://github.com/EngageMedia-video/cinematacms.git

# Verify remotes
git remote -v
# origin    https://github.com/YOUR_USERNAME/cinematacms.git (fetch)
# origin    https://github.com/YOUR_USERNAME/cinematacms.git (push)
# upstream  https://github.com/EngageMedia-video/cinematacms.git (fetch)
# upstream  https://github.com/EngageMedia-video/cinematacms.git (push)
```

#### 3. Keep Your Fork Synced

**Always keep your fork's main branch in sync with the upstream repository.**

##### Option A: Using GitHub (Easiest)

1. Go to your fork on GitHub: `https://github.com/YOUR_USERNAME/cinematacms`
2. You'll see a message: "This branch is X commits behind EngageMedia-video:main"
3. Click **"Sync fork"** button
4. Click **"Update branch"**
5. Pull the changes locally:
   ```bash
   git checkout main
   git pull origin main
   ```

##### Option B: Using Command Line (with Rebase)

```bash
# Switch to main branch
git checkout main

# Fetch latest changes from upstream
git fetch upstream

# Rebase your main onto upstream/main (keeps linear history)
git rebase upstream/main

# Force push to your fork (safe on main after sync)
git push origin main --force-with-lease
```

> **💡 Tip:** Use the GitHub UI method (Option A) for a quick sync. Use command line with rebase (Option B) to maintain a clean, linear git history.

#### 4. Create Feature Branch

**Create a new branch from your synced main branch:**

```bash
# Ensure you're on main and it's up to date
git checkout main
git pull upstream main

# Create and switch to feature branch
git checkout -b feature/your-feature-name

# Or for bug fixes
git checkout -b fix/bug-description
```

#### 5. Make Changes

- Follow existing code style
- Write tests for new features
- Update documentation
- Keep commits focused and atomic

#### 6. Test Changes

```bash
# Run all tests
uv run manage.py test

# Run specific tests
uv run manage.py test files

# Check code quality
uv run python manage.py check
```

#### 7. Commit Changes

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: add subtitle auto-sync feature"

# Or for fixes
git commit -m "fix: resolve race condition in upload"
```

**Commit Message Format:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

#### 8. Rebase and Push to Your Fork

**Before pushing, rebase your feature branch onto the latest main for a clean, linear history:**

```bash
# Fetch latest changes from upstream
git fetch upstream

# Rebase your feature branch onto upstream/main
git rebase upstream/main

# If there are conflicts, resolve them, then:
git add .
git rebase --continue

# Push to your fork
# Use --force-with-lease if you've rebased
git push origin feature/your-feature-name --force-with-lease
```

**If this is your first push (no rebase needed):**

```bash
git push origin feature/your-feature-name
```

#### 9. Create Pull Request

1. Go to your fork on GitHub
2. Click "Compare & pull request" button
3. **Base repository:** `EngageMedia-video/cinematacms`
4. **Base branch:** `main`
5. **Head repository:** `YOUR_USERNAME/cinematacms`
6. **Compare branch:** `feature/your-feature-name`
7. Fill in PR description with:
   - What changes were made
   - Why the changes are needed
   - How to test the changes
   - Reference any related issues
8. Submit the pull request

> **Note:** Maintainers will use **"Squash and merge"** when merging your PR to keep the main branch history clean and linear.

#### 10. Respond to Review Feedback

##### Option A: Add new commits (if requested)

```bash
# Make requested changes
git add .
git commit -m "refactor: address review comments"
git push origin feature/your-feature-name
```

##### Option B: Amend existing commits (for minor fixes)

```bash
# Make changes
git add .

# Amend the last commit
git commit --amend --no-edit

# Force push (safe since it's your feature branch)
git push origin feature/your-feature-name --force-with-lease
```

##### Option C: Interactive rebase to clean up commits

```bash
# Rebase and squash commits interactively
git rebase -i upstream/main

# Mark commits to squash (s) or fixup (f)
# Save and exit

# Force push
git push origin feature/your-feature-name --force-with-lease
```

#### 11. After PR is Merged

```bash
# Switch back to main
git checkout main

# Sync with upstream
git pull upstream main
git push origin main

# Delete feature branch (optional)
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

### Git Strategy: Rebase for Linear History

We use **rebase** instead of merge to maintain a clean, linear git history:

**Why Rebase?**
- ✅ Clean, linear history without merge commits
- ✅ Easier to understand project evolution
- ✅ Easier to bisect when debugging
- ✅ Cleaner git log visualization

**Why Squash and Merge?**
- ✅ Each PR becomes a single commit in main
- ✅ Atomic changes per feature
- ✅ Easier rollbacks if needed

**Important Rules:**
- ⚠️ Always rebase feature branches onto `upstream/main`
- ⚠️ Use `--force-with-lease` when force pushing (safer than `--force`)
- ⚠️ Never rebase commits that have been pushed to main
- ⚠️ Maintainers use "Squash and merge" for all PRs

### Quick Reference

**Before starting new feature:**

```bash
# Option 1: Sync via GitHub UI, then pull
git checkout main
git pull origin main
git checkout -b feature/new-feature

# Option 2: Sync via command line with rebase
git checkout main
git fetch upstream
git rebase upstream/main
git push origin main --force-with-lease
git checkout -b feature/new-feature
```

**Working on feature:**

```bash
# Make changes
git add .
git commit -m "feat: description"

# Before pushing, rebase onto latest main
git fetch upstream
git rebase upstream/main

# Push (use --force-with-lease after rebase)
git push origin feature/new-feature --force-with-lease

# Then create PR on GitHub
```

**After PR is merged (squashed):**

```bash
# Sync fork on GitHub UI, then:
git checkout main
git pull origin main
git branch -d feature/old-feature  # Clean up

# Or via command line:
git checkout main
git fetch upstream
git rebase upstream/main
git push origin main --force-with-lease
git branch -d feature/old-feature
```

### Code Style

**Python:**
- Follow PEP 8
- Use Django best practices
- Add docstrings

**JavaScript/React:**
- Use ES6+ features
- Functional components with hooks
- PropTypes for type checking

**Git Commits:**
- Format: `type: description`
- Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`

---

## Next Steps

1. **Start Docker services:**
   ```bash
   make docker-up
   ```

2. **Verify installation:**
   - Access http://127.0.0.1:8000
   - Log in with admin account
   - Upload a test video

3. **Complete post-installation:**
   - Follow [Post-Installation Guide](./Post-installation-guide.md)
   - Upload and feature content
   - Test video encoding

4. **Start contributing:**
   - Pick a beginner-friendly issue
   - Create feature branch
   - Make your first PR!

---

## Additional Resources

- [Post-Installation Guide](./Post-installation-guide.md) - After setup steps
- [Creating Superuser](./creating_superuser.md) - Admin account setup

**External Documentation:**
- [Django](https://docs.djangoproject.com/)
- [React](https://react.dev/)
- [Celery](https://docs.celeryq.dev/)
- [Docker](https://docs.docker.com/)

---

**Welcome to the team! Happy coding! 🎬**
