import base64
from unittest.mock import patch

from django.test import RequestFactory, SimpleTestCase, TestCase
from rest_framework import exceptions
from rest_framework.request import Request

from cms import authentication_telemetry


class AuthenticationFailureRecorderTests(SimpleTestCase):
    def test_recorder_emits_only_bounded_labels_and_event_fields(self):
        with (
            patch.object(authentication_telemetry.metrics.AUTH_FAILURES_TOTAL, "labels") as metric,
            patch.object(authentication_telemetry.logger, "warning") as warning,
        ):
            authentication_telemetry.record_authentication_failure("api", "token", "invalid_token")

        metric.assert_called_once_with(surface="api", mechanism="token", reason="invalid_token")
        warning.assert_called_once_with(
            "cinematacms.authentication.failed",
            extra={"surface": "api", "mechanism": "token", "reason": "invalid_token"},
        )

    def test_unregistered_value_is_bounded_and_reported(self):
        with (
            patch.object(authentication_telemetry.metrics.AUTH_FAILURES_TOTAL, "labels") as metric,
            patch.object(authentication_telemetry.metrics, "record_contract_violation") as violation,
            patch.object(authentication_telemetry.logger, "warning"),
        ):
            authentication_telemetry.record_authentication_failure("private-path", "bearer", "secret-error")

        metric.assert_called_once_with(surface="other", mechanism="unknown", reason="unknown_failure")
        self.assertEqual(violation.call_count, 3)


class DRFAuthenticationTelemetryTests(TestCase):
    def setUp(self):
        self.factory = RequestFactory()

    def test_malformed_basic_credentials_are_recorded(self):
        request = Request(self.factory.get("/api/v1/media", HTTP_AUTHORIZATION="Basic malformed"))
        backend = authentication_telemetry.BasicAuthentication()

        with patch.object(authentication_telemetry, "record_authentication_failure") as record:
            with self.assertRaises(exceptions.AuthenticationFailed):
                backend.authenticate(request)

        record.assert_called_once_with("api", "basic", "malformed_credentials")

    def test_invalid_basic_credentials_are_recorded(self):
        encoded = base64.b64encode(b"missing-user:invalid-password").decode()
        request = Request(self.factory.get("/api/v1/media", HTTP_AUTHORIZATION=f"Basic {encoded}"))
        backend = authentication_telemetry.BasicAuthentication()

        with patch.object(authentication_telemetry, "record_authentication_failure") as record:
            with self.assertRaises(exceptions.AuthenticationFailed):
                backend.authenticate(request)

        record.assert_called_once_with("api", "basic", "invalid_credentials")

    def test_invalid_token_is_recorded(self):
        request = Request(self.factory.get("/api/v1/media", HTTP_AUTHORIZATION="Token invalid"))
        backend = authentication_telemetry.TokenAuthentication()

        with (
            patch.object(backend, "authenticate_credentials", side_effect=exceptions.AuthenticationFailed()),
            patch.object(authentication_telemetry, "record_authentication_failure") as record,
        ):
            with self.assertRaises(exceptions.AuthenticationFailed):
                backend.authenticate(request)

        record.assert_called_once_with("api", "token", "invalid_token")

    def test_anonymous_request_does_not_count_missing_credentials(self):
        request = Request(self.factory.get("/api/v1/media"))

        with patch.object(authentication_telemetry, "record_authentication_failure") as record:
            self.assertIsNone(authentication_telemetry.TokenAuthentication().authenticate(request))

        record.assert_not_called()

    def test_dependency_middleware_returns_typed_503(self):
        middleware = authentication_telemetry.AuthenticationDependencyMiddleware(lambda request: None)
        response = middleware.process_exception(
            self.factory.get("/media/restricted"), authentication_telemetry.AuthenticationDependencyUnavailable()
        )

        self.assertEqual(response.status_code, 503)
        self.assertJSONEqual(response.content, {"detail": "Authentication service is temporarily unavailable."})

    def test_allauth_rate_limit_response_is_recorded(self):
        middleware = authentication_telemetry.AuthenticationDependencyMiddleware(
            lambda request: type("R", (), {"status_code": 429})()
        )
        request = self.factory.post("/accounts/login/")
        request.resolver_match = type("Match", (), {"url_name": "account_login"})()

        with patch.object(authentication_telemetry, "record_authentication_failure") as record:
            middleware(request)

        record.assert_called_once_with("account_login", "password", "rate_limited")

    def test_browser_csrf_failure_is_recorded(self):
        request = self.factory.post("/accounts/login/")

        with (
            patch.object(authentication_telemetry, "record_authentication_failure") as record,
            patch.object(authentication_telemetry, "django_csrf_failure", return_value=object()) as failure,
        ):
            response = authentication_telemetry.csrf_failure(request, reason="sensitive reason")

        self.assertIs(response, failure.return_value)
        record.assert_called_once_with("account_login", "session", "csrf_rejected")
