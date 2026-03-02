from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("files", "0015_encoding_task_dispatched"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="encoding",
            index=models.Index(
                fields=["status", "task_dispatched", "add_date"],
                name="encoding_drain_idx",
            ),
        ),
    ]
