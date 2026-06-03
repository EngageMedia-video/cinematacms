from django.db import migrations, models


def backfill_comment_counts(apps, schema_editor):
    Media = apps.get_model("files", "Media")
    Comment = apps.get_model("files", "Comment")
    from django.db.models import Count, OuterRef, Subquery, Value
    from django.db.models.functions import Coalesce

    comment_counts = (
        Comment.objects.filter(media=OuterRef("pk")).order_by().values("media").annotate(cnt=Count("pk")).values("cnt")
    )
    Media.objects.update(comment_count=Coalesce(Subquery(comment_counts), Value(0)))


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0025_communityimpact"),
    ]

    operations = [
        migrations.AddField(
            model_name="media",
            name="comment_count",
            field=models.IntegerField(default=0, db_index=True),
        ),
        migrations.RunPython(backfill_comment_counts, migrations.RunPython.noop),
    ]
