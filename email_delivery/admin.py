from django.contrib import admin

from .models import EmailDeliveryReceipt


@admin.register(EmailDeliveryReceipt)
class EmailDeliveryReceiptAdmin(admin.ModelAdmin):
    list_display = ("delivery_id", "email_kind", "status", "attempt_count", "created_at", "updated_at")
    list_filter = ("email_kind", "status")
    search_fields = ("=delivery_id", "=recipient_ref", "=celery_task_id")
    readonly_fields = (
        "delivery_id",
        "recipient_ref",
        "email_kind",
        "status",
        "attempt_count",
        "celery_task_id",
        "reason_code",
        "created_at",
        "updated_at",
    )

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
