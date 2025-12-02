"""
Django template tags for integrating webpack content-hashed assets.

Provides template tags that read the webpack-generated manifest.json
and return content-hashed filenames for static assets.

Two tags are available:

1. hashed_static (recommended) - Returns the full static URL:
    {% load webpack_manifest %}
    <script src="{% hashed_static 'js/index.js' %}"></script>
    <!-- Output: /static/js/index-75dac8d2.js -->

2. static_hashed - Returns only the hashed path (must combine with {% static %}):
    {% load static webpack_manifest %}
    {% with hashed_path=static_hashed:'js/index.js' %}
    <script src="{% static hashed_path %}"></script>
    {% endwith %}
    <!-- Output: /static/js/index-75dac8d2.js -->

Use `hashed_static` for convenience. Use `static_hashed` only if you need
the raw hashed path for other processing.
"""
import json
import logging
import os
from django import template
from django.conf import settings
from django.contrib.staticfiles.storage import staticfiles_storage

logger = logging.getLogger(__name__)
register = template.Library()

# Cache the manifest in memory to avoid reading the file on every request
_manifest_cache = None


def _load_manifest():
    """
    Load the webpack manifest.json file.

    Returns a dictionary mapping original filenames to hashed filenames.
    Falls back to returning the original filename if manifest is not found.
    """
    global _manifest_cache

    if _manifest_cache is not None and not settings.DEBUG:
        return _manifest_cache

    # Try to find manifest.json in static files
    manifest_path = None

    # First, try the collected static files (production)
    if hasattr(settings, 'STATIC_ROOT') and settings.STATIC_ROOT:
        candidate = os.path.join(settings.STATIC_ROOT, 'manifest.json')
        if os.path.exists(candidate):
            manifest_path = candidate

    # If not found, try the source static dirs (development)
    # STATICFILES_DIRS entries can be strings or (prefix, path) tuples
    if not manifest_path and hasattr(settings, 'STATICFILES_DIRS'):
        for static_dir in settings.STATICFILES_DIRS:
            # Handle both string paths and (prefix, path) tuples
            if isinstance(static_dir, (list, tuple)) and len(static_dir) == 2:
                dir_path = static_dir[1]
            else:
                dir_path = static_dir
            candidate = os.path.join(dir_path, 'manifest.json')
            if os.path.exists(candidate):
                manifest_path = candidate
                break

    if manifest_path and os.path.exists(manifest_path):
        try:
            with open(manifest_path, 'r', encoding='utf-8') as f:
                _manifest_cache = json.load(f)
                return _manifest_cache
        except OSError as e:
            logger.error(
                "Failed to read webpack manifest file '%s': %s",
                manifest_path, e
            )
            _manifest_cache = {}
            return _manifest_cache
        except json.JSONDecodeError as e:
            logger.error(
                "Failed to parse webpack manifest JSON '%s': %s",
                manifest_path, e
            )
            _manifest_cache = {}
            return _manifest_cache

    # Return empty dict if manifest not found (will fall back to original names)
    _manifest_cache = {}
    return _manifest_cache


@register.simple_tag
def static_hashed(path):
    """
    Template tag to get the content-hashed path of a static file.

    Returns only the hashed path (e.g., 'js/index-75dac8d2.js'), NOT a full URL.
    Use with Django's {% static %} tag or {% with %} to get a complete URL.

    Args:
        path: The original path relative to STATIC_URL (e.g., 'js/index.js')

    Returns:
        The hashed path if found in manifest, otherwise the original path.

    Example (using {% with %} since template tags cannot be nested):
        {% load static webpack_manifest %}
        {% with hashed_path=static_hashed:'js/index.js' %}
        <script src="{% static hashed_path %}"></script>
        {% endwith %}

    Recommended: Use {% hashed_static %} instead for convenience:
        <script src="{% hashed_static 'js/index.js' %}"></script>
    """
    manifest = _load_manifest()
    hashed_path = manifest.get(path, path)
    return hashed_path


@register.simple_tag
def hashed_static(path):
    """
    Combined template tag that returns the full static URL with content hash.

    This combines static_hashed and Django's staticfiles_storage.url()
    for convenience.

    Args:
        path: The original path relative to STATIC_URL (e.g., 'js/index.js')

    Returns:
        The full static URL with content hash (e.g., '/static/js/index-75dac8d2.js')

    Example:
        {% load webpack_manifest %}
        <script src="{% hashed_static 'js/index.js' %}"></script>
    """
    manifest = _load_manifest()
    hashed_path = manifest.get(path, path)
    return staticfiles_storage.url(hashed_path)
