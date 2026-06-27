from django.test import RequestFactory, TestCase, override_settings

from files.models import ContentSensitivity, EncodeProfile, Encoding
from files.serializers import HeroPlaybackSerializer, MediaSerializer, SingleMediaSerializer
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

    def test_single_media_serializer_includes_content_sensitivity_info(self):
        media = create_test_media(self.user)
        sensitivity = ContentSensitivity.objects.create(title="Graphic Violence")
        media.content_sensitivity.add(sensitivity)
        request = RequestFactory().get("/api/v1/media/test")
        request.user = self.user

        data = SingleMediaSerializer(media, context={"request": request}).data

        self.assertEqual(data["content_sensitivity_info"], [{"title": "Graphic Violence"}])

    @override_settings(SPRITE_NUM_SECS=7)
    def test_single_media_serializer_uses_historical_constant_for_legacy_rows(self):
        # Legacy media generated before sprite_num_secs existed has a null field. Its sheet
        # was always spaced at a fixed 10s, so the serializer must report 10 regardless of
        # the current SPRITE_NUM_SECS setting (here overridden to 7) — otherwise changing
        # the setting would remap legacy sheets to the wrong timestamps.
        media = create_test_media(self.user)
        self.assertIsNone(media.sprite_num_secs)
        request = RequestFactory().get("/api/v1/media/test")
        request.user = self.user

        data = SingleMediaSerializer(media, context={"request": request}).data

        self.assertEqual(data["sprite_num_secs"], 10)

    @override_settings(SPRITE_NUM_SECS=10)
    def test_single_media_serializer_prefers_per_media_sprite_num_secs(self):
        # Long videos store a widened interval; the serializer must report THAT value, not
        # the global setting, so the selector maps tiles to the correct timestamps.
        media = create_test_media(self.user)
        media.sprite_num_secs = 17
        media.save(update_fields=["sprite_num_secs"])
        request = RequestFactory().get("/api/v1/media/test")
        request.user = self.user

        data = SingleMediaSerializer(media, context={"request": request}).data

        self.assertEqual(data["sprite_num_secs"], 17)

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
