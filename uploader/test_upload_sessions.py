import os
import shutil
import tempfile
import uuid
from datetime import timedelta
from unittest.mock import patch

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from files.models import Media
from files.tasks import cleanup_orphaned_uploads
from uploader import sessions
from uploader.models import UploadSession
from users.models import User

CONTENT = b"0123456789"  # 10 bytes in parts of 4, 4 and 2
PART_SIZE = 4
FINGERPRINT = "a" * 64
OTHER_FINGERPRINT = "b" * 64


def create_media(user, title):
    with patch.object(Media, "media_init", return_value=None):
        return Media.objects.create(title=title, user=user, media_type="video")


class UploadSessionTestCase(TestCase):
    def setUp(self):
        self.media_root = tempfile.mkdtemp()
        self.addCleanup(shutil.rmtree, self.media_root, ignore_errors=True)
        media_root = override_settings(MEDIA_ROOT=self.media_root, UPLOAD_PART_SIZE=PART_SIZE)
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
        self.upload_uuid = str(uuid.uuid4())

    def chunk_data(self, index, *, content=CONTENT, part_size=PART_SIZE, fingerprint=FINGERPRINT, **overrides):
        start = index * part_size
        piece = content[start : start + part_size]
        data = {
            "qquuid": self.upload_uuid,
            "qqfilename": "clip.mp4",
            "qqtotalparts": -(-len(content) // part_size),
            "qqtotalfilesize": len(content),
            "qqpartindex": index,
            "qqchunksize": len(piece),
            "qqpartbyteoffset": start,
            "qqfingerprint": fingerprint,
            "qqfile": SimpleUploadedFile("blob", piece),
        }
        data.update(overrides)
        return data

    def post_chunk(self, index, *, endpoint=None, **kwargs):
        return self.client.post(endpoint or reverse("uploader:upload"), self.chunk_data(index, **kwargs))

    def post_all_chunks(self, endpoint=None, order=(0, 1, 2)):
        for index in order:
            response = self.post_chunk(index, endpoint=endpoint)
            self.assertEqual(response.status_code, 200, response.content)

    def complete(self, endpoint=None, upload_uuid=None):
        endpoint = endpoint or reverse("uploader:upload")
        data = {"qquuid": upload_uuid or self.upload_uuid, "qqfilename": "clip.mp4", "qqtotalparts": 3}
        return self.client.post(f"{endpoint}?done", data)

    def chunk_files(self):
        directory = sessions.chunks_dir(self.upload_uuid)
        return sorted(os.listdir(directory)) if os.path.isdir(directory) else []

    def session(self):
        return UploadSession.objects.get(uuid=self.upload_uuid)


class ChunkAndCompletionTests(UploadSessionTestCase):
    def test_out_of_order_chunks_complete_into_one_media_with_the_original_bytes(self):
        self.post_all_chunks(order=(2, 0, 1))

        response = self.complete()

        self.assertEqual(response.status_code, 200, response.content)
        media = Media.objects.get(user=self.owner)
        self.assertEqual(response.json(), {"success": True, "media_url": media.get_absolute_url()})
        with media.media_file.open("rb") as stored:
            self.assertEqual(stored.read(), CONTENT)
        self.assertEqual(self.chunk_files(), [])
        self.assertEqual(self.session().status, UploadSession.Status.COMPLETE)

    def test_repeated_completion_returns_the_first_media_without_creating_another(self):
        self.post_all_chunks()

        first = self.complete()
        second = self.complete()

        self.assertEqual(first.status_code, 200)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.json(), first.json())
        self.assertEqual(Media.objects.filter(user=self.owner).count(), 1)

    def test_a_repeated_chunk_replaces_its_earlier_copy(self):
        self.post_chunk(0, content=b"XXXX456789")
        self.post_all_chunks()

        self.assertEqual(self.chunk_files(), ["0", "1", "2"])
        self.assertEqual(self.complete().status_code, 200)
        with Media.objects.get(user=self.owner).media_file.open("rb") as stored:
            self.assertEqual(stored.read(), CONTENT)

    def test_a_chunk_repeated_after_completion_changes_nothing(self):
        self.post_all_chunks()
        self.complete()

        response = self.post_chunk(1)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.chunk_files(), [])
        self.assertEqual(Media.objects.filter(user=self.owner).count(), 1)

    def test_another_account_cannot_add_chunks_to_the_upload(self):
        self.post_chunk(0)
        self.client.force_login(self.other)

        response = self.post_chunk(1)

        self.assertEqual(response.status_code, 403)
        self.assertTrue(response.json()["preventRetry"])
        self.assertEqual(self.chunk_files(), ["0"])

    def test_another_account_cannot_complete_or_cancel_the_upload(self):
        self.post_all_chunks()
        self.client.force_login(self.other)

        completed = self.complete()
        cancelled = self.client.delete(reverse("uploader:session", args=[self.upload_uuid]))

        self.assertEqual(completed.status_code, 404)
        self.assertEqual(cancelled.status_code, 404)
        self.assertEqual(Media.objects.count(), 0)
        self.assertEqual(self.session().status, UploadSession.Status.OPEN)
        self.assertEqual(self.chunk_files(), ["0", "1", "2"])

    def test_chunks_of_a_different_file_are_refused(self):
        cases = [
            ("fingerprint", {"fingerprint": OTHER_FINGERPRINT}),
            ("file name", {"qqfilename": "other.mp4"}),
            ("file size", {"content": CONTENT + b"ab"}),
        ]
        for label, change in cases:
            with self.subTest(label):
                self.upload_uuid = str(uuid.uuid4())
                self.post_chunk(0)

                response = self.post_chunk(1, **change)

                self.assertEqual(response.status_code, 409)
                self.assertEqual(response.json()["reset"], True)
                self.assertEqual(self.chunk_files(), ["0"])

    def test_a_chunk_that_does_not_fit_the_file_layout_is_refused(self):
        cases = [
            ("short body", {"qqfile": SimpleUploadedFile("blob", b"45")}),
            ("wrong offset", {"qqpartbyteoffset": 3}),
            ("index past the end", {"qqpartindex": 3}),
            ("missing total size", {"qqtotalfilesize": ""}),
            # Tiny parts would let one session claim billions of parts to check on disk.
            ("part size other than the fixed one", {"part_size": 1, "content": CONTENT[:3]}),
            ("file over the upload limit", {"qqtotalfilesize": 10**13, "qqtotalparts": 25 * 10**11}),
        ]
        for label, change in cases:
            with self.subTest(label):
                response = self.post_chunk(1, **change)

                self.assertEqual(response.status_code, 400)
                self.assertTrue(response.json()["preventRetry"])
                self.assertEqual(self.chunk_files(), [])

    def test_completion_with_a_missing_part_asks_for_a_retry_from_scratch(self):
        self.post_chunk(0)
        self.post_chunk(1)

        response = self.complete()

        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["reset"], True)
        self.assertFalse(response.json()["preventRetry"])
        self.assertEqual(Media.objects.count(), 0)

    def test_completion_of_an_unknown_upload_is_refused(self):
        response = self.complete()

        self.assertEqual(response.status_code, 404)
        self.assertTrue(response.json()["preventRetry"])

    def test_completion_while_another_request_assembles_is_retryable(self):
        self.post_all_chunks()
        UploadSession.objects.filter(uuid=self.upload_uuid).update(status=UploadSession.Status.ASSEMBLING)

        response = self.complete()

        self.assertEqual(response.status_code, 409)
        self.assertFalse(response.json()["preventRetry"])
        self.assertEqual(Media.objects.count(), 0)

    def test_an_assembly_abandoned_by_a_dead_worker_is_reclaimed(self):
        self.post_all_chunks()
        abandoned_at = timezone.now() - sessions.ASSEMBLY_TIMEOUT - timedelta(minutes=1)
        UploadSession.objects.filter(uuid=self.upload_uuid).update(
            status=UploadSession.Status.ASSEMBLING, updated_at=abandoned_at
        )

        response = self.complete()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Media.objects.filter(user=self.owner).count(), 1)

    def test_a_failed_assembly_leaves_the_upload_open_for_another_attempt(self):
        self.post_all_chunks()

        with patch.object(sessions, "_combine", side_effect=OSError("disk full")), self.assertRaises(OSError):
            sessions.complete(self.owner, None, self.upload_uuid, lambda assembly: "/view?m=never")

        self.assertEqual(self.session().status, UploadSession.Status.OPEN)
        self.assertEqual(self.chunk_files(), ["0", "1", "2"])
        self.assertEqual(self.complete().status_code, 200)
        self.assertEqual(Media.objects.filter(user=self.owner).count(), 1)

    def test_a_failure_after_the_media_is_saved_does_not_create_a_second_media_on_retry(self):
        self.post_all_chunks()
        save = Media.save

        def save_then_fail(media, *args, **kwargs):
            save(media, *args, **kwargs)
            raise ConnectionError("broker unavailable")

        self.client.raise_request_exception = False
        with patch.object(Media, "save", save_then_fail):
            failed = self.complete()
        retried = self.complete()

        self.assertEqual(failed.status_code, 500)
        self.assertEqual(retried.status_code, 409)
        self.assertEqual(retried.json()["error"], sessions.FAILED_MESSAGE)
        self.assertTrue(retried.json()["preventRetry"])
        self.assertEqual(Media.objects.filter(user=self.owner).count(), 1)
        self.assertEqual(self.session().status, UploadSession.Status.FAILED)


class CancellationAndExpiryTests(UploadSessionTestCase):
    def test_cancelling_discards_the_chunks_and_refuses_later_requests(self):
        self.post_chunk(0)

        response = self.client.delete(reverse("uploader:session", args=[self.upload_uuid]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"success": True, "status": "cancelled"})
        self.assertEqual(self.chunk_files(), [])
        late_chunk = self.post_chunk(1)
        self.assertEqual(late_chunk.status_code, 410)
        self.assertTrue(late_chunk.json()["preventRetry"])
        self.assertEqual(self.complete().status_code, 410)

    def test_an_upload_being_assembled_cannot_be_cancelled(self):
        self.post_all_chunks()
        UploadSession.objects.filter(uuid=self.upload_uuid).update(status=UploadSession.Status.ASSEMBLING)

        response = self.client.delete(reverse("uploader:session", args=[self.upload_uuid]))

        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.session().status, UploadSession.Status.ASSEMBLING)
        self.assertEqual(self.chunk_files(), ["0", "1", "2"])

    def test_completing_a_cancelled_upload_is_refused(self):
        self.post_all_chunks()
        self.client.delete(reverse("uploader:session", args=[self.upload_uuid]))

        response = self.complete()

        self.assertEqual(response.status_code, 410)
        self.assertEqual(Media.objects.count(), 0)

    def test_cancelling_a_completed_upload_keeps_its_media(self):
        self.post_all_chunks()
        self.complete()

        response = self.client.delete(reverse("uploader:session", args=[self.upload_uuid]))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "complete")
        self.assertEqual(Media.objects.filter(user=self.owner).count(), 1)

    def test_an_upload_untouched_past_retention_expires(self):
        self.post_chunk(0)
        UploadSession.objects.filter(uuid=self.upload_uuid).update(
            updated_at=timezone.now() - sessions.retention() - timedelta(minutes=1)
        )

        response = self.post_chunk(1)

        self.assertEqual(response.status_code, 410)
        self.assertEqual(response.json()["error"], sessions.EXPIRED_MESSAGE)
        self.assertEqual(self.session().status, UploadSession.Status.EXPIRED)
        self.assertEqual(self.chunk_files(), [])

    def test_cleanup_deletes_sessions_past_retention_with_their_chunks(self):
        self.post_chunk(0)
        stale_uuid = self.upload_uuid
        UploadSession.objects.filter(uuid=stale_uuid).update(
            updated_at=timezone.now() - sessions.retention() - timedelta(minutes=1)
        )
        self.upload_uuid = str(uuid.uuid4())
        self.post_chunk(0)

        result = cleanup_orphaned_uploads()

        self.assertEqual(result["sessions_deleted"], 1)
        self.assertFalse(UploadSession.objects.filter(uuid=stale_uuid).exists())
        self.assertFalse(os.path.exists(sessions.chunks_dir(stale_uuid)))
        self.assertTrue(UploadSession.objects.filter(uuid=self.upload_uuid).exists())
        self.assertEqual(self.chunk_files(), ["0"])


class ReplacementUploadTests(UploadSessionTestCase):
    def setUp(self):
        super().setUp()
        self.media = create_media(self.owner, "first")
        self.other_media = create_media(self.owner, "second")
        self.endpoint = reverse("uploader:update", args=[self.media.friendly_token])

    def test_replacement_completes_into_the_staged_file(self):
        self.post_all_chunks(endpoint=self.endpoint)

        response = self.complete(endpoint=self.endpoint)

        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response.json()["media_url"], self.media.get_absolute_url())
        staged = self.client.session[f"media_file_updated_{self.media.friendly_token}"]
        with open(staged["temp_file_path"], "rb") as stored:
            self.assertEqual(stored.read(), CONTENT)

    def test_a_replacement_upload_cannot_be_used_for_other_media_or_a_new_upload(self):
        self.post_chunk(0, endpoint=self.endpoint)
        other_endpoint = reverse("uploader:update", args=[self.other_media.friendly_token])

        for endpoint in (other_endpoint, reverse("uploader:upload")):
            with self.subTest(endpoint):
                self.assertEqual(self.post_chunk(1, endpoint=endpoint).status_code, 403)

        self.post_chunk(1, endpoint=self.endpoint)
        self.post_chunk(2, endpoint=self.endpoint)
        self.assertEqual(self.complete(endpoint=other_endpoint).status_code, 404)
        self.assertEqual(self.complete(endpoint=reverse("uploader:upload")).status_code, 404)


class ResumeLookupTests(UploadSessionTestCase):
    def lookup(self, url=None, **overrides):
        query = {"filename": "clip.mp4", "total_size": len(CONTENT), "part_size": PART_SIZE}
        query["fingerprint"] = FINGERPRINT
        query.update(overrides)
        return self.client.get(url or reverse("uploader:session_lookup"), query)

    def test_lookup_returns_the_upload_and_its_verified_parts(self):
        self.post_chunk(0)
        self.post_chunk(2)

        response = self.lookup()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(), {"success": True, "uuid": self.upload_uuid, "total_parts": 3, "parts": [0, 2]}
        )

    def test_a_chunk_file_with_the_wrong_size_is_not_reported(self):
        self.post_chunk(0)
        self.post_chunk(1)
        with open(os.path.join(sessions.chunks_dir(self.upload_uuid), "1"), "wb") as truncated:
            truncated.write(b"4")

        self.assertEqual(self.lookup().json()["parts"], [0])

    def test_lookup_finds_nothing_for_another_account_file_or_target(self):
        media = create_media(self.owner, "target")
        cases = [
            ("other account", lambda: self.client.force_login(self.other), {}),
            ("other fingerprint", lambda: None, {"fingerprint": OTHER_FINGERPRINT}),
            ("other size", lambda: None, {"total_size": len(CONTENT) + 1}),
            ("other part size", lambda: None, {"part_size": PART_SIZE + 1}),
            (
                "replacement target",
                lambda: None,
                {"url": reverse("uploader:update_session_lookup", args=[media.friendly_token])},
            ),
        ]
        self.post_chunk(0)
        for label, arrange, overrides in cases:
            with self.subTest(label):
                self.client.force_login(self.owner)
                arrange()

                response = self.lookup(**overrides)

                self.assertEqual(response.status_code, 404)

    def test_finished_cancelled_and_stale_uploads_are_not_resumable(self):
        cases = [
            ("completed", lambda: (self.post_all_chunks(), self.complete())),
            (
                "cancelled",
                lambda: (
                    self.post_chunk(0),
                    self.client.delete(reverse("uploader:session", args=[self.upload_uuid])),
                ),
            ),
            (
                "stale",
                lambda: (
                    self.post_chunk(0),
                    UploadSession.objects.filter(uuid=self.upload_uuid).update(
                        updated_at=timezone.now() - sessions.retention() - timedelta(minutes=1)
                    ),
                ),
            ),
        ]
        for label, arrange in cases:
            with self.subTest(label):
                self.upload_uuid = str(uuid.uuid4())
                arrange()

                self.assertEqual(self.lookup().status_code, 404)

    def test_lookup_rejects_an_incomplete_identity(self):
        self.assertEqual(self.lookup(fingerprint="not-a-hash").status_code, 400)
        self.assertEqual(self.lookup(total_size=0).status_code, 400)
