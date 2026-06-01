from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0025_communityimpact"),
    ]

    operations = [
        migrations.AddField(
            model_name="communityimpact",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("active", "Active"),
                    ("inactive", "Inactive"),
                ],
                db_index=True,
                default="active",
                max_length=20,
            ),
            preserve_default=False,
        ),
        migrations.AddIndex(
            model_name="communityimpact",
            index=models.Index(fields=["status", "category"], name="files_commu_status_b5306c_idx"),
        ),
        migrations.AlterField(
            model_name="communityimpact",
            name="status",
            field=models.CharField(
                choices=[
                    ("pending", "Pending"),
                    ("active", "Active"),
                    ("inactive", "Inactive"),
                ],
                db_index=True,
                default="pending",
                max_length=20,
            ),
        ),
    ]
