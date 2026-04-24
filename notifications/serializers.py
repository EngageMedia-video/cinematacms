from rest_framework import serializers
from rest_framework.pagination import PageNumberPagination

from .models import Notification, NotificationPreference


class NotificationActorSerializer(serializers.Serializer):
    username = serializers.CharField(read_only=True)
    name = serializers.CharField(read_only=True)
    thumbnail_url = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()

    def get_thumbnail_url(self, obj):
        thumb = obj.thumbnail_url()
        if thumb and "request" in self.context:
            return self.context["request"].build_absolute_uri(thumb)
        return None

    def get_url(self, obj):
        return obj.get_absolute_url()


class NotificationSerializer(serializers.ModelSerializer):
    actor = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = [
            "id",
            "notification_type",
            "message",
            "action_url",
            "is_read",
            "actor",
            "metadata",
            "created_at",
            "read_at",
        ]

    def get_actor(self, obj):
        if obj.actor is None:
            return None
        return NotificationActorSerializer(obj.actor, context=self.context).data


class NotificationPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class NotificationPreferenceSerializer(serializers.ModelSerializer):
    class Meta:
        model = NotificationPreference
        fields = [
            "on_comment",
            "on_reply",
            "on_like",
            "on_follow",
            "on_mention",
            "on_new_media_from_following",
            "on_added_to_playlist",
        ]
