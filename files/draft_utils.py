from django.template.defaultfilters import slugify
from django.utils import timezone

from .models import Category, ContentSensitivity, License, Tag, Topic

DRAFT_SCALAR_FIELDS = (
    "title",
    "summary",
    "description",
    "company",
    "website",
    "media_language",
    "media_country",
)
DRAFT_M2M_MODELS = {
    "category": Category,
    "topics": Topic,
    "content_sensitivity": ContentSensitivity,
}


def apply_tags(media, new_tags_value, user):
    """Replace a media's tags from a comma-separated string."""
    media.tags.clear()
    if not new_tags_value:
        return
    for raw in str(new_tags_value).split(","):
        tag_title = slugify(raw)
        if not tag_title:
            continue
        try:
            tag = Tag.objects.get(title=tag_title)
        except Tag.DoesNotExist:
            tag = Tag.objects.create(title=tag_title, user=user)
        media.tags.add(tag)


def draft_license_error(metadata):
    if metadata.get("no_license") or not metadata.get("custom_license"):
        return None
    try:
        license_id = int(metadata["custom_license"])
    except (TypeError, ValueError):
        return "Select a valid license."
    if not License.objects.filter(pk=license_id).exists():
        return "Select a valid license."
    return None


def apply_media_draft(media, metadata, user):
    """Leniently apply partial metadata, marking the media as a private draft."""
    for field in DRAFT_SCALAR_FIELDS:
        value = metadata.get(field)
        if value is not None:
            setattr(media, field, value)

    year = metadata.get("year_produced")
    if year == "other":
        year = metadata.get("year_produced_custom")
    if year not in (None, "", "other"):
        try:
            media.year_produced = int(year)
        except (TypeError, ValueError):
            pass

    if "enable_comments" in metadata:
        media.enable_comments = bool(metadata["enable_comments"])
    if "allow_download" in metadata:
        media.allow_download = bool(metadata["allow_download"])
    if "is_encrypted" in metadata:
        media.is_encrypted = bool(metadata["is_encrypted"])

    if metadata.get("no_license"):
        media.license = None
    elif metadata.get("custom_license"):
        try:
            license_id = int(metadata["custom_license"])
        except (TypeError, ValueError):
            pass
        else:
            if License.objects.filter(pk=license_id).exists():
                media.license_id = license_id

    # Drafts are always kept private and flagged out of the admin review queue.
    media.state = "private"
    media.is_draft = True
    media.metadata_saved_at = timezone.now()
    media.save()

    for field, model in DRAFT_M2M_MODELS.items():
        value = metadata.get(field)
        if isinstance(value, list):
            getattr(media, field).set(model.objects.filter(pk__in=value))

    if "new_tags" in metadata:
        apply_tags(media, metadata.get("new_tags"), user)


def form_data_to_draft_metadata(post_data):
    """Convert single-upload form data into the metadata dict used by draft saving."""
    metadata = {}
    for field in DRAFT_SCALAR_FIELDS:
        if field in post_data:
            metadata[field] = post_data.get(field)

    for field in DRAFT_M2M_MODELS:
        if field in post_data:
            metadata[field] = post_data.getlist(field)

    for field in (
        "year_produced",
        "year_produced_custom",
        "enable_comments",
        "allow_download",
        "custom_license",
        "no_license",
        "new_tags",
    ):
        if field in post_data:
            metadata[field] = post_data.get(field)

    metadata["enable_comments"] = "enable_comments" in post_data
    metadata["allow_download"] = "allow_download" in post_data
    metadata["no_license"] = "no_license" in post_data
    metadata["is_encrypted"] = "is_encrypted" in post_data
    return metadata
