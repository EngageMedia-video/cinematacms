# 🧰 CinemataCMS Troubleshooting Guide for Common Administrative Issues

This guide outlines how to identify and resolve common issues faced by **authorized users** when managing roles, permissions, and content in **CinemataCMS**.

---

## 🧑‍💻 1. User Cannot Access Expected Features

### 🔍 Problem
- User reports missing menu items or inaccessible pages  
- "Permission Denied" or similar errors when navigating the platform

### ✅ Steps to Resolve
1. **Check Assigned Roles**  
   Go to `Auth > Users` and confirm that the user has the correct role(s).

2. **Verify Role Permissions**  
   Ensure the role(s) contain relevant permissions (e.g., `read:content`, `edit:content`, etc.).

3. **Review Group Memberships**  
   Check if the user belongs to appropriate groups that inherit necessary permissions.

4. **Impersonate Temporarily**  
   Assign the same role(s) to your account and replicate the issue to test.

---

## 🔐 2. Cannot Edit or Remove Certain Content

### 🔍 Problem
- Content appears in dashboards but cannot be modified or removed  
- Error indicating insufficient permissions

### ✅ Steps to Resolve
1. **Validate Role Permissions**  
   Make sure the user has `edit:content`, `delete:content`, or broader access where required.

2. **Content Ownership Limitations**  
   If using `edit:own`, ensure the user attempting to edit is the original creator.

3. **Check Object-Level Constraints**  
   If object-level permissions are enabled, confirm that the user has access to specific content items.

---

## 🎛️ 3. Role or Permission Changes Not Applying

### 🔍 Problem
- Updates to roles or permissions seem to have no effect  
- Users still lack access after configuration changes

### ✅ Steps to Resolve
1. **Clear Cache**  
   If the platform uses caching, refresh or restart services to reflect changes.

2. **Re-authenticate the User**  
   Ask the user to log out and log in again to reload permission contexts.

3. **Check for Role Conflicts**  
   Multiple roles with overlapping or missing permissions may cause inconsistent behavior.

---

## 📹 4. Video Uploads Not Appearing in Public Interface

### 🔍 Problem
- Videos are uploaded successfully but not publicly visible  
- Content curators do not receive notifications

### ✅ Steps to Resolve
1. **Check Video Visibility Settings**  
   Ensure the video is not still marked as `private` or `unlisted`.

2. **Determine User Type**  
   - Uploads by regular users are private by default and require review.  
   - Trusted users can assign visibility immediately.

3. **Verify Notification Delivery**  
   Check if the platform is sending notification emails successfully.

4. **Review Moderation Queue**  
   Go to the content moderation dashboard and check for pending reviews.

---

## 👥 5. Unable to Update User Group Assignments

### 🔍 Problem
- Attempts to add/remove users from groups fail  
- Changes to group settings are not saved

### ✅ Steps to Resolve
1. **Ensure Permission to Manage Users**  
   Confirm the user managing roles has `manage:users` permission.

2. **Use Correct Workflow**  
   Navigate to each user's profile via `Auth > Users > [Username]` and edit their group memberships.

3. **Inspect Group Configuration**  
   Make sure the group exists and includes the intended permissions.

---

## 💾 6. Errors During Backup or Restore

> ⚠️ For full backup and recovery procedures, refer to the dedicated documentation file.

### 🔍 Problem
- Backups are incomplete or fail to execute  
- Errors during restoration from backup files

### ✅ Quick Checks
1. **Storage Capacity**  
   Ensure the server has enough disk space for backup files.

2. **Correct Commands** (for Django installations)
   ```bash
   # Backup
   python manage.py dumpdata > backup.json

   # Restore
   python manage.py loaddata backup.json
   ```

3. **Database Migrations**
   Run migrations to keep schema up to date:
   ```bash
   python manage.py migrate
   ```

---

## 🔒 7. Lost Access to High-Level Account

> ⚠️ For secure recovery procedures, refer to the **security best practices** documentation.

### ✅ Steps to Resolve (via CLI)
1. **Access Django Shell**
   ```bash
   python manage.py shell
   ```

2. **Reset Account Password**
   ```python
   from django.contrib.auth.models import User
   user = User.objects.get(username='target_username')
   user.set_password('new_secure_password')
   user.save()
   ```

---

## 🧹 8. Removing Spam Accounts or Inappropriate Content

### ✅ Steps to Resolve
1. **Identify Suspicious Accounts**
   Look for unusual upload patterns or irrelevant metadata.

2. **Batch Review in Interface**
   Use filters to locate problematic users or content, and take action.

3. **Implement Blocklists**
   Prevent repeated abuse by flagging IP addresses or email domains.
