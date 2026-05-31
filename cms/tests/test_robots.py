from django.test import TestCase


class RobotsTxtTests(TestCase):
    def test_robots_txt_returns_valid_plain_text(self):
        response = self.client.get("/robots.txt")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Content-Type"], "text/plain; charset=utf-8")
        self.assertEqual(response.content, b"User-agent: *\nDisallow:\n")
