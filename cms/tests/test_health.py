import json
from unittest.mock import patch

from django.test import Client, TestCase, override_settings

from users.models import User


class HealthLiveTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_live_returns_200(self):
        response = self.client.get("/health/live")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(json.loads(response.content), {"status": "ok"})

    def test_live_is_get_only(self):
        response = self.client.post("/health/live")
        self.assertEqual(response.status_code, 405)


class HealthReadyTests(TestCase):
    def setUp(self):
        self.client = Client()

    def test_ready_all_healthy_returns_200(self):
        response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 200)
        body = json.loads(response.content)
        self.assertEqual(body["status"], "ok")
        self.assertIn("database", body["checks"])
        self.assertIn("cache", body["checks"])
        self.assertIn("filesystem", body["checks"])
        self.assertIn("static_manifest", body["checks"])

    def test_ready_db_failure_returns_503(self):
        with patch("cms.health._check_db", return_value=(False, "connection refused")):
            response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body["status"], "fail")
        # Privileged (localhost) client sees detail dict
        self.assertFalse(body["checks"]["database"]["ok"])

    def test_ready_cache_failure_returns_503(self):
        with patch(
            "cms.health.cache_health_check",
            return_value={"status": "unhealthy", "error": "redis down", "latency_ms": 0, "timestamp": 0},
        ):
            response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body["status"], "fail")
        self.assertFalse(body["checks"]["cache"]["ok"])

    def test_ready_static_manifest_missing_returns_503(self):
        with override_settings(DJANGO_VITE={"default": {"manifest_path": "/nonexistent/manifest.json"}}):
            response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body["status"], "fail")
        self.assertFalse(body["checks"]["static_manifest"]["ok"])

    def test_ready_public_response_has_no_detail(self):
        # Non-localhost client (X-Forwarded-For with public IP) gets compact response
        with patch("cms.health._check_db", return_value=(False, "sensitive internal error detail")):
            response = self.client.get("/health/ready", HTTP_X_FORWARDED_FOR="203.0.113.5")
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body["checks"]["database"], "fail")
        self.assertNotIn("sensitive internal error detail", response.content.decode())

    def test_ready_privileged_response_includes_detail(self):
        staff = User.objects.create_user(
            username="staffhealth",
            email="staffhealth@example.com",
            password="testpass123",
        )
        staff.is_staff = True
        staff.save()
        self.client.login(username="staffhealth", password="testpass123")

        with patch("cms.health._check_db", return_value=(False, "specific db failure")):
            response = self.client.get("/health/ready", HTTP_X_FORWARDED_FOR="203.0.113.5")
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body["checks"]["database"]["detail"], "specific db failure")
