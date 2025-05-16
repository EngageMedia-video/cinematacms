# 🎛️ CinemataCMS Permission System Documentation

This document outlines the permission model used in CinemataCMS to manage access control for users across various roles and contexts. It is intended for administrators, maintainers, and developers integrating or customizing access logic.

---
## 🧩 Key Concepts

| Term         | Description |
|--------------|-------------|
| **Role**     | A named collection of permissions granted to a user. |
| **Permission** | A specific capability defined in `verb:resource` format. |
| **Context**  | An optional scope for permissions (e.g., per project, section, or domain). |
| **User**     | An individual account with one or more assigned roles. |
| **Resource** | Any manageable entity within the platform (e.g., video, article, playlist). |

---

## 🧑‍💼 Built-in Roles

CinemataCMS includes several built-in roles with predefined permissions. These can be customized or extended as needed.

| Role            | Description                             | Example Permissions |
|------------------|-----------------------------------------|----------------------|
| **Administrator** | Full platform control. Intended for system-level access and configuration. | `*` (all permissions) |
| **Manager**       | Oversees content and user coordination. | `read:*`, `edit:*`, `manage:users` |
| **Editor**        | Responsible for curating and moderating content. | `read:*`, `edit:*`, `publish:*`, `delete:content` |
| **Contributor**   | Authenticated users who can create and edit their own drafts. | `read:*`, `create:content`, `edit:own` |
| **Viewer**        | Read-only access to platform interfaces and data. | `read:*` |

> 💡 **Note**: Additional roles can be created and assigned with any combination of permissions. Multiple roles may be assigned to the same user.


---

## 🛡️ Permission Model

Permissions follow a `verb:resource` naming scheme and support wildcard patterns for flexibility.

### Common Permissions

| Permission          | Description                                 |
|---------------------|---------------------------------------------|
| `read:content`      | View published content                      |
| `create:content`    | Add new articles, videos, or posts          |
| `edit:content`      | Edit any existing content                   |
| `edit:own`          | Edit content created by the same user       |
| `publish:content`   | Publish or unpublish content                |
| `delete:content`    | Remove content from the platform            |
| `read:media`        | Access Media Library                        |
| `edit:media`        | Modify media metadata or arrangement        |
| `delete:media`      | Delete media files                          |
| `manage:users`      | Assign roles and manage user accounts       |
| `manage:settings`   | Change system-level settings and configs    |

> ✅ Permissions are additive — users inherit all permissions from every role they hold.

---

## 🧱 Custom Role Management

Custom roles allow more granular and context-specific control.

### Viewing and Managing Roles

- Navigate to the **Roles & Permissions** section in the configuration dashboard
- View all system-defined and custom roles
- Filter by name or assigned permissions

### Creating a Custom Role

1. Open the **Roles & Permissions** configuration panel
2. Choose **Create New Role**
3. Provide:
   - **Role name**
   - **Description** (optional)
   - **Permissions** (select or define explicitly)
4. Save the role and assign it to users as needed

#### Example Role Definition (JSON):

```json
{
  "role": "Media Moderator",
  "permissions": [
    "read:media",
    "edit:media",
    "delete:media"
  ]
}
