"""tus 1.0.0 resumable uploads on top of ``UploadSession``.

Implements the core protocol and the Creation, Expiration and Termination
extensions (https://tus.io/protocols/resumable-upload). A tus upload appends to one
file, and that file's size on disk is the offset, so accepted bytes survive a lost
response, a page reload, and an application restart.
"""

import base64
import binascii
import fcntl
import os
import uuid

from django.conf import settings
from django.utils import timezone

from . import sessions
from .fineuploader import clean_filename
from .models import UploadSession

VERSION = "1.0.0"
EXTENSIONS = "creation,expiration,termination"
OFFSET_CONTENT_TYPE = "application/offset+octet-stream"
READ_SIZE = 64 * 1024

SIGN_IN_MESSAGE = "Sign in again to continue this upload."
NOT_FOUND_MESSAGE = "Upload not found."
LOCKED_MESSAGE = "This upload is busy. Try again shortly."
TOO_LARGE_MESSAGE = "This file is larger than the upload limit."


class TusError(Exception):
    """A tus request the server refuses, with the HTTP status the protocol asks for."""

    def __init__(self, status, error):
        super().__init__(error)
        self.status = status
        self.error = error


def max_upload_size(user):
    """The largest file this account may upload, in bytes."""
    return settings.UPLOAD_MAX_SIZE


def parse_metadata(header):
    """Decode an Upload-Metadata header into a dict of text values."""
    metadata = {}
    for pair in filter(None, (item.strip() for item in (header or "").split(","))):
        key, _, encoded = pair.partition(" ")
        try:
            value = base64.b64decode(encoded, validate=True).decode("utf-8")
        except (binascii.Error, UnicodeDecodeError) as error:
            raise TusError(400, "Upload-Metadata is not valid.") from error
        if not key or key in metadata:
            raise TusError(400, "Upload-Metadata is not valid.")
        metadata[key] = value
    return metadata


def encode_metadata(session):
    pairs = {"filename": session.filename, "fingerprint": session.fingerprint}
    return ",".join(
        f"{key} {base64.b64encode(value.encode('utf-8')).decode('ascii')}" for key, value in pairs.items() if value
    )


def expires_at(session):
    return session.updated_at + sessions.retention()


def create(user, target_media, *, length, filename, fingerprint="", is_draft=False):
    """Start an upload of ``length`` bytes for the caller and return its session."""
    if length > max_upload_size(user):
        raise TusError(413, TOO_LARGE_MESSAGE)
    session = UploadSession.objects.create(
        uuid=uuid.uuid4(),
        protocol=UploadSession.Protocol.TUS,
        user=user,
        target_media=target_media,
        filename=clean_filename(filename),
        total_size=length,
        part_size=0,
        total_parts=0,
        fingerprint=sessions.clean_fingerprint(fingerprint),
        is_draft=is_draft,
    )
    os.makedirs(sessions.chunks_dir(session.uuid), exist_ok=True)
    with open(sessions.data_path(session.uuid), "xb"):
        pass
    return session


def get(user, target_media, upload_id):
    """The caller's tus upload. Another account's upload, or one for another target, looks absent."""
    session = sessions.get_owned(user, target_media, upload_id)
    if session is None or session.protocol != UploadSession.Protocol.TUS:
        raise TusError(404, NOT_FOUND_MESSAGE)
    if session.status in (UploadSession.Status.CANCELLED, UploadSession.Status.EXPIRED):
        raise TusError(410, sessions.EXPIRED_MESSAGE)
    if session.status == UploadSession.Status.FAILED:
        raise TusError(410, sessions.FAILED_MESSAGE)
    if session.status == UploadSession.Status.OPEN and sessions.is_stale(session, timezone.now()):
        sessions.expire(session)
        raise TusError(410, sessions.EXPIRED_MESSAGE)
    return session


def offset(session):
    """Bytes of the upload the server holds."""
    if session.status != UploadSession.Status.OPEN:
        # Every byte arrived before assembly started, and assembly moves the data file.
        return session.total_size
    try:
        return os.path.getsize(sessions.data_path(session.uuid))
    except OSError:
        return 0


def find_resumable(user, target_media, filename, total_size, fingerprint):
    """The caller's unfinished tus upload of this exact file, or None."""
    fingerprint = sessions.clean_fingerprint(fingerprint)
    if not fingerprint:
        return None
    session = (
        UploadSession.objects.filter(
            protocol=UploadSession.Protocol.TUS,
            user=user,
            target_media=target_media,
            status=UploadSession.Status.OPEN,
            filename=clean_filename(filename),
            total_size=total_size,
            fingerprint=fingerprint,
        )
        .order_by("-updated_at")
        .first()
    )
    if session is None:
        return None
    if sessions.is_stale(session, timezone.now()):
        sessions.expire(session)
        return None
    return session


def append(session, claimed_offset, stream):
    """Append the request body at ``claimed_offset`` and return the new offset.

    Only one request may write an upload at a time: a second one gets 423 and
    retries. An offset other than the file's size gets 409 and changes nothing.
    Bytes of an interrupted body stay, so the next request continues after them.
    """
    try:
        data = open(sessions.data_path(session.uuid), "r+b")
    except FileNotFoundError:
        # Assembly or cancellation took the file between the status check and here.
        if UploadSession.objects.filter(pk=session.pk, status=UploadSession.Status.OPEN).exists():
            raise TusError(410, sessions.EXPIRED_MESSAGE) from None
        raise TusError(423, LOCKED_MESSAGE) from None
    with data:
        try:
            fcntl.flock(data, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise TusError(423, LOCKED_MESSAGE) from None
        if not UploadSession.objects.filter(pk=session.pk, status=UploadSession.Status.OPEN).exists():
            raise TusError(423, LOCKED_MESSAGE)
        current = os.fstat(data.fileno()).st_size
        if claimed_offset != current:
            raise TusError(409, "Upload-Offset does not match the upload.")
        data.seek(current)
        written = 0
        remaining = session.total_size - current
        try:
            while piece := stream.read(READ_SIZE):
                if len(piece) > remaining - written:
                    data.truncate(current)
                    raise TusError(413, "The request sends more bytes than the upload's length.")
                data.write(piece)
                written += len(piece)
        finally:
            data.flush()
            os.fsync(data.fileno())
    UploadSession.objects.filter(pk=session.pk).update(updated_at=timezone.now())
    # The cleanup task ages chunk directories by modification time, which an append does not change.
    os.utime(sessions.chunks_dir(session.uuid))
    return current + written
