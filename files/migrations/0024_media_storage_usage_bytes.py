from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0023_category_color"),
    ]

    operations = [
        migrations.AddField(
            model_name="media",
            name="storage_usage_bytes",
            field=models.BigIntegerField(default=0),
        ),
    ]
