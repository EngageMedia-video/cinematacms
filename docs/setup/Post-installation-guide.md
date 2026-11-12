# Cinemata Post-Installation Guide

After installing CinemataCMS, you need to take a few additional steps to make content appear on the homepage. This guide will walk you through the process of setting up your site correctly.

## Step 1: Understand Why the Homepage Is Empty

A fresh CinemataCMS installation has an empty homepage because:
1. No featured content assigned yet
2. The homepage depends on featured content which doesn't exist yet
3. Videos need to be fully encoded before they appear in listings
Until these steps are done, the homepage will not display any content.

## Step 2: Upload Initial Content

1. Log in as the admin user created during installation
2. Navigate to upload on the topbar or sidebar to add videos
3. Upload at least 4 videos (minimum recommended for homepage population).
4. Wait for encoding to complete (check status in Manage Media on the sidebar)

## Step 3: Set Featured Content

1. Go to Manage Media
2. Select a video you want to feature
3. Check the "Featured" checkbox
4. Click "Save"
5. Repeat for other videos you want to feature

## Step 4: Verify Video Visibility Settings

For a video to appear publicly:
1. Ensure the state is set to public
2. Ensure the video is reviewed (is_reviewed = true)
These settings are required even for featured videos.

## Step 5: Check the Sitemap and Crawler Rules

`/robots.txt` points crawlers at the sitemap index, `/sitemap.xml`. The index
links one sitemap for each kind of page:

- `/sitemap-media.xml` lists the films that are public, reviewed, and encoded
  successfully.
- `/sitemap-playlists.xml` lists the playlists that hold at least one of those
  films.
- `/sitemap-categories.xml` lists the categories that hold at least one of those
  films.
- `/sitemap-pages.xml` lists every page created under `/admin` > "Files" >
  "Pages", such as an About page. A page has no draft state, so delete test and
  outdated pages.
- `/sitemap-static.xml` lists the home page, `/contact`, `/tos`,
  `/creative-commons`, and the hub pages `/categories`, `/topics`, `/countries`,
  and `/languages`.

Private, unlisted, and restricted films never appear. Search-result pages tell
crawlers not to index them. A category page, `/search?c=<category>`, names its
canonical URL and stays indexable.

The sitemap and `/robots.txt` build absolute URLs from the domain of the Django
Site that `SITE_ID` selects and the scheme of `FRONTEND_HOST`. The scheme comes
from `FRONTEND_HOST` because a proxy that terminates TLS can forward requests
over plain HTTP. `install.sh` sets the domain to the portal hostname. If
`/sitemap.xml` lists `example.com` or another host, set the domain:

```bash
python manage.py update_site_name --domain <portal-hostname>
```

`/robots.txt` also states the crawler rules of the "Cinemata and AI Crawlers"
policy:

- Video and subtitle files are closed to every crawler: `/media/original/user/`,
  `/media/original/subtitles/`, `/media/encoded/`, `/media/hls/`, and the legacy
  `/media/videos/` and `/media/other_media/`. Posters and thumbnails stay open.
- AI training crawlers are blocked from the whole site. `AI_TRAINING_CRAWLERS`
  in `cms/robots.py` holds the list. It matches the training crawlers that
  Cloudflare's managed `robots.txt` blocks.
- The line `Content-Signal: search=yes, ai-input=yes, ai-train=no`, with the
  Content Signals Policy text above it, states that pages may be used for search
  and AI answers but not for AI training.

`robots.txt` is a request that a crawler can ignore. Rate limits, and blocks for
crawlers that ignore the file, belong in the CDN. If Cloudflare's managed
`robots.txt` is turned on, Cloudflare prepends its own rules to this file.
Crawlers combine the two `User-agent: *` groups into one.

## Troubleshooting

### No Videos Appear After Upload

Check the encoding status:
1. Go to `/admin` > "Files" > "Media"
2. Check the "encoding_status" field - it should be "success"
3. If it's "pending" or "fail", check logs at `/home/cinemata/cinematacms/logs/`

### Featured Videos Not Showing

1. Ensure videos have "state" set to "public" and "is_reviewed" checked
2. Verify that `IndexPageFeatured` entries point to valid API endpoints
3. Check browser console(F12) for any JavaScript errors

### Encoding Fails

1. Check if FFMPEG is installed correctly
2. Verify the video format is supported
3. Check the logs at `/home/cinemata/cinematacms/logs/` for specific error messages

### Final Checklist
 1. Admin account is active and has access to upload/manage content
 2. Minimum 4 videos uploaded and fully encoded
 3. At least one video marked as featured, reviewed, and public
 4. No critical errors in encoding logs
 5. Homepage loads correctly with featured content visible
 6. `/sitemap.xml` lists sitemap URLs on the portal hostname and scheme
