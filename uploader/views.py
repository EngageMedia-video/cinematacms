import logging
import os
import shutil
from datetime import datetime

from django.conf import settings
from django.core.exceptions import PermissionDenied
from django.core.files import File
from django.http import JsonResponse
from django.views import generic

from cms.permissions import user_allowed_to_upload
from files.helpers import cleanup_temp_upload_files, rm_file
from files.models import Media

from .fineuploader import ChunkedFineUploader
from .forms import FineUploaderUploadForm, FineUploaderUploadSuccessForm

logger = logging.getLogger(__name__)


class FineUploaderView(generic.FormView):
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

    def dispatch(self, request, *args, **kwargs):
        if not user_allowed_to_upload(request):
            raise PermissionDenied  # HTTP 403
        return super(FineUploaderView, self).dispatch(request, *args, **kwargs)

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
                }
                return self.make_response(data, status=400)

        if self.upload.concurrent and self.chunks_done:
            try:
                self.upload.combine_chunks()
            except FileNotFoundError:
                data = {"success": False, "error": "Error with File Uploading"}
                return self.make_response(data, status=400)
        elif self.upload.total_parts == 1:
            self.upload.save()
        else:
            self.upload.save()
            return self.make_response({"success": True})
        # create media!
        media_file = os.path.join(settings.MEDIA_ROOT, self.upload.real_path)
        with open(media_file, "rb") as f:
            myfile = File(f)
            new = Media.objects.create(media_file=myfile, user=self.request.user)
        rm_file(media_file)
        shutil.rmtree(os.path.join(settings.MEDIA_ROOT, self.upload.file_path))
        return self.make_response({"success": True, "media_url": new.get_absolute_url()})

    def form_invalid(self, form):
        data = {"success": False, "error": "%s" % repr(form.errors)}
        return self.make_response(data, status=400)


class MediaFileUpdateView(generic.FormView):
    """
    View for updating the media_file of an existing Media object.
    Used in edit media page to upload replacement media files via upload subdomain.
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

    def dispatch(self, request, *args, **kwargs):
        # Get the media object
        friendly_token = kwargs.get("friendly_token")
        if not friendly_token:
            raise PermissionDenied("Media identifier required")

        try:
            self.media = Media.objects.get(friendly_token=friendly_token)
        except Media.DoesNotExist:
            raise PermissionDenied("Media not found")

        # Check if user has permission to update this media
        from files.methods import is_mediacms_editor, is_mediacms_manager

        if not (
            request.user == self.media.user or is_mediacms_editor(request.user) or is_mediacms_manager(request.user)
        ):
            raise PermissionDenied("You don't have permission to update this media")

        if not user_allowed_to_upload(request):
            raise PermissionDenied("Upload not allowed")

        return super(MediaFileUpdateView, self).dispatch(request, *args, **kwargs)

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
                }
                return self.make_response(data, status=400)

        if self.upload.concurrent and self.chunks_done:
            try:
                self.upload.combine_chunks()
            except FileNotFoundError:
                data = {"success": False, "error": "Error with File Uploading"}
                return self.make_response(data, status=400)
        elif self.upload.total_parts == 1:
            self.upload.save()
        else:
            self.upload.save()
            return self.make_response({"success": True})

        # Get the uploaded file path
        media_file = os.path.join(settings.MEDIA_ROOT, self.upload.real_path)
        upload_file_path = os.path.join(settings.MEDIA_ROOT, self.upload.file_path)

        # Get file size
        file_size = 0
        try:
            if os.path.exists(media_file):
                file_size = os.path.getsize(media_file)
        except Exception as e:
            logger.error(
                f"Failed to get file size for uploaded file {media_file} for media {self.media.friendly_token}: {e}",
                exc_info=True,
            )

        # DEFER PERSISTENCE: Do NOT save media_file yet
        # Instead, store the temporary file path in session
        # Only ONE file replacement is allowed at a time

        session_key = f"media_file_updated_{self.media.friendly_token}"
        session_data = self.request.session.get(session_key, {})

        # Clean up any previous pending upload if user uploads again before submitting
        if session_data.get("temp_file_path"):
            old_temp = session_data["temp_file_path"]
            old_upload_path = session_data.get("upload_file_path")

            # Use centralized cleanup helper with directory traversal protection
            cleanup_temp_upload_files(
                temp_file_path=old_temp,
                upload_file_path=old_upload_path,
                media_friendly_token=self.media.friendly_token,
                logger=logger,
            )

        # If this is the first upload for this session, store the original media_file path
        if not session_data.get("original_file_path"):
            original_file_path = None
            if self.media.media_file:
                try:
                    original_file_path = self.media.media_file.path
                except Exception as e:
                    logger.error(
                        f"Failed to get original media file path for media {self.media.friendly_token}: {e}",
                        exc_info=True,
                    )
            session_data["original_file_path"] = original_file_path

        # Store the new upload info
        session_data["updated"] = True
        session_data["temp_file_path"] = media_file
        session_data["upload_file_path"] = upload_file_path
        session_data["timestamp"] = datetime.now().isoformat()
        session_data["size"] = file_size
        session_data["filename"] = self.upload.filename

        self.request.session[session_key] = session_data

        return self.make_response({"success": True, "media_url": self.media.get_absolute_url()})

    def form_invalid(self, form):
        data = {"success": False, "error": "%s" % repr(form.errors)}
        return self.make_response(data, status=400)


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
