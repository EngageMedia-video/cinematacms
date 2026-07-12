from rest_framework import serializers

from files.lists import video_countries
from files.serializers import PrivateJournalNoteSerializer

from .models import User

# Pre-build country dict once at module level to avoid rebuilding on every serialization
VIDEO_COUNTRIES_DICT = dict(video_countries)


class ProfilePrivateJournalNoteSerializer(PrivateJournalNoteSerializer):
    """Notes aggregated on the profile carry their media context so each entry
    can render a thumbnail card and deep-link back to the film at its timestamp.

    The per-media viewer serializer omits this because the viewer already knows
    its own media.
    """

    media = serializers.SerializerMethodField()

    class Meta(PrivateJournalNoteSerializer.Meta):
        fields = PrivateJournalNoteSerializer.Meta.fields + ("media",)

    def get_media(self, obj):
        media = obj.media
        request = self.context.get("request")
        thumbnail_url = media.thumbnail_url
        url = media.get_absolute_url()
        if request is not None:
            if thumbnail_url:
                thumbnail_url = request.build_absolute_uri(thumbnail_url)
            url = request.build_absolute_uri(url)
        return {
            "title": media.title,
            "friendly_token": media.friendly_token,
            "url": url,
            "thumbnail_url": thumbnail_url,
            "duration": media.duration,
        }


class UserSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    is_trusted = serializers.BooleanField(source="advancedUser", read_only=True)
    location = serializers.SerializerMethodField()

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

    def get_api_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url(api=True))

    def get_thumbnail_url(self, obj):
        thumbnail_url = obj.thumbnail_url()
        if not thumbnail_url:
            return None
        return self.context["request"].build_absolute_uri(thumbnail_url)

    def get_location(self, obj):
        # If user has custom location text, use that
        if obj.location and obj.location.strip():
            return obj.location

        # Otherwise, return country name from country code
        if obj.location_country:
            return VIDEO_COUNTRIES_DICT.get(obj.location_country, "")

        return ""

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
    is_trusted = serializers.BooleanField(source="advancedUser", read_only=True)

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

    def get_api_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url(api=True))

    def get_thumbnail_url(self, obj):
        thumbnail_url = obj.thumbnail_url()
        if not thumbnail_url:
            return None
        return self.context["request"].build_absolute_uri(thumbnail_url)

    class Meta:
        model = User
        read_only_fields = (
            "date_added",
            "is_featured",
            "uid",
            "username",
            "is_manager",
            "is_editor",
            "media_count",
        )
        fields = (
            "description",
            "date_added",
            "name",
            "is_featured",
            "thumbnail_url",
            "banner_thumbnail_url",
            "url",
            "username",
            "is_manager",
            "is_editor",
            "is_trusted",
            "email_is_verified",
            "media_count",
            "media_info",
            "api_url",
            "edit_url",
            "default_channel_edit_url",
            "institution",
            "title",
            "location",
            "location_country",
            "home_page",
            "social_media_links",
            "location_info",
        )
        extra_kwargs = {"name": {"required": False}}
