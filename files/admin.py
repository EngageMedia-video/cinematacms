# from ckeditor.widgets import CKEditorWidget
from django import forms
from django.contrib import admin
from tinymce.widgets import TinyMCE

from users.models import User

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
)


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
    # description = forms.CharField(widget=CKEditorWidget())

    class Meta:
        model = Page
        fields = "__all__"
        widgets = {
            "description": TinyMCE(),
        }


class PageAdmin(admin.ModelAdmin):
    form = PageAdminForm
    

class TopMessageAdmin(admin.ModelAdmin):
    list_display = ("text", "add_date", "active")


class IndexPageFeaturedAdmin(admin.ModelAdmin):
    list_display = ("title", "url", "api_url", "ordering", "active")


class HomepagePopupAdmin(admin.ModelAdmin):
    list_display = ("text", "url", "popup", "add_date", "active")


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
