"""Server-side state for resumable uploads.

An upload is an ``UploadSession`` row plus its bytes in one append-only file,
CHUNKS_DIR/<uuid>/data (see ``uploader.tus``). The row binds the upload to one
account, one target, and one file identity (name, size, client fingerprint). Every
request, resume lookup, cancellation, and completion is checked against it, so a
retry or a resumed upload can only extend the upload it belongs to.
"""

import fcntl
import os
import re
import shutil
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.utils import timezone

from .models import UploadSession
from .utils import is_valid_uuid_format

FINGERPRINT_PATTERN = re.compile(r"^[0-9a-f]{64}$")
# An assembly that has not finished in this time is treated as abandoned by a dead worker.
# It must exceed the proxy read timeout (nginx uwsgi_read_timeout 900s), so a slow
# request that is still running is never reclaimed by its own retry.
ASSEMBLY_TIMEOUT = timedelta(minutes=30)

EXPIRED_MESSAGE = "This upload expired. Select the file again to start a new upload."
FAILED_MESSAGE = "This upload could not be finished, and its media may already exist. Check your media before you upload the file again."


class UploadRejected(Exception):
    """A request the session cannot accept. ``prevent_retry`` is False when asking again later can succeed."""

    def __init__(self, status, error, *, prevent_retry=True):
        super().__init__(error)
        self.status = status
        self.error = error
        self.prevent_retry = prevent_retry


def retention():
    return timedelta(hours=getattr(settings, "ORPHANED_UPLOAD_CLEANUP_HOURS", 24))


def clean_fingerprint(value):
    value = (value or "").strip().lower()
    return value if FINGERPRINT_PATTERN.match(value) else ""


def chunks_dir(upload_uuid):
    return os.path.join(settings.MEDIA_ROOT, settings.CHUNKS_DIR, str(upload_uuid))


def data_path(upload_uuid):
    """The append-only file that holds an upload's bytes."""
    return os.path.join(chunks_dir(upload_uuid), "data")


def _assembled_path(session):
    return os.path.join(settings.MEDIA_ROOT, settings.UPLOAD_DIR, str(session.uuid), session.filename)


def _size_or_none(path):
    try:
        return os.path.getsize(path)
    except OSError:
        return None


def _fully_received(session):
    # An assembly that died after moving the data file left the whole upload at its assembled path.
    return session.total_size in (_size_or_none(data_path(session.uuid)), _size_or_none(_assembled_path(session)))


def is_stale(session, now):
    return session.updated_at < now - retention()


def get_owned(user, target_media, upload_uuid):
    """Return the caller's session for this target, or None. Other accounts' sessions look absent."""
    try:
        session = UploadSession.objects.get(uuid=upload_uuid)
    except (UploadSession.DoesNotExist, ValueError, ValidationError):
        return None
    if session.user_id != user.pk or session.target_media_id != (target_media.pk if target_media else None):
        return None
    return session


def expire(session):
    UploadSession.objects.filter(pk=session.pk).update(status=UploadSession.Status.EXPIRED)
    shutil.rmtree(chunks_dir(session.uuid), ignore_errors=True)


def cancel(user, target_media, upload_uuid):
    """Discard the caller's unfinished upload. Returns the session, or None when the caller has none."""
    session = get_owned(user, target_media, upload_uuid)
    if session is None:
        return None
    # Conditional, so a completion that claims the upload first is never cancelled under it.
    cancelled = UploadSession.objects.filter(
        pk=session.pk, status__in=(UploadSession.Status.OPEN, UploadSession.Status.EXPIRED)
    ).update(status=UploadSession.Status.CANCELLED)
    if cancelled:
        shutil.rmtree(chunks_dir(session.uuid), ignore_errors=True)
    session.refresh_from_db()
    if session.status == UploadSession.Status.ASSEMBLING:
        raise UploadRejected(409, "This upload is already being assembled.")
    return session


@dataclass(frozen=True)
class Assembly:
    """The combined file, relative to MEDIA_ROOT, and the directory that holds it."""

    real_path: str
    upload_dir: str


def _combine(session):
    upload_dir = os.path.join(settings.UPLOAD_DIR, str(session.uuid))
    real_path = os.path.join(upload_dir, session.filename)
    absolute_dir = os.path.join(settings.MEDIA_ROOT, upload_dir)
    os.makedirs(absolute_dir, exist_ok=True)
    # The data file already is the whole upload, so it only has to move. A retry after an
    # assembly that died finds it moved already.
    try:
        data = open(data_path(session.uuid), "rb")
    except FileNotFoundError:
        return Assembly(real_path=real_path, upload_dir=upload_dir)
    with data:
        try:
            # A request that is still appending holds this lock until its body ends. Moving the
            # file under it would let that request truncate or extend the finished upload.
            fcntl.flock(data, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise UploadRejected(409, "This upload is still being written.", prevent_retry=False) from None
        os.replace(data_path(session.uuid), _assembled_path(session))
    return Assembly(real_path=real_path, upload_dir=upload_dir)


def complete(user, target_media, upload_uuid, finish):
    """Assemble the caller's upload once and return the response data for it.

    ``finish(assembly)`` turns the combined file into its result and returns the
    media URL. A repeated or concurrent completion returns the first result
    instead of running ``finish`` again.
    """
    if not is_valid_uuid_format(upload_uuid or ""):
        raise UploadRejected(400, "Invalid upload identifier.")
    session = get_owned(user, target_media, upload_uuid)
    if session is None:
        raise UploadRejected(404, "Upload not found.")

    now = timezone.now()
    if session.status == UploadSession.Status.COMPLETE:
        return {"success": True, "media_url": session.result_url}
    _reject_finished(session)
    if session.status == UploadSession.Status.OPEN and is_stale(session, now):
        expire(session)
        raise UploadRejected(410, EXPIRED_MESSAGE)
    if not _fully_received(session):
        raise UploadRejected(400, "Some bytes of this upload are missing.", prevent_retry=False)

    claimed = UploadSession.objects.filter(
        Q(status=UploadSession.Status.OPEN)
        | Q(status=UploadSession.Status.ASSEMBLING, updated_at__lt=now - ASSEMBLY_TIMEOUT),
        pk=session.pk,
    ).update(status=UploadSession.Status.ASSEMBLING, updated_at=now)
    if not claimed:
        session.refresh_from_db()
        if session.status == UploadSession.Status.COMPLETE:
            return {"success": True, "media_url": session.result_url}
        _reject_finished(session)
        # Another request is assembling it; a retry after backoff picks up its result.
        raise UploadRejected(409, "This upload is still being assembled.", prevent_retry=False)

    assembling = UploadSession.objects.filter(pk=session.pk, status=UploadSession.Status.ASSEMBLING)
    try:
        assembly = _combine(session)
    except BaseException:
        # Nothing was created and the bytes are still on disk, so another completion can succeed.
        shutil.rmtree(os.path.join(settings.MEDIA_ROOT, settings.UPLOAD_DIR, str(session.uuid)), ignore_errors=True)
        assembling.update(status=UploadSession.Status.OPEN, updated_at=timezone.now())
        raise
    try:
        result_url = finish(assembly)
    except BaseException:
        # finish may already have saved a media row, so a retry could create a second one.
        # The upload ends here; cleanup removes its files after the retention period.
        assembling.update(status=UploadSession.Status.FAILED, updated_at=timezone.now())
        raise
    assembling.update(status=UploadSession.Status.COMPLETE, result_url=result_url or "", updated_at=timezone.now())
    shutil.rmtree(chunks_dir(session.uuid), ignore_errors=True)
    return {"success": True, "media_url": result_url}


def _reject_finished(session):
    if session.status in (UploadSession.Status.CANCELLED, UploadSession.Status.EXPIRED):
        raise UploadRejected(410, EXPIRED_MESSAGE)
    if session.status == UploadSession.Status.FAILED:
        raise UploadRejected(409, FAILED_MESSAGE)


def delete_stale_sessions(now=None):
    """Delete sessions untouched for the retention period, with any bytes they still hold."""
    cutoff = (now or timezone.now()) - retention()
    stale = list(UploadSession.objects.filter(updated_at__lt=cutoff).values_list("uuid", flat=True))
    for upload_uuid in stale:
        shutil.rmtree(chunks_dir(upload_uuid), ignore_errors=True)
    UploadSession.objects.filter(uuid__in=stale).delete()
    return len(stale)
