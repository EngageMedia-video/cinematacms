import base64
import fcntl
import os
import shutil
import tempfile
import uuid
from datetime import timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from files.models import Media
from files.tasks import cleanup_orphaned_uploads
from uploader import sessions
from uploader.models import UploadSession
from uploader.test_upload_sessions import create_media
from users.models import User

CONTENT = b"0123456789"
FINGERPRINT = "a" * 64
TUS = {"HTTP_TUS_RESUMABLE": "1.0.0"}
OFFSET_TYPE = "application/offset+octet-stream"


def metadata(**values):
    return ",".join(f"{key} {base64.b64encode(value.encode()).decode()}" for key, value in values.items())


class TusTestCase(TestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media_root, ignore_errors=True)
        media_root = override_settings(MEDIA_ROOT=self.media_root)
        media_root.enable()
        self.addCleanup(media_root.disable)
        media_init = patch.object(Media, "media_init", return_value=None)
        media_init.start()
        self.addCleanup(media_init.stop)

        self.owner = User.objects.create_user(username="owner", email="owner@example.org")
        self.other = User.objects.create_user(username="other", email="other@example.org")
        for user in (self.owner, self.other):
            user.advancedUser = True
            user.save()
        self.client.force_login(self.owner)
        self.endpoint = reverse("uploader:tus")

    def create(self, *, length=10, endpoint=None, headers=TUS, **meta):
        meta = {"filename": "clip.mp4", "fingerprint": FINGERPRINT, **meta}
        return self.client.post(
            endpoint or self.endpoint, HTTP_UPLOAD_LENGTH=str(length), HTTP_UPLOAD_METADATA=metadata(**meta), **headers
        )

    def created_url(self, **kwargs):
        response = self.create(**kwargs)
        self.assertEqual(response.status_code, 201, response.content)
        return response["Location"]

    def patch_bytes(self, url, offset, body, *, content_type=OFFSET_TYPE, headers=TUS):
        # The test client drops the content type of an empty body unless it is passed as a header.
        return self.client.patch(
            url, body, content_type=content_type, CONTENT_TYPE=content_type, HTTP_UPLOAD_OFFSET=str(offset), **headers
        )

    def head(self, url):
        return self.client.head(url, **TUS)

    def stored_bytes(self, url):
        with open(sessions.data_path(self.session(url).uuid), "rb") as data:
            return data.read()

    def session(self, url):
        return UploadSession.objects.get(uuid=url.rstrip("/").rsplit("/", 1)[-1])


class ProtocolTests(TusTestCase):
    def test_options_advertises_the_version_the_supported_extensions_and_the_size_limit(self):
        with override_settings(UPLOAD_MAX_SIZE=1234):
            response = self.client.options(self.endpoint)

        self.assertEqual(response.status_code, 204)
        self.assertEqual(response["Tus-Resumable"], "1.0.0")
        self.assertEqual(response["Tus-Version"], "1.0.0")
        self.assertEqual(response["Tus-Extension"], "creation,expiration,termination")
        self.assertEqual(response["Tus-Max-Size"], "1234")

    def test_request_without_the_supported_version_is_not_processed(self):
        for headers in ({}, {"HTTP_TUS_RESUMABLE": "0.2.2"}):
            with self.subTest(headers=headers):
                response = self.create(headers=headers)

                self.assertEqual(response.status_code, 412)
                self.assertEqual(response["Tus-Version"], "1.0.0")
        self.assertFalse(UploadSession.objects.exists())

    def test_creation_returns_the_upload_location_and_its_expiry(self):
        response = self.create()

        self.assertEqual(response.status_code, 201)
        session = UploadSession.objects.get()
        self.assertEqual(response["Location"], f"/fu/tus/{session.uuid}/")
        self.assertIn("GMT", response["Upload-Expires"])
        self.assertEqual(response["Tus-Resumable"], "1.0.0")
        self.assertEqual((session.user, session.filename, session.total_size), (self.owner, "clip.mp4", 10))

    def test_head_reports_offset_length_and_metadata_uncached(self):
        url = self.created_url()
        self.patch_bytes(url, 0, CONTENT[:4])

        response = self.head(url)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Upload-Offset"], "4")
        self.assertEqual(response["Upload-Length"], "10")
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(response["Upload-Metadata"], metadata(filename="clip.mp4", fingerprint=FINGERPRINT))

    def test_patch_appends_and_answers_with_the_new_offset(self):
        url = self.created_url()

        response = self.patch_bytes(url, 0, CONTENT[:4])

        self.assertEqual(response.status_code, 204)
        self.assertEqual(response["Upload-Offset"], "4")
        self.assertIn("GMT", response["Upload-Expires"])
        self.assertEqual(self.stored_bytes(url), b"0123")

    def test_post_with_method_override_is_handled_as_patch(self):
        url = self.created_url()

        response = self.client.post(
            url,
            CONTENT[:4],
            content_type=OFFSET_TYPE,
            HTTP_UPLOAD_OFFSET="0",
            HTTP_X_HTTP_METHOD_OVERRIDE="PATCH",
            **TUS,
        )

        self.assertEqual(response.status_code, 204)
        self.assertEqual(self.stored_bytes(url), b"0123")

    def test_bad_requests_are_refused_without_storing_bytes(self):
        url = self.created_url()
        self.patch_bytes(url, 0, CONTENT[:4])
        cases = [
            ("offset behind the upload", lambda: self.patch_bytes(url, 0, b"zzzz"), 409),
            ("offset ahead of the upload", lambda: self.patch_bytes(url, 6, b"zzzz"), 409),
            ("more bytes than the length", lambda: self.patch_bytes(url, 4, b"z" * 7), 413),
            ("wrong content type", lambda: self.patch_bytes(url, 4, b"zz", content_type="application/json"), 415),
            ("missing offset", lambda: self.client.patch(url, b"zz", content_type=OFFSET_TYPE, **TUS), 400),
        ]
        for name, send, status in cases:
            with self.subTest(name):
                response = send()

                self.assertEqual(response.status_code, status, response.content)
                self.assertEqual(response["Tus-Resumable"], "1.0.0")
                self.assertEqual(self.stored_bytes(url), b"0123")

    def test_creation_validates_length_metadata_and_file_type(self):
        cases = [
            (
                "no length",
                lambda: self.client.post(self.endpoint, HTTP_UPLOAD_METADATA=metadata(filename="a.mp4"), **TUS),
                400,
            ),
            ("empty file", lambda: self.create(length=0), 400),
            ("no filename", lambda: self.client.post(self.endpoint, HTTP_UPLOAD_LENGTH="10", **TUS), 400),
            (
                "undecodable metadata",
                lambda: self.client.post(
                    self.endpoint, HTTP_UPLOAD_LENGTH="10", HTTP_UPLOAD_METADATA="filename !!!", **TUS
                ),
                400,
            ),
            (
                "deferred length",
                lambda: self.client.post(
                    self.endpoint, HTTP_UPLOAD_DEFER_LENGTH="1", HTTP_UPLOAD_METADATA=metadata(filename="a.mp4"), **TUS
                ),
                400,
            ),
            ("file type not allowed", lambda: self.create(filename="notes.exe"), 400),
        ]
        for name, send, status in cases:
            with self.subTest(name):
                self.assertEqual(send().status_code, status)
        self.assertFalse(UploadSession.objects.exists())

    def test_file_over_the_size_limit_is_refused_at_creation(self):
        with override_settings(UPLOAD_MAX_SIZE=9):
            response = self.create()

        self.assertEqual(response.status_code, 413)
        self.assertFalse(UploadSession.objects.exists())

    def test_limit_lowered_during_the_transfer_refuses_further_bytes(self):
        url = self.created_url()
        self.patch_bytes(url, 0, CONTENT[:4])

        with override_settings(UPLOAD_MAX_SIZE=9):
            response = self.patch_bytes(url, 4, CONTENT[4:])

        self.assertEqual(response.status_code, 413)
        self.assertEqual(self.stored_bytes(url), b"0123")

    def test_file_at_the_size_limit_is_accepted(self):
        with override_settings(UPLOAD_MAX_SIZE=10):
            self.assertEqual(self.create().status_code, 201)


class CompletionTests(TusTestCase):
    def upload_all(self, url, pieces=(CONTENT[:4], CONTENT[4:8], CONTENT[8:])):
        offset = 0
        for piece in pieces:
            response = self.patch_bytes(url, offset, piece)
            self.assertEqual(response.status_code, 204, response.content)
            offset += len(piece)
        return response

    def test_final_patch_creates_one_media_with_the_source_bytes(self):
        url = self.created_url()

        response = self.upload_all(url)

        media = Media.objects.get(user=self.owner)
        self.assertEqual(response["Upload-Offset"], "10")
        self.assertEqual(response["X-Media-Url"], media.get_absolute_url())
        with media.media_file.open("rb") as stored:
            self.assertEqual(stored.read(), CONTENT)
        self.assertFalse(media.is_draft)
        self.assertEqual(self.session(url).status, UploadSession.Status.COMPLETE)
        self.assertFalse(os.path.exists(sessions.chunks_dir(self.session(url).uuid)))

    def test_draft_metadata_creates_a_draft_media(self):
        url = self.created_url(is_draft="1")

        self.upload_all(url)

        self.assertTrue(Media.objects.get(user=self.owner).is_draft)

    def test_repeated_final_request_and_head_return_the_first_media(self):
        url = self.created_url()
        first = self.upload_all(url)

        repeated = self.patch_bytes(url, 10, b"")
        head = self.head(url)

        self.assertEqual(repeated.status_code, 204)
        self.assertEqual(repeated["X-Media-Url"], first["X-Media-Url"])
        self.assertEqual(head["Upload-Offset"], "10")
        self.assertEqual(head["X-Media-Url"], first["X-Media-Url"])
        self.assertEqual(Media.objects.filter(user=self.owner).count(), 1)

    def test_late_patch_at_an_earlier_offset_after_completion_is_a_conflict(self):
        url = self.created_url()
        self.upload_all(url)

        response = self.patch_bytes(url, 4, CONTENT[4:])

        self.assertEqual(response.status_code, 409)
        self.assertEqual(Media.objects.filter(user=self.owner).count(), 1)

    def test_head_finishes_an_upload_whose_completion_never_ran(self):
        url = self.created_url()
        self.patch_bytes(url, 0, CONTENT[:4])
        with open(sessions.data_path(self.session(url).uuid), "ab") as data:
            data.write(CONTENT[4:])  # the bytes landed, then the worker died before completing

        response = self.head(url)

        media = Media.objects.get(user=self.owner)
        self.assertEqual(response["X-Media-Url"], media.get_absolute_url())
        with media.media_file.open("rb") as stored:
            self.assertEqual(stored.read(), CONTENT)

    def test_upload_being_assembled_answers_locked(self):
        url = self.created_url()
        self.patch_bytes(url, 0, CONTENT)
        UploadSession.objects.update(status=UploadSession.Status.ASSEMBLING, updated_at=timezone.now())

        self.assertEqual(self.head(url).status_code, 423)
        self.assertEqual(self.patch_bytes(url, 10, b"").status_code, 423)
        self.assertEqual(Media.objects.filter(user=self.owner).count(), 1)

    def test_failed_media_creation_ends_the_upload_without_a_second_media(self):
        url = self.created_url()
        with patch("uploader.tus_views.create_media_from_upload", side_effect=RuntimeError("boom")):
            with self.assertRaises(RuntimeError):
                self.upload_all(url)

        self.assertEqual(self.session(url).status, UploadSession.Status.FAILED)
        self.assertEqual(self.head(url).status_code, 410)
        self.assertEqual(self.patch_bytes(url, 10, b"").status_code, 410)
        self.assertFalse(Media.objects.exists())

    def test_replacement_upload_stages_the_file_for_its_media_only(self):
        media = create_media(self.owner, "Mine")
        endpoint = reverse("uploader:tus_update", kwargs={"friendly_token": media.friendly_token})
        url = self.created_url(endpoint=endpoint)

        response = self.upload_all(url)

        self.assertEqual(url, f"/fu/tus/update/{media.friendly_token}/{self.session(url).uuid}/")
        self.assertEqual(response["X-Media-Url"], media.get_absolute_url())
        staged = self.client.session[f"media_file_updated_{media.friendly_token}"]
        with open(staged["temp_file_path"], "rb") as stored:
            self.assertEqual(stored.read(), CONTENT)
        self.assertEqual(Media.objects.count(), 1)
        # The same upload is absent under the new-media endpoint.
        self.assertEqual(self.head(f"/fu/tus/{self.session(url).uuid}/").status_code, 404)


class ResumeTests(TusTestCase):
    def lookup(self, **overrides):
        query = {"filename": "clip.mp4", "total_size": 10, "fingerprint": FINGERPRINT, **overrides}
        return self.client.get(self.endpoint, query)

    def test_lookup_returns_the_unfinished_upload_and_its_offset(self):
        url = self.created_url()
        self.patch_bytes(url, 0, CONTENT[:4])

        response = self.lookup()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"uploads": [{"url": url, "size": 10, "offset": 4}]})

    def test_lookup_finds_nothing_for_another_file_account_or_target(self):
        url = self.created_url()
        media = create_media(self.owner, "Mine")
        cases = {
            "another fingerprint": lambda: self.lookup(fingerprint="b" * 64),
            "another size": lambda: self.lookup(total_size=11),
            "another name": lambda: self.lookup(filename="other.mp4"),
            "replacement target": lambda: self.client.get(
                reverse("uploader:tus_update", kwargs={"friendly_token": media.friendly_token}),
                {"filename": "clip.mp4", "total_size": 10, "fingerprint": FINGERPRINT},
            ),
        }
        for name, send in cases.items():
            with self.subTest(name):
                self.assertEqual(send().json(), {"uploads": []})
        self.client.force_login(self.other)
        self.assertEqual(self.lookup().json(), {"uploads": []})
        self.assertEqual(self.session(url).status, UploadSession.Status.OPEN)

    def test_lookup_ignores_finished_and_cancelled_uploads(self):
        for status in (UploadSession.Status.COMPLETE, UploadSession.Status.CANCELLED, UploadSession.Status.FAILED):
            with self.subTest(status):
                self.created_url()
                UploadSession.objects.update(status=status)

                self.assertEqual(self.lookup().json(), {"uploads": []})

    def test_bytes_survive_between_requests_and_resume_from_the_server_offset(self):
        url = self.created_url()
        self.patch_bytes(url, 0, CONTENT[:4])
        # A lost response: the client believes nothing was stored and asks the server.
        offset = int(self.head(url)["Upload-Offset"])

        response = self.patch_bytes(url, offset, CONTENT[offset:])

        self.assertEqual(response.status_code, 204)
        with Media.objects.get(user=self.owner).media_file.open("rb") as stored:
            self.assertEqual(stored.read(), CONTENT)

    def test_interrupted_body_keeps_the_bytes_that_arrived(self):
        url = self.created_url()

        class BrokenStream:
            pieces = [b"0123", OSError("connection lost")]

            def read(self, size):
                piece = self.pieces.pop(0)
                if isinstance(piece, Exception):
                    raise piece
                return piece

        from uploader import tus

        with self.assertRaises(OSError):
            tus.append(self.session(url), 0, BrokenStream())

        self.assertEqual(self.head(url)["Upload-Offset"], "4")

    def test_second_writer_is_locked_out_while_a_request_appends(self):
        url = self.created_url()
        with open(sessions.data_path(self.session(url).uuid), "r+b") as held:
            fcntl.flock(held, fcntl.LOCK_EX)

            response = self.patch_bytes(url, 0, CONTENT[:4])

        self.assertEqual(response.status_code, 423)
        self.assertEqual(self.stored_bytes(url), b"")


class OwnershipTests(TusTestCase):
    def test_signed_out_requests_get_401_and_keep_the_upload(self):
        url = self.created_url()
        self.patch_bytes(url, 0, CONTENT[:4])
        self.client.logout()

        responses = [
            self.head(url),
            self.patch_bytes(url, 4, CONTENT[4:]),
            self.create(),
            self.client.delete(url, **TUS),
        ]

        self.assertEqual([response.status_code for response in responses], [401, 401, 401, 401])
        self.client.force_login(self.owner)
        self.assertEqual(self.head(url)["Upload-Offset"], "4")

    def test_owner_resumes_after_signing_in_again(self):
        url = self.created_url()
        self.patch_bytes(url, 0, CONTENT[:4])
        self.client.logout()
        self.client.force_login(self.owner)

        response = self.patch_bytes(url, 4, CONTENT[4:])

        self.assertEqual(response.status_code, 204)
        self.assertEqual(Media.objects.filter(user=self.owner).count(), 1)

    def test_another_account_cannot_read_extend_or_cancel_the_upload(self):
        url = self.created_url()
        self.patch_bytes(url, 0, CONTENT[:4])
        self.client.force_login(self.other)

        responses = [self.head(url), self.patch_bytes(url, 4, CONTENT[4:]), self.client.delete(url, **TUS)]

        self.assertEqual([response.status_code for response in responses], [404, 404, 404])
        self.assertEqual(self.stored_bytes(url), b"0123")
        self.assertEqual(self.session(url).status, UploadSession.Status.OPEN)

    def test_account_that_may_not_upload_gets_403(self):
        self.owner.advancedUser = False
        self.owner.save()

        with override_settings(CAN_ADD_MEDIA="advancedUser"):
            response = self.create()

        self.assertEqual(response.status_code, 403)
        self.assertEqual(response["Tus-Resumable"], "1.0.0")

    def test_replacement_upload_needs_permission_on_the_media(self):
        media = create_media(self.other, "Theirs")

        response = self.create(endpoint=reverse("uploader:tus_update", kwargs={"friendly_token": media.friendly_token}))

        self.assertEqual(response.status_code, 403)
        self.assertFalse(UploadSession.objects.exists())

    def test_chunked_upload_id_is_not_a_tus_upload(self):
        chunked = UploadSession.objects.create(
            uuid=uuid.uuid4(), user=self.owner, filename="clip.mp4", total_size=10, part_size=4, total_parts=3
        )

        self.assertEqual(self.head(f"/fu/tus/{chunked.uuid}/").status_code, 404)


class TerminationAndExpiryTests(TusTestCase):
    def test_delete_discards_the_upload_and_later_requests_get_410(self):
        url = self.created_url()
        self.patch_bytes(url, 0, CONTENT[:4])
        directory = sessions.chunks_dir(self.session(url).uuid)

        response = self.client.delete(url, **TUS)

        self.assertEqual(response.status_code, 204)
        self.assertFalse(os.path.exists(directory))
        self.assertEqual(self.head(url).status_code, 410)
        self.assertEqual(self.patch_bytes(url, 4, CONTENT[4:]).status_code, 410)
        self.assertFalse(Media.objects.exists())

    def test_upload_untouched_for_the_retention_period_expires(self):
        url = self.created_url()
        self.patch_bytes(url, 0, CONTENT[:4])
        directory = sessions.chunks_dir(self.session(url).uuid)
        UploadSession.objects.update(updated_at=timezone.now() - timedelta(hours=25))

        with override_settings(ORPHANED_UPLOAD_CLEANUP_HOURS=24):
            response = self.patch_bytes(url, 4, CONTENT[4:])

        self.assertEqual(response.status_code, 410)
        self.assertEqual(self.session(url).status, UploadSession.Status.EXPIRED)
        self.assertFalse(os.path.exists(directory))

    def test_cleanup_deletes_stale_uploads_with_their_bytes(self):
        url = self.created_url()
        self.patch_bytes(url, 0, CONTENT[:4])
        directory = sessions.chunks_dir(self.session(url).uuid)
        UploadSession.objects.update(updated_at=timezone.now() - timedelta(hours=25))

        with override_settings(ORPHANED_UPLOAD_CLEANUP_HOURS=24):
            cleanup_orphaned_uploads()

        self.assertFalse(UploadSession.objects.exists())
        self.assertFalse(os.path.exists(directory))
