# Frontend Development Workflow

This document describes the frontend build and deployment process for CinemataCMS.

## Overview

The frontend consists of:

- Main frontend application (`/frontend`)
- VJS Plugin packages (`/frontend/packages/`)
  - `vjs-plugin`
  - `vjs-plugin-font-icons`
  - `media-player`

## Quick Start for Developers

### 1. After Making Frontend Changes

```bash
# Option 1: Use Makefile (Recommended)
make frontend-build

# Option 2: Use Django management command
./scripts/build_frontend.sh

# Option 3: Use the build script directly
./scripts/build_frontend.sh

# Option 4: Quick build (main app only, skips packages)
make quick-build
```

### 2. Development Workflow

```bash
# Start frontend dev server (hot reload)
make frontend-dev

# OR
cd frontend && npm start
```

### 3. Clean Build

```bash
# Remove all build artifacts
make frontend-clean

# Full rebuild
make frontend-clean && make frontend-build
```

## Understanding the Build Process

### Build Flow

1. **Build Frontend Packages** (in order):
   - `vjs-plugin-font-icons`
   - `vjs-plugin`
   - `media-player`

2. **Build Main Frontend Application**:
   - Runs `npm run build` in `/frontend`
   - Outputs to `/frontend/build/production/static/`

3. **Collect Static Files**:
   - Django's `collectstatic` command
   - Collects from:
     - `/frontend/build/production/static/` (frontend build)
     - `/static/` (existing static assets)
   - Outputs to: `/static_collected/`

### Directory Structure

```
cinematacms/
├── frontend/                      # Frontend source
│   ├── src/                      # Main app source
│   ├── build/                    # Build output
│   │   └── production/
│   │       └── static/          # Built assets
│   │               ├── css/     # Webpack-built CSS files
│   │               ├── js/      # Webpack-built JS files
│   │               └── ...      # Other built assets
│   └── packages/                # Frontend packages
│       ├── vjs-plugin/
│       ├── vjs-plugin-font-icons/
│       └── media-player/
├── static/                       # Django & third-party static files (DO NOT DELETE)
│   ├── admin/                   # Django admin static files
│   ├── lib/                     # Libraries (video.js, fonts, etc.)
│   ├── ckeditor/                # CKEditor assets
│   └── ...                      # Other Django app static files
├── static_collected/             # Final collected static files (git-ignored)
│   ├── css/                     # Frontend CSS from build
│   ├── js/                      # Frontend JS from build
│   ├── admin/                   # Django admin files
│   ├── lib/                     # Libraries
│   └── ...                      # All collected static assets
└── scripts/
    └── build_frontend.sh         # Build automation script
```

**Important**: The `static/` folder contains Django admin files, third-party libraries, and other non-frontend assets. Do NOT delete it - it's required for the application to function properly.

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make frontend-build` | Build all frontend packages and collect static |
| `make frontend-dev` | Start frontend development server |
| `make frontend-clean` | Clean all build directories |
| `make build-all` | Alias for frontend-build |
| `make quick-build` | Build main app only (skips packages) |

## Django Management Command

The `build_frontend` command provides fine-grained control:

```bash
# Full build (default)
./scripts/build_frontend.sh

# Skip package builds
./scripts/build_frontend.sh --skip-packages

# Skip main app build
./scripts/build_frontend.sh --skip-main

# Skip collectstatic
./scripts/build_frontend.sh --skip-collect

# Verbose output
./scripts/build_frontend.sh --verbose
```

## Configuration

### Django Settings

The following settings in `cms/settings.py` and `cms/local_settings.py` control static file handling:

```python
# Static files URL prefix
STATIC_URL = "/static/"

# Where collectstatic outputs files
STATIC_ROOT = os.path.join(BASE_DIR, "static_collected")

# Where Django looks for static files
STATICFILES_DIRS = [
    # Frontend build output has priority (includes css/, js/, images/, etc.)
    os.path.join(BASE_DIR, "frontend", "build", "production", "static"),
    # Additional static files directory (admin, lib, etc.)
    os.path.join(BASE_DIR, "static"),
]
```

**Note**: If you have a `cms/local_settings.py` file, make sure it includes the same `STATICFILES_DIRS` configuration, as it overrides the main settings.

## CI/CD Integration

For automated deployments:

```bash
# In your CI/CD pipeline
make frontend-build

# Or use Django command
./scripts/build_frontend.sh
```

## Troubleshooting

### Problem: Changes not appearing

1. Clear browser cache
2. Run `make frontend-clean && make frontend-build`
3. Check that `STATICFILES_DIRS` includes frontend build directory in both `settings.py` and `local_settings.py`

### Problem: Build fails

1. Check Node.js version: `node --version` (should be 14+)
2. Clear npm cache: `npm cache clean --force`
3. Remove node_modules and reinstall:
   ```bash
   cd frontend
   rm -rf node_modules package-lock.json
   npm install
   ```

### Problem: collectstatic reports 0 files

1. Check frontend build succeeded
2. Verify `frontend/build/production/static/` contains files
3. Check `STATICFILES_DIRS` configuration in both `settings.py` and `local_settings.py`
4. Ensure `static/` folder exists and contains Django admin/library files

### Problem: 404 errors for static files

1. Run `python manage.py collectstatic --noinput`
2. Check `STATIC_URL` and `STATIC_ROOT` configuration
3. Ensure web server is configured to serve from `STATIC_ROOT`

## Development Tips

1. **Use frontend dev server for rapid development**:
   - Changes are instantly reflected
   - No need to rebuild for every change

2. **Build only what changed**:
   - Use `--skip-packages` if only main app changed
   - Use `make quick-build` for quick iterations

3. **Automate with git hooks** (optional):
   ```bash
   # .git/hooks/pre-commit
   #!/bin/bash
   make frontend-build
   ```

## Important Notes

### About the static/ folder
- **DO NOT DELETE the `static/` folder** - it contains essential Django admin files, third-party libraries, and other non-frontend assets
- Frontend build files go to `frontend/build/production/static/`
- Both directories are needed and serve different purposes

## Production Deployment

For production:

1. Build frontend: `make frontend-build`
2. Static files are collected in `static_collected/`
3. Configure web server (nginx/apache) to serve from `STATIC_ROOT`
4. Use CDN for better performance (optional)

### Files Collection Summary

After running `make frontend-build` or `python manage.py collectstatic`:

- Frontend CSS/JS from `frontend/build/production/static/` → `static_collected/css/` and `static_collected/js/`
- Django admin files from `static/admin/` → `static_collected/admin/`
- Libraries from `static/lib/` → `static_collected/lib/`
- All other static assets → `static_collected/`

## Need Help?

- Check build logs in terminal output
- Review Django's collectstatic output
- Ensure all npm dependencies are installed
- Check file permissions on directories
- Verify both `settings.py` and `local_settings.py` have correct `STATICFILES_DIRS`