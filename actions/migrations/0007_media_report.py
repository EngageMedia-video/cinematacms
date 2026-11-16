from django.conf import settings
from django.db import migrations, models, transaction
from django.db.models import Count, Min, OuterRef, Subquery
from django.db.models.functions import Coalesce


def delete_duplicate_reports(apps, schema_editor):
    """Keep each user's earliest Report per media so the constraint can apply."""
    MediaAction = apps.get_model("actions", "MediaAction")
    user_reports = MediaAction.objects.filter(action="report", user__isnull=False)
    earliest = user_reports.values("media", "user").annotate(first_id=Min("id")).values("first_id")
    user_reports.exclude(id__in=earliest).delete()


RECOUNT_BATCH_SIZE = 1000


def recount_reported_times(apps, schema_editor):
    """Recount every media the way actions.models.recount_reported_times() does.

    An UPDATE that waits on a Report's recount counts from its stale snapshot,
    so each batch takes the media locks first and counts in a later statement.
    """
    Media = apps.get_model("files", "Media")
    MediaAction = apps.get_model("actions", "MediaAction")
    report_count = (
        MediaAction.objects.filter(action="report", media=OuterRef("pk"))
        .values("media")
        .annotate(total=Count("id"))
        .values("total")
    )
    last_recounted_pk = 0
    while True:
        with transaction.atomic():
            batch = list(
                Media.objects.filter(pk__gt=last_recounted_pk)
                .order_by("pk")
                .select_for_update(no_key=True)
                .values_list("pk", flat=True)[:RECOUNT_BATCH_SIZE]
            )
            if not batch:
                return
            Media.objects.filter(pk__in=batch).update(reported_times=Coalesce(Subquery(report_count), 0))
        last_recounted_pk = batch[-1]


def build_index_concurrently(name, create_sql, state_operation):
    """Build an index without blocking writes, replacing any left by a failed run.

    A failed concurrent build leaves its index behind, sometimes invalid, and
    the next run would stop on the name.
    """
    drop_sql = f'DROP INDEX CONCURRENTLY IF EXISTS "{name}"'
    return migrations.SeparateDatabaseAndState(
        database_operations=[migrations.RunSQL(sql=[drop_sql, create_sql], reverse_sql=drop_sql)],
        state_operations=[state_operation],
    )


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
        build_index_concurrently(
            "mediaaction_report_media_idx",
            'CREATE INDEX CONCURRENTLY "mediaaction_report_media_idx" '
            'ON "actions_mediaaction" ("media_id") WHERE "action" = \'report\'',
            migrations.AddIndex(
                model_name="mediaaction",
                index=models.Index(
                    condition=models.Q(("action", "report")),
                    fields=["media"],
                    name="mediaaction_report_media_idx",
                ),
            ),
        ),
        # On PostgreSQL a conditional unique constraint is a partial unique
        # index, which Django's AddConstraint cannot build concurrently.
        build_index_concurrently(
            "mediaaction_one_report_per_user",
            'CREATE UNIQUE INDEX CONCURRENTLY "mediaaction_one_report_per_user" '
            'ON "actions_mediaaction" ("media_id", "user_id") '
            'WHERE ("action" = \'report\' AND "user_id" IS NOT NULL)',
            migrations.AddConstraint(
                model_name="mediaaction",
                constraint=models.UniqueConstraint(
                    condition=models.Q(("action", "report"), ("user__isnull", False)),
                    fields=("media", "user"),
                    name="mediaaction_one_report_per_user",
                ),
            ),
        ),
        migrations.RunPython(recount_reported_times, migrations.RunPython.noop),
    ]
