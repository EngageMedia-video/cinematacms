from django.contrib import admin

from .models import Notification, NotificationPreference


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["recipient", "notification_type", "message", "is_read", "created_at"]
    list_filter = ["notification_type", "is_read", "created_at"]
    search_fields = ["recipient__username", "message"]
    raw_id_fields = ["recipient", "actor"]
    readonly_fields = ["created_at", "read_at"]


@admin.register(NotificationPreference)
class NotificationPreferenceAdmin(admin.ModelAdmin):
    list_display = ["user", "on_comment", "on_like", "on_follow", "updated_at"]
    search_fields = ["user__username"]
    raw_id_fields = ["user"]
