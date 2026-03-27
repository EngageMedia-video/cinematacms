from rest_framework import permissions

from .methods import can_manage_uploads, is_mediacms_editor


class IsMediacmsEditor(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(is_mediacms_editor(request.user))


class IsManageUploadsUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and can_manage_uploads(request.user))
