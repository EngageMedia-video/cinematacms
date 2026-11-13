import base64
import logging
import shutil
import tempfile
import uuid
from types import SimpleNamespace
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.http import HttpResponse
from django.test import Client, RequestFactory, SimpleTestCase, TestCase, override_settings
from django.urls import reverse

from cms.observability import OpenTelemetryLogFilter, actor_reference_context
from cms.permissions import user_allowed_to_upload
from files.views import upload_media
from uploader.models import UploadSession
from uploader.tus_views import TusCollectionView, TusUploadView
from uploader.utils import clean_filename, is_valid_uuid_format, strip_delimiters
from users.models import User

FILE_UUID = "3f2b8c1e-9d4a-4e6b-8a57-1c0d2e3f4a5b"


class UploadMediaCsrfCookieTests(TestCase):
    def test_authenticated_upload_page_sets_csrf_cookie(self):
        """Authenticated uploader page must provide the CSRF cookie the upload requests send back."""
        request = RequestFactory().get(reverse("upload_media"))
        # Mirror a real authenticated user: the view now reads role flags for the
        # bulk-upload config (is_trusted_user / max_bulk_files), which call
        # is_anonymous and the role attributes.
        request.user = SimpleNamespace(
            is_authenticated=True,
            is_anonymous=False,
            is_superuser=False,
            is_manager=False,
            is_editor=False,
            advancedUser=False,
        )

        with (
            patch("files.views.waffle.switch_is_active", return_value=True),
            patch("files.views.can_upload_media", return_value=True),
            patch("files.views.get_allowed_video_extensions", return_value=["mp4"]),
            patch("files.views.render", return_value=HttpResponse("ok")),
        ):
            response = upload_media(request)

        self.assertEqual(response.status_code, 200)
        self.assertIn(settings.CSRF_COOKIE_NAME, response.cookies)


class UploaderTestSuite(TestCase):
    """Test cases for file upload functionality"""

    def setUp(self):
        """Set up test data"""
        # Create test users
        self.username = "testuser"
        self.password = "securepassword123"
        self.email = "test@example.com"

        self.advanced_username = "advanceduser"
        self.advanced_password = "advancedpassword123"
        self.advanced_email = "advanced@example.com"

        self.superuser_username = "superuser"
        self.superuser_password = "superpassword123"
        self.superuser_email = "super@example.com"

        # Create users
        self.user = User.objects.create_user(
            username=self.username,
            email=self.email,
            password=self.password,
        )

        self.advanced_user = User.objects.create_user(
            username=self.advanced_username,
            email=self.advanced_email,
            password=self.advanced_password,
        )
        self.advanced_user.advancedUser = True
        self.advanced_user.save()

        self.superuser = User.objects.create_superuser(
            username=self.superuser_username, email=self.superuser_email, password=self.superuser_password
        )

        # Setup test client
        self.client = Client()

    def test_helper_functions(self):
        """Test utility functions used in upload process"""
        # Test valid UUID format
        valid_uuid = str(uuid.uuid4())
        self.assertTrue(is_valid_uuid_format(valid_uuid))

        # Test invalid UUID format
        invalid_uuid = "not-a-uuid"
        self.assertFalse(is_valid_uuid_format(invalid_uuid))

        # Test filename sanitization
        dirty_filename = "test file & script<>.mp4"
        clean_filename = strip_delimiters(dirty_filename)
        expected_clean = "testfilescript.mp4"
        self.assertEqual(clean_filename, expected_clean)

        # Test filename with various delimiters
        complex_filename = "test[file]{name}(with)|delimiters&more.mp4"
        clean_complex = strip_delimiters(complex_filename)
        self.assertNotIn("[", clean_complex)
        self.assertNotIn("&", clean_complex)
        self.assertNotIn("|", clean_complex)

    def test_user_upload_permissions(self):
        """Test upload permissions for different user types"""
        from django.http import HttpRequest

        # Test anonymous user (should not be allowed)
        request = HttpRequest()
        request.user = AnonymousUser()
        self.assertFalse(user_allowed_to_upload(request))

        # Test regular user (depends on CAN_ADD_MEDIA setting)
        request.user = self.user
        user_can_upload = user_allowed_to_upload(request)
        # This will depend on your CAN_ADD_MEDIA setting
        if settings.CAN_ADD_MEDIA == "all":
            self.assertTrue(user_can_upload)
        elif settings.CAN_ADD_MEDIA == "advancedUser":
            self.assertFalse(user_can_upload)

        # Test advanced user
        request.user = self.advanced_user
        self.assertTrue(user_allowed_to_upload(request))

        # Test superuser
        request.user = self.superuser
        self.assertTrue(user_allowed_to_upload(request))

    def test_upload_page_access(self):
        """Test access to upload page"""
        upload_url = reverse("upload_media")

        # Anonymous users are redirected to the redesigned allauth sign-in page.
        response = self.client.get(upload_url)
        self.assertEqual(response.status_code, 302)
        self.assertIn(reverse("account_login"), response["Location"])

        # Test authenticated user access
        self.client.login(username=self.username, password=self.password)
        response = self.client.get(upload_url)
        self.assertEqual(response.status_code, 200)

    def test_filename_cleaning_removes_delimiters_and_directories(self):
        cases = [
            ("test<script>alert('xss')</script>.mp4", "<>'\""),
            ("file with spaces and & symbols.mp4", " &"),
            ("test[file]{name}(with)|delimiters.mp4", "[]{}()|"),
            ("file\\with\\backslashes.mp4", "\\"),
            ("file:with*special;chars=test+more.mp4", ":*;=+"),
        ]
        for name, removed in cases:
            with self.subTest(name):
                cleaned = clean_filename(name)

                self.assertTrue(cleaned)
                for character in removed:
                    self.assertNotIn(character, cleaned)

        # A client-supplied path must not reach the filesystem.
        self.assertEqual(clean_filename("../../../etc/passwd"), "passwd")


class _LogCollector(logging.Handler):
    def __init__(self):
        super().__init__()
        self.records = []
        self.addFilter(OpenTelemetryLogFilter())

    def emit(self, record):
        self.records.append(record)


class UploadLifecycleLogTests(TestCase):
    """Start and finish events carry the same upload_ref as the nginx line and the denial events."""

    def setUp(self):
        self.user = User.objects.create_user(username="person", email="person@example.org", password="pw")
        self.media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media_root, ignore_errors=True)
        media_root = override_settings(MEDIA_ROOT=self.media_root)
        media_root.enable()
        self.addCleanup(media_root.disable)
        self.collector = _LogCollector()
        view_logger = logging.getLogger("uploader.views")
        view_logger.addHandler(self.collector)
        self.addCleanup(view_logger.removeHandler, self.collector)
        # cms/settings.py sets the uploader logger to INFO; the test run does not inherit that level.
        self.addCleanup(view_logger.setLevel, view_logger.level)
        view_logger.setLevel(logging.INFO)
        self.actor_ref = "v1:" + "d" * 64

    def _call(self, view, request, **kwargs):
        request.user = self.user
        with (
            patch("uploader.views.user_allowed_to_upload", return_value=True),
            patch("uploader.views.is_trusted_uploader", return_value=False),
            patch("uploader.views.Media") as media,
            actor_reference_context(self.actor_ref),
        ):
            media.return_value.get_absolute_url.return_value = "/view?m=abc"
            return view.as_view()(request, **kwargs)

    def _create(self, upload_id=FILE_UUID):
        filename = base64.b64encode(b"clip.mp4").decode()
        request = RequestFactory().post(
            "/fu/tus/",
            HTTP_TUS_RESUMABLE="1.0.0",
            HTTP_UPLOAD_LENGTH="16",
            HTTP_UPLOAD_METADATA=f"filename {filename}",
            HTTP_X_UPLOAD_ID=upload_id,
        )
        return self._call(TusCollectionView, request)

    def _send(self, offset, size):
        session = UploadSession.objects.get()
        request = RequestFactory().patch(
            f"/fu/tus/{session.uuid}/",
            b"x" * size,
            content_type="application/offset+octet-stream",
            HTTP_TUS_RESUMABLE="1.0.0",
            HTTP_UPLOAD_OFFSET=str(offset),
            HTTP_X_UPLOAD_ID=FILE_UUID,
        )
        return self._call(TusUploadView, request, upload_id=session.uuid)

    def _events(self, name):
        return [r for r in self.collector.records if r.getMessage() == name]

    def test_creation_logs_started_with_upload_ref_and_actor_ref(self):
        response = self._create()

        self.assertEqual(response.status_code, 201)
        (record,) = self._events("cinematacms.upload.started")
        self.assertEqual(record.upload_ref, FILE_UUID)
        self.assertEqual(record.actor_ref, self.actor_ref)
        self.assertTrue(hasattr(record, "trace_id"))
        self.assertEqual(record.route_group, "upload_transfer")
        self.assertEqual(self._events("cinematacms.upload.finished"), [])

    def test_bytes_before_the_last_one_log_no_event(self):
        self._create()
        self.collector.records.clear()

        response = self._send(0, 8)

        self.assertEqual(response.status_code, 204)
        self.assertEqual(self._events("cinematacms.upload.started"), [])
        self.assertEqual(self._events("cinematacms.upload.finished"), [])

    def test_last_byte_logs_finished_with_upload_ref(self):
        self._create()

        response = self._send(0, 16)

        self.assertEqual(response.status_code, 204)
        (record,) = self._events("cinematacms.upload.finished")
        self.assertEqual(record.upload_ref, FILE_UUID)
        self.assertEqual(record.actor_ref, self.actor_ref)

    def test_malformed_upload_id_is_logged_as_empty(self):
        self._create(upload_id="not-an-id\r\nforged=1")

        (record,) = self._events("cinematacms.upload.started")
        self.assertEqual(record.upload_ref, "")


class UploadIdCorsTests(SimpleTestCase):
    def test_preflight_allows_the_upload_id_header(self):
        response = Client().options(
            "/fu/tus/",
            HTTP_ORIGIN="https://cinemata.org",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="x-csrftoken,x-upload-id",
        )

        allowed = response.headers.get("Access-Control-Allow-Headers", "").split(", ")
        self.assertIn("x-upload-id", allowed)
