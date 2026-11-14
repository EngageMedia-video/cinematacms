"""HTTP endpoints of the tus 1.0.0 upload protocol; see ``uploader.tus``."""

import os

from django.core.exceptions import PermissionDenied
from django.http import HttpResponse, JsonResponse
from django.http.request import RawPostDataException
from django.urls import reverse
from django.utils.http import http_date
from django.views import generic

from files.helpers import get_allowed_video_extensions

from . import sessions, tus
from .forms import TusCreationForm, TusLookupForm
from .models import UploadSession
from .views import UploadTargetMixin, create_media_from_upload, log_upload_event, stage_replacement_file

# Not part of tus: where the media of a finished upload lives.
MEDIA_URL_HEADER = "X-Media-Url"
TUS_METHODS = ("POST", "HEAD", "PATCH", "DELETE")


def _error(status, message, headers=None):
    response = JsonResponse({"error": message}, status=status)
    for name, value in (headers or {}).items():
        response[name] = value
    return response


def _drain(request):
    """Read the rest of a refused request body, which uWSGI expects the application to consume."""
    try:
        while request.read(tus.READ_SIZE):
            pass
    except (OSError, RawPostDataException):
        pass


class TusView(UploadTargetMixin, generic.View):
    """Applies the rules every tus request shares: sign-in, protocol version, and response headers."""

    def dispatch(self, request, *args, **kwargs):
        override = request.headers.get("X-HTTP-Method-Override", "").upper()
        if request.method == "POST" and override in ("PATCH", "DELETE"):
            request.method = override
        response = self._respond(request, *args, **kwargs)
        if request.method == "PATCH" and response.status_code >= 400:
            _drain(request)
        response["Tus-Resumable"] = tus.VERSION
        return response

    def _respond(self, request, *args, **kwargs):
        if request.user.is_anonymous:
            # 401, unlike the 403 of a permission denial, tells the browser that signing in again helps.
            return _error(401, tus.SIGN_IN_MESSAGE)
        if request.method in TUS_METHODS and request.headers.get("Tus-Resumable") != tus.VERSION:
            response = _error(412, "Unsupported tus version.")
            response["Tus-Version"] = tus.VERSION
            return response
        try:
            return super().dispatch(request, *args, **kwargs)
        except PermissionDenied as denial:
            return _error(403, str(denial) or "Upload not allowed")
        except tus.TusError as refusal:
            return _error(refusal.status, refusal.error, refusal.headers)
        except sessions.UploadRejected as rejection:
            return _error(rejection.status, rejection.error)

    def options(self, request, *args, **kwargs):
        response = HttpResponse(status=204)
        response["Tus-Version"] = tus.VERSION
        response["Tus-Extension"] = tus.EXTENSIONS
        response["Tus-Max-Size"] = str(tus.max_upload_size(request.user))
        return response

    def upload_url(self, session):
        if self.target_media is None:
            return reverse("uploader:tus_upload", kwargs={"upload_id": session.uuid})
        return reverse(
            "uploader:tus_update_upload",
            kwargs={"friendly_token": self.target_media.friendly_token, "upload_id": session.uuid},
        )


class TusCollectionView(TusView):
    """Creates uploads, and finds the caller's unfinished upload of a file so the browser can resume it."""

    http_method_names = ("get", "post", "options")

    def get(self, request, *args, **kwargs):
        form = TusLookupForm(request.GET)
        if not form.is_valid():
            return _error(400, "Invalid upload identity.")
        session = tus.find_resumable(request.user, self.target_media, **form.cleaned_data)
        uploads = []
        if session is not None:
            uploads.append({"url": self.upload_url(session), "size": session.total_size, "offset": tus.offset(session)})
        return JsonResponse({"uploads": uploads})

    def post(self, request, *args, **kwargs):
        if "Upload-Defer-Length" in request.headers:
            return _error(400, "Upload-Defer-Length is not supported.")
        metadata = tus.parse_metadata(request.headers.get("Upload-Metadata"))
        form = TusCreationForm(
            {
                "length": request.headers.get("Upload-Length"),
                "filename": metadata.get("filename"),
                "fingerprint": metadata.get("fingerprint"),
                "is_draft": metadata.get("is_draft"),
            }
        )
        if not form.is_valid():
            return _error(400, "Upload-Length or Upload-Metadata is not valid.")
        allowed_extensions = get_allowed_video_extensions()
        extension = os.path.splitext(form.cleaned_data["filename"])[1].lower().lstrip(".")
        if allowed_extensions and extension not in allowed_extensions:
            allowed = ", ".join(allowed_extensions)
            return _error(400, f"File type '.{extension}' is not allowed. Allowed types: {allowed}")

        session = tus.create(request.user, self.target_media, **form.cleaned_data)
        if self.target_media is None:
            log_upload_event(request, "cinematacms.upload.started")
        response = HttpResponse(status=201)
        response["Location"] = self.upload_url(session)
        response["Upload-Expires"] = http_date(tus.expires_at(session).timestamp())
        return response


class TusUploadView(TusView):
    """Reports an upload's offset, appends bytes to it, and cancels it."""

    http_method_names = ("head", "patch", "delete", "options")

    def head(self, request, *args, **kwargs):
        session = tus.get(request.user, self.target_media, kwargs["upload_id"])
        response = HttpResponse(status=200)
        if tus.offset(session) == session.total_size:
            # A completion that never ran, or whose worker died, is finished by the next request.
            response[MEDIA_URL_HEADER] = self._complete(session)
        else:
            response["Upload-Expires"] = http_date(tus.expires_at(session).timestamp())
        response["Upload-Offset"] = str(tus.offset(session))
        response["Upload-Length"] = str(session.total_size)
        response["Upload-Metadata"] = tus.encode_metadata(session)
        response["Cache-Control"] = "no-store"
        return response

    def patch(self, request, *args, **kwargs):
        if request.content_type != tus.OFFSET_CONTENT_TYPE:
            return _error(415, f"Content-Type must be {tus.OFFSET_CONTENT_TYPE}.")
        try:
            claimed_offset = int(request.headers.get("Upload-Offset", ""))
        except ValueError:
            return _error(400, "Upload-Offset is not valid.")
        if claimed_offset < 0:
            return _error(400, "Upload-Offset is not valid.")

        session = tus.get(request.user, self.target_media, kwargs["upload_id"])
        if session.total_size > tus.max_upload_size(request.user):
            # The account's limit was lowered after the upload started.
            return _error(413, tus.too_large_message(request.user))
        response = HttpResponse(status=204)
        if session.status == UploadSession.Status.OPEN:
            new_offset = tus.append(session, claimed_offset, request)
        elif claimed_offset == session.total_size:
            # The final request again, after its response was lost.
            new_offset = claimed_offset
        else:
            return _error(409, "Upload-Offset does not match the upload.")
        if new_offset == session.total_size:
            response[MEDIA_URL_HEADER] = self._complete(session)
        else:
            session.refresh_from_db(fields=["updated_at"])
            response["Upload-Expires"] = http_date(tus.expires_at(session).timestamp())
        response["Upload-Offset"] = str(new_offset)
        return response

    def delete(self, request, *args, **kwargs):
        session = tus.get(request.user, self.target_media, kwargs["upload_id"])
        sessions.cancel(request.user, self.target_media, kwargs["upload_id"])
        # Termination ends the upload resource, not the media a completed upload created.
        UploadSession.objects.filter(pk=session.pk, status=UploadSession.Status.COMPLETE).update(
            status=UploadSession.Status.CANCELLED
        )
        return HttpResponse(status=204)

    def _complete(self, session):
        """Turn the fully received upload into its result once and return the media URL."""
        try:
            result = sessions.complete(self.request.user, self.target_media, str(session.uuid), self._finish(session))
        except sessions.UploadRejected as rejection:
            if not rejection.prevent_retry:
                # Another request is finishing this upload; the client asks again after a pause.
                raise tus.TusError(423, tus.LOCKED_MESSAGE) from rejection
            raise
        return result["media_url"]

    def _finish(self, session):
        if self.target_media is None:
            return lambda assembly: create_media_from_upload(self.request, assembly, is_draft=session.is_draft)
        return lambda assembly: stage_replacement_file(self.request, self.target_media, assembly, session.filename)
