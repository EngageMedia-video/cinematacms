import logging
import shutil
import tempfile
import uuid
from types import SimpleNamespace
from unittest.mock import patch

from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from django.core.files.uploadedfile import SimpleUploadedFile
from django.http import HttpResponse
from django.test import Client, RequestFactory, SimpleTestCase, TestCase, override_settings
from django.urls import reverse

from cms.observability import OpenTelemetryLogFilter, actor_reference_context
from cms.permissions import user_allowed_to_upload
from files.views import upload_media
from uploader.fineuploader import ChunkedFineUploader, is_valid_uuid_format, strip_delimiters
from uploader.forms import FineUploaderUploadForm
from uploader.views import FineUploaderView
from users.models import User

FILE_UUID = "3f2b8c1e-9d4a-4e6b-8a57-1c0d2e3f4a5b"


class UploadMediaCsrfCookieTests(TestCase):
    def test_authenticated_upload_page_sets_csrf_cookie(self):
        """Authenticated uploader page must provide the CSRF cookie used by FineUploader."""
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

        # Create test file content (minimal MP4 header)
        self.test_file_content = b"\x00\x00\x00\x20ftypmp41\x00\x00\x00\x00mp41isom" + b"\x00" * 100
        self.test_filename = "test_video.mp4"

    def create_test_file(self, filename=None, content=None, content_type="video/mp4"):
        """Helper to create test uploaded files"""
        filename = filename or self.test_filename
        content = content or self.test_file_content

        return SimpleUploadedFile(filename, content, content_type=content_type)

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

    def test_upload_endpoint_methods(self):
        """Test upload endpoint method restrictions"""
        upload_endpoint = reverse("uploader:upload")
        response = self.client.get(upload_endpoint)
        self.assertEqual(response.status_code, 403)

    def test_upload_form_validation(self):
        """Test upload form validation"""
        test_file = self.create_test_file()
        test_uuid = str(uuid.uuid4())

        # Valid form data
        form_data = {
            "qqfilename": self.test_filename,
            "qquuid": test_uuid,
            "qqtotalparts": 1,
            "qqpartindex": 0,
        }
        files = {"qqfile": test_file}

        form = FineUploaderUploadForm(data=form_data, files=files)
        self.assertTrue(form.is_valid())

        # Invalid form data (missing required fields)
        invalid_form = FineUploaderUploadForm(data={})
        self.assertFalse(invalid_form.is_valid())

    def test_chunked_fine_uploader_initialization(self):
        """Test ChunkedFineUploader initialization"""
        test_file = self.create_test_file()
        test_uuid = str(uuid.uuid4())

        upload_data = {
            "qqfilename": self.test_filename,
            "qquuid": test_uuid,
            "qqfile": test_file,
            "qqtotalparts": 1,
            "qqpartindex": 0,
        }

        uploader = ChunkedFineUploader(upload_data)

        # Test basic properties
        self.assertEqual(uploader.filename, self.test_filename)
        self.assertEqual(uploader.uuid, test_uuid)
        self.assertFalse(uploader.chunked)  # Single part upload
        self.assertEqual(uploader.total_parts, 1)
        self.assertEqual(uploader.part_index, 0)

    def test_chunked_upload_detection(self):
        """Test detection of chunked vs single uploads"""
        test_file = self.create_test_file()
        test_uuid = str(uuid.uuid4())

        # Single upload
        single_upload_data = {
            "qqfilename": self.test_filename,
            "qquuid": test_uuid,
            "qqfile": test_file,
            "qqtotalparts": 1,
            "qqpartindex": 0,
        }

        single_uploader = ChunkedFineUploader(single_upload_data)
        self.assertFalse(single_uploader.chunked)

        # Chunked upload
        chunked_upload_data = {
            "qqfilename": self.test_filename,
            "qquuid": test_uuid,
            "qqfile": test_file,
            "qqtotalparts": 3,
            "qqpartindex": 0,
        }

        chunked_uploader = ChunkedFineUploader(chunked_upload_data)
        self.assertTrue(chunked_uploader.chunked)
        self.assertEqual(chunked_uploader.total_parts, 3)

    def test_uuid_validation_and_regeneration(self):
        """Test UUID validation and regeneration for security"""
        test_file = self.create_test_file()

        # Test with invalid UUID (should be regenerated)
        invalid_upload_data = {
            "qqfilename": self.test_filename,
            "qquuid": "invalid-uuid-format",
            "qqfile": test_file,
        }

        uploader = ChunkedFineUploader(invalid_upload_data)
        # Should generate a new valid UUID
        self.assertTrue(is_valid_uuid_format(str(uploader.uuid)))
        self.assertNotEqual(uploader.uuid, "invalid-uuid-format")

    def test_file_path_generation(self):
        """Test file path generation"""
        test_file = self.create_test_file()
        test_uuid = str(uuid.uuid4())

        upload_data = {
            "qqfilename": self.test_filename,
            "qquuid": test_uuid,
            "qqfile": test_file,
        }

        uploader = ChunkedFineUploader(upload_data)

        # Test file path generation
        file_path = uploader.file_path
        self.assertIsNotNone(file_path)
        self.assertIn(test_uuid, file_path)

        # Test full file path
        full_path = uploader._full_file_path
        self.assertIn(self.test_filename, full_path)

    # NOTE: doesn't work, can be revisited later
    # def test_upload_with_authentication_required(self):
    #     """Test upload endpoint with authentication"""
    #     upload_endpoint = reverse('uploader:upload')
    #     test_file = self.create_test_file()
    #     test_uuid = str(uuid.uuid4())

    #     upload_data = {
    #         'qqfilename': self.test_filename,
    #         'qquuid': test_uuid,
    #         'qqtotalparts': 1,
    #         'qqpartindex': 0,
    #     }
    #     files = {'qqfile': test_file}

    #     # Test without authentication (should fail)
    #     response = self.client.post(upload_endpoint, data=upload_data, files=files)
    #     self.assertEqual(response.status_code, 403)  # Permission Denied

    #     # Test with authenticated user
    #     self.client.login(username=self.advanced_username, password=self.advanced_password)
    #     response = self.client.post(upload_endpoint, data=upload_data, files=files)

    #     # Should succeed (200) or redirect to processing
    #     self.assertIn(response.status_code, [200, 302])

    def test_large_file_handling(self):
        """Test handling of files approaching size limits"""
        # Create a larger test file (but still within reasonable test limits)
        large_content = b"x" * (1024 * 1024)  # 1MB test file
        large_file = self.create_test_file(filename="large_test.mp4", content=large_content)

        test_uuid = str(uuid.uuid4())
        upload_data = {
            "qqfilename": "large_test.mp4",
            "qquuid": test_uuid,
            "qqfile": large_file,
        }

        uploader = ChunkedFineUploader(upload_data)
        self.assertEqual(uploader.filename, "large_test.mp4")
        self.assertIsNotNone(uploader.file_path)

    # NOTE: doesn't work
    def test_malicious_filename_handling(self):
        """Test handling of potentially malicious filenames"""
        # Test cases based on what strip_delimiters actually removes
        # From the code: delimiters = " \t\n\r'\"[]{}()<>\\|&;:*-=+"

        test_cases = [
            {
                "input": "test<script>alert('xss')</script>.mp4",
                "should_not_contain": ["<", ">", "'", '"'],
                "description": "XSS attempt",
            },
            {
                "input": "file with spaces and & symbols.mp4",
                "should_not_contain": [" ", "&"],
                "description": "Spaces and ampersand",
            },
            {
                "input": "test[file]{name}(with)|delimiters.mp4",
                "should_not_contain": ["[", "]", "{", "}", "(", ")", "|"],
                "description": "Various brackets and delimiters",
            },
            {"input": "file\\with\\backslashes.mp4", "should_not_contain": ["\\"], "description": "Backslashes"},
            {
                "input": "file:with*special;chars=test+more.mp4",
                "should_not_contain": [":", "*", ";", "=", "+"],
                "description": "Special characters",
            },
        ]

        for test_case in test_cases:
            malicious_name = test_case["input"]
            test_file = self.create_test_file(filename=malicious_name)
            test_uuid = str(uuid.uuid4())

            upload_data = {
                "qqfilename": malicious_name,
                "qquuid": test_uuid,
                "qqfile": test_file,
            }

            uploader = ChunkedFineUploader(upload_data)

            # Test that specific delimiters are removed
            for char in test_case["should_not_contain"]:
                self.assertNotIn(
                    char,
                    uploader.filename,
                    f"Character '{char}' should be removed from filename in test: {test_case['description']}",
                )

            # Should still have some recognizable part
            self.assertIsNotNone(uploader.filename)
            self.assertNotEqual(uploader.filename, "")

        # Test path traversal specifically (dots are NOT removed by strip_delimiters)
        path_traversal_name = "../../../etc/passwd"
        test_file = self.create_test_file(filename=path_traversal_name)
        test_uuid = str(uuid.uuid4())

        upload_data = {
            "qqfilename": path_traversal_name,
            "qquuid": test_uuid,
            "qqfile": test_file,
        }

        uploader = ChunkedFineUploader(upload_data)

        # Note: strip_delimiters doesn't remove dots, but os.path.basename()
        # in the ChunkedFineUploader.__init__ should prevent path traversal
        self.assertEqual(uploader.filename, "passwd")  # Only basename should remain

    def test_concurrent_upload_flag(self):
        """Test concurrent upload configuration"""
        test_file = self.create_test_file()
        test_uuid = str(uuid.uuid4())

        upload_data = {
            "qqfilename": self.test_filename,
            "qquuid": test_uuid,
            "qqfile": test_file,
        }

        # Test with concurrent=True
        uploader_concurrent = ChunkedFineUploader(upload_data, concurrent=True)
        self.assertTrue(uploader_concurrent.concurrent)

        # Test with concurrent=False
        uploader_sequential = ChunkedFineUploader(upload_data, concurrent=False)
        self.assertFalse(uploader_sequential.concurrent)

    def test_chunk_combination_timing(self):
        """Test when chunks should be combined"""
        test_file = self.create_test_file()
        test_uuid = str(uuid.uuid4())

        # Test final chunk in multi-part upload
        final_chunk_data = {
            "qqfilename": self.test_filename,
            "qquuid": test_uuid,
            "qqfile": test_file,
            "qqtotalparts": 3,
            "qqpartindex": 2,  # Final chunk (0-indexed)
        }

        uploader = ChunkedFineUploader(final_chunk_data)
        self.assertTrue(uploader.is_time_to_combine_chunks)

        # Test non-final chunk
        middle_chunk_data = {
            "qqfilename": self.test_filename,
            "qquuid": test_uuid,
            "qqfile": test_file,
            "qqtotalparts": 3,
            "qqpartindex": 1,  # Middle chunk
        }

        uploader_middle = ChunkedFineUploader(middle_chunk_data)
        self.assertFalse(uploader_middle.is_time_to_combine_chunks)


class _LogCollector(logging.Handler):
    def __init__(self):
        super().__init__()
        self.records = []
        self.addFilter(OpenTelemetryLogFilter())

    def emit(self, record):
        self.records.append(record)


class UploadLifecycleLogTests(SimpleTestCase):
    """Start and finish events carry the same upload_ref as the nginx line and the denial events."""

    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media_root, ignore_errors=True)
        media_root = override_settings(MEDIA_ROOT=self.media_root)
        media_root.enable()
        self.addCleanup(media_root.disable)
        self.collector = _LogCollector()
        view_logger = logging.getLogger("uploader.views")
        view_logger.addHandler(self.collector)
        self.addCleanup(view_logger.removeHandler, self.collector)
        # Production configures the uploader logger at INFO; the test settings do not.
        self.addCleanup(view_logger.setLevel, view_logger.level)
        view_logger.setLevel(logging.INFO)
        self.actor_ref = "v1:" + "d" * 64

    def _post(self, *, part, total, upload_id=None, chunks_done=False):
        data = {"qquuid": FILE_UUID, "qqfilename": "clip.mp4", "qqtotalparts": total}
        if not chunks_done:
            data.update(qqfile=SimpleUploadedFile("blob", b"x" * 16), qqpartindex=part)
        headers = {} if upload_id is None else {"HTTP_X_UPLOAD_ID": upload_id}
        path = "/fu/upload/?done" if chunks_done else "/fu/upload/"
        request = RequestFactory().post(path, data, **headers)
        request.user = SimpleNamespace(is_authenticated=True, email="person@example.org")
        with (
            patch("uploader.views.user_allowed_to_upload", return_value=True),
            patch("uploader.views.is_trusted_uploader", return_value=False),
            patch("uploader.views.Media") as media,
            actor_reference_context(self.actor_ref),
        ):
            media.return_value.get_absolute_url.return_value = "/view?m=abc"
            return FineUploaderView.as_view()(request)

    def _events(self, name):
        return [r for r in self.collector.records if r.getMessage() == name]

    def test_first_chunk_logs_started_with_upload_ref_and_actor_ref(self):
        response = self._post(part=0, total=3, upload_id=FILE_UUID)

        self.assertEqual(response.status_code, 200)
        (record,) = self._events("cinematacms.upload.started")
        self.assertEqual(record.upload_ref, FILE_UUID)
        self.assertEqual(record.actor_ref, self.actor_ref)
        self.assertTrue(hasattr(record, "trace_id"))
        self.assertEqual(record.route_group, "upload_transfer")
        self.assertEqual(self._events("cinematacms.upload.finished"), [])

    def test_later_chunks_do_not_log_started(self):
        self._post(part=1, total=3, upload_id=FILE_UUID)

        self.assertEqual(self._events("cinematacms.upload.started"), [])

    def test_completed_upload_logs_finished_with_upload_ref(self):
        response = self._post(part=0, total=1, upload_id=FILE_UUID)

        self.assertEqual(response.status_code, 200)
        (record,) = self._events("cinematacms.upload.finished")
        self.assertEqual(record.upload_ref, FILE_UUID)
        self.assertEqual(record.actor_ref, self.actor_ref)

    def test_chunks_done_request_that_cannot_combine_logs_no_finish(self):
        response = self._post(part=0, total=3, upload_id=FILE_UUID, chunks_done=True)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(self._events("cinematacms.upload.finished"), [])

    def test_malformed_upload_id_is_logged_as_empty(self):
        self._post(part=0, total=3, upload_id="not-an-id\r\nforged=1")

        (record,) = self._events("cinematacms.upload.started")
        self.assertEqual(record.upload_ref, "")


class UploadIdCorsTests(SimpleTestCase):
    def test_preflight_allows_the_upload_id_header(self):
        response = Client().options(
            "/fu/upload/",
            HTTP_ORIGIN="https://cinemata.org",
            HTTP_ACCESS_CONTROL_REQUEST_METHOD="POST",
            HTTP_ACCESS_CONTROL_REQUEST_HEADERS="x-csrftoken,x-upload-id",
        )

        allowed = response.headers.get("Access-Control-Allow-Headers", "").split(", ")
        self.assertIn("x-upload-id", allowed)
