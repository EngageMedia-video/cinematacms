"""Shared test helpers for the files app."""

from unittest.mock import patch

from files.models import Media


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
