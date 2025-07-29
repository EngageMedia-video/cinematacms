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

def user_requires_mfa(user):
    if not user.is_authenticated:
        return False
    
    required_roles = getattr(settings, 'MFA_REQUIRED_ROLES', ['superuser'])
    role_checks = {
        'superuser': user.is_superuser,
        'editor': user.is_editor,
        'manager': user.is_manager,
        'advanced_user': user.advancedUser,
        'authenticated': user.is_authenticated
    }

    for role in required_roles:
        if role in role_checks and role_checks[role]:
            return True
    
    return False

def should_enforce_mfa_on_path(path):
    """
    Check if MFA should be enforced on a given path.
    
    Args:
        path: Request path string
        
    Returns:
        bool: True if MFA should be enforced, False otherwise
    """
    enforce_paths = getattr(settings, 'MFA_ENFORCE_ON_PATHS', ['/admin/'])
    exclude_paths = getattr(settings, 'MFA_EXCLUDE_PATHS', ['/fu/', '/api/', '/manage/', '/accounts/'])
    
    # Check if path should be excluded
    for exclude_path in exclude_paths:
        if path.startswith(exclude_path):
            return False
    
    # Check if path should be enforced
    for enforce_path in enforce_paths:
        if path.startswith(enforce_path):
            return True
    
    return False
