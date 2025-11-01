from rest_framework import serializers

from .models import User
from files.lists import video_countries

# Pre-build country dict once at module level to avoid rebuilding on every serialization
VIDEO_COUNTRIES_DICT = dict(video_countries)


class UserSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    is_trusted = serializers.BooleanField(source='advancedUser', read_only=True)
    location = serializers.SerializerMethodField()

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

    def get_api_url(self, obj):
        return self.context["request"].build_absolute_uri(
            obj.get_absolute_url(api=True)
        )

    def get_thumbnail_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.thumbnail_url())

    def get_location(self, obj):
        # If user has custom location text, use that
        if obj.location and obj.location.strip():
            return obj.location

        # Otherwise, return country name from country code
        if obj.location_country:
            return VIDEO_COUNTRIES_DICT.get(obj.location_country, '')

        return ''

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
            "location",  # Free text location for display
            "location_country",  # Country code for filtering
            "is_trusted",  # Alias for advancedUser
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
