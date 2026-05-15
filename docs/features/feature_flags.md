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
```

## Seeding Switches

After deploying, run the seed command to create all switches with their correct defaults from settings:

```bash
python manage.py seed_waffle_switches
```

This uses `update_or_create` so it is safe to run multiple times — it will correct any auto-created switches that have wrong defaults.

## Migration from Settings

These switches were previously hardcoded boolean settings in `cms/settings.py` (e.g., `CAN_LIKE_MEDIA = True`). The old settings are kept as deprecated fallbacks and will be removed once the waffle switches are confirmed working in production.
