from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0021_widen_password_field"),
    ]

    operations = [
        migrations.CreateModel(
            name="ContentSensitivity",
            fields=[
                (
                    "id",
                    models.AutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "title",
                    models.CharField(db_index=True, max_length=100, unique=True),
                ),
                ("media_count", models.IntegerField(default=0)),
            ],
            options={
                "ordering": ["title"],
                "verbose_name_plural": "content sensitivities",
            },
        ),
        migrations.AddField(
            model_name="media",
            name="content_sensitivity",
            field=models.ManyToManyField(blank=True, to="files.contentsensitivity"),
        ),
    ]
