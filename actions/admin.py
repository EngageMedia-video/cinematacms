from django.contrib import admin
from django.contrib.auth import get_permission_codename
from django.urls import reverse
from django.utils.html import format_html

from .models import MediaReport


@admin.register(MediaReport)
class MediaReportAdmin(admin.ModelAdmin):
    list_display = ["media_link", "reporter", "action_date", "extra_info", "media_visibility"]
    list_display_links = ["action_date"]
    list_filter = ["action_date"]
    search_fields = ["media__title", "user__username"]
    ordering = ["-action_date"]
    list_select_related = ["media", "user"]
    # remote_ip and session_key identify the Reporter and must stay off the page.
    fields = ["media_link", "reporter", "action_date", "extra_info", "media_visibility"]
    readonly_fields = fields
    # Django allows URL lookups on every local field, which would let the row
    # counts reveal remote_ip and session_key. These are the lookups sent by
    # the MediaAdmin link and the date filter.
    url_lookups = frozenset({"media__id__exact", "action_date__gte", "action_date__lt"})

    def lookup_allowed(self, lookup, value, request=None):
        return lookup in self.url_lookups

    def has_view_permission(self, request, obj=None):
        # Django's default also accepts change_mediareport.
        return request.user.has_perm(f"{self.opts.app_label}.{get_permission_codename('view', self.opts)}")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    @admin.display(description="media", ordering="media__title")
    def media_link(self, report):
        return format_html(
            '<a href="{}">{}</a>', reverse("admin:files_media_change", args=[report.media_id]), report.media.title
        )

    @admin.display(description="Reporter", ordering="user__username")
    def reporter(self, report):
        return report.user.username if report.user else "Anonymous"

    @admin.display(description="Visibility", ordering="media__state")
    def media_visibility(self, report):
        return report.media.get_state_display()
