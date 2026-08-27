from django.test import RequestFactory, SimpleTestCase, override_settings

from cms.request_utils import get_client_ip

CLOUDFLARE_EDGE = "162.158.1.1"
CLOUDFLARE_RANGE = "162.158.0.0/15"


class GetClientIPTests(SimpleTestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def _ip(self, **meta):
        return get_client_ip(self.factory.get("/", **meta))

    def test_untrusted_peer_keeps_its_own_address(self):
        self.assertEqual(self._ip(REMOTE_ADDR="203.0.113.10"), "203.0.113.10")

    def test_untrusted_peer_cannot_forge_forwarded_for(self):
        forged = self._ip(REMOTE_ADDR="203.0.113.10", HTTP_X_FORWARDED_FOR="127.0.0.1")
        self.assertEqual(forged, "203.0.113.10")

    def test_trusted_proxy_forwards_client_address(self):
        self.assertEqual(
            self._ip(REMOTE_ADDR="127.0.0.1", HTTP_X_FORWARDED_FOR="203.0.113.10"),
            "203.0.113.10",
        )

    @override_settings(TRUSTED_PROXIES=("127.0.0.1", "::1", CLOUDFLARE_RANGE))
    def test_client_supplied_forwarded_for_entry_is_not_the_client(self):
        # Cloudflare appends the peer it saw rather than replacing the header,
        # so a caller that sends its own X-Forwarded-For keeps the leftmost
        # slot. Reading from that end would report 127.0.0.1 as the client.
        spoofed = self._ip(
            REMOTE_ADDR=CLOUDFLARE_EDGE,
            HTTP_X_FORWARDED_FOR="127.0.0.1, 203.0.113.10",
        )
        self.assertEqual(spoofed, "203.0.113.10")

    @override_settings(TRUSTED_PROXIES=("127.0.0.1", "::1", CLOUDFLARE_RANGE))
    def test_trusted_hops_are_skipped_from_the_right(self):
        chain = self._ip(
            REMOTE_ADDR="127.0.0.1",
            HTTP_X_FORWARDED_FOR=f"203.0.113.10, {CLOUDFLARE_EDGE}",
        )
        self.assertEqual(chain, "203.0.113.10")

    @override_settings(TRUSTED_PROXIES=("127.0.0.1", "::1", CLOUDFLARE_RANGE))
    def test_falls_back_to_peer_when_every_hop_is_trusted(self):
        self.assertEqual(
            self._ip(REMOTE_ADDR="127.0.0.1", HTTP_X_FORWARDED_FOR=CLOUDFLARE_EDGE),
            "127.0.0.1",
        )

    def test_trusted_proxy_without_header_falls_back_to_peer(self):
        self.assertEqual(self._ip(REMOTE_ADDR="127.0.0.1"), "127.0.0.1")

    def test_missing_remote_addr_is_empty(self):
        request = self.factory.get("/")
        del request.META["REMOTE_ADDR"]
        self.assertEqual(get_client_ip(request), "")
