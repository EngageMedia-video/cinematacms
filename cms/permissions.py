from django.apps import apps
from django.conf import settings
from rest_framework import permissions

from files.methods import is_mediacms_editor, is_mediacms_manager


class IsAuthorizedToAdd(permissions.BasePermission):
    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        return user_allowed_to_upload(request)


class IsUserOrManager(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.is_superuser:
            return True
        if is_mediacms_manager(request.user):
            return True

        if hasattr(obj, "user"):
            return obj.user == request.user
        else:
            return obj == request.user


class IsUserOrEditor(permissions.BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        if request.user.is_superuser:
            return True
        if is_mediacms_editor(request.user):
            return True

        return obj.user == request.user


def user_allowed_to_upload(request):
    # CUSTOM LOGIC SHOULD GO HERE!
    if request.user.is_anonymous:
        return False
    if request.user.is_superuser:
        return True

    if settings.CAN_ADD_MEDIA == "all":
        return True
    elif settings.CAN_ADD_MEDIA == "email_verified":
        if request.user.email_is_verified:
            return True
    elif settings.CAN_ADD_MEDIA == "advancedUser":
        if request.user.advancedUser:
            return True
    return False


def is_trusted_uploader(user):
    """Whether a user counts as a "trusted" uploader for upload-limit purposes.

    Single source of truth for the elevated-trust check: superusers, managers,
    editors and advanced users. Keeps the role list from being duplicated across
    the bulk-upload limit helpers.
    """
    if not user or user.is_anonymous:
        return False
    try:
        return bool(user.is_superuser or user.is_manager or user.is_editor or user.advancedUser)
    except AttributeError:
        return False


def max_bulk_upload_files(user):
    """Maximum number of files a user may upload in a single bulk-upload batch.

    Trusted uploaders (see ``is_trusted_uploader``) get the higher limit;
    everyone else gets the regular limit. Both limits are settings-overridable so
    a deployment can tighten or relax the policy without code changes (issue
    #524). This is distinct from the single-upload page's per-user FineUploader
    cap (``UPLOAD_MAX_FILES_NUMBER`` in files/context_processors.py).
    """
    if not user or user.is_anonymous:
        return 0
    trusted_limit = getattr(settings, "BULK_UPLOAD_MAX_FILES_TRUSTED", 10)
    regular_limit = getattr(settings, "BULK_UPLOAD_MAX_FILES_REGULAR", 2)
    return trusted_limit if is_trusted_uploader(user) else regular_limit


def user_allowed_to_bulk_upload(request):
    """Whether a user may use the dedicated bulk-upload page.

    The user must be allowed to upload at all and have a per-batch limit of at
    least two files. Single-file-only users (limit < 2) are rejected here and
    sent to the single-upload page (issue #524, decision D8).
    """
    if not user_allowed_to_upload(request):
        return False
    return max_bulk_upload_files(request.user) >= 2


def user_requires_mfa(user):
    if not user.is_authenticated:
        return False

    required_roles = getattr(settings, "MFA_REQUIRED_ROLES", ["superuser"])
    role_checks = {
        "superuser": user.is_superuser,
        "editor": user.is_editor,
        "manager": user.is_manager,
        "curator": user.is_curator,
        "advanced_user": user.advancedUser,
        "authenticated": user.is_authenticated,
    }

    return any(role in role_checks and role_checks[role] for role in required_roles)


def is_mfa_enabled_for_user(user):
    if not apps.is_installed("allauth.mfa"):
        return False

    from allauth.mfa.utils import is_mfa_enabled

    return is_mfa_enabled(user)


def should_enforce_mfa_on_path(path):
    """
    Check if MFA should be enforced on a given path.

    Args:
        path: Request path string

    Returns:
        bool: True if MFA should be enforced, False otherwise
    """
    enforce_paths = getattr(settings, "MFA_ENFORCE_ON_PATHS", ["/admin/"])
    exclude_paths = getattr(settings, "MFA_EXCLUDE_PATHS", ["/fu/", "/api/", "/manage/", "/accounts/"])

    # Check if path should be excluded
    for exclude_path in exclude_paths:
        if path.startswith(exclude_path):
            return False

    # Check if path should be enforced
    return any(path.startswith(enforce_path) for enforce_path in enforce_paths)
