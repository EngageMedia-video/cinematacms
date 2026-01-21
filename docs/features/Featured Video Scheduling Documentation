# Featured Video Scheduling System

The Featured Video Scheduling system allows administrators and editors to highlight videos on the CinemataCMS platform. This feature supports both manual featuring (immediate) and scheduled featuring (future date/time) with automatic synchronization and smart ordering.

## Key Capabilities

- ✅ Manually feature videos immediately via Django Admin or Edit Media page
- ✅ Schedule videos to be featured at a specific date and time
- ✅ Automatic synchronization between scheduled and manual featuring
- ✅ Chronological ordering by when videos were featured
- ✅ Respect scheduling in all featured listings (hero, sidebar, Featured by Curators)

---

## User Guide

### For Admins, Managers, and Editors

#### Manual Featuring (Immediate)

##### Option 1: Django Admin

1. Navigate to Admin → Files → Media
2. Find and click the video you want to feature
3. Check the "Featured" checkbox
4. Click "Save"

The video immediately appears in featured listings, and the system automatically sets the Featured Date to the current timestamp.

##### Option 2: Edit Media Page (Frontend)

1. Navigate to the video's edit page on the frontend
2. Check the "Featured" checkbox
3. Save the media

**Result:** The video appears immediately in:
- Hero section (if it's the most recently featured)
- Featured sidebar
- "Featured by Curators" page

#### Scheduled Featuring (Future Date)

1. Navigate to Admin → Files → Featured Videos
2. Click "Add Featured Video"
3. Select the Media you want to schedule
4. Set the Start Date (when the video should become featured)
5. Ensure "Is Active" is checked
6. Click "Save"

**Result:**
- The video remains hidden from all featured listings until the Start Date
- At the scheduled time, it automatically appears in featured listings
- The system sets `Media.featured = True` and `Media.featured_date = Start Date`

> **Note:** Future-scheduled videos will NOT appear in listings until their start date/time arrives.

#### Removing from Featured

To remove a video from featured listings:

1. Navigate to Admin → Files → Media
2. Find the video
3. Uncheck the "Featured" checkbox
4. Click "Save"

**Important:** Unchecking "Featured" removes the video from all featured listings but preserves the `featured_date` field for historical records.

#### Managing Scheduled Features

To disable a schedule without deleting it:

1. Navigate to Admin → Files → Featured Videos
2. Find the scheduled entry
3. Uncheck "Is Active"
4. Click "Save"

**Note:** Disabling a schedule does NOT automatically remove the video from featured listings. To remove it, uncheck "Featured" on the Media page.

---

## Technical Details

### Database Schema

#### New Field: `Media.featured_date`

```python
featured_date = models.DateTimeField(
    null=True,
    blank=True,
    db_index=True,
    help_text="Date when this video was featured (auto-set by scheduling system)"
)
```

**Properties:**
- **Nullable:** Videos without a `featured_date` are treated as oldest in ordering
- **Indexed:** Optimized for queries ordering by `featured_date`
- **Auto-set:** Automatically populated by signals when featured or scheduled

### Signal Handlers

#### 1. `track_featured_change` (Pre-save)

**Location:** `files/models.py` (line 2245)

Detects when the `featured` field changes on a Media instance and stores the previous value.

#### 2. `record_featured_from_frontend` (Post-save)

**Location:** `files/models.py` (line 2259)

When `featured` is set to `True` via frontend/admin:

- Creates a FeaturedVideo entry with `start_date = now()`
- Sets `Media.featured_date = now()` immediately (in-memory and DB)
- Ensures the featured date displays in Django Admin without page refresh

#### 3. `sync_media_featured_fields` (Post-save on FeaturedVideo)

**Location:** `files/models.py` (line 2282)

When a FeaturedVideo becomes active:

- Sets `Media.featured = True`
- Sets `Media.featured_date = FeaturedVideo.start_date`
- Invalidates the media list cache

### Ordering Logic

Featured videos are ordered by:

1. **Primary:** `featured_date` (descending, newest first)
2. **NULL handling:** NULL values sort last (treated as oldest)
3. **Fallback:** `add_date` (descending) for videos with the same `featured_date`

**Example ordering:**

```
1. Video A (featured_date: 2026-01-21 10:00) ← Newest
2. Video B (featured_date: 2026-01-20 15:30)
3. Video C (featured_date: 2026-01-15 09:00)
4. Video D (featured_date: NULL) ← Oldest
```

### Scheduling Filter

**Location:** `files/views.py` (lines 1001-1005)

Featured listings query includes a filter to respect scheduling:

```python
has_future_schedule = FeaturedVideo.objects.filter(
    media=OuterRef('pk'),
    is_active=True,
    start_date__gt=now
)
# Applied with .exclude(Exists(has_future_schedule))
```

**Behavior:**

- Videos with future-scheduled FeaturedVideo entries are hidden until `start_date <= now()`
- Manually featured videos (no FeaturedVideo record) always appear
- Ensures consistent scheduling respect across hero, sidebar, and listing pages

### API Response

The `featured_date` field is exposed in the Media API serializer as a read-only field.

**Example API response:**

```json
{
  "id": 123,
  "title": "Example Video",
  "featured": true,
  "featured_date": "2026-01-21T10:00:00Z",
  "add_date": "2026-01-10T08:30:00Z"
}
```

---

## Behavior Reference

### Scenario 1: Manual Featuring

**Action:** Admin checks "Featured" on Media page

**System Response:**
- ✅ `Media.featured = True`
- ✅ `Media.featured_date = now()`
- ✅ Video appears immediately in all featured listings
- ✅ FeaturedVideo entry created with `start_date = now()`

### Scenario 2: Schedule Future Video

**Action:** Admin creates FeaturedVideo with `start_date = tomorrow 10 AM`

**System Response:**
- ✅ `Media.featured = True` (in database)
- ✅ `Media.featured_date = tomorrow 10 AM`
- ⏸️ Video is hidden from featured listings until tomorrow 10 AM
- ✅ At tomorrow 10 AM, video automatically appears in listings

### Scenario 3: Unfeature a Video

**Action:** Admin unchecks "Featured" on Media page

**System Response:**
- ✅ `Media.featured = False`
- ✅ `Media.featured_date` preserved (not deleted)
- ✅ Video removed from all featured listings
- ℹ️ Historical record of when it was featured is retained

### Scenario 4: Disable Schedule

**Action:** Admin unchecks "Is Active" on FeaturedVideo

**System Response:**
- ⏸️ Schedule is disabled
- ⚠️ Video remains in featured listings (`Media.featured` is still `True`)
- ℹ️ To remove from listings, must also uncheck "Featured" on Media page

---

## Admin Interface

### Media Admin Changes

**New Display Column:** `featured_date`

Located in the Media list view in Django Admin, allowing admins to see when each video was featured at a glance.

### Field Help Text

#### `Media.featured`

> Videos to be featured on the homepage. Unchecking this removes the video from featured listings while preserving the featured_date for historical records.

#### `Media.featured_date`

> Date when this video was featured (auto-set by scheduling system)

#### `FeaturedVideo.is_active`

> Uncheck to disable this schedule without deleting it. To remove a video from featured listings, uncheck 'Featured' on the Media page.

---

## Troubleshooting

### Issue: Featured date shows empty in Django Admin after saving

**Cause:** The `featured_date` is set in the database but the in-memory admin form instance wasn't refreshed.

**Solution (Fixed in PR #391):**
The signal now updates both the in-memory instance and the database, so the Featured Date displays immediately without needing a page refresh.

---

### Issue: Newly featured videos appear as "oldest" in listings

**Cause:** Videos have NULL `featured_date` values.

**Solution (Fixed in PR #391):**
The system now auto-sets `featured_date = now()` when videos are manually featured. NULL values are sorted last intentionally (treated as oldest).

---

### Issue: Scheduled video appears immediately instead of at scheduled time

**Cause:** The scheduling filter wasn't applied to featured listings.

**Solution (Fixed in PR #391):**
Featured queries now exclude videos with future-scheduled start dates. Videos only appear after `FeaturedVideo.start_date <= now()`.

---

### Issue: How to backfill featured_date for old videos?

**Solution:**

Run a data migration or manual script to set `featured_date` for existing featured videos:

```python
from django.utils import timezone
from files.models import Media, FeaturedVideo

# Option 1: Set to the earliest FeaturedVideo start_date
for media in Media.objects.filter(featured=True, featured_date__isnull=True):
    fv = media.featuredvideo_set.order_by('start_date').first()
    if fv:
        media.featured_date = fv.start_date
        media.save()

# Option 2: Set to add_date (when video was uploaded)
for media in Media.objects.filter(featured=True, featured_date__isnull=True):
    media.featured_date = media.add_date
    media.save()
```

---

## Migration

### Migration File: `files/migrations/0013_add_featured_date_field.py`

This migration:

- ✅ Adds `Media.featured_date` field (nullable, indexed)
- ✅ Updates help text for `Media.featured` and `FeaturedVideo.is_active`
- ✅ Safe to run on production (non-destructive, backward compatible)

### To Apply:

```bash
python manage.py migrate files
```

---

## Best Practices

### For Administrators

- **Use scheduling for time-sensitive campaigns:** Schedule videos to go live at specific times (e.g., event announcements, releases)
- **Manually feature for immediate visibility:** Check "Featured" checkbox for urgent or evergreen content
- **Review featured_date for chronological accuracy:** Ensure videos appear in the correct order by checking their featured_date values
- **Preserve historical data:** Don't delete featured_date values—they provide valuable historical context

### For Developers

- **Always use `.order_by(F('featured_date').desc(nulls_last=True))`** when querying featured videos
- **Apply the scheduling filter** to ensure future-scheduled videos don't appear prematurely
- **Don't manually modify featured_date**—let signals handle synchronization
- **Cache featured queries** but invalidate on Media/FeaturedVideo changes
- **Test scheduling edge cases:** midnight rollovers, timezone changes, overlapping schedules

---

## Related Issues & PRs

- **Issue #387:** Featured video scheduling and ordering improvements
- **PR #391:** Implementation of featured_date field and scheduling logic

---

## Support & Questions

For questions or issues with the featured video system, please:

1. Check this documentation
2. Review the Troubleshooting section
3. Open an issue on the GitHub repository with the `featured-videos` label

---

**Last Updated:** January 2026  
**Feature Version:** 1.0 (PR #391)
