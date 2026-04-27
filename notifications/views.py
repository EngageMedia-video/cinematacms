from django.utils import timezone
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Notification, NotificationType
from .serializers import (
    NotificationPagination,
    NotificationPreferenceSerializer,
    NotificationSerializer,
)
from .services import NotificationService


class NotificationList(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        queryset = Notification.objects.filter(recipient=request.user).select_related("actor")

        notification_type = request.query_params.get("type")
        if notification_type:
            if notification_type not in NotificationType.values:
                return Response(
                    {"detail": f"Invalid type. Must be one of: {', '.join(NotificationType.values)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            queryset = queryset.filter(notification_type=notification_type)

        is_read = request.query_params.get("is_read")
        if is_read is not None:
            if is_read.lower() not in ("true", "false"):
                return Response(
                    {"detail": "is_read must be 'true' or 'false'."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            queryset = queryset.filter(is_read=is_read.lower() == "true")

        paginator = NotificationPagination()
        page = paginator.paginate_queryset(queryset, request)
        serializer = NotificationSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)


class UnreadCount(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).count()
        return Response({"unread_count": count})


class MarkAsRead(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, notification_id):
        try:
            notification = Notification.objects.get(id=notification_id, recipient=request.user)
        except Notification.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

        notification.mark_as_read()
        return Response(
            {
                "id": notification.id,
                "is_read": notification.is_read,
                "read_at": notification.read_at,
            }
        )


class MarkAllAsRead(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request):
        count = Notification.objects.filter(recipient=request.user, is_read=False).update(
            is_read=True, read_at=timezone.now()
        )
        return Response({"marked_count": count})


class NotificationPreferenceDetail(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        prefs = NotificationService.get_or_create_preferences(request.user)
        serializer = NotificationPreferenceSerializer(prefs)
        return Response(serializer.data)

    def patch(self, request):
        prefs = NotificationService.get_or_create_preferences(request.user)
        serializer = NotificationPreferenceSerializer(prefs, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        return Response(serializer.data)
