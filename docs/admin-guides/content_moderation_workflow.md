# 🧹 CinemataCMS Content Moderation Workflow

by [Khairunnisa Isma Hanifah](https://github.com/KhairunnisaIsma)

CinemataCMS supports a structured yet flexible moderation process to ensure user-submitted media aligns with the platform’s mission: promoting independent, socially relevant films from the Asia-Pacific region.

This guide provides an overview of the contributors, user roles, media visibility, and moderation responsibilities in the system.

---

## 🎬 1. Video Submissions

Cinemata accepts uploads from a variety of contributors:

| Contributor Type        | Example Use Case                                                                 |
|--------------------------|----------------------------------------------------------------------------------|
| **Individual Filmmakers** | Publishing or archiving films publicly or privately.                            |
| **Advocacy Groups** | Distributing campaign or educational media.                            |
| **Festival Organizers** | Bulk uploading curated content for events or time-bound screenings.           |
| **Spam / Abusive Users** | Uploading ads, infringing content, or irrelevant media. Can be reported.   |

Uploads are moderated based on the user’s role and trust level.

---

## 🔐 2. User Roles & Upload Visibility

### Visibility States

CinemataCMS supports multiple media visibility states:

- `public`
- `private`
- `unlisted`
- `restricted`

> ✅ Confirmed in `cms/settings.py` and frontend (ViewerInfoTitleBanner.js)

### Default Upload Logic

| User Role       | Default Upload Visibility   | Notes                                                                 |
|------------------|-----------------------------|-----------------------------------------------------------------------|
| **Trusted User** | User-defined (`public`, `private`, and `restricted` ) | Bypasses preliminary moderation; still subject to post-publish review |
| **Regular User** | `private`                   | Requires curator review before any public exposure                    |

> 🔎 **Trusted User** is a privilege granted by site admins.  
> See: [https://cinemata.org/cinemata-trusted-user](https://cinemata.org/cinemata-trusted-user)

**Technical References**:
- Upload logic: `uploader/`
- Roles/permissions: `users/models.py`
- Setting: `PORTAL_WORKFLOW` in `cms/settings.py`, line 188


---

## 📣 3. Notification System

When a video is uploaded:

- An **automated email** is sent to the **Curatorial Team**.
- Email includes:
  - Uploader name
  - Media title
  - Visibility level
  - Link to the review queue

> ✅ Notification triggers confirmed in backend logic  
> 🔄 Optional: Slack/Mattermost alerts via webhooks.

---

## 🧐 4. Content Review Process

### ✔️ MEDIA_IS_REVIEWED Setting
Defined in cms/settings.py, line 180:

```python
MEDIA_IS_REVIEWED = True  
```

This setting activates moderation workflows.

### Who can Review

| Permission | Public Visitor | Registered User | Trusted User | Curator | Editor | Manager | Admin |
|:-----------|:---------------|:----------------|:-------------|:-------|:-------|:--------|:------|
| Access content review dashboard | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Review and approve submitted content | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Handle reported content | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Set content visibility status | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |
| Access moderation logs | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ |

> See: [Cinemata User Roles Permission Matrix](https://github.com/EngageMedia-video/cinematacms/blob/main/docs/cinematacms-roles-permission-matrix.md))

### How to Review

1. **Access the Moderation Queue through the Media **
   - Location: Index Page Sidebar → `Manage Media Dashboard`
   - Endpoint: `manage/media`

2. **Evaluate Based On**:
   - Editorial Policy
   - Regional/thematic relevance
   - Copyright
   - Basic quality standards

3. **Take Action**:
   - **Report** (UI label: “Report”, not “Flag”)
   - **Delete** (irrelevant/spam)
   - **Add Notes** (stored as metadata)

4. **Escalation**
   - **Content Lead** for editorial judgment
   - **Technical Maintainers** for abuse or automation-related cases

---

## ✅ 5. Approval & Publishing

Once approved, content is:

- Made **public** (or as uploader specified)
- Optionally **featured** on homepage
- Organized into playlists, events, or categories

### Featured Content

- Updated **twice weekly**
- Chosen based on:
  - Timeliness
  - Regional/theme relevance
  - Community impact

---

## 🛠️ 6. Moderation Tools

| Tool / Interface        | Functionality                                                                   |
|--------------------------|-------------------------------------------------------------------------------|
| **Manage Media**      | Review interface for pending/reported uploads                            |
| **Report System**         | Users report content via **Report** button                               |
| **Role-Based Dashboards** | UIs vary based on user roles (Curator, Contributor, etc.)                |
| **Bulk Moderation**       | Available to Editors and Trusted Users (with limits)                     |
| **Metadata Inspector**    | View notes, flags, and trust scores for each submission                  |

---

## 🔐 7. Escalation & Enforcement

| Violation Type              | Action Taken                                                                 |
|------------------------------|------------------------------------------------------------------------|
| Minor content mismatch       | Video removed, user warned.                                            |
| Spam or irrelevant content   | Immediate removal, user blocked.                                       |
| Repeated violations          | Account deactivated, escalated to maintainers s.                  |
| Copyright Infringement       | Content removed; takedown notification (may involve legal action).          |

---
## 🧪 8. Developer Notes

| Component           | Details                                                                 |
|---------------------|-------------------------------------------------------------------------|
| `MEDIA_IS_REVIEWED` | Defined in `cms/settings.py`, line 180                                  |
| Upload Defaults     | Logic handled in `uploader/`                                            |
| Roles/Permissions   | Defined in `users/models.py`                                            |
| Review Queue UI     | Backend handled via `files/views.py`                                   |
| Report Integration  | Ensure UI “Report” → connects to moderator queue backend logic          |

---
