import logging

from django import forms
from django.contrib import admin
from django.utils import timezone
from tinymce.widgets import TinyMCE

from users.models import User
from users.validators import validate_internal_html

from .models import (
    Category,
    Comment,
    EncodeProfile,
    Encoding,
    FeaturedVideo,
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
    TinyMCEMedia,
    Topic,
    TopMessage,
    TranscriptionRequest,
)

logger = logging.getLogger(__name__)


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    search_fields = ["text"]
    list_display = ["text", "add_date", "user", "media"]
    ordering = ("-add_date",)
    readonly_fields = ("user", "media", "parent")


@admin.register(Media)
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
        "featured_date",
        "get_comments_count",
    ]
    list_filter = ["state", "is_reviewed", "encoding_status", "featured", "category"]
    ordering = ("-add_date",)
    readonly_fields = ("tags", "category", "channel")

    @admin.display(
        description="File Size",
        ordering="size",
    )
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

    @admin.display(description="Comments count")
    def get_comments_count(self, obj):
        return obj.comments.count()

    def get_form(self, request, obj=None, **kwargs):
        form = super(MediaAdmin, self).get_form(request, obj, **kwargs)
        form.base_fields["user"].queryset = User.objects.filter().order_by("username")
        return form


@admin.register(Encoding)
class EncodingAdmin(admin.ModelAdmin):
    pass


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    search_fields = ["title"]
    list_display = ["title", "user", "add_date", "is_global", "media_count"]
    list_filter = ["is_global"]
    ordering = ("-add_date",)
    readonly_fields = ("user", "media_count")


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    search_fields = ["title"]
    list_display = ["title", "user", "media_count"]
    readonly_fields = ("user", "media_count")


@admin.register(EncodeProfile)
class EncodeProfileAdmin(admin.ModelAdmin):
    list_display = ("name", "extension", "resolution", "codec", "description", "active")
    list_filter = ["extension", "resolution", "codec", "active"]
    search_fields = ["name", "extension", "resolution", "codec", "description"]
    list_per_page = 100
    fields = ("name", "extension", "resolution", "codec", "description", "active")


@admin.register(Language)
class LanguageAdmin(admin.ModelAdmin):
    pass


@admin.register(Subtitle)
class SubtitleAdmin(admin.ModelAdmin):
    list_filter = ["language"]


@admin.register(RatingCategory)
class RatingCategoryAdmin(admin.ModelAdmin):
    search_fields = ["title"]
    list_display = ["title", "enabled", "category"]
    list_filter = ["category"]


@admin.register(Rating)
class RatingAdmin(admin.ModelAdmin):
    search_fields = ["user"]
    list_display = ["user", "rating_category", "media"]
    list_filter = ["rating_category"]


#    readonly_fields = ('score', 'media')


@admin.register(License)
class LicenseAdmin(admin.ModelAdmin):
    list_display = [
        "title",
        "allow_commercial",
        "allow_modifications",
        "url",
        "thumbnail_path",
    ]


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    pass


@admin.register(MediaLanguage)
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


@admin.register(Page)
class PageAdmin(admin.ModelAdmin):
    form = PageAdminForm


@admin.register(TopMessage)
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


@admin.register(IndexPageFeatured)
class IndexPageFeaturedAdmin(admin.ModelAdmin):
    form = IndexPageFeaturedAdminForm
    list_display = ("title", "url", "api_url", "ordering", "active")


@admin.register(HomepagePopup)
class HomepagePopupAdmin(admin.ModelAdmin):
    list_display = ("text", "url", "popup", "add_date", "active")


@admin.register(TranscriptionRequest)
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

    @admin.display(description="Media Title")
    def media_title(self, obj):
        return obj.media.title if obj.media else "Unknown"

    @admin.display(description="Language")
    def language(self, obj):
        """Get the language of the media"""
        if obj.media and obj.media.media_language:
            try:
                media_language = obj.media.media_language
                language_row = (
                    Language.objects.exclude(code__in=["automatic-translation", "automatic"])
                    .values("title")
                    .filter(code=media_language)
                    .first()
                )
                return (language_row and language_row["title"]) or (media_language or "Not specified")
            except Exception:
                logger.info("Transcription Request Language Not Specified")
                return "Not specified"
        return "Not specified"

    @admin.display(description="Country")
    def country(self, obj):
        """Get the country of the media"""
        if obj.media and obj.media.media_country:
            # Get the display name from the choices
            from . import lists

            country_dict = dict(lists.video_countries)
            return country_dict.get(obj.media.media_country, obj.media.media_country)
        return "Not specified"

    @admin.action(description="Delete requests (enable retranscoding)")
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
                f"Deleted {count} transcription requests. You can now retry transcription for affected media.",
            )


@admin.register(TinyMCEMedia)
class TinyMCEMediaAdmin(admin.ModelAdmin):
    list_display = ["original_filename", "file_type", "uploaded_at", "user"]
    list_filter = ["file_type", "uploaded_at"]
    search_fields = ["original_filename"]
    readonly_fields = ["uploaded_at"]
    date_hierarchy = "uploaded_at"


@admin.register(FeaturedVideo)
class FeaturedVideoAdmin(admin.ModelAdmin):
    list_display = [
        "media",
        "start_date",
        "end_date",
        "is_active",
        "source",
        "status_display",
    ]
    list_filter = ["is_active", "source"]
    search_fields = ["media__title"]
    autocomplete_fields = ["media"]
    readonly_fields = ["add_date", "source", "created_by"]
    date_hierarchy = "start_date"

    fieldsets = (
        (
            None,
            {
                "fields": ("media", "is_active"),
            },
        ),
        (
            "Schedule",
            {
                "fields": ("start_date", "end_date"),
                "description": (
                    "⏰ All times are in UTC. "
                    "Check https://time.is/UTC for current UTC time. "
                    "Plan your schedule accordingly."
                ),
            },
        ),
        (
            "Audit Information",
            {
                "fields": ("source", "created_by", "add_date"),
                "classes": ("collapse",),
            },
        ),
    )

    @admin.display(description="Status")
    def status_display(self, obj):
        now = timezone.now()
        if not obj.is_active:
            return "⏸️ Disabled"
        if obj.start_date > now:
            return "⏳ Scheduled"
        if obj.end_date and obj.end_date < now:
            return "✅ Completed"
        return "🔴 Live"

    def save_model(self, request, obj, form, change):
        """Validate and set metadata before saving."""
        obj.full_clean()

        if not change:  # New object
            obj.created_by = request.user
            obj.source = "admin"
        super().save_model(request, obj, form, change)
