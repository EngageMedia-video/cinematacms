"""Server-side state for resumable uploads.

An upload is an ``UploadSession`` row plus its bytes in CHUNKS_DIR/<uuid>/: one file
per accepted chunk for Fine Uploader, or one append-only ``data`` file for tus (see
``uploader.tus``). The row binds the upload to one account, one target, and one
file identity (name, size, part layout, client fingerprint). Every chunk,
resume lookup, cancellation, and completion is checked against it, so a retry or
a resumed upload can only extend the upload it belongs to.
"""

import math
import os
import re
import shutil
import tempfile
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db.models import Q
from django.utils import timezone

from .fineuploader import clean_filename, is_valid_uuid_format
from .models import UploadSession

FINGERPRINT_PATTERN = re.compile(r"^[0-9a-f]{64}$")
FINGERPRINT_PARAM = "qqfingerprint"
# An assembly that has not finished in this time is treated as abandoned by a dead worker.
# It must exceed the proxy read timeout (nginx uwsgi_read_timeout 900s), so a slow
# request that is still running is never reclaimed by its own retry.
ASSEMBLY_TIMEOUT = timedelta(minutes=30)

EXPIRED_MESSAGE = "This upload expired. Select the file again to start a new upload."
FAILED_MESSAGE = "This upload could not be finished. Select the file again to start a new upload."


class UploadRejected(Exception):
    """A request the session cannot accept. ``prevent_retry`` stops Fine Uploader's automatic retry."""

    def __init__(self, status, error, *, prevent_retry=True, reset=False):
        super().__init__(error)
        self.status = status
        self.error = error
        self.prevent_retry = prevent_retry
        self.reset = reset

    def response_data(self):
        data = {"success": False, "error": self.error, "preventRetry": self.prevent_retry}
        if self.reset:
            # Fine Uploader drops its saved progress for the file when a response carries reset.
            data["reset"] = True
        return data


def retention():
    return timedelta(hours=getattr(settings, "ORPHANED_UPLOAD_CLEANUP_HOURS", 24))


def clean_fingerprint(value):
    value = (value or "").strip().lower()
    return value if FINGERPRINT_PATTERN.match(value) else ""


def chunks_dir(upload_uuid):
    return os.path.join(settings.MEDIA_ROOT, settings.CHUNKS_DIR, str(upload_uuid))


def data_path(upload_uuid):
    """The append-only file that holds a tus upload's bytes."""
    return os.path.join(chunks_dir(upload_uuid), "data")


def _is_tus(session):
    return session.protocol == UploadSession.Protocol.TUS


def _assembled_path(session):
    return os.path.join(settings.MEDIA_ROOT, settings.UPLOAD_DIR, str(session.uuid), session.filename)


def _size_or_none(path):
    try:
        return os.path.getsize(path)
    except OSError:
        return None


def _fully_received(session):
    if _is_tus(session):
        # An assembly that died after moving the data file left the whole upload at its assembled path.
        return session.total_size in (_size_or_none(data_path(session.uuid)), _size_or_none(_assembled_path(session)))
    return len(accepted_parts(session)) == session.total_parts


def _expected_part_size(total_size, part_size, part_index):
    return min(part_size, total_size - part_index * part_size)


def accepted_parts(session):
    """Part indexes whose chunk file is on disk with exactly the expected size."""
    directory = chunks_dir(session.uuid)
    parts = []
    for index in range(session.total_parts):
        try:
            size = os.path.getsize(os.path.join(directory, str(index)))
        except OSError:
            continue
        if size == _expected_part_size(session.total_size, session.part_size, index):
            parts.append(index)
    return parts


def is_stale(session, now):
    return session.updated_at < now - retention()


@dataclass(frozen=True)
class ChunkRequest:
    uuid: str
    filename: str
    total_size: int
    total_parts: int
    part_size: int
    part_index: int
    fingerprint: str
    file: object

    @classmethod
    def from_form(cls, data, fingerprint):
        """Validate one chunk request's layout against the file it claims to belong to."""
        upload_uuid = data.get("qquuid") or ""
        if not is_valid_uuid_format(upload_uuid):
            raise UploadRejected(400, "Invalid upload identifier.")
        total_size = data.get("qqtotalfilesize")
        total_parts = data.get("qqtotalparts")
        part_index = data.get("qqpartindex")
        chunk_size = data.get("qqchunksize")
        byte_offset = data.get("qqpartbyteoffset")
        upload = data.get("qqfile")
        if None in (total_size, total_parts, part_index, chunk_size, byte_offset) or upload is None:
            raise UploadRejected(400, "Chunk is missing its position in the file.")
        if total_size > settings.UPLOAD_MAX_SIZE:
            raise UploadRejected(400, "This file is larger than the upload limit.")
        if total_size <= 0 or total_parts < 2 or not 0 <= part_index < total_parts:
            raise UploadRejected(400, "Chunk position is outside the file.")

        # The part size is fixed, which also bounds how many parts a session can have.
        part_size = settings.UPLOAD_PART_SIZE
        if (
            math.ceil(total_size / part_size) != total_parts
            or byte_offset != part_index * part_size
            or chunk_size != _expected_part_size(total_size, part_size, part_index)
            or upload.size != chunk_size
        ):
            raise UploadRejected(400, "Chunk does not match the file layout.", reset=True)

        return cls(
            uuid=upload_uuid.lower(),
            filename=clean_filename(data.get("qqfilename") or ""),
            total_size=total_size,
            total_parts=total_parts,
            part_size=part_size,
            part_index=part_index,
            fingerprint=clean_fingerprint(fingerprint),
            file=upload,
        )

    def identity(self):
        return (self.filename, self.total_size, self.part_size, self.total_parts, self.fingerprint)


def _session_identity(session):
    return (session.filename, session.total_size, session.part_size, session.total_parts, session.fingerprint)


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


def accept_chunk(user, target_media, chunk):
    """Store one chunk of the caller's upload. Repeating a chunk replaces it."""
    now = timezone.now()
    session, created = UploadSession.objects.get_or_create(
        uuid=chunk.uuid,
        defaults={
            "user": user,
            "target_media": target_media,
            "filename": chunk.filename,
            "total_size": chunk.total_size,
            "part_size": chunk.part_size,
            "total_parts": chunk.total_parts,
            "fingerprint": chunk.fingerprint,
            "updated_at": now,
        },
    )
    if not created:
        if session.user_id != user.pk or session.target_media_id != (target_media.pk if target_media else None):
            raise UploadRejected(403, "This upload belongs to another account or media.")
        if _session_identity(session) != chunk.identity():
            raise UploadRejected(409, "This chunk belongs to a different file.", reset=True)
        if session.status in (UploadSession.Status.COMPLETE, UploadSession.Status.ASSEMBLING):
            # Every part was accepted before assembly started, so a late repeat changes nothing.
            return session
        if session.status in (UploadSession.Status.CANCELLED, UploadSession.Status.EXPIRED):
            raise UploadRejected(410, EXPIRED_MESSAGE, reset=True)
        if is_stale(session, now):
            expire(session)
            raise UploadRejected(410, EXPIRED_MESSAGE, reset=True)

    directory = chunks_dir(session.uuid)
    os.makedirs(directory, exist_ok=True)
    # Write beside the final name and rename, so an interrupted write never leaves a short chunk.
    descriptor, temp_path = tempfile.mkstemp(dir=directory, prefix=f".{chunk.part_index}-")
    try:
        with os.fdopen(descriptor, "wb") as destination:
            for piece in chunk.file.chunks():
                destination.write(piece)
        os.replace(temp_path, os.path.join(directory, str(chunk.part_index)))
    except BaseException:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise
    UploadSession.objects.filter(pk=session.pk).update(updated_at=timezone.now())
    return session


def find_resumable(user, target_media, filename, total_size, part_size, fingerprint):
    """The caller's open upload of this exact file and its server-verified parts, or None."""
    fingerprint = clean_fingerprint(fingerprint)
    if not fingerprint or total_size <= 0 or part_size <= 0:
        return None
    session = (
        UploadSession.objects.filter(
            user=user,
            target_media=target_media,
            status=UploadSession.Status.OPEN,
            filename=clean_filename(filename),
            total_size=total_size,
            part_size=part_size,
            fingerprint=fingerprint,
        )
        .order_by("-updated_at")
        .first()
    )
    if session is None:
        return None
    if is_stale(session, timezone.now()):
        expire(session)
        return None
    return session, accepted_parts(session)


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
    if _is_tus(session):
        # The data file already is the whole upload, so it only has to move.
        if _size_or_none(data_path(session.uuid)) is not None:
            os.replace(data_path(session.uuid), _assembled_path(session))
        return Assembly(real_path=real_path, upload_dir=upload_dir)
    source_dir = chunks_dir(session.uuid)
    descriptor, temp_path = tempfile.mkstemp(dir=absolute_dir, prefix=".assembling-")
    try:
        with os.fdopen(descriptor, "wb") as destination:
            for index in range(session.total_parts):
                with open(os.path.join(source_dir, str(index)), "rb") as source:
                    shutil.copyfileobj(source, destination)
        os.replace(temp_path, os.path.join(settings.MEDIA_ROOT, real_path))
    except BaseException:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise
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
        raise UploadRejected(410, EXPIRED_MESSAGE, reset=True)
    if not _fully_received(session):
        # Retrying sends the whole file again under the same session.
        raise UploadRejected(400, "Some parts of this upload are missing.", prevent_retry=False, reset=True)

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
        # Nothing was created and the chunks are still on disk, so another completion can succeed.
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
        raise UploadRejected(410, EXPIRED_MESSAGE, reset=True)
    if session.status == UploadSession.Status.FAILED:
        raise UploadRejected(409, FAILED_MESSAGE, reset=True)


def delete_stale_sessions(now=None):
    """Delete sessions untouched for the retention period, with any chunks they still hold."""
    cutoff = (now or timezone.now()) - retention()
    stale = list(UploadSession.objects.filter(updated_at__lt=cutoff).values_list("uuid", flat=True))
    for upload_uuid in stale:
        shutil.rmtree(chunks_dir(upload_uuid), ignore_errors=True)
    UploadSession.objects.filter(uuid__in=stale).delete()
    return len(stale)
