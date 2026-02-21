# Static Files Versioning (Cache Busting)

This document explains the static files versioning system implemented in CinemataCMS to prevent browser caching issues after deployments.

## Problem

When you deploy updated CSS/JS files with the same filenames, browsers often serve cached versions instead of the new files, causing users to see outdated styling or broken functionality until they manually clear their cache.

## Solution

We use **Vite's content-based hashing** where each built file's name includes a hash of its content:
- `base.js` becomes `assets/base-hW91NlS_.js`
- `_helpers.css` becomes `assets/_helpers-xk_PGhMb.css`

When content changes, the hash changes, forcing browsers to download the new file. Unchanged files keep the same hash and remain cached.

## How It Works

### 1. Vite Build (Content Hashing)

**File**: `frontend/vite.config.js`

Vite's production build outputs all assets to `build/production/static/assets/` with content hashes in filenames. This is Vite's default behavior — no special configuration needed.

### 2. Manifest Generation

During production builds, Vite generates `.vite/manifest.json`:

```json
{
  "src/entries/index.js": {
    "file": "assets/index-D_w1zyLc.js",
    "isEntry": true,
    "imports": ["assets/_helpers-B6jnsgqM.js", "assets/vendor-B0kd87Rs.js"],
    "css": ["assets/_helpers-xk_PGhMb.css", "assets/index-9tOe_Y_r.css"]
  }
}
```

This maps entry points to their hashed output files, including all CSS and JS dependencies in the chunk graph.

### 3. Django Template Integration (django-vite)

**Package**: `django-vite`

Django templates use `django-vite` template tags to load Vite-built assets:

```django
{% load django_vite %}
{% vite_asset 'src/entries/index.js' %}
```

This automatically outputs:
```html
<script type="module" src="/static/assets/index-D_w1zyLc.js"></script>
<link rel="stylesheet" href="/static/assets/_helpers-xk_PGhMb.css">
<link rel="stylesheet" href="/static/assets/index-9tOe_Y_r.css">
<link rel="modulepreload" href="/static/assets/_helpers-B6jnsgqM.js">
<link rel="modulepreload" href="/static/assets/vendor-B0kd87Rs.js">
```

### 4. Django Storage Backend

**Configuration** (`cms/settings.py`):
```python
STORAGES = {
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
}
```

We use plain `StaticFilesStorage` (not `ManifestStaticFilesStorage`) because:
- Vite already adds content hashes to filenames
- `ManifestStaticFilesStorage` would double-hash them (e.g., `index-D_w1zyLc.abc123.js`)
- It would also break font URL rewriting in CSS files

## Usage in Templates

```django
{% load django_vite %}

{# Load a page entry (includes all JS + CSS dependencies): #}
{% vite_asset 'src/entries/media.js' %}

{# For non-Vite static files (e.g., _extra.css) with query-string cache-busting: #}
{% load static %}
<link href="{% static 'css/_extra.css' %}?v={{ EXTRA_CSS_VERSION }}" rel="stylesheet">
```

## Build Process

### Development (with HMR)
```bash
# Terminal 1
VITE_DEV_MODE=True make dev-server

# Terminal 2
make frontend-dev

# Assets served directly from Vite dev server — no hashing, instant updates
```

### Production
```bash
make frontend-build
# or
./scripts/build_frontend.sh

# Generates:
# 1. Hashed files in frontend/build/production/static/assets/
# 2. .vite/manifest.json
# 3. Runs collectstatic to copy to static_collected/
```

## File Structure

```
frontend/
├── build/production/
│   └── static/
│       ├── .vite/
│       │   └── manifest.json         # Vite-generated manifest
│       └── assets/
│           ├── index-D_w1zyLc.js     # Hashed JS files
│           ├── vendor-B0kd87Rs.js    # Vendor chunk
│           ├── _helpers-xk_PGhMb.css # Hashed CSS files
│           └── media-DlFZhN3M.css

static_collected/                      # Django's collected static files
├── assets/                            # Copied from frontend build
│   ├── index-D_w1zyLc.js
│   └── _helpers-xk_PGhMb.css
├── css/
│   └── _extra.css                     # Non-Vite CSS (site customizations)
├── admin/                             # Django admin files
└── lib/                               # Third-party libraries
```

## Troubleshooting

### Issue: Template shows 404 for JS/CSS files

**Cause**: Manifest not found or collectstatic not run

**Solution**:
1. Run the build: `make frontend-build`
2. Verify manifest exists: `ls frontend/build/production/static/.vite/manifest.json`
3. Check DJANGO_VITE manifest_path in settings matches actual location

### Issue: Changes not appearing after deployment

**Possible causes**:
1. **Didn't rebuild frontend**: Run `make frontend-build`
2. **Didn't run collectstatic**: Run `uv run manage.py collectstatic --noinput`
3. **CDN cache**: Content-hashed filenames should prevent this, but invalidate CDN if needed

### Issue: Development server shows stale files

**Expected behavior**: When `VITE_DEV_MODE=True`, assets are served directly from the Vite dev server with no hashing. Changes appear instantly via HMR. If stale, check that Vite dev server is running.

## Cache Headers

### NGINX Configuration

```nginx
# Block Vite manifest from public access
location ^~ /static/.vite/ {
    return 404;
}

# Hashed assets — immutable cache
location ~* ^/static/assets/ {
    alias /home/cinemata/cinematacms/static_collected/assets/;
    expires 1y;
    add_header Cache-Control "public, max-age=31536000, immutable";
}

# All other static files (admin, lib, _extra.css) — moderate cache
location /static/ {
    alias /home/cinemata/cinematacms/static_collected/;
    expires 7d;
    add_header Cache-Control "public, max-age=604800, must-revalidate";
}
```

### Why Content Hashing Instead of ?v=timestamp?

1. **CDN/Proxy Friendly**: Some CDNs strip query parameters
2. **Selective Updates**: Only changed files get new hashes
3. **Immutable Caching**: Hashed files can have far-future expires headers
4. **Reliable**: Browsers treat different filenames as truly different resources

## Performance Benefits

- **Unchanged files**: Keep same hash, stay cached indefinitely
- **Changed files**: Get new hash, downloaded immediately
- **Code splitting**: Vite splits code into shared chunks — when one page changes, shared vendor chunks stay cached
- **Zero manual cache clearing**: Users automatically get latest files

## References

- **Vite build**: https://vite.dev/guide/build
- **django-vite**: https://github.com/MrBin99/django-vite
- **Cache-Control headers**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
