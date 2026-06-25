from django.db.models import Max
from django.urls import reverse
from django.utils import timezone
from rest_framework import serializers

from actions.models import MediaAction

from .community_impact_validators import validate_trusted_url
from .models import (
    Category,
    Comment,
    CommunityImpact,
    ContentSensitivity,
    EncodeProfile,
    HomepagePopup,
    IndexPageFeatured,
    Media,
    MediaCountry,
    MediaLanguage,
    Playlist,
    PlaylistMedia,
    Tag,
    Topic,
    TopMessage,
)

# TODO: put them in a more DRY way


class MediaSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source="user.username")
    summary = serializers.ReadOnlyField()
    url = serializers.SerializerMethodField()
    api_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()
    author_profile = serializers.SerializerMethodField()
    author_thumbnail = serializers.SerializerMethodField()

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

    def get_api_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url(api=True))

    def get_thumbnail_url(self, obj):
        if not obj.thumbnail_url:
            return None
        return self.context["request"].build_absolute_uri(obj.thumbnail_url)

    def get_author_profile(self, obj):
        return self.context["request"].build_absolute_uri(obj.author_profile())

    def get_author_thumbnail(self, obj):
        return self.context["request"].build_absolute_uri(obj.author_thumbnail())

    class Meta:
        model = Media
        read_only_fields = (
            "friendly_token",
            "user",
            "add_date",
            "summary",
            "views",
            "media_type",
            "state",
            "duration",
            "encoding_status",
            "views",
            "likes",
            "dislikes",
            "reported_times",
            "size",
            "is_reviewed",
            "featured",
            "featured_date",
        )
        fields = (
            "friendly_token",
            "url",
            "api_url",
            "user",
            "title",
            "description",
            "summary",
            "add_date",
            "views",
            "media_type",
            "state",
            "duration",
            "thumbnail_url",
            "is_reviewed",
            "url",
            "api_url",
            "preview_url",
            "author_name",
            "author_profile",
            "author_thumbnail",
            "author_is_trusted",
            "author_is_manager",
            "encoding_status",
            "views",
            "likes",
            "dislikes",
            "reported_times",
            "featured",
            "featured_date",
            "user_featured",
            "size",
            "media_country_info",
            "categories_info",
            "year_produced",
        )


class HeroPlaybackSerializer(serializers.ModelSerializer):
    poster_url = serializers.SerializerMethodField()
    sprites_url = serializers.SerializerMethodField()
    preview_url = serializers.SerializerMethodField()
    encodings_info = serializers.SerializerMethodField()
    hls_info = serializers.SerializerMethodField()
    subtitles_info = serializers.SerializerMethodField()

    def _absolute_url(self, url):
        if not url:
            return url
        request = self.context.get("request")
        if not request:
            return url
        return request.build_absolute_uri(url)

    def _absolute_encoding_urls(self, value):
        if isinstance(value, dict):
            return {
                key: self._absolute_url(nested)
                if key == "url" and isinstance(nested, str)
                else self._absolute_encoding_urls(nested)
                for key, nested in value.items()
            }
        if isinstance(value, list):
            return [self._absolute_encoding_urls(item) for item in value]
        return value

    def get_poster_url(self, obj):
        return self._absolute_url(obj.poster_url)

    def get_sprites_url(self, obj):
        return self._absolute_url(obj.sprites_url)

    def get_preview_url(self, obj):
        return self._absolute_url(obj.preview_url)

    def get_encodings_info(self, obj):
        return self._absolute_encoding_urls(obj.encodings_info)

    def get_hls_info(self, obj):
        return {key: self._absolute_url(url) for key, url in obj.hls_info.items()}

    def get_subtitles_info(self, obj):
        return [
            {
                **subtitle,
                "src": self._absolute_url(subtitle.get("src")),
            }
            for subtitle in obj.subtitles_info
        ]

    class Meta:
        model = Media
        fields = (
            "duration",
            "poster_url",
            "sprites_url",
            "preview_url",
            "thumbnail_time",
            "encodings_info",
            "hls_info",
            "subtitles_info",
        )


class ManageUploadSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

    def get_thumbnail_url(self, obj):
        if not obj.thumbnail_url:
            return None
        return self.context["request"].build_absolute_uri(obj.thumbnail_url)

    class Meta:
        model = Media
        fields = (
            "friendly_token",
            "title",
            "url",
            "thumbnail_url",
            "add_date",
            "media_type",
            "encoding_status",
            "state",
            "views",
            "likes",
        )


class ManageCommunityImpactSerializer(serializers.ModelSerializer):
    WRITABLE_CATEGORIES = {
        CommunityImpact.SCREENING,
        CommunityImpact.FEATURED,
        CommunityImpact.ACADEMIC,
    }

    category_label = serializers.CharField(source="get_category_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    edit_url = serializers.SerializerMethodField()
    media = serializers.SerializerMethodField()
    user = serializers.SerializerMethodField()

    def get_edit_url(self, obj):
        url = reverse("manage_film_impact_edit", args=[obj.uid])
        request = self.context.get("request")
        if request:
            return request.build_absolute_uri(url)
        return url

    def get_media(self, obj):
        url = obj.media.get_absolute_url()
        request = self.context.get("request")
        return {
            "friendly_token": obj.media.friendly_token,
            "title": obj.media.title,
            "url": request.build_absolute_uri(url) if request else url,
        }

    def get_user(self, obj):
        return {
            "username": obj.user.username,
            "name": obj.user.name,
        }

    def validate_details(self, value):
        if len(value.split()) > 80:
            raise serializers.ValidationError("Details cannot exceed 80 words.")
        return value

    def validate_category(self, value):
        if value not in self.WRITABLE_CATEGORIES:
            raise serializers.ValidationError(f"Category must be one of: {sorted(self.WRITABLE_CATEGORIES)}.")
        return value

    def validate_status(self, value):
        status_options = {choice[0] for choice in CommunityImpact.STATUS_CHOICES}
        if value not in status_options:
            raise serializers.ValidationError(f"Status must be one of: {sorted(status_options)}.")
        return value

    def validate_url(self, value):
        return validate_trusted_url(value)

    class Meta:
        model = CommunityImpact
        read_only_fields = (
            "uid",
            "category_label",
            "status_label",
            "media",
            "user",
            "add_date",
            "edit_date",
            "edit_url",
        )
        fields = (
            "uid",
            "title",
            "category",
            "category_label",
            "status",
            "status_label",
            "details",
            "media",
            "user",
            "event_date",
            "add_date",
            "edit_date",
            "url",
            "edit_url",
        )


class SingleMediaSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source="user.username")
    url = serializers.SerializerMethodField()
    user_has_liked = serializers.SerializerMethodField()
    user_has_disliked = serializers.SerializerMethodField()
    community_impacts = serializers.SerializerMethodField()
    sprite_num_secs = serializers.SerializerMethodField()

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

    def get_sprite_num_secs(self, obj):
        # Seconds between consecutive sprite-sheet frames. The thumbnail selector needs
        # this to map a chosen tile back to its exact timestamp (tile i -> i * value),
        # which must match how files/sprites.py extracts the tiles. Exposed instead of
        # hardcoding 10 on the client so the two never drift if the setting changes.
        from django.conf import settings

        return getattr(settings, "SPRITE_NUM_SECS", 10)

    def get_user_has_liked(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return MediaAction.objects.filter(media=obj, user=request.user, action="like").exists()
        return False

    def get_user_has_disliked(self, obj):
        request = self.context.get("request")
        if request and request.user.is_authenticated:
            return MediaAction.objects.filter(media=obj, user=request.user, action="dislike").exists()
        return False

    def get_community_impacts(self, obj):
        entries = obj.community_impacts.filter(status=CommunityImpact.APPROVED)
        grouped = {key: [] for key, _label in CommunityImpact.CATEGORY_CHOICES}
        for entry in entries:
            if entry.category == CommunityImpact.SAVES:
                continue
            grouped[entry.category].append(CommunityImpactSerializer(entry, context=self.context).data)

        playlist_items = PlaylistMedia.objects.filter(media=obj)
        latest_save = playlist_items.aggregate(latest=Max("action_date"))["latest"]
        grouped[CommunityImpact.SAVES] = {
            "entries": [],
            "lastEventAt": latest_save.isoformat() if latest_save else "",
            "totalCount": {
                "saves": playlist_items.values("playlist__user").distinct().count(),
                "playlists": playlist_items.values("playlist_id").distinct().count(),
            },
        }
        return grouped

    class Meta:
        model = Media
        read_only_fields = (
            "friendly_token",
            "user",
            "add_date",
            "views",
            "media_type",
            "state",
            "duration",
            "encoding_status",
            "views",
            "likes",
            "dislikes",
            "reported_times",
            "size",
            "video_height",
            "is_reviewed",
        )
        fields = (
            "url",
            "user",
            "title",
            "description",
            "summary",
            "add_date",
            "edit_date",
            "media_type",
            "state",
            "duration",
            "thumbnail_url",
            "poster_url",
            "thumbnail_time",
            "url",
            "sprites_url",
            "sprite_num_secs",
            "preview_url",
            "author_name",
            "author_profile",
            "author_thumbnail",
            "author_is_trusted",
            "author_is_manager",
            "encodings_info",
            "encoding_status",
            "views",
            "likes",
            "dislikes",
            "reported_times",
            "user_featured",
            "original_media_url",
            "size",
            "video_height",
            "enable_comments",
            "categories_info",
            "topics_info",
            "is_reviewed",
            "company",
            "website",
            "add_subtitle_url",
            "edit_url",
            "media_country_info",
            "media_language_info",
            "license_info",
            "tags_info",
            "content_sensitivity_info",
            "hls_info",
            "is_encrypted",
            "subtitles_info",
            "ratings_info",
            "community_impacts",
            "allow_download",
            "year_produced",
            "user_has_liked",
            "user_has_disliked",
        )


class MediaSearchSerializer(serializers.ModelSerializer):
    url = serializers.SerializerMethodField()

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

    class Meta:
        model = Media
        fields = (
            "title",
            "summary",
            "author_name",
            "author_profile",
            "thumbnail_url",
            "add_date",
            "views",
            "friendly_token",
            "duration",
            "url",
            "media_type",
            "preview_url",
            "media_country_info",
            "categories_info",
        )


class EncodeProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = EncodeProfile
        fields = ("name", "extension", "resolution", "codec", "description")


class CategorySerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source="user.username")

    class Meta:
        model = Category
        fields = (
            "title",
            "description",
            "is_global",
            "media_count",
            "user",
            "thumbnail_url",
            "color",
        )


class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ("title", "media_count", "thumbnail_url")


class ContentSensitivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = ContentSensitivity
        fields = ("title", "media_count")


class MediaLanguageSerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaLanguage
        fields = ("title", "thumbnail_url", "media_count")


class MediaCountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = MediaCountry
        fields = ("title", "thumbnail_url", "media_count")


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ("title", "media_count", "thumbnail_url")


class PlaylistSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source="user.username")

    class Meta:
        model = Playlist
        read_only_fields = ("add_date", "user")
        fields = (
            "add_date",
            "title",
            "description",
            "user",
            "media_count",
            "url",
            "api_url",
            "thumbnail_url",
        )


class PlaylistDetailSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source="user.username")

    class Meta:
        model = Playlist
        read_only_fields = ("add_date", "user")
        fields = (
            "title",
            "add_date",
            "user_thumbnail_url",
            "description",
            "user",
            "media_count",
            "url",
            "thumbnail_url",
            "composite_thumbnail_url",
        )


class CommentSerializer(serializers.ModelSerializer):
    author_profile = serializers.ReadOnlyField(source="user.get_absolute_url")
    author_name = serializers.ReadOnlyField(source="user.name")
    author_thumbnail_url = serializers.ReadOnlyField(source="user.thumbnail_url")
    author_is_trusted = serializers.ReadOnlyField(source="user.advancedUser")
    author_is_manager = serializers.SerializerMethodField()

    def get_author_is_manager(self, obj):
        return obj.user.is_superuser or obj.user.is_manager

    class Meta:
        model = Comment
        read_only_fields = ("add_date", "uid")
        fields = (
            "add_date",
            "text",
            "parent",
            "author_thumbnail_url",
            "author_profile",
            "author_name",
            "author_is_trusted",
            "author_is_manager",
            "media_url",
            "uid",
        )


class CommunityImpactSerializer(serializers.ModelSerializer):
    author_name = serializers.ReadOnlyField(source="user.name")
    author_username = serializers.ReadOnlyField(source="user.username")
    event_date = serializers.DateField(required=False, default=timezone.localdate)
    status_label = serializers.CharField(source="get_status_display", read_only=True)

    WRITABLE_CATEGORIES = {
        CommunityImpact.SCREENING,
        CommunityImpact.FEATURED,
        CommunityImpact.ACADEMIC,
    }

    class Meta:
        model = CommunityImpact
        read_only_fields = (
            "uid",
            "add_date",
            "edit_date",
            "author_name",
            "author_username",
            "status",
            "status_label",
        )
        fields = (
            "uid",
            "category",
            "status",
            "status_label",
            "title",
            "details",
            "event_date",
            "url",
            "add_date",
            "edit_date",
            "author_name",
            "author_username",
        )

    def validate_details(self, value):
        if len(value.split()) > 80:
            raise serializers.ValidationError("Details cannot exceed 80 words.")
        return value

    def validate_category(self, value):
        if value not in self.WRITABLE_CATEGORIES:
            raise serializers.ValidationError(f"Category must be one of: {sorted(self.WRITABLE_CATEGORIES)}.")
        return value

    def validate_url(self, value):
        return validate_trusted_url(value)


class TopMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = TopMessage
        fields = ("add_date", "text", "active")


class HomepagePopupSerializer(serializers.ModelSerializer):
    class Meta:
        model = HomepagePopup
        fields = ("popup_image_url", "url")


class IndexPageFeaturedSerializer(serializers.ModelSerializer):
    api_url = serializers.SerializerMethodField()
    url = serializers.SerializerMethodField()

    def get_api_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.api_url)

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.url)

    class Meta:
        model = IndexPageFeatured
        fields = ("title", "url", "api_url", "ordering", "active", "text")
