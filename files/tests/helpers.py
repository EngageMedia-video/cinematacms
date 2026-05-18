"""Shared test helpers for the files app."""

import json
import uuid
from unittest.mock import MagicMock, patch

from django.contrib.auth import get_user_model

from files.models import Media

User = get_user_model()


def create_test_user(**kwargs):
    """Create a user with a unique username to avoid conflicts in mirrored test DBs."""
    defaults = {
        "username": f"test_{uuid.uuid4().hex[:8]}",
        "password": "testpass1234567890",
    }
    defaults.update(kwargs)
    return User.objects.create_user(**defaults)


def create_test_media(user, **kwargs):
    """Create test media. State is set via update() to bypass save() override."""
    state = kwargs.pop("state", "public")
    defaults = {
        "media_type": "video",
        "duration": 120,
        "views": 0,
        "likes": 0,
        "dislikes": 0,
        "reported_times": 0,
        "encoding_status": "success",
        "is_reviewed": True,
    }
    defaults.update(kwargs)
    with patch.object(Media, "media_init", return_value=None):
        media = Media.objects.create(title="Test", user=user, **defaults)
    # Set state after creation to avoid save() overriding it with get_default_state()
    Media.objects.filter(pk=media.pk).update(state=state)
    media.refresh_from_db()
    return media


def make_vite_loader_mock():
    """Return a mock DjangoViteAssetLoader that emits no-op asset tags."""
    mock_instance = MagicMock()
    mock_instance.generate_vite_asset.return_value = ""
    mock_instance.generate_vite_asset_url.return_value = "/static/fake.js"
    mock_instance.generate_vite_legacy_polyfills.return_value = ""
    mock_instance.generate_vite_react_hmr.return_value = ""
    return mock_instance


def extract_json_script_body(content, script_id):
    """Return a json_script body by id, or None when the script tag is absent."""
    start_marker = f'id="{script_id}" type="application/json">'
    end_marker = "</script>"
    start = content.find(start_marker)
    if start == -1:
        return None
    start += len(start_marker)
    end = content.find(end_marker, start)
    if end == -1:
        return None
    return content[start:end]


def extract_json_script_payload(content, script_id):
    """Parse a json_script payload by id, or None when the script tag is absent."""
    body = extract_json_script_body(content, script_id)
    if body is None:
        return None
    return json.loads(body)
