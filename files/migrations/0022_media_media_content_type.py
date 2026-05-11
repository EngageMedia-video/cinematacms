from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("files", "0021_widen_password_field"),
    ]

    operations = [
        migrations.AddField(
            model_name="media",
            name="media_content_type",
            field=models.CharField(
                blank=True,
                choices=[
                    ("", ""),
                    ("documentary", "Documentary"),
                    ("film", "Film"),
                    ("short_film", "Short Film"),
                    ("experimental", "Experimental"),
                    ("webinar", "Webinar"),
                    ("music_video", "Music Video"),
                    ("art", "Art"),
                    ("tv", "TV"),
                    ("animation", "Animation"),
                    ("lecture", "Lecture"),
                    ("other", "Other"),
                ],
                db_index=True,
                default="film",
                max_length=20,
            ),
        ),
    ]
