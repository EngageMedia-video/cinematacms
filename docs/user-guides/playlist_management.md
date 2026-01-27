# 🎵 Playlist Creation and Management Guide

by [Khairunnisa Isma Hanifah](https://github.com/KhairunnisaIsma) - Updated for CinemataCMS 2.0

This document provides comprehensive instructions for creating and managing playlists in CinemataCMS, including the new Enhanced Playlist Access features for organizing video content into themed collections.

---

## 🆕 What's New in CinemataCMS 2.0

**Enhanced Playlist Access** introduces powerful new capabilities:

- **Trusted Users** can add unlisted and restricted videos to their playlists
- **All authenticated users** can see thumbnails of unlisted/restricted videos in any playlist  
- **Advanced privacy controls** while maintaining security
- **Improved content organization** for content creators

---

## 🎬 Creating a Playlist

Follow these steps after uploading your video:

### Step 1: Access the Video
- Log in to your CinemataCMS account  
- Click on the video you've uploaded to open its **Play Media** window

### Step 2: Save to Playlist
- Below the video player (bottom right corner), click the **Save** button  
- This opens the **Playlist pop-up window**

### Step 3: Create New Playlist
- In the pop-up, click **"Create New"** (top right corner)
- Fill in the playlist details:
  - **Title** – *Required.* Public name of your playlist
  - **Description** – *Optional.* Short description of the playlist's theme
- Click **Save** to confirm creation
- The current video is automatically added to the new playlist

---

## 📹 Video Privacy & Playlist Visibility

### Understanding Video States

| Video State | Description | Who Can See in Playlists |
|-------------|-------------|---------------------------|
| **🌍 Public** | Accessible to everyone | Everyone (including visitors) |
| **🔗 Unlisted** | Not listed publicly, requires direct link | Authenticated users only |
| **🔐 Restricted** | Requires password to play | Authenticated users only* |
| **🔒 Private** | Owner and administrators only | Never visible in playlists |

*Thumbnail visible, password required for playback

### What You Can Add Based on Your Role

#### 👤 Regular Users
- ✅ Can add **Public** videos to playlists
- ❌ Cannot add Unlisted or Restricted videos

#### ⭐ Trusted Users, Curators, Editors, Managers, Superusers
- ✅ Can add **Public** videos to any of their playlists
- ✅ Can add **Unlisted** videos to their own playlists  
- ✅ Can add **Restricted** videos to their own playlists
- ❌ Cannot add Private videos to playlists

> **💡 Tip:** To become a Trusted User, contact the curators at [curators@cinemata.org](mailto:curators@cinemata.org)

---

## ➕ Adding Videos to Existing Playlists

### For Each Additional Video:

1. **Navigate to the video's Play Media window**
2. **Click the "Save" button**
3. **Select existing playlist** from the dropdown list
4. **Confirm addition**

### Adding Different Video Types

#### Adding Public Videos (All Users)
- Any authenticated user can add public videos to their playlists
- No restrictions apply

#### Adding Unlisted/Restricted Videos (Advanced Users Only)
- Only Trusted Users and above can add these to their **own** playlists
- Videos maintain their privacy settings (password protection preserved)
- Provides better content organization for creators

---

## 👀 Viewing Playlists

### What You'll See Based on Your Status

#### 🚫 Anonymous Visitors
- Can only see **Public** videos in any playlist
- Must sign in to see unlisted/restricted content

#### 🔐 Authenticated Users  
- Can see **Public, Unlisted, and Restricted** video thumbnails
- Can view all playlists, but may need passwords for restricted content
- Cannot see Private videos

#### ⭐ Advanced Users (Own Playlists)
- Can see all videos they've added to their own playlists
- Have full control over playlist content and organization

---

## 🎛️ Managing Your Playlists

### Accessing Your Playlists
1. Navigate to **Account** → **Playlists**
2. View all playlists you've created
3. See playlist statistics and content

### Editing Playlist Content
1. **Click on a playlist** to open it
2. **View all contained videos**
3. **Reorder videos** by dragging items up or down
4. **Remove videos** if needed
5. **Edit playlist title and description**

### Playlist Organization Tips
- **Use descriptive titles** that indicate the playlist's theme
- **Group related content** (e.g., by topic, event, or series)
- **Consider your audience** when deciding video privacy levels
- **Leverage unlisted videos** for works-in-progress or limited distribution

---

## 🔐 Privacy & Security Features

### Playlist Visibility vs. Video Access
**Important:** Seeing a video thumbnail in a playlist ≠ being able to play it

- **Playlist visibility** shows what videos are in a collection
- **Video access** controls whether you can actually watch the content
- **Password protection** is maintained for restricted videos
- **Authentication requirements** are preserved for unlisted videos

### Best Practices for Content Creators

#### Using Restricted Videos in Playlists
- Add password-protected videos to playlists for better organization
- Viewers will see the video exists but need the password to watch
- Useful for premium content, works-in-progress, or sensitive material

#### Using Unlisted Videos in Playlists  
- Great for organizing content not meant for public discovery
- Viewers must be logged in to see these videos in playlists
- Perfect for member-only content or limited distribution

---

## 🎯 Use Cases & Examples

### For Individual Filmmakers
- **Public Portfolio**: Public videos showcasing your best work
- **Work in Progress**: Unlisted videos for feedback from specific collaborators  
- **Premium Content**: Restricted videos for paying supporters

### For Organizations
- **Public Campaigns**: Public videos for awareness and outreach
- **Member Resources**: Unlisted training or educational content
- **Confidential Materials**: Restricted videos for board members or staff

### For Festival Organizers
- **Public Highlights**: Showcase reels and promotional content
- **Participant Access**: Unlisted videos for festival participants
- **Judge Materials**: Restricted content for evaluation panels

---

## ❓ Frequently Asked Questions

### Q: I'm a regular user. Why can't I add an unlisted video to my playlist?
**A:** Only Trusted Users and above can add unlisted/restricted videos to playlists. Contact [curators@cinemata.org](mailto:curators@cinemata.org) to learn about becoming a Trusted User.

### Q: I can see a restricted video in a playlist but can't play it. Why?
**A:** The video requires a password for playback. Contact the video owner for access credentials.

### Q: Can I make my entire playlist private?
**A:** Playlists themselves follow standard privacy rules, but individual videos maintain their own privacy settings within the playlist.

### Q: Will adding a video to a playlist change its privacy settings?
**A:** No. Adding videos to playlists never changes their individual privacy settings. A restricted video remains restricted even when added to a playlist.

---

## 🆘 Need Help?

- **General Support**: Visit the [Cinemata Help Page](https://cinemata.org/help)
- **Trusted User Applications**: Email [curators@cinemata.org](mailto:curators@cinemata.org)  
- **Technical Issues**: Consult the [Troubleshooting Guide](../admin-guides/troubleshooting_guide.md)

---

*This guide reflects CinemataCMS 2.0 Enhanced Playlist Access features. For technical implementation details, see the API documentation.*