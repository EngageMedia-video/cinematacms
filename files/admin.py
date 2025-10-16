import re
import logging
from django import forms
from django.contrib import admin
from tinymce.widgets import TinyMCE

from users.models import User
from users.validators import validate_internal_html

from .models import (
    Category,
    Comment,
    EncodeProfile,
    Encoding,
    HomepagePopup,
    IndexPageFeatured,
    Language,
    License,
    Media,
    MediaLanguage,
    Page,
    Rating,
    RatingCategory,
    Subtitle,
    Tag,
    Topic,
    TopMessage,
    TinyMCEMedia,
    TranscriptionRequest,
)

logger = logging.getLogger(__name__)


class CommentAdmin(admin.ModelAdmin):
    search_fields = ["text"]
    list_display = ["text", "add_date", "user", "media"]
    ordering = ("-add_date",)
    readonly_fields = ("user", "media", "parent")


class MediaAdmin(admin.ModelAdmin):
    search_fields = ["title"]
    list_display = [
        "title",
        "user",
        "get_file_size",
        "add_date",
        "views",
        "year_produced",
        "media_type",
        "duration",
        "state",
        "is_reviewed",
        "encoding_status",
        "featured",
        "get_comments_count",
    ]
    list_filter = ["state", "is_reviewed", "encoding_status", "featured", "category"]
    ordering = ("-add_date",)
    readonly_fields = ("tags", "category", "channel")

    def get_file_size(self, obj):
        """Display the file size of the media"""
        if obj.size:
            return obj.size
        elif obj.media_file:
            try:
                # If size is not set, calculate it from the file
                import os
                from . import helpers

                file_size = os.path.getsize(obj.media_file.path)
                return helpers.show_file_size(file_size)
            except (OSError, ValueError):
                return "N/A"
        return "N/A"

    get_file_size.short_description = "File Size"
    get_file_size.admin_order_field = "size"  # Allow sorting by this column

    def get_comments_count(self, obj):
        return obj.comments.count()

    get_comments_count.short_description = "Comments count"

    def get_form(self, request, obj=None, **kwargs):
        form = super(MediaAdmin, self).get_form(request, obj, **kwargs)
        form.base_fields["user"].queryset = User.objects.filter().order_by("username")
        return form


class EncodingAdmin(admin.ModelAdmin):
    pass


class CategoryAdmin(admin.ModelAdmin):
    search_fields = ["title"]
    list_display = ["title", "user", "add_date", "is_global", "media_count"]
    list_filter = ["is_global"]
    ordering = ("-add_date",)
    readonly_fields = ("user", "media_count")


class TagAdmin(admin.ModelAdmin):
    search_fields = ["title"]
    list_display = ["title", "user", "media_count"]
    readonly_fields = ("user", "media_count")


class EncodeProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "extension", "resolution", "codec", "description", "active")
    list_filter = ["extension", "resolution", "codec", "active"]
    search_fields = ["name", "extension", "resolution", "codec", "description"]
    list_per_page = 100
    fields = ("name", "extension", "resolution", "codec", "description", "active")


class LanguageAdmin(admin.ModelAdmin):
    pass


class SubtitleAdmin(admin.ModelAdmin):
    list_filter = ["language"]


class RatingCategoryAdmin(admin.ModelAdmin):
    search_fields = ["title"]
    list_display = ["title", "enabled", "category"]
    list_filter = ["category"]


class RatingAdmin(admin.ModelAdmin):
    search_fields = ["user"]
    list_display = ["user", "rating_category", "media"]
    list_filter = ["rating_category"]


#    readonly_fields = ('score', 'media')


class LicenseAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "allow_commercial",
        "allow_modifications",
        "url",
        "thumbnail_path",
    ]


class TopicAdmin(admin.ModelAdmin):
    pass


class MediaLanguageAdmin(admin.ModelAdmin):
    pass


class PageAdminForm(forms.ModelForm):
    description = forms.CharField(widget=TinyMCE())

    def clean_description(self):
        content = self.cleaned_data["description"]
        # Add sandbox attribute to all iframes
        content = content.replace(
            "<iframe ",
            '<iframe sandbox="allow-scripts allow-same-origin allow-presentation" ',
        )
        return content

    class Meta:
        model = Page
        fields = "__all__"


class PageAdmin(admin.ModelAdmin):
    form = PageAdminForm


class TopMessageAdmin(admin.ModelAdmin):
    list_display = ("text", "add_date", "active")


class IndexPageFeaturedAdminForm(forms.ModelForm):
    text = forms.CharField(
        widget=forms.Textarea(
            attrs={
                "rows": 4,
                "placeholder": "Enter description text. HTML links allowed for both internal and external URLs.",
            }
        ),
        help_text="HTML formatting allowed. Internal links (start with / or #) and external links (start with http:// or https://) are supported. Example: &lt;a href=&quot;/about&quot;&gt;About Us&lt;/a&gt; or &lt;a href=&quot;https://example.com&quot;&gt;External Link&lt;/a&gt;",
    )

    class Meta:
        model = IndexPageFeatured
        fields = "__all__"

    def clean_text(self):
        """
        Validate and sanitize HTML content for admin form.

        1. Validates that only allowed tags and internal links are present
        2. Sanitizes by removing dangerous tags
        3. Returns the cleaned value that will be persisted to the database
        """
        content = self.cleaned_data["text"]
        # Validate and sanitize - will raise ValidationError if disallowed content found
        # Returns the cleaned value for persistence
        return validate_internal_html(content)


class IndexPageFeaturedAdmin(admin.ModelAdmin):
    form = IndexPageFeaturedAdminForm
    list_display = ("title", "url", "api_url", "ordering", "active")


class HomepagePopupAdmin(admin.ModelAdmin):
    list_display = ("text", "url", "popup", "add_date", "active")


class TranscriptionRequestAdmin(admin.ModelAdmin):
    list_display = [
        "media_title",
        "add_date",
        "language",
        "country",
        "translate_to_english",
    ]
    search_fields = ["media__title"]
    list_filter = ["translate_to_english", "add_date"]
    readonly_fields = ["add_date"]
    ordering = ["-add_date"]
    actions = ["delete_selected_requests"]

    def get_actions(self, request):
        """Override to remove the default delete action and keep only our custom one"""
        actions = super().get_actions(request)
        # Remove the default 'delete_selected' action
        if "delete_selected" in actions:
            del actions["delete_selected"]
        return actions

    def media_title(self, obj):
        return obj.media.title if obj.media else "Unknown"

    media_title.short_description = "Media Title"

    def language(self, obj):
        """Get the language of the media"""
        if obj.media and obj.media.media_language:
            try:
                media_language = obj.media.media_language
                language_row = (
                    Language.objects.exclude(
                        code__in=["automatic-translation", "automatic"]
                    )
                    .values("title")
                    .filter(code=media_language)
                    .first()
                )
                return (language_row and language_row["title"]) or (
                    media_language or "Not specified"
                )
            except Exception as e:
                logger.info("Transcription Request Language Not Specified")
                return "Not specified"
        return "Not specified"

    language.short_description = "Language"

    def country(self, obj):
        """Get the country of the media"""
        if obj.media and obj.media.media_country:
            # Get the display name from the choices
            from . import lists

            country_dict = dict(lists.video_countries)
            return country_dict.get(obj.media.media_country, obj.media.media_country)
        return "Not specified"

    country.short_description = "Country"

    def delete_selected_requests(self, request, queryset):
        """Allow retranscoding by deleting transcription requests"""
        count = queryset.count()
        media_titles = [req.media.title for req in queryset if req.media]

        # Reset the Media model fields to allow retranscoding
        for req in queryset:
            if req.media:
                req.media.allow_whisper_transcribe = False
                req.media.allow_whisper_transcribe_and_translate = False
                req.media.save(
                    update_fields=[
                        "allow_whisper_transcribe",
                        "allow_whisper_transcribe_and_translate",
                    ]
                )

        queryset.delete()

        if count == 1:
            self.message_user(
                request,
                f"Deleted transcription request for '{media_titles[0]}'. "
                f"You can now retry transcription from the media interface.",
            )
        else:
            self.message_user(
                request,
                f"Deleted {count} transcription requests. "
                f"You can now retry transcription for affected media.",
            )

    delete_selected_requests.short_description = (
        "Delete requests (enable retranscoding)"
    )


@admin.register(TinyMCEMedia)
class TinyMCEMediaAdmin(admin.ModelAdmin):
    list_display = ["original_filename", "file_type", "uploaded_at", "user"]
    list_filter = ["file_type", "uploaded_at"]
    search_fields = ["original_filename"]
    readonly_fields = ["uploaded_at"]
    date_hierarchy = "uploaded_at"


admin.site.register(EncodeProfile, EncodeProfileAdmin)
admin.site.register(Comment, CommentAdmin)
admin.site.register(Media, MediaAdmin)
admin.site.register(Encoding, EncodingAdmin)
admin.site.register(Category, CategoryAdmin)
admin.site.register(Tag, TagAdmin)
admin.site.register(Subtitle, SubtitleAdmin)
admin.site.register(Language, LanguageAdmin)
admin.site.register(RatingCategory, RatingCategoryAdmin)
admin.site.register(Rating, RatingAdmin)
admin.site.register(License, LicenseAdmin)
admin.site.register(Topic, TopicAdmin)
admin.site.register(Page, PageAdmin)
admin.site.register(TopMessage, TopMessageAdmin)
admin.site.register(IndexPageFeatured, IndexPageFeaturedAdmin)
admin.site.register(MediaLanguage, MediaLanguageAdmin)
admin.site.register(HomepagePopup, HomepagePopupAdmin)
admin.site.register(TranscriptionRequest, TranscriptionRequestAdmin)
