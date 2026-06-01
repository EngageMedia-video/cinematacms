from django.test import RequestFactory, SimpleTestCase, override_settings

from files.query_cache import (
    get_media_detail_cache_key,
    get_media_list_cache_key,
    get_playlist_detail_cache_key,
    get_request_cache_origin,
)


class QueryCacheKeyTest(SimpleTestCase):
    def test_media_list_cache_key_is_origin_aware(self):
        dev_key = get_media_list_cache_key(show="featured", page=1, user_id=None, origin="https://dev.cinemata.org")
        ip_key = get_media_list_cache_key(show="featured", page=1, user_id=None, origin="https://185.88.143.181")

        self.assertNotEqual(dev_key, ip_key)

    def test_detail_cache_keys_are_origin_aware(self):
        dev_media_key = get_media_detail_cache_key("abc123", origin="https://dev.cinemata.org")
        ip_media_key = get_media_detail_cache_key("abc123", origin="https://185.88.143.181")
        dev_playlist_key = get_playlist_detail_cache_key("playlist123", origin="https://dev.cinemata.org")
        ip_playlist_key = get_playlist_detail_cache_key("playlist123", origin="https://185.88.143.181")

        self.assertNotEqual(dev_media_key, ip_media_key)
        self.assertNotEqual(dev_playlist_key, ip_playlist_key)

    def test_request_cache_origin_matches_absolute_url_origin(self):
        request = RequestFactory().get("/", secure=True, HTTP_HOST="dev.cinemata.org")

        with override_settings(ALLOWED_HOSTS=["dev.cinemata.org"]):
            self.assertEqual(get_request_cache_origin(request), "https://dev.cinemata.org")
