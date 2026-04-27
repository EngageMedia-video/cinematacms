from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0016_add_encoding_drain_composite_index"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="media",
            index=models.Index(
                fields=["user", "state", "add_date"],
                name="media_user_state_date_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="media",
            index=models.Index(
                fields=["user", "encoding_status"],
                name="media_user_encoding_idx",
            ),
        ),
    ]
