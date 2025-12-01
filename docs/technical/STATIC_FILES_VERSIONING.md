# Static Files Versioning (Cache Busting)

This document explains the static files versioning system implemented in CinemataCMS to prevent browser caching issues after deployments.

## Problem

When you deploy updated CSS/JS files with the same filenames, browsers often serve cached versions instead of the new files, causing users to see outdated styling or broken functionality until they manually clear their cache.

## Solution

We use **content-based hashing** where each file's name includes an 8-character hash of its content:
- `index.js` becomes `index-75dac8d2.js`
- `_commons.css` becomes `_commons-c4b2b610.css`
- `_extra.css` becomes `_extra-a1b2c3d4.css`

When content changes, the hash changes, forcing browsers to download the new file. Unchanged files keep the same hash and remain cached.

## How It Works

### 1. Webpack Build (Content Hashing)

**File**: `frontend/scripts/utils/webpack-config/webpack.configuration.js`

- Production JS files use `[name]-[contenthash:8].js` format
- Production CSS files use `[name]-[contenthash:8].css` format
- Copied files (like `_extra.css`) use CopyPlugin's `[contenthash:8]` for consistent hashing
- Development builds use `[name].js` / `[name].css` (no hashing for easier debugging)

### 2. Manifest Generation

**File**: `frontend/scripts/utils/webpack-config/webpack.configuration.js`

During production builds, the official `webpack-manifest-plugin` (3.5M+ weekly npm downloads) generates `static/manifest.json`:

```json
{
  "js/index.js": "js/index-75dac8d2.js",
  "css/_commons.css": "css/_commons-c4b2b610.css",
  "css/_extra.css": "css/_extra-a1b2c3d4.css",
  ...
}
```

This maps original filenames → hashed filenames.

**Note**: Copied files like `_extra.css` are injected into the manifest by a custom `InjectCopiedAssetsToManifestPlugin` that runs after the main manifest generation.

### 3. Django Template Integration

**File**: `files/templatetags/webpack_manifest.py`

A custom Django template tag reads the manifest and returns hashed filenames:

```django
{% load webpack_manifest %}
<script src="{% hashed_static 'js/index.js' %}"></script>
```

This outputs: `<script src="/static/js/index-75dac8d2.js"></script>`

### 4. Django Storage Backend

**File**: `cms/storage.py`

`WebpackHashedFilesStorage` is a simple storage backend that:
- Collects static files without post-processing (webpack already added hashes)
- Avoids Django's URL rewriting which can cause issues with missing fonts

**Configuration** (`cms/settings.py`):
```python
STORAGES = {
    "staticfiles": {
        "BACKEND": "cms.storage.WebpackHashedFilesStorage",
    },
}
```

## Usage in Templates

### Option 1: Combined Tag (Recommended)
```django
{% load webpack_manifest %}
<script src="{% hashed_static 'js/index.js' %}"></script>
<link href="{% hashed_static 'css/media.css' %}" rel="stylesheet">
```

### Option 2: Separate Tags
```django
{% load static webpack_manifest %}
<script src="{% static static_hashed 'js/index.js' %}"></script>
```

## Build Process

### Development
```bash
make frontend-dev
# Serves unversioned files (e.g., index.js) for faster builds
```

### Production
```bash
make frontend-build
# or
./scripts/build_frontend.sh

# Generates:
# 1. Hashed files in frontend/build/production/static/
# 2. manifest.json
# 3. Runs collectstatic to copy to static_collected/
```

After building, always run:
```bash
python manage.py collectstatic --noinput
```

## Updating Existing Templates

To enable versioning in a Django template:

1. Add the template tag library:
```django
{% load webpack_manifest %}
```

2. Replace static references:
```django
{# OLD #}
<script src="{% static 'js/index.js' %}"></script>

{# NEW #}
<script src="{% hashed_static 'js/index.js' %}"></script>
```

## File Structure

```
frontend/
├── build/production/
│   ├── static/
│   │   ├── manifest.json          # Webpack-generated manifest
│   │   ├── js/
│   │   │   ├── index-75dac8d2.js  # Hashed JS files
│   │   │   └── _commons-669c12a7.js
│   │   └── css/
│   │       ├── media-31847d02.css  # Hashed CSS files
│   │       ├── _commons-c4b2b610.css
│   │       └── _extra-a1b2c3d4.css # Copied with content hash
│   └── *.html                       # Webpack-generated HTML (standalone pages)

static_collected/                    # Django's collected static files
├── manifest.json                    # Copied from frontend build
├── js/
│   └── index-75dac8d2.js
└── css/
    ├── _commons-c4b2b610.css
    └── _extra-a1b2c3d4.css
```

## Troubleshooting

### Issue: Template shows 404 for JS/CSS files

**Cause**: Manifest not loaded or file path incorrect

**Solution**:
1. Verify manifest exists: `cat static_collected/manifest.json`
2. Check the file path matches what's in manifest
3. Run collectstatic: `python manage.py collectstatic`

### Issue: Changes not appearing after deployment

**Possible causes**:
1. **Didn't rebuild frontend**: Run `make frontend-build`
2. **Didn't run collectstatic**: Run `python manage.py collectstatic`
3. **Template not using versioned tag**: Add `{% load webpack_manifest %}` and use `{% hashed_static %}`

### Issue: Development server shows wrong files

**Expected behavior**: Development uses webpack-dev-server which serves unversioned files directly from `frontend/src/`. The versioning only applies to production builds.

## Why Content Hashing Instead of ?v=timestamp?

You might wonder: "Why not just add `?v=12345` to files?" Here's why content hashing is better:

### Content Hashing Advantages:
1. **CDN/Proxy Friendly**: Some CDNs strip or ignore query parameters, treating `app.js?v=1` and `app.js?v=2` as the same file
2. **Selective Updates**: Only changed files get new hashes. Query params change ALL files on every deploy, invalidating caches unnecessarily
3. **Immutable Caching**: Content-hashed files can have far-future expires headers (1 year+) since filename guarantees uniqueness
4. **Reliable**: Browsers treat different filenames as truly different resources

### Query Parameter Limitations:
- Some aggressive caching proxies ignore query strings
- All files appear "new" on every deployment (wastes bandwidth)
- Can't safely set long cache headers
- Browser cache behavior less predictable

## Performance Benefits

With this system:
- **Unchanged files**: Keep same hash, stay cached indefinitely
- **Changed files**: Get new hash, downloaded immediately
- **Far-future caching**: Set `Cache-Control: max-age=31536000, immutable` on hashed assets
- **Zero manual cache clearing**: Users automatically get latest files

## Alternative: Simple Query Parameter Versioning

If content hashing feels too complex, here's a simpler alternative using query parameters:

```django
{# Create a simple template tag in files/templatetags/simple_versioning.py #}
import time
from django import template
register = template.Library()

@register.simple_tag
def versioned_static(path):
    from django.templatetags.static import static
    return f"{static(path)}?v={int(time.time())}"

{# Use in templates #}
{% load simple_versioning %}
<script src="{% versioned_static 'js/index.js' %}"></script>
```

This is much simpler but has the limitations mentioned above.

## Maintenance

### When to Update Manifest

The manifest is automatically regenerated on every production build. No manual updates needed.

### Clearing Old Files

Old hashed files accumulate over time. Periodically clean up:

```bash
# In frontend/build/production/static/
# Keep only files referenced in manifest.json

# Example cleanup script:
python manage.py collectstatic --noinput --clear
```

### Monitoring

Check manifest is current:
```bash
cat static_collected/manifest.json | grep "js/index.js"
# Should show: "js/index.js": "js/index-XXXXXXXX.js"
```

## References

- **Webpack contenthash**: https://webpack.js.org/guides/caching/
- **Django static files**: https://docs.djangoproject.com/en/stable/howto/static-files/
- **Cache-Control headers**: https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cache-Control
