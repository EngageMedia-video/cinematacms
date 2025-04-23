# Cinemata Post-Installation Guide

After installing CinemataCMS, you need to take a few additional steps to make content appear on the homepage. This guide will walk you through the process of setting up your site correctly.

## Step 1: Understand Why the Homepage Is Empty

A fresh CinemataCMS installation has an empty homepage because:

1. The homepage depends on featured content which doesn't exist yet
2. Videos need to be fully encoded before they appear in listings

## Step 2: Upload Initial Content

1. Log in as the admin user created during installation
2. Navigate to upload on the topbar or sidebar to add videos
3. Upload at least 4 videos
4. Wait for encoding to complete (check status in Manage Media on the sidebar)

## Step 3: Set Featured Content

1. Go to Manage Media
2. Select a video you want to feature
3. Check the "Featured" checkbox
4. Click "Save"
5. Repeat for other videos you want to feature
   
## Troubleshooting

### No Videos Appear After Upload

Check the encoding status:
1. Go to `/admin` > "Files" > "Media"
2. Check the "encoding_status" field - it should be "success"
3. If it's "pending" or "fail", check logs at `/home/cinemata/cinematacms/logs/`

### Featured Videos Not Showing

1. Ensure videos have "state" set to "public" and "is_reviewed" checked
2. Verify that `IndexPageFeatured` entries point to valid API endpoints
3. Check browser console for any JavaScript errors

### Encoding Fails

1. Check if FFMPEG is installed correctly
2. Verify the video format is supported
3. Check the logs for specific error messages

