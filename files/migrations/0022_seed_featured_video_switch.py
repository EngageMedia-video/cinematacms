from django.conf import settings
from django.db import migrations

SWITCHES = [
    ("load_from_cdn", "LOAD_FROM_CDN", "Fetch external content from CDNs"),
    ("login_allowed", "LOGIN_ALLOWED", "Whether the login button appears"),
    ("register_allowed", "REGISTER_ALLOWED", "Whether the register button appears"),
    ("upload_media_allowed", "UPLOAD_MEDIA_ALLOWED", "Whether the upload media button appears"),
    ("can_like_media", "CAN_LIKE_MEDIA", "Whether the like button appears"),
    ("can_dislike_media", "CAN_DISLIKE_MEDIA", "Whether the dislike button appears"),
    ("can_report_media", "CAN_REPORT_MEDIA", "Whether the report button appears"),
    ("can_share_media", "CAN_SHARE_MEDIA", "Whether the share button appears"),
    ("allow_ratings", "ALLOW_RATINGS", "Enable user ratings (experimental)"),
    (
        "allow_ratings_confirmed_email_only",
        "ALLOW_RATINGS_CONFIRMED_EMAIL_ONLY",
        "Restrict ratings to verified emails",
    ),
    (
        "video_player_featured_video_on_index_page",
        "VIDEO_PLAYER_FEATURED_VIDEO_ON_INDEX_PAGE",
        "Whether a featured item appears enlarged with player on index page",
    ),
]


def seed_switches(apps, schema_editor):
    Switch = apps.get_model("waffle", "Switch")
    for name, setting, note in SWITCHES:
        Switch.objects.get_or_create(
            name=name,
            defaults={
                "active": getattr(settings, setting, False),
                "note": note,
            },
        )


def unseed_switches(apps, schema_editor):
    Switch = apps.get_model("waffle", "Switch")
    switch_names = [name for name, _, _ in SWITCHES]
    Switch.objects.filter(name__in=switch_names).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0021_widen_password_field"),
        ("waffle", "0004_update_everyone_nullbooleanfield"),
    ]

    operations = [
        migrations.RunPython(seed_switches, unseed_switches),
    ]
