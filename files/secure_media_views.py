import os
import re
import mimetypes
import logging
import hashlib
from urllib.parse import unquote, quote
from typing import Optional
import hmac

from django.conf import settings
from django.http import Http404, HttpResponse, HttpResponseForbidden, FileResponse
from django.views.decorators.cache import cache_control
from django.views.decorators.http import require_http_methods
from django.utils.decorators import method_decorator
from django.views import View

from .models import Media, Encoding, Subtitle
from .methods import is_mediacms_editor, is_mediacms_manager
from .cache_utils import (
    get_permission_cache_key, get_elevated_access_cache_key,
    get_cached_permission, set_cached_permission,
    PERMISSION_CACHE_TIMEOUT, RESTRICTED_MEDIA_CACHE_TIMEOUT
)

logger = logging.getLogger(__name__)

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


class SecureMediaView(View):
    """
    Securely serves media files, handling authentication and authorization
    for different visibility levels (public, unlisted, restricted, private).
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

    # ✅ FIX 1: Add 'homepage-popups/' to the list of public paths.
    PUBLIC_MEDIA_PATHS = [
        'thumbnails/', 'userlogos/', 'logos/', 'favicons/', 'social-media-icons/',
        'tinymce_media/', 'homepage-popups/'
    ]

    CACHE_CONTROL_MAX_AGE = 604800  # 1 week

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

        # Enhanced path validation using the corrected method
        if not self._is_valid_file_path(file_path):
            logger.warning(f"Invalid file path detected: {file_path}")
            raise Http404("Invalid file path")

        # The rest of the logic continues if the path is valid
        if self._is_public_media_file(file_path):
            logger.debug(f"Serving public media file: {file_path}")
            return self._serve_file(file_path, head_request)

        if self._is_non_video_file(file_path):
            logger.debug(f"Serving non-video file without authorization check: {file_path}")
            return self._serve_file(file_path, head_request)

        media = self._get_media_from_path(file_path)
        if not media:
            logger.warning(f"Media not found for path: {file_path}")
            raise Http404("Media not found")

        logger.debug(f"Found media: {media.friendly_token} (state: {media.state})")

        if not self._check_access_permission(request, media):
            logger.warning(f"Access denied for media: {media.friendly_token} (user: {request.user})")
            resp = HttpResponseForbidden("Access denied")
            resp['Cache-Control'] = 'no-store'
            return resp

        return self._serve_file(file_path, head_request)

    # ✅ FIX 2: Ensure this instance method has 'self' as its first argument.
    def _is_valid_file_path(self, file_path: str) -> bool:
        """Enhanced path validation with security checks."""
        if self.INVALID_PATH_PATTERNS.search(file_path) or file_path.startswith('/'):
            return False

        if self._is_public_media_file(file_path):
            return True

        allowed_prefixes = ('original/', 'encoded/', 'hls/')
        if not file_path.startswith(allowed_prefixes):
            return False

        return len(file_path) <= 500

    # ✅ FIX 3: Ensure this instance method has 'self' and uses the class constant.
    def _is_public_media_file(self, file_path: str) -> bool:
        """Check if the file is a public asset that bypasses media permissions."""
        return any(file_path.startswith(public_path) for public_path in self.PUBLIC_MEDIA_PATHS)

    #
    # --- NO CHANGES TO THE REST OF THE METHODS BELOW ---
    #

    def _get_media_from_path(self, file_path: str) -> Optional[Media]:
        """Extract media object from file path using filename matching."""
        if file_path.startswith('original/user/'):
            try:
                search_path = file_path[len('original/'):]
                logger.debug(f"Searching for media with file path ending: {search_path}")
                media = Media.objects.select_related('user').filter(
                    media_file__endswith=search_path
                ).first()
                if media:
                    logger.debug(f"Found media by filename: {media.friendly_token}")
                    return media
            except Exception as e:
                logger.warning(f"Error finding media by filename: {e}")
        elif file_path.startswith('original/subtitles/user/'):
            logger.debug(f"Subtitle file path detected but should be handled as non-video: {file_path}")
            return None
        elif file_path.startswith('encoded/'):
            parts = file_path.split('/')
            if len(parts) >= 4:
                profile_id_str, username, filename = parts[1], parts[2], parts[3]
                logger.debug(f"Encoded file: profile_id={profile_id_str}, username={username}, filename={filename}")
                try:
                    filter_kwargs = {
                        'media__user__username': username,
                        'media_file__endswith': filename,
                    }
                    if profile_id_str.isdigit():
                        filter_kwargs['profile_id'] = int(profile_id_str)
                    encoding = Encoding.objects.select_related('media', 'media__user').filter(**filter_kwargs).first()
                    return encoding.media if encoding else None
                except Exception as e:
                    logger.warning(f"Error finding encoded media: {e}")
        elif file_path.startswith('hls/'):
            parts = file_path.split('/')
            if len(parts) >= 3:
                folder_name = parts[1]
                logger.debug(f"HLS file in folder: {folder_name}")
                try:
                    if self._is_valid_uid(folder_name):
                        return Media.objects.select_related('user').filter(uid=folder_name).first()
                    else:
                        return None
                except Exception as e:
                    logger.warning(f"Error finding HLS media: {e}")
        return None

    def _is_valid_uid(self, uid_str: str) -> bool:
        if not uid_str or len(uid_str) < 8 or len(uid_str) > 64:
            return False
        try:
            int(uid_str, 16)
            return True
        except ValueError:
            return False

    def _is_non_video_file(self, file_path: str) -> bool:
        if file_path.startswith('original/subtitles/'):
            return True
        file_ext = os.path.splitext(file_path)[1].lower()
        video_extensions = {
            '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm',
            '.m4v', '.3gp', '.ogv', '.asf', '.rm', '.rmvb', '.vob',
            '.mpg', '.mpeg', '.mp2', '.mpe', '.mpv', '.m2v', '.m4p',
            '.f4v', '.ts', '.m3u8'
        }
        if file_ext in video_extensions:
            return False
        content_type = self.CONTENT_TYPES.get(file_ext)
        if not content_type:
            content_type, _ = mimetypes.guess_type(file_path)
        is_video_by_content_type = (
            (content_type and content_type.startswith('video/')) or
            content_type == 'application/vnd.apple.mpegurl' or
            content_type == 'video/mp2t'
        )
        is_in_hls_directory = file_path.startswith('hls/')
        is_video_like = is_video_by_content_type or is_in_hls_directory
        return not is_video_like

    def _user_has_elevated_access(self, user, media: Media) -> bool:
        if not user.is_authenticated:
            return False
        cache_key = get_elevated_access_cache_key(user.id, media.uid)
        cached_result = get_cached_permission(cache_key)
        if cached_result is not None:
            return cached_result
        result = (user == media.user or is_mediacms_editor(user) or is_mediacms_manager(user))
        set_cached_permission(cache_key, result)
        return result

    def _check_access_permission(self, request, media: Media) -> bool:
        user = request.user
        user_id = user.id if user.is_authenticated else 'anonymous'
        if media.state in ('public', 'unlisted'):
            return True
        additional_data = None
        if media.state == 'restricted':
            session_password_hash = request.session.get(f'media_password_{media.friendly_token}')
            query_password = request.GET.get('password')
            if session_password_hash:
                attempt_material = session_password_hash
            elif query_password:
                attempt_material = hashlib.sha256(query_password.encode('utf-8')).hexdigest()
            else:
                attempt_material = 'no_password'
            password_hash = hashlib.sha256(attempt_material.encode('utf-8')).hexdigest()[:12]
            additional_data = f"restricted:{password_hash}"
        cache_key = get_permission_cache_key(user_id, media.uid, additional_data)
        cached_result = get_cached_permission(cache_key)
        if cached_result is not None:
            return cached_result
        result = self._calculate_access_permission(request, media)
        cache_timeout = PERMISSION_CACHE_TIMEOUT
        if media.state == 'restricted' and additional_data:
            cache_timeout = RESTRICTED_MEDIA_CACHE_TIMEOUT
        set_cached_permission(cache_key, result, cache_timeout)
        return result

    def _calculate_access_permission(self, request, media: Media) -> bool:
        user = request.user
        if user.is_authenticated and self._user_has_elevated_access(user, media):
            return True
        if media.state == 'restricted':
            session_password_hash = request.session.get(f'media_password_{media.friendly_token}')
            query_password = request.GET.get('password')
            expected_password_hash = None
            if media.password:
                expected_password_hash = hashlib.sha256(media.password.encode('utf-8')).hexdigest()
            valid_session_password = (
                bool(session_password_hash) and
                bool(expected_password_hash) and
                hmac.compare_digest(session_password_hash, expected_password_hash)
            )
            valid_query_password = False
            if query_password and expected_password_hash:
                query_hash = hashlib.sha256(query_password.encode('utf-8')).hexdigest()
                valid_query_password = hmac.compare_digest(query_hash, expected_password_hash)
            if valid_session_password or valid_query_password:
                return True
            return False
        if not user.is_authenticated:
            return False
        if media.state == 'private':
            return False
        return False

    def _serve_file(self, file_path: str, head_request: bool = False) -> HttpResponse:
        if getattr(settings, 'USE_X_ACCEL_REDIRECT', True):
            return self._serve_file_via_xaccel(file_path, head_request)
        return self._serve_file_direct_django(file_path, head_request)

    def _get_content_type_and_headers(self, file_path: str) -> tuple:
        file_ext = os.path.splitext(file_path)[1].lower()
        content_type = self.CONTENT_TYPES.get(file_ext)
        is_video_like = (content_type and content_type.startswith('video/')) or content_type == 'application/vnd.apple.mpegurl'
        if is_video_like:
            headers = VIDEO_SECURITY_HEADERS
        elif content_type and content_type.startswith('image/'):
            headers = IMAGE_SECURITY_HEADERS
        else:
            headers = SECURITY_HEADERS
        return content_type, headers

    def _serve_file_via_xaccel(self, file_path: str, head_request: bool = False) -> HttpResponse:
        if file_path.startswith('original/'):
            unencoded = f'/internal/media/original/{file_path[len("original/"):]}'
        else:
            unencoded = f'/internal/media/{file_path}'
        internal_path = quote(unencoded, safe="/:")
        response = HttpResponse()
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
        for header, value in security_headers.items():
            response[header] = value
        response['Content-Disposition'] = 'inline'
        return response

    def _serve_file_direct_django(self, file_path: str, head_request: bool = False) -> HttpResponse:
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
                response = HttpResponse(content_type=content_type)
                try:
                    file_size = os.path.getsize(full_path)
                    response['Content-Length'] = str(file_size)
                except OSError:
                    pass
            else:
                response = FileResponse(open(full_path, 'rb'), content_type=content_type)
            response['Content-Disposition'] = 'inline'
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
