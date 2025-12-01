"""
Django template tags for integrating webpack content-hashed assets.

Provides a template tag that reads the webpack-generated manifest.json
and returns the content-hashed filename for a given asset.

Usage in templates:
    {% load webpack_manifest %}
    <script src="{% static_hashed 'js/index.js' %}"></script>

This will look up 'js/index.js' in the manifest and return something like
'js/index-75dac8d2.js', which Django's {% static %} tag then serves.
"""
import json
import os
from django import template
from django.conf import settings
from django.contrib.staticfiles.storage import staticfiles_storage

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
    if not manifest_path and hasattr(settings, 'STATICFILES_DIRS'):
        for static_dir in settings.STATICFILES_DIRS:
            candidate = os.path.join(static_dir, 'manifest.json')
            if os.path.exists(candidate):
                manifest_path = candidate
                break

    if manifest_path and os.path.exists(manifest_path):
        with open(manifest_path, 'r') as f:
            _manifest_cache = json.load(f)
            return _manifest_cache

    # Return empty dict if manifest not found (will fall back to original names)
    _manifest_cache = {}
    return _manifest_cache


@register.simple_tag
def static_hashed(path):
    """
    Template tag to get the content-hashed version of a static file.

    Args:
        path: The original path relative to STATIC_URL (e.g., 'js/index.js')

    Returns:
        The hashed path if found in manifest, otherwise the original path.

    Example:
        {% load webpack_manifest %}
        <script src="{% static static_hashed 'js/index.js' %}"></script>

    Or use the combined tag:
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
