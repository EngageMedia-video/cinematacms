# 🧹 CinemataCMS Content Moderation Workflow

CinemataCMS supports a rigorous but flexible moderation process to ensure that user-contributed content aligns with the platform’s mission: promoting independent and socially relevant films from the Asia-Pacific region.

This document outlines the moderation steps, roles involved, notification logic, tooling, and escalation procedures.

---

## 🎬 1. Video Submissions

Cinemata accepts uploads from a variety of contributors:

| Contributor Type        | Example Use Case                                                                 |
|--------------------------|----------------------------------------------------------------------------------|
| **Individual Filmmakers** | Publishing or archiving films publicly or privately.                            |
| **Advocacy Groups / Collectives** | Distributing campaign media or educational films.                            |
| **Festival Organizers** | Bulk uploads of curated content for time-bound showcases or playlists.           |
| **Spam / Abusive Users** | Uploading ads, infringing material, or unrelated content (requires flagging).   |

Uploads are handled based on the user’s trust level.

---

## 🔐 2. Access Level Assignment

| User Type       | Upload Visibility       | Notes                                                                 |
|------------------|--------------------------|-----------------------------------------------------------------------|
| **Trusted User** | Can choose visibility (`public`, `unlisted`, `private`, `password-protected`) | Bypasses preliminary moderation but still subject to review post-publish. |
| **Regular User** | Uploads default to `private` | Requires curator review before any public exposure.                         |

---

## 📣 3. Notification System

Upon upload:

- An **automated email notification** is sent to the Cinemata **Curatorial Team**.
- Notifications include: uploader identity, title, visibility, and a link to the review queue.

Optional integrations (e.g., Slack, Mattermost) can supplement this via webhook alerts.

---

## 🧐 4. Content Review Process

### Step-by-step:

1. **Access the Moderation Queue**
   - Located in the Admin UI under `Content > Pending Review`
   - Or via direct moderation dashboard for curators.

2. **Evaluate Content Based on**:
   - Cinemata’s [Editorial Policy](#)
   - Relevance to regional and thematic focus
   - Copyright compliance
   - Production quality (basic minimum)

3. **Flag or Delete** if:
   - Content is irrelevant (e.g., generic vlog, commercial ad)
   - Obvious copyright violation
   - Spam, offensive, or AI-generated junk

4. **Escalate** complex cases to:
   - **Content Lead** for editorial disputes
   - **Technical Maintainers** if related to abusive automation

5. **Optional Notes**:
   - Curators can leave moderation comments stored as metadata for internal review history.

---

## ✅ 5. Approval & Publishing

Approved content is:

- **Made Public**: Visibility changed to `public`, or as specified by uploader.
- **Featured** (optional): Exceptional submissions may be selected for front-page curation.
- **Organized**: Into relevant categories, playlists, or events.

### Featured Content
- Updated **twice weekly**.
- Selected by the **curatorial team** based on timeliness, theme relevance, and impact.

---

## 🛠️ Moderation Tools

| Tool / Interface        | Description                                                                   |
|--------------------------|-------------------------------------------------------------------------------|
| **Moderation Queue**     | Interface to review unapproved or flagged content.                           |
| **Flagging System**      | Users can flag videos for curator review.                                    |
| **Role-Based Dashboards**| Custom UI views for Curators, Managers, and Contributors.                    |
| **Bulk Moderation**      | Available to Trusted Users, Editors, and above (with rate limits).           |
| **Metadata Inspector**   | View internal notes, flags, and trust scores for uploads and users.          |

---

## 🔐 Escalation & Enforcement

| Violation Type              | Action                                                                 |
|------------------------------|------------------------------------------------------------------------|
| Minor content mismatch       | Video deleted, user warned.                                            |
| Spam or irrelevant content   | Immediate removal, user blocked.                                       |
| Repeated violations          | Account deactivation, reported to system maintainers.                  |
| Copyright Infringement       | Takedown + optional external notice (depending on local law).          |

---
