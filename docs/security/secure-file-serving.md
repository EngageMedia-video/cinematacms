# X-Accel-Redirect Implementation Guide for CinemaCMS

This guide provides a comprehensive step-by-step implementation of secure media file serving using X-Accel-Redirect in CinemaCMS, designed to address critical security vulnerabilities and performance challenges in media file access control.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Create Secure Media Views](#step-1-create-secure-media-views)
4. [Step 2: Configure Django Settings](#step-2-configure-django-settings)
5. [Step 3: Update URL Configuration](#step-3-update-url-configuration)
6. [Step 4: Configure Nginx](#step-4-configure-nginx)
7. [Step 5: Implement Password Protection](#step-5-implement-password-protection)
8. [Step 6: Testing and Validation](#step-6-testing-and-validation)
9. [Troubleshooting](#troubleshooting)
10. [Performance Considerations](#performance-considerations)

## Overview

X-Accel-Redirect is a Nginx feature that allows Django to control file access while Nginx handles the actual file serving. This implementation addresses critical security and performance challenges in media file serving.

### Why This Implementation is Necessary

#### Security Vulnerabilities in Traditional Media Serving

**Problem**: Traditional Django media serving exposes files directly through static file serving, bypassing Django's authentication and authorization system.

**Risks**:
- **Unauthorized Access**: Anyone with a direct URL can access private media files
- **No Permission Checking**: Media visibility settings (public, unlisted, restricted, private) are ignored
- **Password Bypass**: Password-protected content can be accessed without authentication
- **Directory Traversal**: Potential security vulnerabilities in file path handling

**Example**: A private video at `/media/original/user/admin/private-video.mp4` could be accessed directly by anyone who knows the URL, completely bypassing Django's permission system.

#### Performance Issues with Django-Only Serving

**Problem**: Serving large media files directly through Django is inefficient and resource-intensive.

**Issues**:
- **High Memory Usage**: Django loads entire files into memory
- **Poor Scalability**: Django processes become bottlenecks for large files
- **No Streaming**: Large videos can't be streamed efficiently
- **Resource Exhaustion**: Multiple concurrent requests can overwhelm Django

#### Business Requirements for Media Access Control

**CinemaCMS Specific Needs**:
- **User Privacy**: Protect private user uploads
- **Password Protection**: Allow content creators to password-protect their media
- **Role-Based Access**: Different permissions for editors, managers, and regular users

### Solution Benefits

#### Enhanced Security
- **Django Authentication**: All file access goes through Django's authentication system
- **Permission Enforcement**: Media visibility settings are strictly enforced
- **Password Protection**: Restricted content requires valid passwords
- **Path Validation**: Prevents directory traversal attacks

#### High Performance
- **Nginx Efficiency**: Nginx handles actual file serving with optimized performance
- **Streaming Support**: Large video files can be streamed efficiently
- **Caching**: Proper cache headers for media content
- **Concurrent Access**: Multiple users can access files simultaneously without performance degradation

#### Development Flexibility
- **Dual Mode Support**: Works with both Django development server and production Nginx
- **Easy Configuration**: Simple setting toggle between development and production modes
- **Environment Variables**: Can be controlled via environment variables for different deployment scenarios
- **No Code Changes**: Access rules can be modified without touching Nginx configuration

## Prerequisites

- Django application with media files
- Nginx web server
- Media files stored in a specific directory structure
- Django authentication system configured

## Step 1: Create Secure Media Views

### 1.1 Create the Secure Media Views File

Create `files/secure_media_views.py`:

```python
import os
import re
import mimetypes
import logging
from urllib.parse import unquote

from django.conf import settings
from django.http import Http404, HttpResponse, HttpResponseForbidden, FileResponse
from django.views.decorators.cache import cache_control
from django.views.decorators.http import require_GET
from django.utils.decorators import method_decorator
from django.views import View

from .models import Media, Encoding
from .methods import is_mediacms_editor, is_mediacms_manager

logger = logging.getLogger(__name__)


class SecureMediaView(View):
    """
    Securely serves media files, handling authentication and authorization
    for different visibility levels (public, unlisted, restricted, private).

    It uses Nginx's X-Accel-Redirect for efficient file delivery in production.
    """
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
        '.m3u8': 'application/x-mpegURL',
        '.ts': 'video/MP2T'
    }

    @method_decorator(cache_control(max_age=604800, private=True))
    def get(self, request, file_path):
        file_path = unquote(file_path)
        logger.debug(f"Secure media request for: {file_path}")

        if '..' in file_path or file_path.startswith('/'):
            logger.warning(f"Path traversal attempt: {file_path}")
            raise Http404("Invalid file path")

        if self._is_public_media_file(file_path):
            logger.debug(f"Serving public media file: {file_path}")
            return self._serve_file(file_path)

        media = self._get_media_from_path(file_path)
        if not media:
            logger.warning(f"Media not found for path: {file_path}")
            raise Http404("Media not found")

        logger.debug(f"Found media: {media.friendly_token} (state: {media.state})")

        if not self._check_access_permission(request, media):
            logger.warning(f"Access denied for media: {media.friendly_token} (user: {request.user})")
            return HttpResponseForbidden("Access denied")

        return self._serve_file(file_path)

    def _get_media_from_path(self, file_path):
        """Extract media object from file path by trying different patterns."""
        # Pattern for original media files
        match = re.search(r'original/user/([^/]+)/([a-f0-9]{32})\.(.+)$', file_path)
        if match:
            username, uid_str, _ = match.groups()
            logger.debug(f"Original file pattern matched: username={username}, uid={uid_str}")
            return Media.objects.filter(uid=uid_str, user__username=username).first()

        # Pattern for encoded files
        match = re.search(r'encoded/(\d+)/([^/]+)/([a-f0-9]{32})\.(.+)$', file_path)
        if match:
            profile_id, username, uid_str, _ = match.groups()
            logger.debug(f"Encoded file pattern matched: profile_id={profile_id}, username={username}, uid={uid_str}")
            encoding = Encoding.objects.select_related('media').filter(
                media__uid=uid_str,
                media__user__username=username,
                profile_id=profile_id
            ).first()
            return encoding.media if encoding else None

        # Pattern for HLS files
        match = re.search(r'hls/([a-f0-9]{32})/(.+)$', file_path)
        if match:
            uid_str, _ = match.groups()
            logger.debug(f"HLS file pattern matched: uid={uid_str}")
            return Media.objects.filter(uid=uid_str).first()

        # Generic UID pattern as a fallback
        match = re.search(r'([a-f0-9]{32})', file_path)
        if match:
            uid_str = match.group(1)
            logger.debug(f"Generic UID pattern matched: uid={uid_str}")
            return Media.objects.filter(uid=uid_str).first()

        return None

    def _is_public_media_file(self, file_path):
        """Check if the file is a public asset that bypasses media permissions."""
        public_paths = [
            '/thumbnails/', 'userlogos/', 'logos/', 'favicons/', 'social-media-icons/',
        ]
        return any(path in file_path for path in public_paths)

    def _user_has_elevated_access(self, user, media):
        """Check if user is owner, editor, or manager. Assumes user is authenticated."""
        return (user == media.user or
                is_mediacms_editor(user) or
                is_mediacms_manager(user))

    def _check_access_permission(self, request, media):
        """Check if the user has permission to access the media."""
        user = request.user

        if media.state in ('public', 'unlisted'):
            return True

        if media.state == 'restricted':
            session_password = request.session.get(f'media_password_{media.friendly_token}')
            query_password = request.GET.get('password')
            if media.password and (media.password == session_password or media.password == query_password):
                logger.debug("Restricted media access granted: valid password provided")
                return True
            logger.debug("Restricted media access denied: no valid password provided")
            return False

        if not user.is_authenticated:
            logger.debug(f"Access denied for '{media.state}' media: user not authenticated")
            return False

        if self._user_has_elevated_access(user, media):
            logger.debug(f"Access granted for '{media.state}' media: user has elevated permissions")
            return True

        if media.state == 'private':
            logger.debug("Private media access denied: user lacks elevated permissions")
            return False

        return False

    def _serve_file(self, file_path):
        """Serve file using X-Accel-Redirect (production) or Django (development)."""
        if getattr(settings, 'USE_X_ACCEL_REDIRECT', True):
            return self._serve_file_via_xaccel(file_path)
        return self._serve_file_direct_django(file_path)

    def _serve_file_via_xaccel(self, file_path):
        """Serve file using Nginx's X-Accel-Redirect header."""
        if file_path.startswith('original/'):
            internal_path = f'/internal/media/original/{file_path[len("original/"):]}'
        else:
            internal_path = f'/internal/media/{file_path}'

        response = HttpResponse()
        response['X-Accel-Redirect'] = internal_path
        response['X-Accel-Buffering'] = 'yes'

        file_ext = os.path.splitext(file_path)[1].lower()
        content_type = self.CONTENT_TYPES.get(file_ext)
        if content_type:
            response['Content-Type'] = content_type

        response['Content-Disposition'] = 'inline'

        return response

    def _serve_file_direct_django(self, file_path):
        """Serve file directly through Django (for development)."""
        full_path = os.path.join(settings.MEDIA_ROOT, file_path)
        logger.debug(f"Attempting to serve file directly: {full_path}")

        if not os.path.exists(full_path) or not os.path.isfile(full_path):
            logger.warning(f"File not found at: {full_path}")
            raise Http404("File not found")

        content_type, _ = mimetypes.guess_type(full_path)
        content_type = content_type or 'application/octet-stream'
        logger.debug(f"Serving file with content-type: {content_type}")

        try:
            response = FileResponse(open(full_path, 'rb'), content_type=content_type)
            response['Cache-Control'] = 'private, max-age=3600'
            response['X-Content-Type-Options'] = 'nosniff'
            response['Content-Disposition'] = 'inline'
            return response
        except IOError as e:
            logger.error(f"Error reading file {full_path}: {e}")
            raise Http404("File could not be read")


@require_GET
def secure_media_file(request, file_path):
    """Function-based view wrapper for SecureMediaView."""
    return SecureMediaView.as_view()(request, file_path=file_path)
```

### 1.2 Key Features of the Secure Media View

- **Path Validation**: Prevents directory traversal attacks.
- **Media Object Identification**: Extracts media objects from file paths using multiple regex patterns, including a fallback for generic UIDs.
- **Refactored Permission Checking**: Implements a clearer and more secure logic for different access levels (public, unlisted, restricted, private).
- **Password Protection**: Supports session-based and query parameter password verification.
- **Dual Serving Modes**: Uses X-Accel-Redirect for production and direct Django serving for development.
- **Elevated Access Control**: A dedicated method to check for owner, editor, or manager privileges.

## Step 2: Configure Django Settings

### 2.1 Production Settings (`cms/settings.py`)

Add the following configuration:

```python
# X-Accel-Redirect settings for secure media serving
# Set to True when using Nginx with X-Accel-Redirect (production)
# Set to False when using Django development server
USE_X_ACCEL_REDIRECT = True
```

### 2.2 Development Settings (`cms/dev_settings.py`)

Add the following configuration:

```python
# X-Accel-Redirect settings for secure media serving
# Set to False in development since Django runserver doesn't support X-Accel-Redirect
USE_X_ACCEL_REDIRECT = False

# Add logging configuration for debugging
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "level": "DEBUG",
            "class": "logging.StreamHandler",
        },
        "file": {
            "level": "ERROR",
            "class": "logging.FileHandler",
            "filename": "logs/django.log",
        },
    },
    "loggers": {
        "files.secure_media_views": {
            "handlers": ["console"],
            "level": "DEBUG",
            "propagate": False,
        },
        "django": {
            "handlers": ["file"],
            "level": "ERROR",
        },
    },
}
```

### 2.3 Environment-Specific Configuration

You can also configure `USE_X_ACCEL_REDIRECT` based on environment variables:

```python
# In cms/settings.py or cms/local_settings.py
import os

# X-Accel-Redirect settings for secure media serving
# Can be overridden by environment variable
USE_X_ACCEL_REDIRECT = os.getenv('USE_X_ACCEL_REDIRECT', 'True').lower() == 'true'
```

## Step 3: Update URL Configuration

### 3.1 Update `files/urls.py`

Replace the existing media serving configuration:

```python
from django.conf.urls.static import static
from django.urls import path, re_path
from django.views.static import serve

from . import management_views, views, tinymce_handlers, secure_media_views
from .feeds import IndexRSSFeed, SearchRSSFeed

urlpatterns = [
    # SECURE MEDIA FILE SERVING
    re_path(r"^media/(?P<file_path>.+)$", secure_media_views.secure_media_file, name="secure_media"),
    # ... other URL patterns ...
]

# Remove the static media serving for production
# urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Only add static serving for development
if not getattr(settings, 'USE_X_ACCEL_REDIRECT', True):
    urlpatterns += [
        # Note: /media/ requests are now handled by secure_media_views
        re_path(
            r"^/api/v1/playlists/(?P<friendly_token>[\w]*)$",
            views.PlaylistDetail.as_view(),
            name="playlist_detail",
        ),
    ]
```

## Step 4: Configure Nginx

### 4.1 Update Nginx Configuration (`deploy/mediacms.io`)

Replace the existing media serving locations with internal locations:

```nginx
server {
    listen 80;
    server_name cinemata.local;

    gzip on;
    access_log /var/log/nginx/mediacms.io.access.log;
    error_log  /var/log/nginx/mediacms.io.error.log  warn;

    location /static {
        alias /home/cinemata/cinematacms/static;
    }

    # Internal locations for X-Accel-Redirect - not accessible externally
    location /internal/media/original/ {
        internal;
        alias /home/cinemata/cinematacms/media_files/original/;

        # Enable efficient file serving
        sendfile on;
        tcp_nopush on;
        tcp_nodelay on;

        # Cache settings for media files
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options nosniff;
    }

    location /internal/media/ {
        internal;
        alias /home/cinemata/cinematacms/media_files/;

        # Enable efficient file serving
        sendfile on;
        tcp_nopush on;
        tcp_nodelay on;

        # Cache settings for media files
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header X-Content-Type-Options nosniff;
    }

    # All media requests now go through Django for authentication
    # Django will use X-Accel-Redirect to serve files efficiently

    location / {
        add_header 'Access-Control-Allow-Origin' '*';
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS';
        add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range';
        add_header 'Access-Control-Expose-Headers' 'Content-Length,Content-Range';

        include /etc/nginx/uwsgi_params;
        uwsgi_pass 127.0.0.1:9000;
    }
}
```

### 4.2 Key Nginx Configuration Points

- **Internal Locations**: Use `internal;` directive to prevent direct external access
- **Performance Optimizations**: Enable `sendfile`, `tcp_nopush`, `tcp_nodelay`
- **Caching**: Set appropriate cache headers for media files
- **Security Headers**: Add `X-Content-Type-Options` to prevent MIME sniffing

## Step 5: Implement Password Protection

### 5.1 Update Media View (`files/views.py`)

Add session storage for password verification:

```python
def view_media(request):
    # ... existing code ...

    if request.POST.get("password"):
        if media.password == request.POST.get("password"):
            can_see_restricted_media = True
            # Store password in session for file access
            request.session[f'media_password_{media.friendly_token}'] = media.password
        else:
            wrong_password_provided = True

    # ... rest of the function ...
```

### 5.2 Password Verification Flow

The system supports multiple password verification methods:

1. **Session Storage**: Passwords are stored in Django sessions after successful form submission
2. **Query Parameter**: Passwords can be passed via `?password=xxx` for API access
3. **Privileged Access**: Media owners, editors, and managers bypass password requirements

## Step 6: Testing and Validation

### 6.1 Test Public Content

```bash
# Test public media (should work without authentication)
curl -I http://your-domain/media/original/user/username/public-file.mp4
# Should return 200 OK

# Test thumbnails (should work without authentication)
curl -I http://your-domain/media/original/thumbnails/user/username/thumb.jpg
# Should return 200 OK
```

### 6.2 Test Unlisted Content

```bash
# Test unlisted media without authentication (should work - direct file access)
curl -I http://your-domain/media/original/user/username/unlisted-file.mp4
# Should return 200 OK

# Note: Unlisted media files are accessible to anyone with the direct link
# However, unlisted media won't appear in public playlists for anonymous users
```

### 6.3 Test Private Content

```bash
# Test private media without authentication (should fail)
curl -I http://your-domain/media/original/user/username/private-file.mp4
# Should return 403 Forbidden

# Test private media with authentication (should work)
curl -I -H "Authorization: Token your-token" http://your-domain/media/original/user/username/private-file.mp4
# Should return 200 OK
```

### 6.4 Test Restricted Content

```bash
# Test restricted media without password (should fail)
curl -I http://your-domain/media/original/user/username/restricted-file.mp4
# Should return 403 Forbidden

# Test restricted media with valid password via query parameter
curl -I "http://your-domain/media/original/user/username/restricted-file.mp4?password=validpassword"
# Should return 200 OK

# Test restricted media with invalid password
curl -I "http://your-domain/media/original/user/username/restricted-file.mp4?password=wrongpassword"
# Should return 403 Forbidden
```

### 6.5 Test Development Mode

```bash
# Start Django development server with USE_X_ACCEL_REDIRECT=False
python manage.py runserver --settings=cms.dev_settings

# Test file serving (should work directly through Django)
curl -I http://localhost:8000/media/original/user/username/file.mp4
# Should return 200 OK with file served by Django

# Test with environment variable override
USE_X_ACCEL_REDIRECT=False python manage.py runserver
# Should also serve files directly through Django
```

## Troubleshooting

### Common Issues and Solutions

#### 1. 404 Not Found for Valid Files

**Symptoms**: Files exist but return 404 errors

**Solutions**:
- Check URL patterns in `files/urls.py`
- Verify file paths match expected patterns
- Ensure media objects exist in database
- Check Nginx internal location paths

#### 2. 403 Forbidden for Public Content

**Symptoms**: Public media returns 403 errors

**Solutions**:
- Verify media state is set to 'public'
- Check Django authentication middleware
- Review permission checking logic in `SecureMediaView`

#### 3. Restricted Media Password Issues

**Symptoms**: Password-protected content not accessible

**Solutions**:
- Verify password is correctly set on media object
- Check session storage after successful password submission
- Ensure user is authenticated before password check
- Test with `?password=xxx` query parameter for API access
- Verify owner/editor/manager privileges are working correctly

#### 4. Files Not Loading in Development

**Symptoms**: Files don't load with Django development server

**Solutions**:
- Ensure `USE_X_ACCEL_REDIRECT = False` in development settings
- Check that `MEDIA_ROOT` is correctly configured
- Verify file permissions are readable by Django process
- Check Django logs for file access errors
- Verify the setting is being read correctly: `print(settings.USE_X_ACCEL_REDIRECT)`

#### 5. Direct File Access Still Working in Production

**Symptoms**: Files can still be accessed directly via Nginx

**Solutions**:
- Ensure old Nginx locations are removed
- Verify internal locations are marked as `internal`
- Check Nginx configuration reload
- Test direct access to internal paths (should fail)

#### 6. Poor Performance in Development

**Symptoms**: Slow file serving in development

**Solutions**:
- This is expected - Django direct serving is slower than Nginx
- For performance testing, use production environment
- Consider using a local Nginx setup for performance testing

### Debugging with Logging

Enable detailed logging in Django settings:

```python
LOGGING = {
    'version': 1,
    'handlers': {
        'file': {
            'level': 'DEBUG',
            'class': 'logging.FileHandler',
            'filename': 'secure_media.log',
        },
    },
    'loggers': {
        'files.secure_media_views': {
            'handlers': ['file'],
            'level': 'DEBUG',
            'propagate': True,
        },
    },
}
```

## Performance Considerations

### Production Optimizations

1. **Nginx Configuration**:
   - Enable `sendfile` for efficient file transfer
   - Use `tcp_nopush` and `tcp_nodelay` for optimized streaming
   - Set appropriate cache headers for media content

2. **Django Optimizations**:
   - Use database queries with proper indexing
   - Implement per-request caching
   - Minimize processing for file requests

3. **File System**:
   - Use fast storage for media files
   - Consider SSD storage for high-traffic scenarios
   - Implement proper file permissions

### Development Considerations

1. **Django Development Server**:
   - Files served directly by Django when `USE_X_ACCEL_REDIRECT = False`
   - Full authentication/authorization still applies
   - No Nginx configuration required
   - Can be controlled via environment variable: `USE_X_ACCEL_REDIRECT=False`

2. **Testing**:
   - Use production environment for performance testing
   - Consider local Nginx setup for development performance testing

## Security Features

### Path Validation
- Prevents directory traversal attacks (`../` sequences)
- Validates file path format and structure
- Blocks access to paths starting with `/`

### Authentication Integration
- Uses Django's built-in authentication system
- Supports both session and token-based authentication
- Integrates with existing MediaCMS user roles

### Authorization Logic

- **Public Media**: Anyone can access (no authentication required)
- **Unlisted Media**: Anyone with the direct link can access (no authentication required for file access, but authentication required for playlist visibility)
- **Restricted Media**: Authenticated users with valid password (or owner/editor/manager)
- **Private Media**: Only media owner, editors, and managers can access

#### Important Note: File Access vs. Playlist Visibility

There is an intentional distinction between **direct file access** and **playlist visibility** for unlisted media:

- **Direct File Access**: Unlisted media files can be accessed by anyone who knows the direct URL (no authentication required)
- **Playlist Visibility**: Unlisted media only appears in playlists for authenticated users

This design allows for "link-only" sharing where content creators can share unlisted videos via direct links without requiring recipients to create accounts, while still maintaining privacy in public playlist listings.

### Conclusion

This implementation provides a robust, secure, and high-performance solution for media file serving in CinemaCMS. The dual-mode approach ensures compatibility with both development and production environments, while the comprehensive permission system provides fine-grained access control.

The step-by-step approach ensures that each component is properly configured and tested before moving to the next step, reducing the risk of configuration errors and security vulnerabilities.
