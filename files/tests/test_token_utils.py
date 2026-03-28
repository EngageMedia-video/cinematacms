"""
Tests for files.token_utils — token lifecycle, rate limiting, and manifest rewriting.
"""

from unittest.mock import patch

from django.test import SimpleTestCase, TestCase, override_settings

from files import token_utils


class TokenGenerationTest(TestCase):
    """Test token generation and Redis storage."""

    def test_generate_returns_url_safe_string(self):
        token = token_utils.generate_token("media123")
        self.assertIsInstance(token, str)
        self.assertGreater(len(token), 20)
        # URL-safe characters only
        for ch in token:
            self.assertIn(ch, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_=")

    def test_generate_returns_unique_tokens(self):
        tokens = {token_utils.generate_token("media123") for _ in range(10)}
        self.assertEqual(len(tokens), 10)

    def test_token_stored_in_redis_with_dual_key(self):
        media_id = "test-media-uid"
        token = token_utils.generate_token(media_id)

        redis = token_utils._get_redis()
        access_key = token_utils.ACCESS_KEY_TEMPLATE.format(token=token)
        media_set_key = token_utils.MEDIA_SET_KEY_TEMPLATE.format(media_id=media_id)

        # Access key exists with TTL
        self.assertIsNotNone(redis.get(access_key))
        ttl = redis.ttl(access_key)
        self.assertGreater(ttl, 0)
        self.assertLessEqual(ttl, token_utils._get_token_ttl())

        # Media set contains the access key
        members = redis.smembers(media_set_key)
        self.assertIn(access_key.encode() if isinstance(access_key, str) else access_key, members)


class TokenValidationTest(TestCase):
    """Test token validation logic."""

    def test_valid_token_returns_true(self):
        media_id = "media-abc"
        token = token_utils.generate_token(media_id)
        self.assertTrue(token_utils.validate_token(token, media_id))

    def test_wrong_media_returns_false(self):
        token = token_utils.generate_token("media-abc")
        self.assertFalse(token_utils.validate_token(token, "media-xyz"))

    def test_nonexistent_token_returns_false(self):
        self.assertFalse(token_utils.validate_token("bogus-token", "media-abc"))

    def test_empty_token_returns_false(self):
        self.assertFalse(token_utils.validate_token("", "media-abc"))
        self.assertFalse(token_utils.validate_token(None, "media-abc"))

    def test_expired_token_returns_false(self):
        media_id = "media-expire"
        token = token_utils.generate_token(media_id)

        # Manually expire the key
        redis = token_utils._get_redis()
        access_key = token_utils.ACCESS_KEY_TEMPLATE.format(token=token)
        redis.delete(access_key)

        self.assertFalse(token_utils.validate_token(token, media_id))

    def test_redis_unavailable_fails_closed(self):
        token = token_utils.generate_token("media-closed")

        with patch.object(token_utils, "_get_redis", side_effect=Exception("Redis down")):
            self.assertFalse(token_utils.validate_token(token, "media-closed"))


class TokenInvalidationTest(TestCase):
    """Test per-media token invalidation."""

    def test_invalidate_removes_all_tokens_for_media(self):
        media_id = "media-inval"
        t1 = token_utils.generate_token(media_id)
        t2 = token_utils.generate_token(media_id)

        count = token_utils.invalidate_media_tokens(media_id)
        self.assertEqual(count, 2)

        self.assertFalse(token_utils.validate_token(t1, media_id))
        self.assertFalse(token_utils.validate_token(t2, media_id))

    def test_invalidate_does_not_affect_other_media(self):
        t_keep = token_utils.generate_token("media-keep")
        token_utils.generate_token("media-remove")

        token_utils.invalidate_media_tokens("media-remove")

        self.assertTrue(token_utils.validate_token(t_keep, "media-keep"))

    def test_invalidate_empty_set_returns_zero(self):
        self.assertEqual(token_utils.invalidate_media_tokens("nonexistent-media"), 0)


class RateLimitTest(TestCase):
    """Test brute-force rate limiting."""

    def setUp(self):
        # Clean up any leftover keys
        try:
            redis = token_utils._get_redis()
            key = token_utils.RATE_LIMIT_KEY_TEMPLATE.format(ip="1.2.3.4", friendly_token="ft123")
            redis.delete(key)
        except Exception:
            pass

    def test_allowed_under_limit(self):
        self.assertTrue(token_utils.check_rate_limit("1.2.3.4", "ft123"))

    def test_blocked_at_max_attempts(self):
        for _ in range(token_utils._get_brute_force_max_attempts()):
            token_utils.record_failed_attempt("1.2.3.4", "ft123")

        self.assertFalse(token_utils.check_rate_limit("1.2.3.4", "ft123"))

    def test_different_ip_not_affected(self):
        for _ in range(token_utils._get_brute_force_max_attempts()):
            token_utils.record_failed_attempt("1.2.3.4", "ft123")

        self.assertTrue(token_utils.check_rate_limit("5.6.7.8", "ft123"))

    def test_different_media_not_affected(self):
        for _ in range(token_utils._get_brute_force_max_attempts()):
            token_utils.record_failed_attempt("1.2.3.4", "ft123")

        self.assertTrue(token_utils.check_rate_limit("1.2.3.4", "ft999"))

    def test_reset_clears_counter(self):
        for _ in range(token_utils._get_brute_force_max_attempts()):
            token_utils.record_failed_attempt("1.2.3.4", "ft123")

        token_utils.reset_rate_limit("1.2.3.4", "ft123")
        self.assertTrue(token_utils.check_rate_limit("1.2.3.4", "ft123"))

    def test_record_returns_count(self):
        c1 = token_utils.record_failed_attempt("1.2.3.4", "ft123")
        c2 = token_utils.record_failed_attempt("1.2.3.4", "ft123")
        self.assertEqual(c1, 1)
        self.assertEqual(c2, 2)

    @override_settings(PASSWORD_BRUTE_FORCE_MAX_ATTEMPTS=2)
    def test_respects_configurable_max_attempts(self):
        token_utils.record_failed_attempt("1.2.3.4", "ft123")
        self.assertTrue(token_utils.check_rate_limit("1.2.3.4", "ft123"))
        token_utils.record_failed_attempt("1.2.3.4", "ft123")
        self.assertFalse(token_utils.check_rate_limit("1.2.3.4", "ft123"))


class ManifestRewriteTest(SimpleTestCase):
    """Test M3U8 manifest rewriting — pure string logic, no DB/Redis needed."""

    def test_bare_segment_uris(self):
        content = "#EXTM3U\n#EXTINF:4.0,\nsegment-0.m4s\n#EXTINF:4.0,\nsegment-1.m4s\n#EXT-X-ENDLIST"
        result = token_utils.rewrite_m3u8(content, "abc123")
        self.assertIn("segment-0.m4s?token=abc123", result)
        self.assertIn("segment-1.m4s?token=abc123", result)

    def test_variant_playlist_uris(self):
        content = (
            "#EXTM3U\n"
            "#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720\n"
            "media-1/stream.m3u8\n"
            "#EXT-X-STREAM-INF:BANDWIDTH=1000000,RESOLUTION=640x360\n"
            "media-2/stream.m3u8"
        )
        result = token_utils.rewrite_m3u8(content, "tok")
        self.assertIn("media-1/stream.m3u8?token=tok", result)
        self.assertIn("media-2/stream.m3u8?token=tok", result)

    def test_ext_x_map_uri(self):
        content = '#EXTM3U\n#EXT-X-MAP:URI="init.mp4"\n#EXTINF:4.0,\nseg.m4s'
        result = token_utils.rewrite_m3u8(content, "t1")
        self.assertIn('URI="init.mp4?token=t1"', result)

    def test_ext_x_key_uri(self):
        content = '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="https://example.com/key"\n#EXTINF:4.0,\nseg.ts'
        result = token_utils.rewrite_m3u8(content, "t2")
        self.assertIn('URI="https://example.com/key?token=t2"', result)

    def test_iframe_stream_uri(self):
        content = '#EXTM3U\n#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=100000,URI="media-1/iframes.m3u8"'
        result = token_utils.rewrite_m3u8(content, "t3")
        self.assertIn('URI="media-1/iframes.m3u8?token=t3"', result)

    def test_uri_with_existing_query_params(self):
        content = "#EXTM3U\n#EXTINF:4.0,\nsegment.m4s?v=3"
        result = token_utils.rewrite_m3u8(content, "t4")
        self.assertIn("segment.m4s?v=3&token=t4", result)

    def test_preserves_comments_and_tags(self):
        content = "#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-TARGETDURATION:4\n#EXT-X-ENDLIST"
        result = token_utils.rewrite_m3u8(content, "t5")
        self.assertEqual(content, result)  # No URIs to rewrite, should be unchanged

    def test_empty_content(self):
        self.assertEqual(token_utils.rewrite_m3u8("", "t"), "")

    def test_full_master_playlist(self):
        content = (
            "#EXTM3U\n"
            "#EXT-X-VERSION:6\n"
            "#EXT-X-STREAM-INF:BANDWIDTH=3984854,RESOLUTION=1280x720\n"
            "media-1/stream.m3u8\n"
            "#EXT-X-STREAM-INF:BANDWIDTH=1917097,RESOLUTION=640x360\n"
            "media-2/stream.m3u8\n"
            '#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=291488,URI="media-1/iframes.m3u8"\n'
            '#EXT-X-I-FRAME-STREAM-INF:BANDWIDTH=171488,URI="media-2/iframes.m3u8"'
        )
        result = token_utils.rewrite_m3u8(content, "master_tok")

        self.assertIn("media-1/stream.m3u8?token=master_tok", result)
        self.assertIn("media-2/stream.m3u8?token=master_tok", result)
        self.assertIn('URI="media-1/iframes.m3u8?token=master_tok"', result)
        self.assertIn('URI="media-2/iframes.m3u8?token=master_tok"', result)
        # Tags preserved
        self.assertIn("#EXT-X-VERSION:6", result)
        self.assertIn("BANDWIDTH=3984854", result)
