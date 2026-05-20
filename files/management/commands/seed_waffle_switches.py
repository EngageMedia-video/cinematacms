"""
Django Management Command: seed_waffle_switches

Seeds waffle switches from their corresponding Django settings values.
Run after migrating to ensure all switches exist with correct defaults.

Usage:
    python manage.py seed_waffle_switches
    python manage.py seed_waffle_switches --force
"""

from django.conf import settings
from django.core.management.base import BaseCommand

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


class Command(BaseCommand):
    help = "Seed waffle switches from Django settings values"

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Overwrite existing switches with settings defaults",
        )

    def handle(self, *args, **options):
        from waffle.models import Switch

        force = options["force"]

        for name, setting, note in SWITCHES:
            defaults = {
                "active": getattr(settings, setting, False),
                "note": note,
            }

            if force:
                switch, created = Switch.objects.update_or_create(name=name, defaults=defaults)
            else:
                switch, created = Switch.objects.get_or_create(name=name, defaults=defaults)

            status = "created" if created else ("updated" if force else "exists")
            self.stdout.write(f"  {name}: active={switch.active} ({status})")

        self.stdout.write(self.style.SUCCESS(f"Seeded {len(SWITCHES)} waffle switches"))
