import json
import secrets
from contextlib import ExitStack
from unittest.mock import patch

from django.test import Client, TestCase, override_settings

from users.models import User


_CHECK_NAMES = ("_check_db", "_check_cache", "_check_filesystem", "_check_static_manifest")


def _all_checks_healthy() -> ExitStack:
    """Return a context manager that patches all four check helpers to (True, "ok").

    Using this keeps tests hermetic: they don't depend on a running Postgres,
    Redis, writable MEDIA_ROOT, or a built Vite manifest.
    """
    stack = ExitStack()
    for name in _CHECK_NAMES:
        stack.enter_context(patch(f"cms.health.{name}", return_value=(True, "ok")))
    return stack


def _all_checks_healthy_except(*skip: str) -> ExitStack:
    """Patch every check helper to healthy *except* the named ones.

    Use when a test wants the real implementation of one check to run (e.g. to
    exercise its redaction path) while still keeping the other checks
    deterministic.
    """
    stack = ExitStack()
    for name in _CHECK_NAMES:
        if name in skip:
            continue
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
        # Baseline-healthy + override only the check under test, so the test
        # cannot fail because of an unrelated dependency in CI / local dev.
        with _all_checks_healthy(), patch("cms.health._check_db", return_value=(False, "OperationalError")):
            response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body["status"], "fail")
        # Privileged (direct-localhost, no XFF) client sees detail dict.
        self.assertFalse(body["checks"]["database"]["ok"])

    def test_ready_cache_failure_returns_503(self):
        with _all_checks_healthy(), patch(
            "cms.health._check_cache",
            return_value=(False, "unhealthy"),
        ):
            response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body["status"], "fail")
        self.assertFalse(body["checks"]["cache"]["ok"])

    def test_ready_cache_failure_detail_is_redacted(self):
        # Privileged response must not echo the raw cache error string back.
        # Use the real _check_cache so we exercise the redaction path; baseline
        # the rest so this test can't fail for unrelated reasons.
        with _all_checks_healthy_except("_check_cache"), patch(
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
        with _all_checks_healthy(), patch(
            "cms.health._check_db", return_value=(False, "sensitive internal error detail")
        ):
            response = public_client.get("/health/ready")
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body["checks"]["database"], "fail")
        self.assertNotIn("sensitive internal error detail", response.content.decode())

    def test_ready_xff_spoof_cannot_escalate_to_privileged(self):
        # Regression: an external client setting `X-Forwarded-For: 127.0.0.1`
        # must NOT unlock the detailed branch. `get_client_ip()` only honors
        # XFF when REMOTE_ADDR is itself a trusted proxy, so the crafted header
        # is ignored and the real (external) REMOTE_ADDR wins.
        public_client = Client(REMOTE_ADDR="203.0.113.5")
        with _all_checks_healthy(), patch(
            "cms.health._check_db", return_value=(False, "sensitive internal error detail")
        ):
            response = public_client.get("/health/ready", HTTP_X_FORWARDED_FOR="127.0.0.1")
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body["checks"]["database"], "fail")
        self.assertNotIn("sensitive internal error detail", response.content.decode())

    def test_ready_proxied_localhost_is_not_privileged(self):
        # Regression: traffic traversing nginx has REMOTE_ADDR=127.0.0.1 (the
        # proxy) and a real external client IP in XFF. Because nginx is a
        # trusted proxy, `get_client_ip()` resolves to the XFF entry, so the
        # external client does NOT get the detailed branch.
        with _all_checks_healthy(), patch(
            "cms.health._check_db", return_value=(False, "LeakyError details")
        ):
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

        with _all_checks_healthy(), patch(
            "cms.health._check_db", return_value=(False, "OperationalError")
        ):
            response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 503)
        body = json.loads(response.content)
        self.assertEqual(body["checks"]["database"]["ok"], False)
        self.assertEqual(body["checks"]["database"]["detail"], "OperationalError")


class HealthReadyTokenGateTests(TestCase):
    """Verify the HEALTH_READY_TOKEN shared-secret gate on /health/ready."""

    TOKEN = "s3cret-token-value-do-not-use-in-prod"

    def setUp(self):
        # Default: external (non-localhost) client. Each test that needs a
        # different origin overrides this.
        self.client = Client(REMOTE_ADDR="203.0.113.5")

    def test_gate_disabled_when_token_unset_returns_normally(self):
        # No HEALTH_READY_TOKEN → existing behavior (200, compact response).
        with _all_checks_healthy():
            response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 200)

    def test_gate_rejects_external_without_token(self):
        with override_settings(HEALTH_READY_TOKEN=self.TOKEN), _all_checks_healthy():
            response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response["Cache-Control"], "no-store")

    def test_gate_rejects_wrong_token(self):
        with override_settings(HEALTH_READY_TOKEN=self.TOKEN), _all_checks_healthy():
            response = self.client.get(
                "/health/ready", HTTP_X_HEALTHCHECK_TOKEN="wrong-token"
            )
        self.assertEqual(response.status_code, 401)

    def test_gate_skips_checks_when_rejected(self):
        # When the gate rejects a caller, the four expensive checks must NOT run.
        # Otherwise the "DoS surface" the gate is supposed to close is still open.
        with (
            override_settings(HEALTH_READY_TOKEN=self.TOKEN),
            patch("cms.health._check_db") as mock_db,
            patch("cms.health._check_cache") as mock_cache,
            patch("cms.health._check_filesystem") as mock_fs,
            patch("cms.health._check_static_manifest") as mock_manifest,
        ):
            response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 401)
        mock_db.assert_not_called()
        mock_cache.assert_not_called()
        mock_fs.assert_not_called()
        mock_manifest.assert_not_called()

    def test_gate_accepts_valid_token_and_returns_privileged_shape(self):
        with override_settings(HEALTH_READY_TOKEN=self.TOKEN), _all_checks_healthy():
            response = self.client.get(
                "/health/ready", HTTP_X_HEALTHCHECK_TOKEN=self.TOKEN
            )
        self.assertEqual(response.status_code, 200)
        body = json.loads(response.content)
        # Token bearers see the detailed (dict-per-check) shape.
        self.assertEqual(body["checks"]["database"], {"ok": True, "detail": "ok"})

    def test_gate_bypassed_by_staff_session(self):
        # Staff with valid session but no token must still pass the gate.
        test_password = secrets.token_urlsafe(16)
        staff = User.objects.create_user(
            username="staffgate",
            email="staffgate@example.com",
            password=test_password,
        )
        staff.is_staff = True
        staff.save()
        self.client.login(username="staffgate", password=test_password)

        with override_settings(HEALTH_READY_TOKEN=self.TOKEN), _all_checks_healthy():
            response = self.client.get("/health/ready")
        self.assertEqual(response.status_code, 200)
        body = json.loads(response.content)
        # Staff still get the privileged shape.
        self.assertEqual(body["checks"]["database"], {"ok": True, "detail": "ok"})

    def test_gate_bypassed_by_direct_localhost(self):
        # Default Client (REMOTE_ADDR=127.0.0.1, no XFF) is "direct localhost"
        # under cms.request_utils.get_client_ip — operator on the box, no token
        # required.
        local_client = Client()  # REMOTE_ADDR defaults to 127.0.0.1
        with override_settings(HEALTH_READY_TOKEN=self.TOKEN), _all_checks_healthy():
            response = local_client.get("/health/ready")
        self.assertEqual(response.status_code, 200)

    def test_gate_uses_constant_time_compare(self):
        # Sanity: an empty header must not be treated as matching an empty/unset
        # token. (Both branches in the helper return False for that case.)
        with override_settings(HEALTH_READY_TOKEN=self.TOKEN), _all_checks_healthy():
            response = self.client.get(
                "/health/ready", HTTP_X_HEALTHCHECK_TOKEN=""
            )
        self.assertEqual(response.status_code, 401)


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
