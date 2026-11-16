from django.conf import settings
from django.contrib.postgres.operations import AddIndexConcurrently
from django.db import migrations, models
from django.db.models import Count, Min, OuterRef, Subquery
from django.db.models.functions import Coalesce


def delete_duplicate_reports(apps, schema_editor):
    """Keep each user's earliest Report per media so the constraint can apply."""
    MediaAction = apps.get_model("actions", "MediaAction")
    user_reports = MediaAction.objects.filter(action="report", user__isnull=False)
    earliest = user_reports.values("media", "user").annotate(first_id=Min("id")).values("first_id")
    user_reports.exclude(id__in=earliest).delete()


def recount_reported_times(apps, schema_editor):
    Media = apps.get_model("files", "Media")
    MediaAction = apps.get_model("actions", "MediaAction")
    report_count = (
        MediaAction.objects.filter(action="report", media=OuterRef("pk"))
        .values("media")
        .annotate(total=Count("id"))
        .values("total")
    )
    Media.objects.update(reported_times=Coalesce(Subquery(report_count), 0))


class Migration(migrations.Migration):
    # MediaAction holds one row per watch; build the indexes without blocking writes.
    atomic = False

    dependencies = [
        ("actions", "0006_mediaaction_ip_expiry_idx"),
        ("files", "0038_dailysegmentmetric"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    # Rolling back keeps the counters and cannot restore deleted duplicates,
    # because the old counts and the duplicates were both wrong.
    operations = [
        migrations.CreateModel(
            name="MediaReport",
            fields=[],
            options={
                "verbose_name": "report",
                "proxy": True,
                "indexes": [],
                "constraints": [],
            },
            bases=("actions.mediaaction",),
        ),
        migrations.RunPython(delete_duplicate_reports, migrations.RunPython.noop),
        AddIndexConcurrently(
            model_name="mediaaction",
            index=models.Index(
                condition=models.Q(("action", "report")),
                fields=["media"],
                name="mediaaction_report_media_idx",
            ),
        ),
        # Django has no concurrent AddConstraint. On PostgreSQL a conditional
        # unique constraint is a partial unique index, so build that index
        # concurrently and record the constraint in the migration state.
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        'CREATE UNIQUE INDEX CONCURRENTLY "mediaaction_one_report_per_user" '
                        'ON "actions_mediaaction" ("media_id", "user_id") '
                        'WHERE ("action" = \'report\' AND "user_id" IS NOT NULL)'
                    ),
                    reverse_sql='DROP INDEX CONCURRENTLY IF EXISTS "mediaaction_one_report_per_user"',
                ),
            ],
            state_operations=[
                migrations.AddConstraint(
                    model_name="mediaaction",
                    constraint=models.UniqueConstraint(
                        condition=models.Q(("action", "report"), ("user__isnull", False)),
                        fields=("media", "user"),
                        name="mediaaction_one_report_per_user",
                    ),
                ),
            ],
        ),
        migrations.RunPython(recount_reported_times, migrations.RunPython.noop),
    ]
