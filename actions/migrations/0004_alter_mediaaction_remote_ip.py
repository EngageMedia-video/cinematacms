from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("actions", "0003_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="mediaaction",
            name="remote_ip",
            field=models.CharField(blank=True, max_length=64, null=True),
        ),
    ]
