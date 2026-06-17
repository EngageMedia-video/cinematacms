from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from django.utils.text import slugify
from rest_framework import status
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import APIView

from cms.permissions import max_bulk_upload_files
from users.models import User
from users.serializers import UserSerializer

from . import lists
from .forms import MediaForm
from .methods import is_mediacms_manager
from .models import (
    Category,
    Comment,
    CommunityImpact,
    ContentSensitivity,
    License,
    Media,
    Tag,
    Topic,
    get_language_choices,
)
from .permissions import IsBulkUploadUser, IsFilmImpactManager, IsManageUploadsUser, IsMediacmsEditor
from .serializers import CommentSerializer, ManageCommunityImpactSerializer, ManageUploadSerializer, MediaSerializer

VALID_MEDIA_STATES = ["private", "public", "restricted", "unlisted"]


class MediaList(APIView):
    permission_classes = (IsMediacmsEditor,)
    parser_classes = (JSONParser,)

    def get(self, request, format=None):
        params = self.request.query_params
        ordering = params.get("ordering", "").strip()
        sort_by = params.get("sort_by", "").strip()
        state = params.get("state", "").strip()
        encoding_status = params.get("encoding_status", "").strip()
        media_type = params.get("media_type", "").strip()
        search = params.get("search", "").strip()

        params.get("add_date", "").strip()
        params.get("edit_date", "").strip()
        featured = params.get("featured", "").strip()
        is_reviewed = params.get("is_reviewed", "").strip()

        sort_by_options = [
            "title",
            "add_date",
            "edit_date",
            "views",
            "likes",
            "reported_times",
        ]
        if sort_by not in sort_by_options:
            sort_by = "add_date"
        ordering = "" if ordering == "asc" else "-"

        if media_type not in ["video", "image", "audio", "pdf"]:
            media_type = None

        if state not in VALID_MEDIA_STATES:
            state = None

        if encoding_status not in ["pending", "running", "fail", "success"]:
            encoding_status = None

        if featured == "true":
            featured = True
        elif featured == "false":
            featured = False
        else:
            featured = "all"
        if is_reviewed == "true":
            is_reviewed = True
        elif is_reviewed == "false":
            is_reviewed = False
        else:
            is_reviewed = "all"

        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
        # Exclude drafts so unsubmitted bulk-upload drafts (state=private, is_draft=True)
        # never enter the admin review queue. They are surfaced only after the user
        # submits them via the bulk-upload flow, which clears is_draft.
        qs = Media.objects.exclude(is_draft=True)
        if state:
            qs = qs.filter(state=state)
        if encoding_status:
            qs = qs.filter(encoding_status=encoding_status)
        if media_type:
            qs = qs.filter(media_type=media_type)

        if featured != "all":
            qs = qs.filter(featured=featured)
        if is_reviewed != "all":
            qs = qs.filter(is_reviewed=is_reviewed)
        if search:
            qs = qs.filter(title__icontains=search)

        media = qs.order_by(f"{ordering}{sort_by}")

        paginator = pagination_class()

        page = paginator.paginate_queryset(media, request)

        serializer = MediaSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    def delete(self, request, format=None):
        tokens = request.GET.get("tokens")
        if tokens:
            tokens = tokens.split(",")
            Media.objects.filter(friendly_token__in=tokens).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyUploadsList(APIView):
    permission_classes = (IsManageUploadsUser,)
    parser_classes = (JSONParser,)

    def get(self, request, format=None):
        params = self.request.query_params
        ordering = params.get("ordering", "").strip()
        sort_by = params.get("sort_by", "").strip()
        state = params.get("state", "").strip()
        encoding_status = params.get("encoding_status", "").strip()
        search = params.get("search", "").strip()

        sort_by_options = ["title", "add_date", "edit_date", "views", "likes"]
        if sort_by not in sort_by_options:
            sort_by = "add_date"
        ordering = "" if ordering == "asc" else "-"

        if state not in VALID_MEDIA_STATES:
            state = None

        if encoding_status not in ["pending", "running", "fail", "success"]:
            encoding_status = None

        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
        qs = Media.objects.select_related("user").filter(user=request.user)
        if state:
            qs = qs.filter(state=state)
        if encoding_status:
            qs = qs.filter(encoding_status=encoding_status)
        if search:
            qs = qs.filter(title__icontains=search)

        media = qs.order_by(f"{ordering}{sort_by}")

        paginator = pagination_class()
        page = paginator.paginate_queryset(media, request)

        serializer = ManageUploadSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    def delete(self, request, format=None):
        tokens = request.GET.get("tokens")
        if not tokens:
            return Response(
                {"detail": "tokens query parameter is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        tokens = list({t.strip() for t in tokens.split(",") if t.strip()})
        if not tokens:
            return Response(
                {"detail": "tokens must contain at least one value"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        with transaction.atomic():
            qs = Media.objects.select_for_update().filter(friendly_token__in=tokens, user=request.user)
            if qs.count() != len(tokens):
                return Response(
                    {"detail": "one or more tokens not found or not owned by you"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            qs.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MyUploadsBulkState(APIView):
    permission_classes = (IsManageUploadsUser,)
    parser_classes = (JSONParser,)

    def post(self, request, format=None):
        tokens = request.data.get("tokens", [])
        new_state = request.data.get("state", "").strip()

        if not tokens or not isinstance(tokens, list):
            return Response(
                {"detail": "tokens must be a non-empty list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Deduplicate tokens to avoid count mismatch on repeated values
        tokens = list(set(tokens))

        if new_state not in ["private", "public", "unlisted"]:
            return Response(
                {"detail": "state must be private, public, or unlisted"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            qs = Media.objects.select_for_update().filter(friendly_token__in=tokens, user=request.user)
            if qs.count() != len(tokens):
                return Response(
                    {"detail": "one or more tokens not found or not owned by you"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            updated = qs.update(state=new_state)
        return Response({"updated": updated}, status=status.HTTP_200_OK)


def _bulk_apply_tags(media, new_tags_value, user):
    """Replace a media's tags from a comma-separated string.

    Mirrors the tag handling in files.views.edit_media so bulk submit produces
    the same tags as the single-upload edit flow.
    """
    media.tags.clear()
    if not new_tags_value:
        return
    for raw in str(new_tags_value).split(","):
        tag_title = slugify(raw)
        if not tag_title:
            continue
        try:
            tag = Tag.objects.get(title=tag_title)
        except Tag.DoesNotExist:
            tag = Tag.objects.create(title=tag_title, user=user)
        media.tags.add(tag)


_DRAFT_SCALAR_FIELDS = (
    "title",
    "summary",
    "description",
    "company",
    "website",
    "media_language",
    "media_country",
)
_DRAFT_M2M_MODELS = {
    "category": Category,
    "topics": Topic,
    "content_sensitivity": ContentSensitivity,
}


def _bulk_license_error(metadata):
    if metadata.get("no_license") or not metadata.get("custom_license"):
        return None
    try:
        license_id = int(metadata["custom_license"])
    except (TypeError, ValueError):
        return "Select a valid license."
    if not License.objects.filter(pk=license_id).exists():
        return "Select a valid license."
    return None


def _bulk_apply_draft(media, metadata, user):
    """Leniently apply whatever metadata exists, marking the media a private draft.

    Drafts skip required-field validation so a user can save partial progress at
    any sub-step. Everything is best-effort; invalid scalars are ignored rather
    than raising, since a draft is by definition incomplete.
    """
    for field in _DRAFT_SCALAR_FIELDS:
        value = metadata.get(field)
        if value is not None:
            setattr(media, field, value)

    year = metadata.get("year_produced")
    if year == "other":
        year = metadata.get("year_produced_custom")
    if year not in (None, "", "other"):
        try:
            media.year_produced = int(year)
        except (TypeError, ValueError):
            pass

    if "enable_comments" in metadata:
        media.enable_comments = bool(metadata["enable_comments"])
    if "allow_download" in metadata:
        media.allow_download = bool(metadata["allow_download"])

    if metadata.get("no_license"):
        media.license = None
    elif metadata.get("custom_license"):
        try:
            license_id = int(metadata["custom_license"])
        except (TypeError, ValueError):
            pass
        else:
            if License.objects.filter(pk=license_id).exists():
                media.license_id = license_id

    # Drafts are always kept private and flagged out of the admin review queue.
    media.state = "private"
    media.is_draft = True
    media.save()

    for field, model in _DRAFT_M2M_MODELS.items():
        value = metadata.get(field)
        if isinstance(value, list):
            getattr(media, field).set(model.objects.filter(pk__in=value))

    if "new_tags" in metadata:
        _bulk_apply_tags(media, metadata.get("new_tags"), user)


class BulkUploadOptions(APIView):
    """Form option lists for the bulk-upload metadata step.

    Returns ids/codes (not just titles) so the client submits exactly what
    MediaForm expects: M2M PKs for category/topic/content-sensitivity, language
    and country codes, and license PKs.
    """

    permission_classes = (IsBulkUploadUser,)

    def get(self, request, format=None):
        data = {
            "categories": list(Category.objects.order_by("title").values("id", "title")),
            "topics": list(Topic.objects.order_by("title").values("id", "title")),
            "content_sensitivities": list(ContentSensitivity.objects.order_by("title").values("id", "title")),
            "languages": [{"code": code, "title": title} for code, title in get_language_choices()],
            "countries": [{"code": code, "title": title} for code, title in lists.video_countries],
            "licenses": list(License.objects.order_by("title").values("id", "title")),
        }
        return Response(data)


# The bulk metadata form only ever exposes this fixed set of fields. Any other
# MediaForm field is dropped before validation so it is neither required nor
# altered here — notably the editor-only admin fields (featured, reported_times,
# is_reviewed, add_date) that MediaForm keeps required for editors but the bulk
# UI never shows, plus the upload/poster fields handled elsewhere.
#
# This is an allowlist coupled to MediaForm.Meta.fields by hand: every entry
# must be a real MediaForm field or it silently won't be saved (construct_instance
# only iterates the remaining form.fields). test_bulk_upload guards the subset
# invariant; if you expose a new field in the bulk UI, add it here too.
_BULK_SUBMIT_FIELDS = {
    "title",
    "summary",
    "description",
    "year_produced",
    "year_produced_custom",
    "company",
    "website",
    "media_language",
    "media_country",
    "category",
    "topics",
    "content_sensitivity",
    "new_tags",
    "custom_license",
    "no_license",
    "enable_comments",
    "allow_download",
    "state",
    "password",
}


class BulkUploadSubmit(APIView):
    """Apply per-file metadata to a batch of already-uploaded media.

    Each uploaded file already exists as a Media row (created by the chunked
    uploader). This endpoint applies the wizard metadata to those rows, either
    saving them as private drafts (action="draft") or running the same
    validation/publish path as the single-upload edit flow (action="submit").
    """

    permission_classes = (IsBulkUploadUser,)
    parser_classes = (JSONParser,)

    def post(self, request, format=None):
        action = (request.data.get("action") or "").strip().lower()
        items = request.data.get("items", [])

        if action not in ("draft", "submit"):
            return Response({"detail": "action must be 'draft' or 'submit'"}, status=status.HTTP_400_BAD_REQUEST)
        if not isinstance(items, list) or not items:
            return Response({"detail": "items must be a non-empty list"}, status=status.HTTP_400_BAD_REQUEST)

        # Enforce the per-role batch limit server-side (authoritative).
        max_files = max_bulk_upload_files(request.user)
        if len(items) > max_files:
            return Response(
                {"detail": f"You can submit at most {max_files} files in one batch."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        metadata_by_token = {}
        for item in items:
            if not isinstance(item, dict):
                return Response({"detail": "each item must be an object"}, status=status.HTTP_400_BAD_REQUEST)
            token = (item.get("friendly_token") or "").strip()
            if not token:
                return Response({"detail": "each item requires a friendly_token"}, status=status.HTTP_400_BAD_REQUEST)
            metadata = item.get("metadata")
            if not isinstance(metadata, dict):
                return Response({"detail": "metadata must be an object"}, status=status.HTTP_400_BAD_REQUEST)
            license_error = _bulk_license_error(metadata)
            if license_error:
                return Response(
                    {"detail": "invalid metadata", "errors": {token: {"custom_license": [license_error]}}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            metadata_by_token[token] = metadata

        tokens = list(metadata_by_token.keys())

        with transaction.atomic():
            qs = Media.objects.select_for_update().filter(friendly_token__in=tokens, user=request.user)
            media_by_token = {m.friendly_token: m for m in qs}
            if len(media_by_token) != len(tokens):
                return Response(
                    {"detail": "one or more tokens not found or not owned by you"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            if action == "draft":
                for token, media in media_by_token.items():
                    _bulk_apply_draft(media, metadata_by_token[token], request.user)
                return Response({"updated": len(media_by_token)}, status=status.HTTP_200_OK)

            # action == "submit": validate every item first (all-or-nothing),
            # reusing MediaForm so semantics match the single-upload edit flow.
            errors = {}
            valid_forms = {}
            for token, media in media_by_token.items():
                form = MediaForm(request.user, data=metadata_by_token[token], instance=media)
                # Restrict validation/saving to the fields the bulk UI exposes,
                # so role-dependent admin fields (e.g. reported_times for editors)
                # don't reject a submit for metadata the user can't even enter.
                for field_name in list(form.fields):
                    if field_name not in _BULK_SUBMIT_FIELDS:
                        form.fields.pop(field_name, None)
                if form.is_valid():
                    valid_forms[token] = form
                else:
                    errors[token] = form.errors
            if errors:
                return Response(
                    {"detail": "validation failed", "errors": errors},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            for token, form in valid_forms.items():
                media = media_by_token[token]
                media._current_user = request.user
                saved = form.save()
                _bulk_apply_tags(saved, form.cleaned_data.get("new_tags"), request.user)
                # MediaForm.save() clears is_draft for a completed item (shared
                # with the edit-page path), so no separate clear is needed here.
            return Response({"updated": len(valid_forms)}, status=status.HTTP_200_OK)


class CommentList(APIView):
    permission_classes = (IsMediacmsEditor,)
    parser_classes = (JSONParser,)

    def get(self, request, format=None):
        params = self.request.query_params
        ordering = params.get("ordering", "").strip()
        sort_by = params.get("sort_by", "").strip()

        sort_by_options = ["text", "add_date"]
        if sort_by not in sort_by_options:
            sort_by = "add_date"
        ordering = "" if ordering == "asc" else "-"

        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS

        qs = Comment.objects.filter()
        media = qs.order_by(f"{ordering}{sort_by}")

        paginator = pagination_class()

        page = paginator.paginate_queryset(media, request)

        serializer = CommentSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    def delete(self, request, format=None):
        comment_ids = request.GET.get("comment_ids")
        if comment_ids:
            comments = comment_ids.split(",")
            Comment.objects.filter(uid__in=comments).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class UserList(APIView):
    permission_classes = (IsMediacmsEditor,)
    parser_classes = (JSONParser,)

    def get(self, request, format=None):
        params = self.request.query_params
        ordering = params.get("ordering", "").strip()
        sort_by = params.get("sort_by", "").strip()
        role = params.get("role", "all").strip()

        sort_by_options = ["date_added", "name"]
        if sort_by not in sort_by_options:
            sort_by = "date_added"
        ordering = "" if ordering == "asc" else "-"

        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS

        qs = User.objects.filter()
        if role == "manager":
            qs = qs.filter(is_manager=True)
        elif role == "editor":
            qs = qs.filter(is_editor=True)
        media = qs.order_by(f"{ordering}{sort_by}")

        paginator = pagination_class()

        page = paginator.paginate_queryset(media, request)

        serializer = UserSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    def delete(self, request, format=None):
        if not is_mediacms_manager(request.user):
            return Response({"detail": "bad permissions"}, status=status.HTTP_400_BAD_REQUEST)

        tokens = request.GET.get("tokens")
        if tokens:
            tokens = tokens.split(",")
            User.objects.filter(username__in=tokens).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CommunityImpactList(APIView):
    permission_classes = (IsFilmImpactManager,)
    parser_classes = (JSONParser,)

    def get(self, request, format=None):
        params = self.request.query_params
        category = params.get("category", "").strip()
        impact_status = params.get("status", "").strip()
        search = params.get("search", "").strip()
        ordering = params.get("ordering", "").strip()
        sort_by = params.get("sort_by", "").strip()
        event_date_from = (
            params.get("event_date_from", "").strip()
            or params.get("event_date_after", "").strip()
            or params.get("start_date", "").strip()
        )
        event_date_to = (
            params.get("event_date_to", "").strip()
            or params.get("event_date_before", "").strip()
            or params.get("end_date", "").strip()
        )

        sort_by_options = ["event_date", "add_date"]
        if sort_by not in sort_by_options:
            sort_by = "event_date"
        ordering = "" if ordering == "asc" else "-"

        category_options = {choice[0] for choice in CommunityImpact.CATEGORY_CHOICES}
        if category not in category_options:
            category = None
        status_options = {choice[0] for choice in CommunityImpact.STATUS_CHOICES}
        if impact_status not in status_options:
            impact_status = None

        qs = CommunityImpact.objects.select_related("media", "user")
        if category:
            qs = qs.filter(category=category)
        if impact_status:
            qs = qs.filter(status=impact_status)
        if search:
            qs = qs.filter(
                Q(title__icontains=search)
                | Q(details__icontains=search)
                | Q(media__title__icontains=search)
                | Q(user__username__icontains=search)
            )

        parsed_event_date_from = parse_date(event_date_from) if event_date_from else None
        if parsed_event_date_from:
            qs = qs.filter(event_date__gte=parsed_event_date_from)

        parsed_event_date_to = parse_date(event_date_to) if event_date_to else None
        if parsed_event_date_to:
            qs = qs.filter(event_date__lte=parsed_event_date_to)

        impacts = qs.order_by(f"{ordering}{sort_by}", "-add_date")

        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
        paginator = pagination_class()
        page = paginator.paginate_queryset(impacts, request)

        serializer = ManageCommunityImpactSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)


class CommunityImpactDetail(APIView):
    permission_classes = (IsFilmImpactManager,)
    parser_classes = (JSONParser,)

    def get_object(self, uid):
        return get_object_or_404(CommunityImpact.objects.select_related("media", "user"), uid=uid)

    def get(self, request, uid, format=None):
        impact = self.get_object(uid)
        serializer = ManageCommunityImpactSerializer(impact, context={"request": request})
        return Response(serializer.data)

    def patch(self, request, uid, format=None):
        impact = self.get_object(uid)
        serializer = ManageCommunityImpactSerializer(
            impact, data=request.data, partial=True, context={"request": request}
        )
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, uid, format=None):
        impact = self.get_object(uid)
        impact.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
