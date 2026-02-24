from rest_framework import serializers

from .models import (
    Category,
    Comment,
    EncodeProfile,
    HomepagePopup,
    IndexPageFeatured,
    Media,
    MediaCountry,
    MediaLanguage,
    Playlist,
    Tag,
    Topic,
    TopMessage,
)

# TODO: put them in a more DRY way


class MediaSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source="user.username")
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
            "year_produced",
        )


class SingleMediaSerializer(serializers.ModelSerializer):
    user = serializers.ReadOnlyField(source="user.username")
    url = serializers.SerializerMethodField()

    def get_url(self, obj):
        return self.context["request"].build_absolute_uri(obj.get_absolute_url())

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
            "preview_url",
            "author_name",
            "author_profile",
            "author_thumbnail",
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
            "hls_info",
            "subtitles_info",
            "ratings_info",
            "allow_download",
            "year_produced",
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
            "description",
            "friendly_token",
            "duration",
            "url",
            "media_type",
            "preview_url",
            "media_country_info",
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
        )


class TopicSerializer(serializers.ModelSerializer):
    class Meta:
        model = Topic
        fields = ("title", "media_count", "thumbnail_url")


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
        )


class CommentSerializer(serializers.ModelSerializer):
    author_profile = serializers.ReadOnlyField(source="user.get_absolute_url")
    author_name = serializers.ReadOnlyField(source="user.name")
    author_thumbnail_url = serializers.ReadOnlyField(source="user.thumbnail_url")

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
            "media_url",
            "uid",
        )


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
