# 🎬 Cinemata User Roles Permission Matrix

This permission matrix defines the hierarchical access control system for Cinemata, outlining what different user types can do within the platform. Understanding these permissions is essential for:

- **👥 Administrators** setting up user accounts and managing access levels
- **🎥 Content creators** understanding their capabilities based on their role
- **💻 Developers** implementing role-based features and security measures
- **🛠️ Site managers** planning user workflows and content moderation strategies

The matrix follows a progressive permission model where higher-level roles inherit all permissions from lower levels, plus additional privileges. This ensures a clear chain of authority while maintaining appropriate content security and user experience.

## 🔗 User Role Hierarchy (Lowest to Highest)

1. 🌐 **Public Visitor** (non-authenticated)
2. 👤 **Registered User** (authenticated)
3. ⭐ **Trusted User**
4. ✏️ **Editor**
5. 🎯 **Manager**
6. 🔑 **Admin**

## 📹 Content Management Permissions

### 👀 Video Access & Viewing

| Permission | Public Visitor | Registered User | Trusted User | Editor | Manager | Admin |
|:-----------|:---------------|:----------------|:-------------|:-------|:--------|:------|
| View public videos | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Access password-protected videos | With password | With password | With password | With password | With password | ✓ |
| Download videos (if enabled) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

### 📤 Video Upload & Management

| Permission | Public Visitor | Registered User | Trusted User | Editor | Manager | Admin |
|:-----------|:---------------|:----------------|:-------------|:-------|:--------|:------|
| Upload videos | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Set video privacy settings | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Password-protect videos | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Edit own video metadata | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit others' video metadata | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Delete own videos | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Delete others' videos | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Bulk upload (drag & drop multiple files) | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Auto-transcription via Whisper | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Feature videos on the front page | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Transfer video ownership | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

### 📝 Subtitle Management

| Permission | Public Visitor | Registered User | Trusted User | Editor | Manager | Admin |
|:-----------|:---------------|:----------------|:-------------|:-------|:--------|:------|
| View subtitles | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Upload subtitles to own videos | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Upload subtitles to others' videos | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Edit own subtitles | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit others' subtitles | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Delete subtitles | ✗ | Own only | Own only | ✓ | ✓ | ✓ |

### 💬 Community Interaction

| Permission | Public Visitor | Registered User | Trusted User | Editor | Manager | Admin |
|:-----------|:---------------|:----------------|:-------------|:-------|:--------|:------|
| View comments | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Post comments | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit own comments | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Delete own comments | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Delete others' comments | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Moderate comments (edit others') | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Like/dislike videos | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Rate videos (advanced rating system) | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Report content | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Create playlists | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Share videos | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## 🛡️ Editorial & Administrative Permissions

### 🔍 Content Review & Moderation

| Permission | Public Visitor | Registered User | Trusted User | Editor | Manager | Admin |
|:-----------|:---------------|:----------------|:-------------|:-------|:--------|:------|
| Access content review dashboard | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Review and approve submitted content | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Handle reported content | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Set content visibility status | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Access moderation logs | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |

### 🎨 Site Management

| Permission | Public Visitor | Registered User | Trusted User | Editor | Manager | Admin |
|:-----------|:---------------|:----------------|:-------------|:-------|:--------|:------|
| Manage homepage featured content | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Create/edit site pages (About, Contact, etc.) | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Manage categories, tags, and topics | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| View site analytics | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Configure encoding profiles | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Manage site settings and configuration | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

### 👥 User Management

| Permission | Public Visitor | Registered User | Trusted User | Editor | Manager | Admin |
|:-----------|:---------------|:----------------|:-------------|:-------|:--------|:------|
| Create user accounts | Self-register only | ✗ | ✗ | ✗ | ✓ | ✓ |
| Edit own profile | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| View user profiles | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Edit other users' profiles | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Promote users to higher roles | ✗ | ✗ | ✗ | ✗ | Manager+ only | ✓ |
| Suspend/deactivate users | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| Delete user accounts | ✗ | Own only | Own only | ✗ | ✗ | ✓ |

### ⚙️ System Administration

| Permission | Public Visitor | Registered User | Trusted User | Editor | Manager | Admin |
|:-----------|:---------------|:----------------|:-------------|:-------|:--------|:------|
| Access Django admin panel | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Manage encoding tasks and queues | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| View system logs and diagnostics | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Configure API access and tokens | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| Manage database and file storage | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

## 🔌 API Access Permissions

| Permission | Public Visitor | Registered User | Trusted User | Editor | Manager | Admin |
|:-----------|:---------------|:----------------|:-------------|:-------|:--------|:------|
| Read-only API access (public content) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Personal API token for authenticated requests | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Upload via API | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ |
| Bulk operations via API | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Administrative API endpoints | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |

## 📊 Upload Limits & Restrictions

| User Role | Storage Quota | Concurrent Uploads | File Size Limit | Special Restrictions |
|:----------|:--------------|:-------------------|:-----------------|:--------------------|
| Public Visitor | N/A | N/A | N/A | No upload privileges |
| Registered User | No specified quota* | Single file upload | ~3.9 GB per file | Must upload one video at a time |
| Trusted User | No specified quota* | Bulk upload (up to 100 files) | ~3.9 GB per file | - |
| Editor | No specified quota* | Bulk upload (up to 100 files) | ~3.9 GB per file | - |
| Manager | No specified quota* | Bulk upload (up to 100 files) | ~3.9 GB per file | - |
| Admin | Unlimited | Bulk upload (up to 100 files) | ~3.9 GB per file | Can override all restrictions |

> **Note**: *The current system has a maximum file size of approximately 3.9 GB per upload, with up to 100 concurrent uploads for bulk operations. User-specific storage quotas are not implemented in the current version but may be added in future releases.

## 🔐 Content Visibility Levels

1. **🌍 Public**: Visible to all visitors, including non-authenticated users
2. **🔗 Unlisted**: Accessible via direct link but not listed publicly; requires authentication to view
3. **🔐 Password-protected**: Requires specific password to access; visible to admins without password
4. **🔒 Private**: Visible only to content owner, managers, and admins

## 🛡️ Multi-Factor Authentication (MFA)

All admin users are **required** to enable multi-factor authentication for enhanced security. This requirement can be extended to other user roles based on organizational security policies.

---

*This permission matrix is subject to change as Cinemata evolves. Always refer to the latest documentation for current access controls.* 📚
