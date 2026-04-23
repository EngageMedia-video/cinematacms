import json
import secrets
from contextlib import ExitStack
from unittest.mock import patch

from django.test import Client, TestCase, override_settings

from users.models import User


def _all_checks_healthy() -> ExitStack:
    """Return a context manager that patches all four check helpers to (True, "ok").

    Using this keeps tests hermetic: they don't depend on a running Postgres,
    Redis, writable MEDIA_ROOT, or a built Vite manifest.
    """
    stack = ExitStack()
    for name in ("_check_db", "_check_cache", "_check_filesystem", "_check_static_manifest"):
        stack.enter_context(patch(f"cms.health.{name}", return_value=(True, "ok")))
    return stack


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

    def _override_vite(self, dev_mode=False, manifest_path=None):
        if manifest_path is None:
            from django.conf import settings as s
            manifest_path = s.DJANGO_VITE["default"]["manifest_path"]
        return override_settings(
            DJANGO_VITE={"default": {"dev_mode": dev_mode, "manifest_path": manifest_path}}
        )

    def test_ready_all_healthy_returns_200(self):
        with _all_checks_healthy():
            response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 200)
        body = json.loads(response.content)
        self.assertEqual(body["status"], "ok")
        self.assertIn("database", body["checks"])
        self.assertIn("cache", body["checks"])
        self.assertIn("filesystem", body["checks"])
        self.assertIn("static_manifest", body["checks"])

    def test_ready_db_failure_returns_503(self):
        with patch("cms.health._check_db", return_value=(False, "OperationalError")):
            response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body["status"], "fail")
        # Privileged (direct-localhost, no XFF) client sees detail dict.
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

    def test_ready_cache_failure_detail_is_redacted(self):
        # Privileged response must not echo the raw cache error string back.
        with patch(
            "cms.health.cache_health_check",
            return_value={"status": "unhealthy", "error": "leaky internal redis trace", "latency_ms": 0, "timestamp": 0},
        ):
            response = self.client.get("/health/ready")
        self.assertNotIn("leaky internal redis trace", response.content.decode())
        body = json.loads(response.content)
        self.assertEqual(body["checks"]["cache"]["detail"], "unhealthy")

    def test_ready_static_manifest_missing_returns_503(self):
        # Force only the manifest to fail; mock the rest so the test is hermetic.
        with ExitStack() as stack:
            stack.enter_context(patch("cms.health._check_db", return_value=(True, "ok")))
            stack.enter_context(patch("cms.health._check_cache", return_value=(True, "ok")))
            stack.enter_context(patch("cms.health._check_filesystem", return_value=(True, "ok")))
            stack.enter_context(self._override_vite(dev_mode=False, manifest_path="/nonexistent/manifest.json"))
            response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body["status"], "fail")
        self.assertFalse(body["checks"]["static_manifest"]["ok"])
        self.assertEqual(body["checks"]["static_manifest"]["detail"], "missing")

    def test_ready_static_manifest_short_circuits_in_dev_mode(self):
        # In Vite dev_mode the manifest file is legitimately absent; must not fail.
        # Mock the non-manifest checks so the dev_mode branch is what's under test.
        with ExitStack() as stack:
            stack.enter_context(patch("cms.health._check_db", return_value=(True, "ok")))
            stack.enter_context(patch("cms.health._check_cache", return_value=(True, "ok")))
            stack.enter_context(patch("cms.health._check_filesystem", return_value=(True, "ok")))
            stack.enter_context(self._override_vite(dev_mode=True, manifest_path="/nonexistent/manifest.json"))
            response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 200)
        body = json.loads(response.content)
        self.assertTrue(body["checks"]["static_manifest"]["ok"])

    def test_ready_public_response_has_no_detail(self):
        # Non-localhost REMOTE_ADDR must get compact response with no exception info.
        public_client = Client(REMOTE_ADDR="203.0.113.5")
        with patch("cms.health._check_db", return_value=(False, "sensitive internal error detail")):
            response = public_client.get("/health/ready")
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body["checks"]["database"], "fail")
        self.assertNotIn("sensitive internal error detail", response.content.decode())

    def test_ready_xff_spoof_cannot_escalate_to_privileged(self):
        # Regression: a client-supplied X-Forwarded-For header must NOT unlock the
        # detailed response branch. REMOTE_ADDR is what counts.
        public_client = Client(REMOTE_ADDR="203.0.113.5")
        with patch("cms.health._check_db", return_value=(False, "sensitive internal error detail")):
            response = public_client.get("/health/ready", HTTP_X_FORWARDED_FOR="127.0.0.1")
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body["checks"]["database"], "fail")
        self.assertNotIn("sensitive internal error detail", response.content.decode())

    def test_ready_proxied_localhost_is_not_privileged(self):
        # Regression: traffic traversing nginx will have REMOTE_ADDR=127.0.0.1 AND
        # an XFF header. Must NOT get the detailed branch.
        with patch("cms.health._check_db", return_value=(False, "LeakyError details")):
            response = self.client.get(
                "/health/ready",
                REMOTE_ADDR="127.0.0.1",
                HTTP_X_FORWARDED_FOR="203.0.113.5",
            )
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        # Compact (string) shape proves the privileged branch was NOT taken.
        self.assertEqual(body["checks"]["database"], "fail")
        self.assertNotIn("LeakyError details", response.content.decode())

    def test_ready_privileged_response_includes_detail(self):
        test_password = secrets.token_urlsafe(16)
        staff = User.objects.create_user(
            username="staffhealth",
            email="staffhealth@example.com",
            password=test_password,
        )
        staff.is_staff = True
        staff.save()

        # Use a non-localhost REMOTE_ADDR to prove it's the staff login, not IP,
        # that unlocks the detailed branch.
        self.client = Client(REMOTE_ADDR="203.0.113.5")
        self.client.login(username="staffhealth", password=test_password)

        with patch("cms.health._check_db", return_value=(False, "OperationalError")):
            response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body["checks"]["database"]["ok"], False)
        self.assertEqual(body["checks"]["database"]["detail"], "OperationalError")


class HealthCheckRedactionTests(TestCase):
    """Unit tests asserting that the check helpers themselves redact exception text."""

    def test_db_check_returns_class_name_not_message(self):
        from cms import health

        class FakeCursorContext:
            def __enter__(self):
                raise RuntimeError("secret connection string: postgres://user:pw@host/db")

            def __exit__(self, *a):
                return False

        with patch.object(health.connection, "cursor", return_value=FakeCursorContext()):
            ok, detail = health._check_db()
        self.assertFalse(ok)
        self.assertEqual(detail, "RuntimeError")
        self.assertNotIn("secret", detail)

    def test_filesystem_check_returns_class_name_not_path(self):
        from cms import health

        with override_settings(MEDIA_ROOT="/this/path/should/not/leak/abc123"):
            ok, detail = health._check_filesystem()
        self.assertFalse(ok)
        self.assertNotIn("/this/path/should/not/leak", detail)
