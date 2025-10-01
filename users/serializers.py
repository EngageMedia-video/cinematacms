from rest_framework import serializers

from files.models import IndexPageFeatured
from .validators import validate_internal_html
from .models import User


class UserSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

    def get_api_url(self, obj):
        return self.context["request"].build_absolute_uri(
            obj.get_absolute_url(api=True)
        )

    def get_thumbnail_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.thumbnail_url())

    class Meta:
        model = User
        read_only_fields = (
            "date_added",
            "is_featured",
            "uid",
            "username",
            "advancedUser",
            "is_editor",
            "is_manager",
            "email_is_verified",
        )
        fields = (
            "description",
            "date_added",
            "name",
            "is_featured",
            "thumbnail_url",
            "url",
            "api_url",
            "username",
            "advancedUser",
            "is_editor",
            "is_manager",
            "email_is_verified",
            "media_count",
        )


class UserDetailSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

    def get_api_url(self, obj):
        return self.context["request"].build_absolute_uri(
            obj.get_absolute_url(api=True)
        )

    def get_thumbnail_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.thumbnail_url())

    class Meta:
        model = User
        read_only_fields = ("date_added", "is_featured", "uid", "username")
        fields = (
            "description",
            "date_added",
            "name",
            "is_featured",
            "thumbnail_url",
            "banner_thumbnail_url",
            "url",
            "username",
            "media_info",
            "api_url",
            "edit_url",
            "default_channel_edit_url",
            "home_page",
            "social_media_links",
            "location_info",
        )
        extra_kwargs = {"name": {"required": False}}

# files/serializers.py
class IndexPageFeaturedSerializer(serializers.ModelSerializer):
    class Meta:
        model = IndexPageFeatured
        fields = ("title", "url", "api_url", "ordering", "active", "text")
    
    def validate_text(self, value):
        """Ensure HTML content is safe and internal-only"""
        return validate_internal_html(value)