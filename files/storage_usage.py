import logging
import os

from django.conf import settings
from django.core.cache import cache
from django.db import transaction
from django.db.models import Sum

logger = logging.getLogger(__name__)

STORAGE_USAGE_CACHE_TIMEOUT = 21600
SITE_STORAGE_USAGE_CACHE_KEY = "storage_usage:site"
USER_STORAGE_USAGE_CACHE_KEY = "storage_usage:user:{user_id}"


def user_storage_usage_cache_key(user_id):
    return USER_STORAGE_USAGE_CACHE_KEY.format(user_id=user_id)


def invalidate_storage_usage_cache(user_id=None):
    cache.delete(SITE_STORAGE_USAGE_CACHE_KEY)
    if user_id:
        cache.delete(user_storage_usage_cache_key(user_id))


def _normalize_local_path(path):
    if not path:
        return ""
    if os.path.isabs(path):
        return os.path.realpath(path)
    media_root = getattr(settings, "MEDIA_ROOT", "")
    if media_root:
        return os.path.realpath(os.path.join(media_root, path))
    return os.path.realpath(path)


def _safe_filefield_size(field_file, seen_paths):
    if not field_file:
        return 0

    name = getattr(field_file, "name", "")
    if not name:
        return 0

    local_path = ""
    try:
        local_path = field_file.path
    except (NotImplementedError, OSError, ValueError):
        local_path = ""

    if local_path:
        key = f"file:{_normalize_local_path(local_path)}"
    else:
        storage = getattr(field_file, "storage", None)
        storage_name = storage.__class__.__name__ if storage else "storage"
        key = f"storage:{storage_name}:{name}"

    if key in seen_paths:
        return 0

    try:
        if local_path and os.path.exists(local_path):
            size = os.path.getsize(local_path)
        else:
            storage = getattr(field_file, "storage", None)
            size = storage.size(name) if storage else field_file.size
    except (FileNotFoundError, OSError, ValueError) as e:
        logger.warning("Skipping missing media storage file %s: %s", name, e)
        return 0

    if not isinstance(size, int) or size < 0:
        return 0

    seen_paths.add(key)
    return size


def _safe_local_file_size(path, seen_paths):
    if not path:
        return 0

    local_path = _normalize_local_path(path)
    key = f"file:{local_path}"
    if key in seen_paths:
        return 0

    try:
        if not os.path.isfile(local_path):
            return 0
        size = os.path.getsize(local_path)
    except OSError as e:
        logger.warning("Skipping missing media storage file %s: %s", path, e)
        return 0

    if size < 0:
        return 0

    seen_paths.add(key)
    return size


def _safe_local_directory_size(path, seen_paths):
    if not path:
        return 0

    directory = path if os.path.isdir(path) else os.path.dirname(path)
    local_directory = _normalize_local_path(directory)
    if not os.path.isdir(local_directory):
        return 0

    total = 0
    for root, _, files in os.walk(local_directory):
        for filename in files:
            total += _safe_local_file_size(os.path.join(root, filename), seen_paths)
    return total


def calculate_media_storage_usage(media):
    seen_paths = set()
    total = 0

    for field_name in (
        "media_file",
        "thumbnail",
        "poster",
        "uploaded_thumbnail",
        "uploaded_poster",
        "sprites",
    ):
        total += _safe_filefield_size(getattr(media, field_name, None), seen_paths)

    for encoding in media.encodings.all():
        total += _safe_filefield_size(encoding.media_file, seen_paths)
        total += _safe_local_file_size(encoding.chunk_file_path, seen_paths)

    for subtitle in media.subtitles.all():
        total += _safe_filefield_size(subtitle.subtitle_file, seen_paths)

    total += _safe_local_directory_size(media.hls_file, seen_paths)

    return total


def refresh_media_storage_usage(media_or_id):
    from .models import Media

    media = (
        media_or_id
        if isinstance(media_or_id, Media)
        else Media.objects.prefetch_related("encodings", "subtitles").filter(pk=media_or_id).first()
    )

    if not media:
        invalidate_storage_usage_cache()
        return 0

    used_bytes = calculate_media_storage_usage(media)
    Media.objects.filter(pk=media.pk).update(storage_usage_bytes=used_bytes)
    invalidate_storage_usage_cache(user_id=media.user_id)
    return used_bytes


def schedule_refresh_media_storage_usage(media_or_id):
    media_id = getattr(media_or_id, "id", media_or_id)

    def enqueue():
        from .tasks import refresh_media_storage_usage_task

        try:
            refresh_media_storage_usage_task.apply_async(args=[media_id], queue="short_tasks")
        except Exception:
            logger.warning("Failed to enqueue storage usage refresh for media %s", media_id, exc_info=True)

    transaction.on_commit(enqueue)


def get_user_storage_usage(user):
    if not getattr(user, "is_authenticated", False):
        return get_site_storage_usage()

    key = user_storage_usage_cache_key(user.id)
    cached = cache.get(key)
    if cached is not None:
        return cached

    from .models import Media

    used_bytes = Media.objects.filter(user=user).aggregate(total=Sum("storage_usage_bytes"))["total"] or 0
    cache.set(key, used_bytes, STORAGE_USAGE_CACHE_TIMEOUT)
    return used_bytes


def get_site_storage_usage():
    cached = cache.get(SITE_STORAGE_USAGE_CACHE_KEY)
    if cached is not None:
        return cached

    from .models import Media

    used_bytes = Media.objects.aggregate(total=Sum("storage_usage_bytes"))["total"] or 0
    cache.set(SITE_STORAGE_USAGE_CACHE_KEY, used_bytes, STORAGE_USAGE_CACHE_TIMEOUT)
    return used_bytes


def get_storage_usage_for_request(request):
    if request.user.is_authenticated:
        return "user", get_user_storage_usage(request.user)
    return "site", get_site_storage_usage()
