import os
import re
import mimetypes
import logging
import hashlib
from urllib.parse import unquote, quote
from typing import Optional
import hmac

from django.conf import settings
from django.db.models import Q
from django.http import Http404, HttpResponse, HttpResponseForbidden, FileResponse
from django.views.decorators.cache import cache_control
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator
from django.views import View
from django.core.cache import cache

from .models import Media, Encoding, Subtitle
from .methods import is_mediacms_editor, is_mediacms_manager, is_curator
from .cache_utils import (
    get_permission_cache_key, get_elevated_access_cache_key,
    get_cached_permission, set_cached_permission,
    PERMISSION_CACHE_TIMEOUT, RESTRICTED_MEDIA_CACHE_TIMEOUT
)


logger = logging.getLogger(__name__)

# Configuration constants
CACHE_CONTROL_MAX_AGE = 604800  # 1 week
MEDIA_PATH_CACHE_TIMEOUT = 300  # 5 minutes for file path → Media ID mapping
MEDIA_PATH_CACHE_PREFIX = 'cinemata:media_path'
MEDIA_PATH_REVERSE_PREFIX = 'cinemata:media_path:reverse'  # Reverse mapping: media_id → set of cache keys

# Paths that are always public (no authorization needed)
# Note: User-specific media thumbnails (original/thumbnails/user/) are NOT public
# and require authorization for private/restricted media
PUBLIC_MEDIA_PATHS = [
    'userlogos/', 'logos/', 'favicons/', 'social-media-icons/',
    'tinymce_media/', 'homepage-popups/',
    # Category and topic thumbnails are truly public
    'original/categories/', 'original/topics/',
]

# Security headers for different content types
SECURITY_HEADERS = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
}

VIDEO_SECURITY_HEADERS = {
    **SECURITY_HEADERS,
    'Content-Security-Policy': "default-src 'self'; media-src 'self'",
}

IMAGE_SECURITY_HEADERS = {
    **SECURITY_HEADERS,
    'Content-Security-Policy': "default-src 'self'; img-src 'self'",
}

"""
Permission Caching Strategy:

This module implements Redis caching for user permission checks to improve performance
when serving secure media files. The caching strategy includes:

1. Elevated Access Caching: Caches whether a user has owner/editor/manager permissions
   Cache key format: "elevated_access:{user_id}:{media_uid}"

2. Permission Result Caching: Caches the final permission decision
   Cache key format: "media_permission:{user_id}:{media_uid}[:{additional_data_hash}]"

3. Different cache timeouts:
   - Standard permissions: 5 minutes (300 seconds)
   - Password-protected restricted media: 1 minute (60 seconds)

4. Cache invalidation:
   - Specific user/media combinations can be cleared
   - Pattern-based clearing for all users (if django-redis is available)
   - Automatic invalidation when media permissions change (via models.py)

5. Graceful degradation:
   - If cache fails, permission checks continue without caching
   - Errors are logged but don't break functionality

6. API Integration:
   - Cache invalidation is automatic and transparent
   - No API changes required
   - Works with all existing endpoints

Password Handling for Restricted Media:
   - Media passwords are stored as plaintext in the database
   - Session stores SHA256 hash of the actual password for security
   - Query parameters contain plaintext passwords
   - Comparisons are done by hashing query passwords and comparing with expected hash
   - Cache keys use hashed password material to prevent exposure

Performance Benefits:
   - ~90% reduction in database queries for permission checks
   - Improved response times for secure media requests
   - Better scalability under high load

Security Considerations:
   - Cache keys include user and media identifiers to prevent unauthorized access
   - Password attempts are hashed before being used in cache keys
   - Shorter timeouts for password-protected content
   - Automatic invalidation on permission changes
"""


def get_media_path_cache_key(file_path: str) -> str:
    """
    Generate cache key for file path → Media ID mapping.
    Uses full SHA-256 hash for strong collision resistance.

    Cache key format: cinemata:media_path:{sha256_hexdigest}
    SHA-256 provides 256 bits of entropy (vs 64 bits from truncated MD5),
    making collisions astronomically unlikely even at massive scale.
    """
    path_hash = hashlib.sha256(file_path.encode('utf-8')).hexdigest()
    return f"{MEDIA_PATH_CACHE_PREFIX}:{path_hash}"


def get_reverse_mapping_key(media_id: int) -> str:
    """
    Generate reverse mapping key for Media ID → set of cache keys.
    Used for cache invalidation when media is deleted or permissions change.
    """
    return f"{MEDIA_PATH_REVERSE_PREFIX}:{media_id}"


def get_cached_media_id(file_path: str) -> Optional[int]:
    """Get cached Media ID for a file path."""
    try:
        cache_key = get_media_path_cache_key(file_path)
        media_id = cache.get(cache_key)
        if media_id:
            logger.debug(f"Cache HIT for media path: {file_path}")
            return media_id
        logger.debug(f"Cache MISS for media path: {file_path}")
        return None
    except Exception as e:
        logger.warning(f"Failed to get cached media ID for {file_path}: {e}")
        return None


def set_cached_media_id(file_path: str, media_id: int) -> bool:
    """
    Cache Media ID for a file path and maintain reverse mapping for invalidation.

    This function:
    1. Caches the file_path → media_id mapping
    2. Adds the cache key to a reverse mapping set for the media_id

    The reverse mapping allows efficient invalidation of all cached paths
    when a media object is deleted or its permissions change.
    """
    try:
        cache_key = get_media_path_cache_key(file_path)
        reverse_key = get_reverse_mapping_key(media_id)

        # Store the forward mapping: file_path → media_id
        cache.set(cache_key, media_id, MEDIA_PATH_CACHE_TIMEOUT)

        # Add to reverse mapping set: media_id → {cache_key1, cache_key2, ...}
        # Use a Redis set to track all cache keys for this media
        # Note: django-redis supports Redis SET operations
        try:
            # Try using Redis SET operations (sadd)
            cache.sadd(reverse_key, cache_key)
            # Set expiration on the reverse mapping set
            cache.expire(reverse_key, MEDIA_PATH_CACHE_TIMEOUT)
        except AttributeError:
            # Fallback: If sadd is not available, use a simple list in cache
            # This is less efficient but works with any cache backend
            existing_keys = cache.get(reverse_key, set())
            if not isinstance(existing_keys, set):
                existing_keys = set()
            existing_keys.add(cache_key)
            cache.set(reverse_key, existing_keys, MEDIA_PATH_CACHE_TIMEOUT)

        logger.debug(f"Cached media ID {media_id} for path: {file_path}")
        return True
    except Exception as e:
        logger.warning(f"Failed to cache media ID for {file_path}: {e}")
        return False


def invalidate_media_path_cache(media_id: int) -> int:
    """
    Invalidate all cached file paths for a media object.

    This function uses the reverse mapping to efficiently delete all cache entries
    associated with a specific media ID. This is critical for security and consistency:

    - When media permissions change, unauthorized users lose cached access
    - When media is deleted, stale cache entries are removed
    - When media file paths change, old paths are invalidated

    Returns the number of cache keys deleted.
    """
    try:
        reverse_key = get_reverse_mapping_key(media_id)

        # Get all cache keys for this media from the reverse mapping
        cache_keys = None
        try:
            # Try Redis SET operations first (smembers)
            cache_keys = cache.smembers(reverse_key)
        except AttributeError:
            # Fallback for non-Redis backends
            cache_keys = cache.get(reverse_key, set())
            if not isinstance(cache_keys, set):
                cache_keys = set()

        if cache_keys:
            # Delete all forward mapping cache keys
            deleted_count = 0
            for cache_key in cache_keys:
                try:
                    cache.delete(cache_key)
                    deleted_count += 1
                except Exception as e:
                    logger.warning(f"Failed to delete cache key {cache_key}: {e}")

            # Delete the reverse mapping itself
            cache.delete(reverse_key)

            logger.info(f"Invalidated {deleted_count} cache entries for media {media_id}")
            return deleted_count
        else:
            logger.debug(f"No cached paths found for media {media_id}")
            return 0

    except Exception as e:
        logger.error(f"Failed to invalidate media path cache for media {media_id}: {e}")
        return 0


class SecureMediaView(View):
    """
    Securely serves media files, handling authentication and authorization
    for different visibility levels (public, unlisted, restricted, private).

    It uses Nginx's X-Accel-Redirect for efficient file delivery in production.
    Implements Redis caching for user permission checks to improve performance.
    """

    # Path traversal protection
    INVALID_PATH_PATTERNS = re.compile(r'\.\.|\\|\x00|[\x01-\x1f\x7f]')

    CONTENT_TYPES = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.mp3': 'audio/mpeg',
        '.wav': 'audio/wav',
        '.pdf': 'application/pdf',
        '.vtt': 'text/vtt',
        '.m3u8': 'application/vnd.apple.mpegurl',
        '.ts': 'video/mp2t'
    }

    @method_decorator(cache_control(max_age=CACHE_CONTROL_MAX_AGE, private=True))
    def get(self, request, file_path: str):
        """Handle GET requests for secure media files."""
        return self._handle_request(request, file_path)

    @method_decorator(cache_control(max_age=CACHE_CONTROL_MAX_AGE, private=True))
    def head(self, request, file_path: str):
        """Handle HEAD requests for secure media files."""
        return self._handle_request(request, file_path, head_request=True)

    def _handle_request(self, request, file_path: str, head_request: bool = False):
        """Handle both GET and HEAD requests for secure media files."""
        file_path = unquote(file_path)
        logger.debug(f"Secure media request for: {file_path}")

        # Enhanced path validation
        if not self._is_valid_file_path(file_path):
            logger.warning(f"Invalid file path detected: {file_path}")
            raise Http404("Invalid file path")

        # Check if it's a public file that bypasses media permissions
        if self._is_public_media_file(file_path):
            logger.debug(f"Serving public media file: {file_path}")
            return self._serve_file(file_path, head_request)

        # Check if it's a non-video file that bypasses authorization
        if self._is_non_video_file(file_path):
            logger.debug(f"Serving non-video file without authorization check: {file_path}")
            return self._serve_file(file_path, head_request)

        # Get media object and actual file path (handles ownership transfers)
        media, actual_file_path = self._get_media_from_path_cached(file_path)
        if not media:
            logger.warning(f"Media not found for path: {file_path}")
            raise Http404("Media not found")

        logger.debug(f"Found media: {media.friendly_token} (state: {media.state})")

        if not self._check_access_permission(request, media):
            logger.warning(f"Access denied for media: {media.friendly_token} (user: {request.user})")
            resp = HttpResponseForbidden("Access denied")
            # Prevent browsers from caching a forbidden response
            resp['Cache-Control'] = 'no-store'
            return resp

        # Use actual file path from database if provided (ownership transfer case),
        # otherwise use the URL path
        serving_path = actual_file_path if actual_file_path else file_path

        return self._serve_file(serving_path, head_request)
        
    def _is_valid_file_path(self, file_path: str) -> bool:
        """Enhanced path validation with security checks."""
        # Check for path traversal and invalid characters
        if self.INVALID_PATH_PATTERNS.search(file_path):
            return False
        
        # Check if path starts with /
        if file_path.startswith('/'):
            return False

        # Combine allowed video/media prefixes with public media paths for validation
        allowed_prefixes = [
         # Video-specific paths (with videos/ prefix)
        'videos/media/', 
        'videos/encoded/', 
        'videos/subtitles/', 
        'other_media/',
        
        # Standalone media paths (critical for video processing)
        'hls/',       # HLS streaming files (REQUIRED for playback)
        'encoded/',   # Encoded video files (REQUIRED for transcoding)
        'original/'   # Original media files (REQUIRED for various operations)
        ]
        
        # Add public paths and their "original/" variants to the list of allowed paths
        # to ensure they are not incorrectly blocked.
        for public_path in PUBLIC_MEDIA_PATHS:
            allowed_prefixes.append(public_path)
            # Some public assets like thumbnails can also be in an 'original' directory
            original_path = f"original/{public_path}"
            if original_path not in allowed_prefixes:
                allowed_prefixes.append(original_path)

        # Check if the file path starts with any of the allowed prefixes
        if any(file_path.startswith(prefix) for prefix in allowed_prefixes):
            return True

        return False

    def _verify_media_owns_thumbnail_path(self, media: Media, file_path: str) -> bool:
        """
        Verify that a media object actually owns the given thumbnail file path.

        This is a security check to prevent authorization based on wrong media
        when using __endswith queries or stale cache entries. It ensures the
        exact requested path matches one of the media's actual thumbnail fields.

        Args:
            media: The Media object to verify
            file_path: The requested file path (e.g., 'original/thumbnails/user/alice/thumb.jpg')

        Returns:
            True if the media owns this exact path, False otherwise
        """
        # Get all thumbnail-related paths from the media object
        thumbnail_paths = []

        if media.thumbnail:
            thumbnail_paths.append(media.thumbnail.name if hasattr(media.thumbnail, 'name') else str(media.thumbnail))
        if media.poster:
            thumbnail_paths.append(media.poster.name if hasattr(media.poster, 'name') else str(media.poster))
        if media.uploaded_thumbnail:
            thumbnail_paths.append(media.uploaded_thumbnail.name if hasattr(media.uploaded_thumbnail, 'name') else str(media.uploaded_thumbnail))
        if media.uploaded_poster:
            thumbnail_paths.append(media.uploaded_poster.name if hasattr(media.uploaded_poster, 'name') else str(media.uploaded_poster))
        if media.sprites:
            thumbnail_paths.append(media.sprites.name if hasattr(media.sprites, 'name') else str(media.sprites))

        # Check if the requested path exactly matches any of the media's thumbnail paths
        if file_path in thumbnail_paths:
            return True

        # Also check for encoded GIF paths
        if file_path.startswith('encoded/') and file_path.lower().endswith('.gif'):
            # For encoded GIFs, verify via the Encoding model
            # The path format is: encoded/{profile_id}/{username}/{filename}
            from .models import Encoding
            # Check if any encoding for this media has this exact path
            # Use media_file (the actual DB field) instead of media_encoding_url (computed property)
            return Encoding.objects.filter(
                media=media,
                media_file=file_path
            ).exists()

        return False

    def _get_media_from_path_cached(self, file_path: str) -> tuple[Optional[Media], Optional[str]]:
        """
        Get media from file path with caching.
        This wrapper reduces database queries by caching Media ID lookups.

        Returns:
            Tuple of (Media object, actual_file_path)
            - On cache hit: (Media, None) - use original file_path
            - On cache miss: delegates to _get_media_from_path which may return actual path override
        """
        # Try cache first
        cached_media_id = get_cached_media_id(file_path)
        if cached_media_id:
            try:
                media = Media.objects.select_related('user').get(id=cached_media_id)

                # SECURITY: Verify the cached media still owns this exact path
                # This prevents stale cache entries from authorizing access after
                # ownership transfers or permission changes (P1-002 fix)
                if file_path.startswith('original/thumbnails/user/') or (
                    file_path.startswith('encoded/') and file_path.lower().endswith('.gif')
                ):
                    if not self._verify_media_owns_thumbnail_path(media, file_path):
                        logger.warning(
                            f"Stale cache: media {media.friendly_token} no longer owns path {file_path}"
                        )
                        # Invalidate stale media path cache entry (file_path → media_id mapping)
                        cache.delete(get_media_path_cache_key(file_path))
                        # Fall through to fresh lookup
                    else:
                        return (media, None)
                else:
                    # For non-thumbnail paths, use existing behavior
                    return (media, None)

            except Media.DoesNotExist:
                # Stale cache - media was deleted
                logger.debug(f"Stale cache entry for path {file_path}, media {cached_media_id} not found")
                # Don't need to explicitly delete - will expire naturally
                pass

        # Cache miss - do expensive lookup
        media, actual_file_path = self._get_media_from_path(file_path)

        # Cache the result if found
        if media:
            set_cached_media_id(file_path, media.id)

        return (media, actual_file_path)

    def _get_media_from_path(self, file_path: str) -> tuple[Optional[Media], Optional[str]]:
        """
        Extract media object from file path using filename matching.

        Returns:
            Tuple of (Media object, actual_file_path)
            - Media object: The found media, or None if not found
            - actual_file_path: The actual file path from database (for encoded files with username mismatch),
                               or None to use the original file_path
        """

        # Handle original files: original/user/{username}/{filename}
        if file_path.startswith('original/user/'):
            # Extract filename and username from path
            try:
                parts = file_path.split('/')
                if len(parts) >= 4:
                    username = parts[2]
                    filename = parts[3]
                    logger.debug(f"Searching for media: username={username}, filename={filename}")

                    # Query by filename field (much faster with index)
                    media = Media.objects.select_related('user').filter(
                        user__username=username,
                        filename=filename
                    ).first()

                    if media:
                        logger.debug(f"Found media by filename: {media.friendly_token}")
                        return (media, None)

                    # Fallback: if not found, try querying by media_file path
                    # This handles edge cases where filename field wasn't populated
                    logger.debug("Filename lookup failed, attempting fallback by media_file path")
                    media = Media.objects.select_related('user').filter(
                        user__username=username,
                        media_file__endswith=filename
                    ).first()

                    if media:
                        logger.info(f"Found media by fallback path lookup: {media.friendly_token}")
                        # Backfill the filename field for future queries
                        if not media.filename:
                            media.filename = filename
                            media.save(update_fields=['filename'])
                            logger.info(f"Backfilled filename for media {media.friendly_token}")
                        return (media, None)

                    # Third fallback: handle ownership transfers
                    # If username in URL doesn't match current owner (e.g., video was transferred),
                    # look up by filename only
                    logger.debug("Username lookup failed, attempting lookup ignoring username (handles ownership transfers)")
                    media = Media.objects.select_related('user').filter(
                        filename=filename
                    ).first()

                    if media:
                        logger.info(f"Found media via ownership transfer fallback (original owner in path: '{username}', current owner: '{media.user.username}')")
                        logger.info(f"Media: {media.friendly_token}")
                        # Return actual file path from database to avoid username mismatch
                        actual_path = media.media_file.name if media.media_file else None
                        if not actual_path:
                            logger.error(f"Media {media.friendly_token} has no media_file set!")
                            return (None, None)
                        logger.info(f"Using actual file path from database: {actual_path}")
                        return (media, actual_path)

            except Exception as e:
                logger.warning(f"Error finding media by filename: {e}")

        # Handle thumbnail files: original/thumbnails/user/{username}/{filename}
        # These include: thumbnail, poster, uploaded_thumbnail, uploaded_poster, sprites
        elif file_path.startswith('original/thumbnails/user/'):
            try:
                parts = file_path.split('/')
                if len(parts) >= 5:
                    username = parts[3]
                    filename = parts[4]
                    logger.debug(f"Searching for media thumbnail: username={username}, filename={filename}")

                    # Search across all thumbnail-related fields
                    # The filename could be in thumbnail, poster, uploaded_thumbnail,
                    # uploaded_poster, or sprites field
                    thumbnail_path = f"original/thumbnails/user/{username}/{filename}"
                    media = Media.objects.select_related('user').filter(
                        Q(user__username=username) & (
                            Q(thumbnail=thumbnail_path) |
                            Q(poster=thumbnail_path) |
                            Q(uploaded_thumbnail=thumbnail_path) |
                            Q(uploaded_poster=thumbnail_path) |
                            Q(sprites=thumbnail_path)
                        )
                    ).order_by('id').first()

                    if media:
                        logger.debug(f"Found media by thumbnail path: {media.friendly_token}")
                        return (media, None)

                    # Fallback: search by filename ending (P2-005 optimization)
                    # This consolidates the username-scoped and ownership-transfer queries
                    # into a single database query, reducing worst case from 3 queries to 2.
                    # NOTE: __endswith cannot use standard B-tree indexes. If performance
                    # becomes an issue at scale, consider adding indexed filename fields.
                    logger.debug("Exact path match failed, attempting __endswith lookup")
                    matches = Media.objects.select_related('user').filter(
                        Q(thumbnail__endswith=filename) |
                        Q(poster__endswith=filename) |
                        Q(uploaded_thumbnail__endswith=filename) |
                        Q(uploaded_poster__endswith=filename) |
                        Q(sprites__endswith=filename)
                    ).order_by('id')

                    # Check for multiple matches (filename collision warning)
                    match_count = matches.count()
                    if match_count > 1:
                        matched_tokens = [m.friendly_token for m in matches[:5]]
                        logger.warning(
                            f"Thumbnail filename collision detected: {match_count} media items "
                            f"match filename '{filename}'. Matched tokens: {matched_tokens}."
                        )

                    # SECURITY: Find a media that actually owns this exact path (P1-001 fix)
                    # Prioritize matches with correct username, then fall back to any verified match
                    # This handles both normal lookups and ownership transfers in one pass
                    verified_match = None
                    ownership_transfer_match = None

                    for media in matches[:10]:  # Limit to prevent DoS
                        if self._verify_media_owns_thumbnail_path(media, file_path):
                            if media.user.username == username:
                                # Best match: correct username and verified path
                                verified_match = media
                                break
                            elif ownership_transfer_match is None:
                                # Ownership transfer: different username but verified path
                                ownership_transfer_match = media

                    if verified_match:
                        logger.debug(f"Found media by thumbnail filename: {verified_match.friendly_token}")
                        return (verified_match, None)

                    if ownership_transfer_match:
                        logger.info(
                            f"Found media thumbnail via ownership transfer: "
                            f"{ownership_transfer_match.friendly_token} (verified owner of path)"
                        )
                        return (ownership_transfer_match, None)

                    # If no verified match found, log and fail closed
                    if match_count > 0:
                        logger.warning(
                            f"No media verified to own path {file_path} despite {match_count} "
                            f"__endswith matches. Failing closed (404)."
                        )

            except Exception as e:
                logger.warning(f"Error finding media by thumbnail path: {e}")

        # Handle subtitle files: original/subtitles/user/{username}/{filename}
        # Subtitles contain transcripts of video content and must be protected (P2-004 fix)
        elif file_path.startswith('original/subtitles/user/'):
            try:
                parts = file_path.split('/')
                if len(parts) >= 5:
                    username = parts[3]
                    filename = parts[4]
                    logger.debug(f"Searching for subtitle: username={username}, filename={filename}")

                    # Look up the parent media via the Subtitle model
                    subtitle = Subtitle.objects.select_related('media', 'media__user').filter(
                        media__user__username=username,
                        subtitle_file=file_path
                    ).first()

                    if subtitle:
                        logger.debug(f"Found subtitle's parent media: {subtitle.media.friendly_token}")
                        return (subtitle.media, None)

                    # Fallback: search by filename ending (handles path variations)
                    subtitle = Subtitle.objects.select_related('media', 'media__user').filter(
                        media__user__username=username,
                        subtitle_file__endswith=filename
                    ).first()

                    if subtitle:
                        # Verify the subtitle actually owns this path
                        if subtitle.subtitle_file and subtitle.subtitle_file.name == file_path:
                            logger.debug(f"Found subtitle by filename: {subtitle.media.friendly_token}")
                            return (subtitle.media, None)
                        else:
                            logger.warning(
                                f"Subtitle match via __endswith but path mismatch: "
                                f"requested={file_path}, actual={subtitle.subtitle_file.name if subtitle.subtitle_file else 'None'}"
                            )

                    # Ownership transfer fallback: search without username
                    logger.debug("Username lookup failed, attempting lookup ignoring username")
                    subtitle = Subtitle.objects.select_related('media', 'media__user').filter(
                        subtitle_file__endswith=filename
                    ).order_by('-id').first()

                    if subtitle:
                        # Verify the subtitle actually owns this path
                        if subtitle.subtitle_file and subtitle.subtitle_file.name == file_path:
                            logger.info(f"Found subtitle via ownership transfer fallback: {subtitle.media.friendly_token}")
                            return (subtitle.media, None)
                        else:
                            logger.warning(
                                f"Subtitle ownership transfer match but path mismatch: "
                                f"requested={file_path}, actual={subtitle.subtitle_file.name if subtitle.subtitle_file else 'None'}"
                            )

            except Exception as e:
                logger.warning(f"Error finding media by subtitle path: {e}")

            # No subtitle found - fail closed
            return (None, None)

        # Handle encoded files: encoded/{profile_id}/{username}/{filename}
        elif file_path.startswith('encoded/'):
            parts = file_path.split('/')
            if len(parts) >= 4:
                profile_id_str = parts[1]
                username = parts[2]
                filename = parts[3]

                logger.debug(f"Encoded file: profile_id={profile_id_str}, username={username}, filename={filename}")

                try:
                    # Query by filename field (much faster with index)
                    filter_kwargs = {
                        'media__user__username': username,
                        'filename': filename,
                    }

                    if profile_id_str.isdigit():
                        filter_kwargs['profile_id'] = int(profile_id_str)

                    encoding = Encoding.objects.select_related('media', 'media__user').filter(**filter_kwargs).first()

                    if encoding:
                        # Username matches - no path override needed
                        return (encoding.media, None)

                    # Fallback: if not found, try querying by media_file path
                    # This handles edge cases where filename field wasn't populated
                    logger.debug("Encoding filename lookup failed, attempting fallback by media_file path")
                    fallback_kwargs = {
                        'media__user__username': username,
                        'media_file__endswith': filename,
                    }

                    if profile_id_str.isdigit():
                        fallback_kwargs['profile_id'] = int(profile_id_str)

                    encoding = Encoding.objects.select_related('media', 'media__user').filter(**fallback_kwargs).first()

                    if encoding:
                        logger.info(f"Found encoding by fallback path lookup for media: {encoding.media.friendly_token}")
                        # Backfill the filename field for future queries
                        if not encoding.filename:
                            encoding.filename = filename
                            encoding.save(update_fields=['filename'])
                            logger.info(f"Backfilled filename for encoding {encoding.id}")
                        # Username matches - no path override needed
                        return (encoding.media, None)

                    # Second fallback: handle ownership transfers
                    # If username in URL doesn't match current owner (e.g., video was transferred),
                    # look up by filename and profile only
                    logger.debug("Username lookup failed, attempting lookup ignoring username (handles ownership transfers)")
                    ownership_transfer_kwargs = {
                        'filename': filename,
                    }

                    if profile_id_str.isdigit():
                        ownership_transfer_kwargs['profile_id'] = int(profile_id_str)

                    encoding = Encoding.objects.select_related('media', 'media__user').filter(**ownership_transfer_kwargs).first()

                    if encoding:
                        logger.info(f"Found encoding via ownership transfer fallback (original owner in path: '{username}', current owner: '{encoding.media.user.username}')")
                        logger.info(f"Media: {encoding.media.friendly_token}")
                        # Return actual file path from database to avoid username mismatch
                        actual_path = encoding.media_file.name if encoding.media_file else None
                        if not actual_path:
                            logger.error(f"Encoding {encoding.id} has no media_file set!")
                            return (None, None)
                        logger.info(f"Using actual file path from database: {actual_path}")
                        return (encoding.media, actual_path)

                    return (None, None)

                except Exception as e:
                    logger.warning(f"Error finding encoded media: {e}")

        # Handle HLS files: hls/{uid_or_folder}/{filename}
        elif file_path.startswith('hls/'):
            parts = file_path.split('/')
            if len(parts) >= 3:
                folder_name = parts[1]
                logger.debug(f"HLS file in folder: {folder_name}")

                try:
                    # For HLS files, we might need to check if the folder name matches a UID
                    # or try to find media that has HLS files in this directory
                    if self._is_valid_uid(folder_name):
                        media = Media.objects.select_related('user').filter(uid=folder_name).first()
                        return (media, None)
                    else:
                        # Fallback: try to find any media that might have HLS files
                        # This is less precise but more flexible
                        return (None, None)

                except Exception as e:
                    logger.warning(f"Error finding HLS media: {e}")

        return (None, None)

    def _is_valid_uid(self, uid_str: str) -> bool:
        """Check if a string looks like a valid UID (8-64 hex characters)."""
        if not uid_str or len(uid_str) < 8 or len(uid_str) > 64:
            return False
        try:
            int(uid_str, 16)  # Try to parse as hex
            return True
        except ValueError:
            return False

    def _is_public_media_file(self, file_path: str) -> bool:
        """
        Check if a media file is considered public based on its path.
        Public files are those in specific allowed directories.

        Note: Media-associated files (thumbnails, preview GIFs) are NOT public
        and require authorization checks for private/restricted media.
        """
        # Check if the file is in any of the public media directories
        for public_path in PUBLIC_MEDIA_PATHS:
            if file_path.startswith(public_path):
                return True

        # User logos with original/ prefix are public
        if file_path.startswith('original/userlogos/'):
            return True

        return False

    def _is_media_associated_file(self, file_path: str) -> bool:
        """
        Check if the file is associated with a specific Media object and requires
        authorization checks (thumbnails, preview GIFs, subtitles, etc.).

        These files should NOT bypass authorization because they belong to media items
        that may be private or restricted.
        """
        # Media thumbnails: original/thumbnails/user/{username}/{filename}
        if file_path.startswith('original/thumbnails/user/'):
            return True

        # Preview GIFs in encoded directory: encoded/{profile_id}/{username}/{filename}.gif
        if file_path.startswith('encoded/') and file_path.lower().endswith('.gif'):
            return True

        # Subtitle files: original/subtitles/user/{username}/{filename}
        # Subtitles contain transcripts of video content and must be protected
        if file_path.startswith('original/subtitles/user/'):
            return True

        return False

    def _is_non_video_file(self, file_path: str) -> bool:
        """
        Check if the file is not a video file and can bypass authorization.

        IMPORTANT: Media-associated files (thumbnails, preview GIFs, subtitles)
        are NOT bypassed even though they're not video files. They require
        authorization checks because they contain or reveal media content.
        """
        # Media-associated files (thumbnails, preview GIFs, subtitles) require authorization
        # even though they're not video files
        if self._is_media_associated_file(file_path):
            return False

        file_ext = os.path.splitext(file_path)[1].lower()

        # Common video file extensions
        video_extensions = {
            '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm',
            '.m4v', '.3gp', '.ogv', '.asf', '.rm', '.rmvb', '.vob',
            '.mpg', '.mpeg', '.mp2', '.mpe', '.mpv', '.m2v', '.m4p',
            '.f4v', '.ts', '.m3u8'  # Include HLS formats
        }

        # Check if it's a video file by extension
        if file_ext in video_extensions:
            return False  # It's a video file, so don't bypass authorization

        # Also check by content type for additional detection
        content_type = self.CONTENT_TYPES.get(file_ext)
        if not content_type:
            content_type, _ = mimetypes.guess_type(file_path)

        # Consider it a video file if content type starts with 'video/' or is HLS
        is_video_by_content_type = (
            (content_type and content_type.startswith('video/')) or
            content_type == 'application/vnd.apple.mpegurl' or  # .m3u8 files
            content_type == 'video/mp2t'  # .ts files
        )

        # Also check if it's in HLS directory (streaming content)
        is_in_hls_directory = file_path.startswith('hls/')

        # It's a video file if any of the checks match
        is_video_like = is_video_by_content_type or is_in_hls_directory

        # Return True if it's NOT a video file (so it can bypass authorization)
        return not is_video_like
    def _user_has_elevated_access(self, user, media: Media) -> bool:
        """Check if user is owner, editor, or manager with caching. Assumes user is authenticated."""
        if not user.is_authenticated:
            return False

        # Generate cache key for elevated access check
        cache_key = get_elevated_access_cache_key(user.id, media.uid)

        # Try to get from cache first
        cached_result = get_cached_permission(cache_key)
        if cached_result is not None:
            logger.debug(f"Using cached elevated access result for user {user.id}, media {media.uid}")
            return cached_result

        # Calculate the result
        result = (user == media.user or
                  is_mediacms_editor(user) or
                  is_mediacms_manager(user) or
                  is_curator(user))

        # Cache the result
        set_cached_permission(cache_key, result)

        return result

    def _check_access_permission(self, request, media: Media) -> bool:
        """Check if the user has permission to access the media with caching."""
        user = request.user
        user_id = user.id if user.is_authenticated else 'anonymous'

        # For public and unlisted media, no need to cache (always accessible)
        if media.state in ('public', 'unlisted'):
            return True

        # For restricted media, include password info in cache key
        additional_data = None
        if media.state == 'restricted':
            session_password_hash = request.session.get(
                f'media_password_{media.friendly_token}'
            )
            query_password = request.GET.get('password')

            # Determine what password material to use for cache key
            if session_password_hash:
                # Session already contains hash of the correct password
                attempt_material = session_password_hash
            elif query_password:
                # Hash the query password to compare with expected hash
                attempt_material = hashlib.sha256(query_password.encode('utf-8')).hexdigest()
            else:
                attempt_material = 'no_password'

            # Create a shorter hash for cache key (avoid key length issues)
            password_hash = hashlib.sha256(attempt_material.encode('utf-8')).hexdigest()[:12]
            additional_data = f"restricted:{password_hash}"
        # Generate cache key
        cache_key = get_permission_cache_key(user_id, media.uid, additional_data)

        # Try to get from cache first
        cached_result = get_cached_permission(cache_key)
        if cached_result is not None:
            logger.debug(f"Using cached permission result for user {user_id}, media {media.uid}")
            return cached_result

        # Calculate permission (original logic)
        result = self._calculate_access_permission(request, media)

        # Cache the result (but with shorter timeout for restricted media with passwords)
        cache_timeout = PERMISSION_CACHE_TIMEOUT
        if media.state == 'restricted' and additional_data:
            # Shorter cache for password-based access
            cache_timeout = RESTRICTED_MEDIA_CACHE_TIMEOUT

        set_cached_permission(cache_key, result, cache_timeout)

        return result

    def _calculate_access_permission(self, request, media: Media) -> bool:
        """Calculate access permission without caching (original logic)."""
        user = request.user

        # Elevated users bypass further checks for non-public media
        if user.is_authenticated and self._user_has_elevated_access(user, media):
            logger.debug(f"Access granted for '{media.state}' media: user has elevated permissions")
            return True

        if media.state == 'restricted':
            session_password_hash = request.session.get(f'media_password_{media.friendly_token}')
            query_password = request.GET.get('password')

            # Generate expected hash of the stored password for comparison
            expected_password_hash = None
            if media.password:
                expected_password_hash = hashlib.sha256(
                    media.password.encode('utf-8')
                ).hexdigest()

            # Compare hashes: session stores a hash; hash the query param as well
            valid_session_password = (
                bool(session_password_hash)
                and bool(expected_password_hash)
                and hmac.compare_digest(session_password_hash, expected_password_hash)
            )

            valid_query_password = False
            if query_password and expected_password_hash:
                query_hash = hashlib.sha256(
                    query_password.encode('utf-8')
                ).hexdigest()
                valid_query_password = hmac.compare_digest(query_hash, expected_password_hash)

            if valid_session_password or valid_query_password:
                logger.debug("Restricted media access granted: valid password provided")
                return True

            logger.debug("Restricted media access denied: no valid password provided")
            return False

        if not user.is_authenticated:
            logger.debug(f"Access denied for '{media.state}' media: user not authenticated")
            return False

        if media.state == 'private':
            logger.debug("Private media access denied: user lacks elevated permissions")
            return False

        return False

    def _serve_file(self, file_path: str, head_request: bool = False) -> HttpResponse:
        """Serve file using X-Accel-Redirect (production) or Django (development)."""
        if getattr(settings, 'USE_X_ACCEL_REDIRECT', True):
            return self._serve_file_via_xaccel(file_path, head_request)
        return self._serve_file_direct_django(file_path, head_request)

    def _get_content_type_and_headers(self, file_path: str) -> tuple:
        """Get content type and appropriate security headers for the file."""
        file_ext = os.path.splitext(file_path)[1].lower()
        content_type = self.CONTENT_TYPES.get(file_ext)
        is_video_like = (content_type and content_type.startswith('video/')) or content_type == 'application/vnd.apple.mpegurl'
        # Choose appropriate security headers based on content type
        if is_video_like:
            headers = VIDEO_SECURITY_HEADERS
        elif content_type and content_type.startswith('image/'):
            headers = IMAGE_SECURITY_HEADERS
        else:
            headers = SECURITY_HEADERS

        return content_type, headers

    def _serve_file_via_xaccel(self, file_path: str, head_request: bool = False) -> HttpResponse:
        """Serve file using Nginx's X-Accel-Redirect header."""
        if file_path.startswith('original/'):
            unencoded = f'/internal/media/original/{file_path[len("original/"):]}'
        else:
            unencoded = f'/internal/media/{file_path}'
        # Ensure header value is a valid URI (encode spaces/non-ASCII, keep slashes)
        internal_path = quote(unencoded, safe="/:")

        response = HttpResponse()

        # For HEAD requests, we still set the X-Accel-Redirect header
        # but Nginx will not include the body in the response
        response['X-Accel-Redirect'] = internal_path

        content_type, security_headers = self._get_content_type_and_headers(file_path)

        if content_type:
            response['Content-Type'] = content_type
        else:
            response['Content-Type'] = 'application/octet-stream'


        if content_type and content_type.startswith('video/'):
            response['X-Accel-Buffering'] = 'no'
        else:
            response['X-Accel-Buffering'] = 'yes'

        # Add security headers
        for header, value in security_headers.items():
            response[header] = value

        response['Content-Disposition'] = 'inline'

        return response

    def _serve_file_direct_django(self, file_path: str, head_request: bool = False) -> HttpResponse:
        """Serve file directly through Django (for development)."""
        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        logger.debug(f"Attempting to serve file directly: {full_path}")

        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            logger.warning(f"File not found at: {full_path}")
            raise Http404("File not found")

        content_type, security_headers = self._get_content_type_and_headers(file_path)
        if not content_type:
            content_type, _ = mimetypes.guess_type(full_path)
            content_type = content_type or 'application/octet-stream'

        logger.debug(f"Serving file with content-type: {content_type}")

        try:
            if head_request:
                # For HEAD requests, return response with headers but no body
                response = HttpResponse(content_type=content_type)
                # Set Content-Length header for HEAD requests
                try:
                    file_size = os.path.getsize(full_path)
                    response['Content-Length'] = str(file_size)
                except OSError:
                    # If we can't get file size, don't set Content-Length
                    pass
            else:
                # For GET requests, return the file content
                response = FileResponse(open(full_path, 'rb'), content_type=content_type)

            response['Content-Disposition'] = 'inline'

            # Add security headers
            for header, value in security_headers.items():
                response[header] = value

            return response
        except IOError as e:
            logger.error(f"Error reading file {full_path}: {e}")
            raise Http404("File could not be read") from e


@require_http_methods(["GET", "HEAD"])
def secure_media_file(request, file_path: str) -> HttpResponse:
    """Function-based view wrapper for SecureMediaView."""
    return SecureMediaView.as_view()(request, file_path=file_path)
