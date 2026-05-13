from django.test import RequestFactory, TestCase

from files.models import EncodeProfile, Encoding
from files.serializers import HeroPlaybackSerializer, MediaSerializer
from files.tests.helpers import create_test_media, create_test_user


class MediaSerializerTest(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = create_test_user()

    def test_summary_is_included_for_list_payloads(self):
        media = create_test_media(
            self.user,
            summary="A concise synopsis for homepage and listing cards.",
            description="",
        )
        request = RequestFactory().get("/api/v1/media")

        data = MediaSerializer(media, context={"request": request}).data

        self.assertEqual(data["summary"], "A concise synopsis for homepage and listing cards.")

    def test_hero_playback_serializer_includes_playback_fields(self):
        media = create_test_media(self.user)
        profile = EncodeProfile.objects.create(name="Hero 720p", extension="mp4", codec="h264", resolution=720)
        encoding = Encoding(media=media, profile=profile, status="success", progress=100, chunk=False)
        encoding.media_file.name = "encoded/hero.mp4"
        encoding.save()

        data = HeroPlaybackSerializer(media).data

        self.assertIn("encodings_info", data)
        self.assertIn("hls_info", data)
        self.assertIn("subtitles_info", data)
        self.assertEqual(data["encodings_info"][720]["h264"]["status"], "success")

    def test_hero_playback_serializer_absolutizes_urls_with_request_context(self):
        media = create_test_media(self.user)
        profile = EncodeProfile.objects.create(name="Hero 720p", extension="mp4", codec="h264", resolution=720)
        encoding = Encoding(media=media, profile=profile, status="success", progress=100, chunk=False)
        encoding.media_file.name = "encoded/hero.mp4"
        encoding.save()
        request = RequestFactory().get("/api/v1/media")

        data = HeroPlaybackSerializer(media, context={"request": request}).data

        self.assertTrue(
            data["encodings_info"][720]["h264"]["url"].startswith("http://testserver/media/encoded/hero.mp4")
        )
