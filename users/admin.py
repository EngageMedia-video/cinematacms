from django.contrib import admin
from django.db.models import Subquery, OuterRef
from allauth.mfa.utils import is_mfa_enabled
from allauth.mfa.models import Authenticator

from .models import BlackListedEmail, User


class BlackListedEmailAdmin(admin.ModelAdmin):
    pass


class UserAdmin(admin.ModelAdmin):
    search_fields = ["email", "username", "name"]
    exclude = (
        "user_permissions",
        "institution",
        "title",
        "password",
        "groups",
        "last_login",
        "is_featured",
        "location",
        "first_name",
        "last_name",
        "media_count",
        "date_joined",
        "is_staff",
        "is_active",
    )
    list_display = [
        "username",
        "advancedUser",
        "name",
        "email",
        "media_count",
        "logo",
        "date_added",
        "is_superuser",
        "is_editor",
        "is_manager",
        "has_mfa_enabled",
        "mfa_created_at"
    ]
    list_filter = ["is_superuser", "is_editor", "is_manager"]
    ordering = ("-date_added",)

    def has_mfa_enabled(self, obj):
        return Authenticator.objects.filter(user=obj).exists()

    has_mfa_enabled.boolean = True  # Display as a checkmark/cross icon
    has_mfa_enabled.short_description = 'MFA Enabled'

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        queryset = queryset.annotate(
            mfa_created=Subquery(
                Authenticator.objects.filter(user=OuterRef('pk'))
                .order_by('created_at')
                .values('created_at')[:1]
            )
        )
        return queryset

    def mfa_created_at(self, obj):
        return obj.mfa_created


    # ROLE UPDATE NOTIFICATION (ADDED)
    def save_model(self, request, obj, form, change):
        """
        Detects when a superuser upgrades user roles (advancedUser, is_editor, is_manager)
        and sends an email notification.
        """

        from files.methods import notify_user_on_role_update  # imported here to avoid circular import

        upgraded_roles = []

        # Only superusers trigger notifications AND only on existing users (change=True)
        if change and request.user.is_superuser:
            ROLE_FIELDS = ["advancedUser", "is_editor", "is_manager"]

            # Fetch old user data
            old_obj = User.objects.filter(pk=obj.pk).first()

            if old_obj:
                for role in ROLE_FIELDS:
                    old_val = getattr(old_obj, role)
                    new_val = getattr(obj, role)

                    # Trigger only when role becomes True (upgrade)
                    if old_val is False and new_val is True:
                        upgraded_roles.append(role)

        # Save first
        super().save_model(request, obj, form, change)

        # Send notification after saving
        if upgraded_roles:
            notify_user_on_role_update(obj, upgraded_roles)


# unregister regular authenticator model
admin.site.unregister(Authenticator)

@admin.register(Authenticator)
class CustomAuthenticatorAdmin(admin.ModelAdmin):
    list_display = ('user', 'type', 'auth_description', 'created_at', 'last_used_at')
    list_filter = ('type', 'created_at', 'last_used_at')
    readonly_fields = ('type', 'user', 'data_masked', 'created_at', 'last_used_at')
    exclude = ('data',)  # Hide the raw data field

    def get_fields(self, request, obj=None):
        """Ensure 'data' field is not directly editable"""
        fields = super().get_fields(request, obj)
        if 'data' in fields:
            fields.remove('data')
        return fields

    def auth_description(self, obj):
        """Display a meaningful name for the authenticator without revealing secrets"""
        if obj.type == obj.Type.WEBAUTHN:
            return f"WebAuthn: {obj.wrap().name}"
        elif obj.type == obj.Type.TOTP:
            return "Authenticator App"
        elif obj.type == obj.Type.RECOVERY_CODES:
            # Show count of unused codes without revealing the codes themselves
            unused_count = len(obj.wrap().get_unused_codes())
            return f"Recovery Codes ({unused_count} remaining)"
        return obj.get_type_display()

    auth_description.short_description = "Authentication Method"

    def data_masked(self, obj):
        """Display a masked version of the data"""
        if obj.type == obj.Type.WEBAUTHN:
            # For WebAuthn, only show name and creation data
            name = obj.wrap().name
            has_credential = "credential" in obj.data
            return f"Name: {name}, Has credential data: {'Yes' if has_credential else 'No'}"

        elif obj.type == obj.Type.TOTP:
            # For TOTP, just indicate secret exists but don't show it
            has_secret = "secret" in obj.data
            return f"TOTP secret: {'[ENCRYPTED]' if has_secret else 'None'}"

        elif obj.type == obj.Type.RECOVERY_CODES:
            # For recovery codes, show count and usage status
            seed = obj.data.get("seed", None)
            unused_count = len(obj.wrap().get_unused_codes())
            total_count = 0

            # Try to determine total recovery code count
            from allauth.mfa import app_settings as mfa_settings
            total_count = mfa_settings.RECOVERY_CODE_COUNT

            return (
                f"Unused codes: {unused_count}/{total_count}\n"
                f"Seed: {'[ENCRYPTED]' if seed else 'None'}"
            )

        # Generic fallback
        data_keys = list(obj.data.keys())
        return f"Keys: {', '.join(data_keys)}"

    data_masked.short_description = "Protected Data"


# is_superuser: global site administrator
# TODO: Show 'is_editor' in the list filter as well
admin.site.register(User, UserAdmin)
admin.site.register(BlackListedEmail, BlackListedEmailAdmin)
