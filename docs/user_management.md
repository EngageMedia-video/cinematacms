# User Management for CinemataCMS

User management in **CinemataCMS** ensures that the right individuals have the appropriate access to the platform’s features and content. This guide will walk through the process of creating, managing users, handling user roles, and managing permissions to ensure security and usability.


---
## Creating and Managing Users

Users can be created and managed through:

- The **Django Admin Interface**
- The **Django Shell**

Administrators can assign users to roles or groups either during user creation or afterward.

---

## 🧑‍🏫 Role-Based Access

CinemataCMS uses **named roles** to manage user capabilities across the system. These roles define what users can see and do on the platform. You can assign multiple roles to a single user to grant them combined permissions.

### Default Roles

| Role            | Description                                                                 |
|------------------|-----------------------------------------------------------------------------|
| **Administrator** | Full control over platform configuration, user management, and content.     |
| **Manager**       | Oversees content workflows and user coordination.                          |
| **Editor**        | Edits, moderates, and curates content.                                     |
| **Contributor**   | Can create and manage their own content.                                   |
| **Viewer**        | Read-only access to published content.                                     |

> ℹ️ The term *Administrator* refers to users with the highest level of access within CinemataCMS.

> 📌 You may define **custom roles** via the Django Admin Panel or shell to match your organizational needs.

---

## 🧑‍🤝‍🧑 Managing User Groups

**Groups** allow batch assignment of permissions to simplify large-scale user administration.

### How to Manage Groups

1. **Create a Group**
   - Navigate to `Auth > Groups` in the Django Admin.
   - Create groups such as `Content Moderators`, `Festival Curators`, etc.

2. **Assign Permissions**
   - Assign relevant permissions like `edit:content`, `feature:content`, or `manage:users`.

3. **Add Users to Groups**
   - Users inherit all permissions from the groups they belong to.
   - You can manage group membership in each user's profile via the admin interface.

---

## 🎯 Permissions and Access Control

Permissions define what actions a user or group can perform. These are expressed using the `action:resource` format (e.g., `edit:video`, `delete:media`, `manage:users`).

### Assigning Permissions

You can assign permissions to:

- Individual users (not recommended for scalability)
- Groups (preferred approach)
- Roles (via group or custom logic)

Use the Django Admin Interface under `Auth > Users` or `Auth > Groups` to manage permissions visually.

---
