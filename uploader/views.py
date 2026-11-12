import logging
import os
import shutil
from datetime import datetime

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.core.files import File
from django.http import JsonResponse
from django.views import generic

from cms.error_tracking import capture_unexpected_exception
from cms.http_telemetry import upload_reference
from cms.permissions import is_trusted_uploader, user_allowed_to_upload
from files.helpers import cleanup_temp_upload_files, rm_file
from files.models import Media

from . import sessions
from .fineuploader import ChunkedFineUploader
from .forms import FineUploaderUploadForm, FineUploaderUploadSuccessForm, UploadSessionLookupForm

logger = logging.getLogger(__name__)

UPLOAD_ROUTE_GROUP = "upload_transfer"


class UploadTargetMixin:
    """Resolves the media a replacement upload targets and refuses callers who may not upload.

    URLs without a ``friendly_token`` upload new media, so ``target_media`` stays None.
    """

    target_media = None

    def dispatch(self, request, *args, **kwargs):
        if "friendly_token" in kwargs:
            friendly_token = kwargs.get("friendly_token")
            if not friendly_token:
                raise PermissionDenied("Media identifier required")

            try:
                self.target_media = Media.objects.get(friendly_token=friendly_token)
            except Media.DoesNotExist:
                raise PermissionDenied("Media not found")

            # Check if user has permission to update this media
            from files.methods import is_mediacms_editor, is_mediacms_manager

            if not (
                request.user == self.target_media.user
                or is_mediacms_editor(request.user)
                or is_mediacms_manager(request.user)
            ):
                raise PermissionDenied("You don't have permission to update this media")

        if not user_allowed_to_upload(request):
            raise PermissionDenied("Upload not allowed")  # HTTP 403
        return super().dispatch(request, *args, **kwargs)


class ChunkedUploadView(UploadTargetMixin, generic.FormView):
    """Receives Fine Uploader requests: single-request files, chunks, and chunk completion.

    Chunked uploads go through an upload session (see ``uploader.sessions``), which
    checks ownership and file identity on every chunk and assembles the file once.
    Subclasses turn the finished file into their result in ``finish``.
    """

    http_method_names = ("post",)
    form_class_upload = FineUploaderUploadForm
    form_class_upload_success = FineUploaderUploadSuccessForm

    @property
    def concurrent(self):
        return settings.CONCURRENT_UPLOADS

    @property
    def chunks_done(self):
        return self.chunks_done_param_name in self.request.GET

    @property
    def chunks_done_param_name(self):
        return settings.CHUNKS_DONE_PARAM_NAME

    def make_response(self, data, **kwargs):
        return JsonResponse(data, **kwargs)

    def get_form(self, form_class=None):
        form_class = self.form_class_upload_success if self.chunks_done else self.form_class_upload
        return form_class(**self.get_form_kwargs())

    def form_invalid(self, form):
        data = {"success": False, "error": "%s" % repr(form.errors)}
        return self.make_response(data, status=400)

    def form_valid(self, form):
        self.upload = ChunkedFineUploader(form.cleaned_data, self.concurrent)

        # Server-side file extension validation before saving
        from files.helpers import get_allowed_video_extensions

        allowed_extensions = get_allowed_video_extensions()

        # Extract file extension from uploaded filename
        if self.upload.filename:
            file_ext = os.path.splitext(self.upload.filename)[1].lower().lstrip(".")

            # Validate extension against allowlist
            if allowed_extensions and file_ext not in allowed_extensions:
                data = {
                    "success": False,
                    "error": f"File type '.{file_ext}' is not allowed. Allowed types: {', '.join(allowed_extensions)}",
                    "preventRetry": True,
                }
                return self.make_response(data, status=400)

        self.on_request_received()
        try:
            if self.chunks_done:
                return self.make_response(self.complete(form.cleaned_data["qquuid"]))
            if self.upload.total_parts == 1:
                self.upload.save()
                assembly = sessions.Assembly(real_path=self.upload.real_path, upload_dir=self.upload.file_path)
                return self.make_response({"success": True, "media_url": self.finish(assembly)})

            chunk = sessions.ChunkRequest.from_form(
                form.cleaned_data, self.request.POST.get(sessions.FINGERPRINT_PARAM)
            )
            sessions.accept_chunk(self.request.user, self.target_media, chunk)
            if not self.concurrent and chunk.part_index == chunk.total_parts - 1:
                return self.make_response(self.complete(chunk.uuid))
            return self.make_response({"success": True})
        except sessions.UploadRejected as rejection:
            return self.make_response(rejection.response_data(), status=rejection.status)

    def complete(self, upload_uuid):
        return sessions.complete(self.request.user, self.target_media, upload_uuid, self.finish)

    def on_request_received(self):
        pass

    def finish(self, assembly):
        """Turn the uploaded file at ``assembly.real_path`` into this upload's result; return its media URL."""
        raise NotImplementedError


class FineUploaderView(ChunkedUploadView):
    def on_request_received(self):
        if self.upload.part_index == 0 and not self.chunks_done:
            self.log_upload_event("cinematacms.upload.started")

    def finish(self, assembly):
        # The bulk-upload flow sends `is_draft=1`: each freshly uploaded file
        # is created as a private draft so it stays out of the admin review
        # queue (and the public site) until the user explicitly submits/shares
        # — at which point bulk_submit clears the flag. The single-upload flow
        # does not send the param, so it is not a draft.
        is_draft = str(self.request.POST.get("is_draft", "")).lower() in ("1", "true", "yes")
        return create_media_from_upload(self.request, assembly, is_draft=is_draft)

    def log_upload_event(self, event_name):
        log_upload_event(self.request, event_name)


class MediaFileUpdateView(ChunkedUploadView):
    """
    View for updating the media_file of an existing Media object.
    Used in edit media page to upload replacement media files via upload subdomain.
    """

    def finish(self, assembly):
        return stage_replacement_file(self.request, self.target_media, assembly, self.upload.filename)


def log_upload_event(request, event_name):
    logger.info(
        event_name,
        extra={
            "route_group": UPLOAD_ROUTE_GROUP,
            "operation": UPLOAD_ROUTE_GROUP,
            "upload_ref": upload_reference(request),
        },
    )


def create_media_from_upload(request, assembly, *, is_draft):
    """Create the caller's media from an uploaded file and return its URL."""
    media_file = os.path.join(settings.MEDIA_ROOT, assembly.real_path)
    with open(media_file, "rb") as f:
        myfile = File(f)
        new = Media(
            media_file=myfile,
            user=request.user,
            is_draft=is_draft,
            is_reviewed=is_trusted_uploader(request.user),
        )
        # Every upload stays private until its details are saved: the details
        # form or bulk submit sets the chosen state, and an upload whose form
        # is never saved waits for orphan cleanup unseen. Inserting it private
        # also covers media_init, which runs in post_save right after the insert.
        new.save(force_insert=True, initial_state="private")
    rm_file(media_file)
    shutil.rmtree(os.path.join(settings.MEDIA_ROOT, assembly.upload_dir))
    log_upload_event(request, "cinematacms.upload.finished")
    return new.get_absolute_url()


def stage_replacement_file(request, target_media, assembly, filename):
    """Keep an uploaded replacement file in the session until the edit form is saved."""
    # Get the uploaded file path
    media_file = os.path.join(settings.MEDIA_ROOT, assembly.real_path)
    upload_file_path = os.path.join(settings.MEDIA_ROOT, assembly.upload_dir)

    # Get file size
    file_size = 0
    try:
        if os.path.exists(media_file):
            file_size = os.path.getsize(media_file)
    except Exception as e:
        logger.error(
            f"Failed to get file size for uploaded file {media_file} for media {target_media.friendly_token}: {e}",
            exc_info=True,
        )
        capture_unexpected_exception(e)

    # DEFER PERSISTENCE: Do NOT save media_file yet
    # Instead, store the temporary file path in session
    # Only ONE file replacement is allowed at a time

    session_key = f"media_file_updated_{target_media.friendly_token}"
    session_data = request.session.get(session_key, {})

    # Clean up any previous pending upload if user uploads again before submitting
    if session_data.get("temp_file_path"):
        old_temp = session_data["temp_file_path"]
        old_upload_path = session_data.get("upload_file_path")

        # Use centralized cleanup helper with directory traversal protection
        cleanup_temp_upload_files(
            temp_file_path=old_temp,
            upload_file_path=old_upload_path,
            media_friendly_token=target_media.friendly_token,
            logger=logger,
        )

    # If this is the first upload for this session, store the original media_file path
    if not session_data.get("original_file_path"):
        original_file_path = None
        if target_media.media_file:
            try:
                original_file_path = target_media.media_file.path
            except Exception as e:
                logger.error(
                    f"Failed to get original media file path for media {target_media.friendly_token}: {e}",
                    exc_info=True,
                )
                capture_unexpected_exception(e)
        session_data["original_file_path"] = original_file_path

    # Store the new upload info
    session_data["updated"] = True
    session_data["temp_file_path"] = media_file
    session_data["upload_file_path"] = upload_file_path
    session_data["timestamp"] = datetime.now().isoformat()
    session_data["size"] = file_size
    session_data["filename"] = filename

    request.session[session_key] = session_data

    return target_media.get_absolute_url()


class UploadSessionLookupView(UploadTargetMixin, generic.View):
    """Finds the caller's unfinished upload of a file so the browser can resume it.

    The browser sends the file's identity; the response lists the parts the server
    holds, verified on disk, so only the missing parts are sent again.
    """

    http_method_names = ("get",)

    def get(self, request, *args, **kwargs):
        form = UploadSessionLookupForm(request.GET)
        if not form.is_valid():
            return JsonResponse({"success": False, "error": "Invalid upload identity."}, status=400)
        found = sessions.find_resumable(request.user, self.target_media, **form.cleaned_data)
        if found is None:
            return JsonResponse({"success": False, "error": "No resumable upload."}, status=404)
        session, parts = found
        return JsonResponse(
            {"success": True, "uuid": str(session.uuid), "total_parts": session.total_parts, "parts": parts}
        )


class UploadSessionView(UploadTargetMixin, generic.View):
    """Cancels the caller's unfinished upload and deletes its chunks."""

    http_method_names = ("delete",)

    def delete(self, request, *args, **kwargs):
        try:
            session = sessions.cancel(request.user, self.target_media, kwargs["upload_id"])
        except sessions.UploadRejected as rejection:
            return JsonResponse(rejection.response_data(), status=rejection.status)
        if session is None:
            return JsonResponse({"success": False, "error": "Upload not found."}, status=404)
        return JsonResponse({"success": True, "status": session.status})


class MediaFileUploadCancelView(generic.View):
    """
    View for cancelling a pending media file upload and cleaning up temporary files.
    """

    http_method_names = ("post",)

    def post(self, request, *args, **kwargs):
        # Get the media object
        friendly_token = kwargs.get("friendly_token")
        if not friendly_token:
            return JsonResponse({"success": False, "error": "Media identifier required"}, status=400)

        try:
            media = Media.objects.get(friendly_token=friendly_token)
        except Media.DoesNotExist:
            return JsonResponse({"success": False, "error": "Media not found"}, status=404)

        # Check if user has permission to update this media
        from files.methods import is_mediacms_editor, is_mediacms_manager

        if not (request.user == media.user or is_mediacms_editor(request.user) or is_mediacms_manager(request.user)):
            return JsonResponse({"success": False, "error": "Permission denied"}, status=403)

        # Get session data for this media
        session_key = f"media_file_updated_{media.friendly_token}"
        session_data = request.session.get(session_key, {})

        # Clean up any pending upload files
        if session_data.get("temp_file_path"):
            temp_file_path = session_data["temp_file_path"]
            upload_file_path = session_data.get("upload_file_path")

            # Use centralized cleanup helper with directory traversal protection
            cleanup_temp_upload_files(
                temp_file_path=temp_file_path,
                upload_file_path=upload_file_path,
                media_friendly_token=media.friendly_token,
                logger=logger,
            )

        # Clear the session data
        request.session.pop(session_key, None)

        return JsonResponse({"success": True, "message": "Upload cancelled and temporary files cleaned up"})
