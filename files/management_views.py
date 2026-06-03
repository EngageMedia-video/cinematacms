from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework import status
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import APIView

from users.models import User
from users.serializers import UserSerializer

from .methods import is_mediacms_manager
from .models import Comment, CommunityImpact, Media
from .permissions import IsFilmImpactManager, IsManageUploadsUser, IsMediacmsEditor
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
        qs = Media.objects.filter()
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
