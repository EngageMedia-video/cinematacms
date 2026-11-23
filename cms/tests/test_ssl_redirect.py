from django.middleware.security import SecurityMiddleware
from django.test import RequestFactory, SimpleTestCase, override_settings


def response_to(path, method="get"):
    request = getattr(RequestFactory(), method)(path)
    return SecurityMiddleware(lambda request: None).process_request(request)


@override_settings(SECURE_SSL_REDIRECT=True)
class SslRedirectTests(SimpleTestCase):
    def test_plain_http_page_request_is_redirected_to_https(self):
        response = response_to("/")

        self.assertEqual(response.status_code, 301)
        self.assertEqual(response["Location"], "https://testserver/")

    def test_loopback_endpoints_answer_plain_http_without_a_redirect(self):
        # nginx forwards these over plain HTTP from loopback: deploy/nginx/cinematacms-metrics.conf
        # and deploy/observability/templates/nginx-app-metrics.conf.
        for method, path in (
            ("get", "/metrics"),
            ("get", "/internal/observability/references"),
            ("post", "/internal/observability/error-probe"),
        ):
            with self.subTest(path=path):
                self.assertIsNone(response_to(path, method))
