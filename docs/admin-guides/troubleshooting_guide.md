# 🧰 CinemataCMS Troubleshooting Guide for Common Administrative Issues

This guide helps **authorized users** (including *Site Administrators* and *MediaCMS Managers*) diagnose and resolve common issues when managing users, roles, content, and media systems in **CinemataCMS**.

> 📍 Administrative access is available via **Django Admin** (`/admin/`) and the CinemataCMS sidebar (e.g., “Manage Media”, “Manage Users”, “Manage Comments”).

---

## 🧑‍💻 1. User Cannot Access Expected Features

### 🔍 Problem
- User cannot see sidebar options like “Manage Media” or “Manage Users”
- Error: “Permission Denied”

### ✅ Steps to Resolve
1. **Check User Role**  
   Go to Django Admin: `/admin/users/user/` → Ensure the user has the appropriate role(s).

2. **Verify Role Permissions**  
   Roles must include permissions such as `read:content`, `edit:content`, etc.  
   Check in `/admin/auth/group/`.

3. **Check Group Assignment**  
   Ensure the user is assigned to the correct group (see `users/models.py`).

4. **Reproduce the Issue**  
   Temporarily assign the same role to your admin account and try accessing the feature.

---

## 🔐 2. Cannot Edit or Remove Certain Content

### 🔍 Problem
- Content is visible but cannot be edited or deleted  
- Error: “You do not have permission to perform this action”

### ✅ Steps to Resolve
1. **Validate Role Permissions**  
   Make sure the user has `edit:content`, `delete:content`, or `edit:own`.

2. **Content Ownership Limitations**  
   With `edit:own`, users can only edit their own uploads.

3. **Check Object-Level Constraints**  
   If object-level permissions are enabled, inspect the relevant entries in the database via Django Admin or shell.

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
- Uploaded video does not appear on the frontend

### ✅ Steps to Resolve
1. **Check Video Visibility Status**  
   See if the media is set to `private` or `unlisted` at `/admin/files/mediafile/`.

2. **Review Uploader Type**  
   - Regular users: Default to `private` uploads, may require approval  
   - Trusted users: Can set public visibility on upload

3. **Check Notification System**  
   Confirm that email notifications are configured and working (`cms/settings.py`)

4. **Check Moderation Queue**  
   Go to “Manage Media” from the sidebar and verify pending items.

---

## 👥 5. Unable to Update User Group Assignments

### 🔍 Problem
- Cannot assign or remove users from groups

### ✅ Steps to Resolve
1. **Ensure `manage:users` Permission**  
   The admin role must allow user management in Django Admin.

2. **Use Proper Workflow**  
   Navigate to `/admin/users/user/` → Select user → Adjust group assignments.

3. **Check Group Definitions**  
   Groups should be correctly defined and include valid permissions.

---

## ⚙️ 6. Media Processing Issues

### 🔍 Problem
- Encoding stuck in “Running”
- Missing thumbnails or HLS streams
- Failed transcriptions

### ✅ Steps to Resolve
1. **Check Celery Workers**  
   ```bash
   celery -A cms inspect active
   ```

2. **Check Transcoding or Whisper Logs**  
   Currently only runnable via Bash:
   ```bash
   python manage.py process_tasks
   ```

3. **Inspect Encoding Status in Django Admin**  
   Visit `/admin/files/encoding/` and review stuck or failed jobs.

> ⚠️ Currently, these actions can only be triggered via Bash. Adding Django Admin support is a recommended future improvement.

---

## 📁 7. File Upload Issues

### 🔍 Problem
- Chunked uploads fail
- File size exceeds limits
- Upload permission denied

### ✅ Steps to Resolve
1. **Inspect FineUploader Logs**  
   Use browser developer tools → Check if all chunks were sent successfully.

2. **Check Upload Size Settings**  
   Configured via `MAX_UPLOAD_SIZE` in `cms/settings.py`.

3. **Verify Upload Permissions**  
   Review `CAN_ADD_MEDIA` and ensure the user's role allows uploads.

> Debugging upload issues is currently possible only via Bash or server logs.

---

## 🛡️ 8. Multi-Factor Authentication (MFA) Issues

### 🔍 Problem
- User cannot log in after enabling MFA

### ✅ Steps to Resolve
- Refer users to the official MFA setup guide:  
  📄 `docs/guides/mfa_setup.md`
  ---

## 💾 9. Errors During Backup or Restore

### 🔍 Problem
- Backup incomplete  
- Restore process fails

### ✅ Steps to Resolve
1. **Check Disk Space**  
   Run `df -h` to ensure sufficient space.

2. **Use Django Commands**  
   ```bash
   python manage.py dumpdata > backup.json
   python manage.py loaddata backup.json
   ```

3. **Apply Migrations if Needed**  
   ```bash
   python manage.py migrate
   ```

---

## 🔒 10. Lost Access to High-Level Account

### 🔍 Problem
- A user with elevated privileges (e.g., site administrator) is locked out and cannot log in  
- No other high-level users are available to restore access

### ✅ Steps to Resolve
1. **Access the Django Shell**
   ```bash
   python manage.py shell
   ```

2. **Reset the Password**
   Replace `'target_username'` and `'new_secure_password'` with actual values:
   ```python
   from users.models import User
   user = User.objects.get(username='target_username')
   user.set_password('new_secure_password')
   user.save()
   ```

3. **Re-enable User if Deactivated**
   ```python
   user.is_active = True
   user.save()
   ```

4. **Assign Admin Permissions (if removed)**
   ```python
   user.is_superuser = True
   user.is_staff = True
   user.save()
   ```

> 🔐 For long-term recovery and prevention, see the **Security Best Practices** documentation.

---

## 🧹 11. Removing Spam Accounts or Inappropriate Content

### 🔍 Problem
- Suspicious user accounts are repeatedly uploading spam or irrelevant media  
- Inappropriate content is visible before moderation  
- Blocked accounts return using different credentials or IP addresses

### ✅ Steps to Resolve
1. **Identify Suspicious Accounts**
   - Look for users with unusually high upload frequency
   - Review account metadata such as usernames, email domains, and IP addresses

2. **Batch Review in Admin Interface**
   - Go to Django Admin:  
     `/admin/users/user/` for user accounts  
     `/admin/files/file/` for media  
   - Use filters to locate and deactivate/delete accounts or media

3. **Implement Blocklists**
   - Prevent recurring abuse by flagging known IP addresses or email domains
   - Add them to your reverse proxy or firewall blocklists if needed

4. **Enable Pre-Moderation**
   - Ensure uploads from untrusted users are not publicly visible by default
   - Configure `CAN_ADD_MEDIA` settings to restrict auto-publishing

---

## 📹 12. Video Encoding Stuck in a Loop

### 🔍 Problem
- A video, especially 4K content, is stuck in the "encoding" state.
- The encoding process appears to run indefinitely without completing.
- Progress tracking does not update.

### ✅ Steps to Resolve
1.  **Update CinemataCMS**: This issue is caused by a bug in the progress tracking logic that has been fixed in a recent version. Ensure your instance is up to date.
2.  **Monitor Logs**: The fix includes improved logging. Check the Celery worker logs for messages related to "Processing iteration" or "Encoding iteration limit exceeded" to diagnose if the issue persists.
3.  **Manual Intervention (if update is not possible)**: If you cannot update immediately, you may need to manually mark the encoding as successful or failed in the Django Admin interface at `/admin/files/encoding/`. This is a temporary workaround.

# 📹 13. 4K Video Encodes Successfully, But 4K Playback Option Is Missing

### 🔍 Problem
- The video encoding completes without errors, but the player does not offer 4K resolution as a selectable quality.

### ✅ Steps to Resolve
1.  Verify that 4K (2160p) encoding profiles are enabled and active in the database or Django Admin.
2.  Refresh the video page after encoding completes to see the new 4K quality option in the player.
