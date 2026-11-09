# Feature Flags

CinemataCMS uses [django-waffle](https://waffle.readthedocs.io/) to manage feature flags. Flags are stored as **Switches** (simple on/off booleans) in the database and can be toggled via the Django admin panel without redeploying.

## Managing Flags

1. Log in to Django admin at `/admin/`
2. Navigate to **Waffle** > **Switches**
3. Toggle any switch on or off
4. Changes take effect immediately (subject to cache TTL)


## Available Switches

| Switch name | Default | Description |
|---|---|---|
| `load_from_cdn` | Off | Fetch external content (CSS/JS) from CDNs instead of serving locally |
| `login_allowed` | On | Show the login button on the site |
| `register_allowed` | On | Show the registration button on the site |
| `upload_media_allowed` | On | Show the upload media button on the site |
| `can_like_media` | On | Show the like button on media pages |
| `can_dislike_media` | On | Show the dislike button on media pages |
| `can_report_media` | On | Show the report button on media pages |
| `can_share_media` | On | Show the share button on media pages |
| `allow_ratings` | Off | Enable the experimental user ratings feature |
| `allow_ratings_confirmed_email_only` | Off | Restrict ratings to users with verified emails |
| `video_player_featured_video_on_index_page` | Off | Show a featured video enlarged with a player on the index page |

## How It Works

Switches are checked at runtime via `waffle.switch_is_active("switch_name")`. The result is a boolean (`True`/`False`).

Most switches are read in `files/context_processors.py` and exposed to templates as context variables (e.g., `CAN_LIKE_MEDIA`, `CAN_LOGIN`). The `allow_ratings` switch is also checked directly in `files/models.py` (the `Media.ratings_info` property).

### Fallback Behavior

If the waffle database tables do not exist yet (e.g., code is deployed before migrations have run), all switch lookups fall back to the deprecated settings values in `cms/settings.py`. This prevents 500 errors during the deployment window between code deploy and migration.

### Auto-Creation of Missing Switches

The setting `WAFFLE_CREATE_MISSING_SWITCHES = True` is enabled. If code checks a switch that does not exist in the database, waffle automatically creates it with `active=False`. This means new switches can be added in code without requiring a migration — they will appear in the admin panel on first check.

## Adding a New Switch

1. Use `waffle.switch_is_active("your_switch_name")` in your code
2. Wrap the call in the `_switch()` helper (defined in `files/context_processors.py`) if you need a settings-based fallback:
   ```python
   ret["YOUR_FLAG"] = _switch("your_switch_name", "YOUR_SETTINGS_FALLBACK")
   ```
3. The switch will auto-create as inactive on first request
4. Optionally, add it to the `seed_waffle_switches` management command with a specific default value and description

## Roll out a migrated page

A page moving to the v2 shell uses a waffle **flag**, because a flag can target
staff, groups, users, or a percentage of visitors. Switches only turn on or off
for everyone.

1. Add the page to `PAGES_IN_ROLLOUT` in `cms/ui_variant.py` with its old and
   new templates.
2. Render the page with `resolve_template(request, "<page_key>")`. The page
   follows the flag `ui_v2_<page_key>`.
3. Deploy. The page's first request creates the flag, and visitors keep v1.
   Superusers see v2 straight away, because a flag's **Superusers** option
   starts on. Clear it to keep them on v1.
4. In Django admin, open the flag and leave **Everyone** on **Unknown** while
   you target. Set **Staff** to preview v2 as staff, then widen with groups,
   users, or a percentage. Saving the flag takes effect without a redeploy.
5. To finish, set **Everyone** to **Yes**. To roll back, set it to **No**.
6. Once v2 is permanent, move the page to `UI_VARIANT_PAGES` and delete its v1
   template. Delete the flag only after that release is live. A missing flag
   reads as off, so deleting it first returns every visitor to v1.

Target groups or users on a page that requires sign-in. A percentage assigns
each browser by cookie, so one person can get different shells on two devices.
Lowering a percentage does not move browsers already on v2.

Do not use the flag's **Testing** option as a staff preview. It lets any visitor
turn the flag on with `?dwft_<flag>=1`.

## Configuration

All waffle-related Django settings are in `cms/settings.py`:

```python
INSTALLED_APPS = [
    ...
    "waffle",
]

MIDDLEWARE = [
    ...
    "waffle.middleware.WaffleMiddleware",
]

WAFFLE_CREATE_MISSING_SWITCHES = True
WAFFLE_CREATE_MISSING_FLAGS = True
WAFFLE_FLAG_DEFAULT = None
WAFFLE_SECURE = SESSION_COOKIE_SECURE
```

## Seeding Switches

The installer runs the seed command after migrations to create switches from settings defaults. Upgrades do not run it, because a missing switch is created on first check. You can also run it manually:

```bash
python manage.py seed_waffle_switches
```

This is safe to run repeatedly because it preserves existing switches and admin-managed values.

For fresh installs or an explicit reset to settings defaults, use `--force`:

```bash
python manage.py seed_waffle_switches --force
```

Forced seeding overwrites existing switch values with their corresponding Django settings defaults.

## Migration from Settings

These switches were previously hardcoded boolean settings in `cms/settings.py` (e.g., `CAN_LIKE_MEDIA = True`). The old settings are kept as deprecated fallbacks and will be removed once the waffle switches are confirmed working in production.
