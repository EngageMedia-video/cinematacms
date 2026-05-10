from django.conf import settings
from django.db import migrations


def seed_switch(apps, schema_editor):
    Switch = apps.get_model("waffle", "Switch")
    Switch.objects.get_or_create(
        name="video_player_featured_video_on_index_page",
        defaults={
            "active": getattr(settings, "VIDEO_PLAYER_FEATURED_VIDEO_ON_INDEX_PAGE", False),
            "note": "Whether a featured item appears enlarged with player on index page",
        },
    )


def unseed_switch(apps, schema_editor):
    Switch = apps.get_model("waffle", "Switch")
    Switch.objects.filter(name="video_player_featured_video_on_index_page").delete()


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0021_widen_password_field"),
        ("waffle", "0004_update_everyone_nullbooleanfield"),
    ]

    operations = [
        migrations.RunPython(seed_switch, unseed_switch),
    ]
