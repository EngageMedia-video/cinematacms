from unittest.mock import patch

from django.test import TestCase

from files.forms import MediaForm
from files.models import Category, Language, Media
from files.tests.helpers import create_test_media, create_test_user


class EditMediaThumbnailSelectorTests(TestCase):
    def setUp(self):
        self.user = create_test_user()
        self.user.advancedUser = True
        self.user.save()
        self.category = Category.objects.first() or Category.objects.create(
            title="Test Category", user=self.user, is_global=True
        )
        Language.objects.get_or_create(code="en", defaults={"title": "English"})

    def test_media_form_includes_thumbnail_time_for_video(self):
        media = create_test_media(self.user, media_type="video")

        form = MediaForm(self.user, instance=media)

        self.assertIn("thumbnail_time", form.fields)

    def test_media_form_excludes_thumbnail_time_for_non_video(self):
        media = create_test_media(self.user, media_type="image")

        form = MediaForm(self.user, instance=media)

        self.assertNotIn("thumbnail_time", form.fields)

    def test_zero_thumbnail_time_is_used_as_selected_frame(self):
        media = create_test_media(
            self.user,
            media_file="original/media/test-video.mp4",
            thumbnail_time=0,
            duration=120,
        )

        with (
            patch("files.models.helpers.create_temp_file", return_value="/tmp/test-thumb.jpg"),
            patch("files.models.helpers.run_command") as run_command,
            patch("files.models.helpers.rm_file"),
            patch("files.models.os.path.exists", return_value=False),
            patch("files.models.random.uniform", return_value=55) as random_time,
        ):
            media.produce_thumbnails_from_video()

        command = run_command.call_args.args[0]
        self.assertEqual(float(command[2]), 0)
        random_time.assert_not_called()

    def test_selected_video_frame_clears_existing_uploaded_poster(self):
        media = create_test_media(
            self.user,
            media_file="original/media/test-video.mp4",
            thumbnail_time=1,
            uploaded_thumbnail="original/thumbnails/user/test/old-thumb.jpg",
            uploaded_poster="original/thumbnails/user/test/old-poster.jpg",
        )

        media.thumbnail_time = 20

        with patch.object(Media, "set_thumbnail", return_value=True) as set_thumbnail:
            media.save()

        media.refresh_from_db()
        self.assertFalse(media.uploaded_thumbnail)
        self.assertFalse(media.uploaded_poster)
        set_thumbnail.assert_called_once_with(force=True)
