from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("files", "0014_add_thumbnail_field_indexes"),
    ]

    operations = [
        migrations.AddField(
            model_name="encoding",
            name="task_dispatched",
            field=models.BooleanField(
                default=True,
                db_index=True,
                help_text="Whether the Celery task has been dispatched. False when deferred by rate limiting.",
            ),
        ),
    ]
