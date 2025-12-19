from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0004_alter_user_location_country"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="disable_activity_logging",
            field=models.BooleanField(
                default=False,
                help_text="When enabled, your views, likes, and other actions will not be logged.",
                verbose_name="Disable activity logging",
            ),
        ),
    ]
