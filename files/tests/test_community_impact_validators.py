from django.test import SimpleTestCase
from rest_framework import serializers

from files.community_impact_validators import GENERIC_TRUSTED_URL_ERROR, validate_trusted_url


class TrustedImpactUrlValidatorTests(SimpleTestCase):
    def assert_rejects_with_generic_error(self, value):
        with self.assertRaises(serializers.ValidationError) as context:
            validate_trusted_url(value)

        self.assertEqual(str(context.exception.detail[0]), GENERIC_TRUSTED_URL_ERROR)
        self.assertNotIn("allowed", str(context.exception.detail[0]).lower())

    def test_rejects_http_scheme(self):
        self.assert_rejects_with_generic_error("http://drive.google.com/x")

    def test_rejects_ipv4_literal(self):
        self.assert_rejects_with_generic_error("https://192.168.1.1/x")

    def test_rejects_ipv6_literal(self):
        self.assert_rejects_with_generic_error("https://[::1]/x")

    def test_rejects_credentials(self):
        self.assert_rejects_with_generic_error("https://user:pass@drive.google.com/x")

    def test_accepts_https_host(self):
        value = "https://drive.google.com/file/d/abc/view"

        self.assertEqual(validate_trusted_url(value), value)

    def test_accepts_arbitrary_https_host(self):
        value = "https://example.com/x"

        self.assertEqual(validate_trusted_url(value), value)

    def test_accepts_empty_url(self):
        self.assertEqual(validate_trusted_url(""), "")
