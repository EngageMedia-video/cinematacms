# 🎛️ CinemataCMS Permission System Documentation

This document outlines the permission model used in CinemataCMS to manage access control for users across various roles and contexts. It is intended for administrators, maintainers, and developers integrating or customizing access logic.

---
## 🧩 Key Concepts

| Term         | Description |
|--------------|-------------|
| **Role**     | A set of permissions assigned to a user. |
| **Permission** | A specific capability (e.g., `edit:content`). |
| **Context**  | A scoping entity (e.g., per project or section). |
| **User**     | An individual account with assigned roles. |
| **Resource** | An item (e.g., a video, article, collection) subject to access rules. |

---

## 🧑‍💼 Built-in Roles

CinemataCMS includes several default roles with predefined permissions.

| Role            | Description                             | Key Permissions |
|------------------|-----------------------------------------|------------------|
| **Admin**        | Full access to all features.            | `*` (all) |
| **Editor**       | Can create, edit, and publish content.  | `read:*`, `edit:*`, `publish:*` |
| **Contributor**  | Can create and edit drafts.             | `read:*`, `create:*`, `edit:own` |
| **Viewer**       | Read-only access to backend interface.  | `read:*` |

> ✅ **Note**: You can create custom roles using the Admin UI or API.

---

## 🛡️ Permissions

Permissions use the `verb:resource` naming convention. Wildcards are supported (`read:*`, `edit:media`, etc.).

### Common Permissions

| Permission        | Description                             |
|-------------------|-----------------------------------------|
| `read:content`    | View published content                  |
| `create:content`  | Add new articles or videos              |
| `edit:content`    | Edit existing content                   |
| `edit:own`        | Edit only user’s own content            |
| `publish:content` | Publish/unpublish content               |
| `delete:content`  | Remove content from the system          |
| `manage:media`    | Access and organize Media Library       |
| `manage:users`    | Create, edit, and assign user roles     |
| `manage:settings` | Update system-level configurations      |

---

## 🏗️ Role Management

### Viewing Roles

- Go to `Settings > Roles & Permissions`
- View system and custom roles

### Creating Custom Roles

Admins can create roles with specific permissions:

1. Go to `Settings > Roles & Permissions > Add Role`
2. Define:
   - Role name
   - Permissions (select from checklist)
3. Save the role

Example JSON representation:

```json
{
  "role": "Media Moderator",
  "permissions": [
    "read:media",
    "edit:media",
    "delete:media"
  ]
}
