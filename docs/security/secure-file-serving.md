# Secure File Serving in CinemataCMS

This document provides an overview of the secure media file serving implementation in CinemataCMS using X-Accel-Redirect to address critical security vulnerabilities and performance challenges in media file access control.

## Table of Contents

1. [Overview](#overview)
2. [Security Features](#security-features)
3. [Performance Benefits](#performance-benefits)
4. [Architecture](#architecture)
5. [Access Control](#access-control)
6. [Configuration](#configuration)

## Overview

X-Accel-Redirect is an Nginx feature that allows Django to control file access while Nginx handles the actual file serving. This implementation addresses critical security and performance challenges in media file serving.

### Security Challenges Addressed

Traditional Django media serving exposes files directly through static file serving, bypassing Django's authentication and authorization system. This creates several security risks:

- **Unauthorized Access**: Anyone with a direct URL can access private media files
- **No Permission Checking**: Media visibility settings (public, unlisted, restricted, private) are ignored
- **Password Bypass**: Password-protected content can be accessed without authentication
- **Directory Traversal**: Potential security vulnerabilities in file path handling

### Performance Issues Resolved

Serving large media files directly through Django is inefficient and resource-intensive:

- **High Memory Usage**: Django loads entire files into memory
- **Poor Scalability**: Django processes become bottlenecks for large files
- **No Streaming**: Large videos can't be streamed efficiently
- **Resource Exhaustion**: Multiple concurrent requests can overwhelm Django

### Business Requirements

CinemataCMS has specific needs for media access control:

- **User Privacy**: Protect private user uploads
- **Password Protection**: Allow content creators to password-protect their media
- **Role-Based Access**: Different permissions for curators, editors, managers, and regular users

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

The system implements a comprehensive permission model:

- **Public Media**: Anyone can access (no authentication required)
- **Unlisted Media**: Anyone with the direct link can access
- **Restricted Media**: Authenticated users with valid password (or owner/editor/manager)
- **Private Media**: Only media owner, editors, and managers can access

### Important Note: File Access vs. Playlist Visibility

There is an intentional distinction between **direct file access** and **playlist visibility** for unlisted media:

- **Direct File Access**: Unlisted media files can be accessed by anyone who knows the direct URL
- **Playlist Visibility**: Unlisted media only appears in playlists for authenticated users

This design allows for "link-only" sharing where content creators can share unlisted videos via direct links without requiring recipients to create accounts, while still maintaining privacy in public playlist listings.

## Performance Benefits

### Enhanced Security

- **Django Authentication**: All file access goes through Django's authentication system
- **Permission Enforcement**: Media visibility settings are strictly enforced
- **Password Protection**: Restricted content requires valid passwords
- **Path Validation**: Prevents directory traversal attacks

### High Performance

- **Nginx Efficiency**: Nginx handles actual file serving with optimized performance
- **Streaming Support**: Large video files can be streamed efficiently
- **Caching**: Proper cache headers for media content
- **Concurrent Access**: Multiple users can access files simultaneously without performance degradation

### Development Flexibility

- **Dual Mode Support**: Works with both Django development server and production Nginx
- **Easy Configuration**: Simple setting toggle between development and production modes
- **Environment Variables**: Can be controlled via environment variables for different deployment scenarios
- **No Code Changes**: Access rules can be modified without touching Nginx configuration

## Architecture

The secure file serving implementation consists of several key components:

### Django Components

1. **SecureMediaView**: A Django class-based view that handles all media file requests
2. **Permission Caching**: Redis-based caching system for improved performance
3. **Path Pattern Matching**: Multiple regex patterns to identify media files from URLs
4. **Dual Serving Modes**: X-Accel-Redirect for production, direct serving for development

### Nginx Components

1. **Internal Locations**: Nginx locations marked as `internal` that can only be accessed via X-Accel-Redirect
2. **Performance Optimizations**: Sendfile, TCP optimizations, and proper caching headers
3. **Security Headers**: Additional security headers for different content types

### Flow Diagram

```text
User Request → Django (Authentication/Authorization) → X-Accel-Redirect → Nginx (File Serving)
```

## Access Control

### Permission Hierarchy

1. **Owner**: Full access to their own media regardless of visibility
2. **Curators/Editors/Managers**: Access to all media in the system
3. **Authenticated Users**: Access based on media visibility and password requirements
4. **Anonymous Users**: Access only to public and unlisted media

### Password Protection

The system supports multiple password verification methods:

1. **Session Storage**: Passwords are stored in Django sessions after successful form submission
2. **Query Parameter**: Passwords can be passed via `?password=xxx` for API access
3. **Privileged Access**: Media owners, editors, and managers bypass password requirements

### Caching Strategy

The implementation includes Redis caching for user permission checks:

- **Elevated Access Caching**: Caches whether a user has owner/editor/manager permissions
- **Permission Result Caching**: Caches the final permission decision
- **Different Cache Timeouts**: Standard permissions (5 minutes), Password-protected (1 minute)
- **Automatic Invalidation**: Cache is cleared when media permissions change

## Configuration

### Django Settings

The system uses a simple configuration flag to switch between modes:

```python
# Production mode (uses X-Accel-Redirect)
USE_X_ACCEL_REDIRECT = True

# Development mode (Django direct serving)
USE_X_ACCEL_REDIRECT = False
```

### Environment Variables

Configuration can be controlled via environment variables:

```bash
# Enable X-Accel-Redirect (production)
export USE_X_ACCEL_REDIRECT=True

# Disable X-Accel-Redirect (development)
export USE_X_ACCEL_REDIRECT=False
```

### Nginx Configuration

Production deployments require Nginx configuration with internal locations:

- Internal media locations that are not directly accessible
- Performance optimizations (sendfile, TCP settings)
- Proper cache headers and security headers
- X-Accel-Redirect support

## Conclusion

This secure file serving implementation provides a robust, secure, and high-performance solution for media file serving in CinemataCMS. The dual-mode approach ensures compatibility with both development and production environments, while the comprehensive permission system provides fine-grained access control.

Key benefits include:

- **Security**: Complete control over media access with Django's permission system
- **Performance**: Nginx-optimized file serving in production
- **Flexibility**: Easy development/production switching
- **Scalability**: Efficient handling of large files and concurrent requests
- **Maintainability**: Clear separation of concerns between authentication and file serving
