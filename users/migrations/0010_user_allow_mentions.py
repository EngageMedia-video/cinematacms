from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("users", "0009_alter_user_location_country"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="allow_mentions",
            field=models.BooleanField(
                default=True,
                help_text="Let other members @mention you in comments",
                verbose_name="Mentions",
            ),
        ),
    ]
