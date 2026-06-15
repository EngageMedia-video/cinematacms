from rest_framework import permissions

from .methods import can_manage_film_impact, can_manage_uploads, is_mediacms_editor


class IsMediacmsEditor(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(is_mediacms_editor(request.user))


class IsManageUploadsUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and can_manage_uploads(request.user))


class IsBulkUploadUser(permissions.BasePermission):
    """Allows users who may use the bulk-upload flow (limit of at least 2 files).

    This is broader than IsManageUploadsUser: regular users get a small bulk
    limit too, so they must be able to fetch form options and submit batches.
    Single-file-only users (limit < 2) are rejected (issue #524, D8).
    """

    def has_permission(self, request, view):
        from cms.permissions import user_allowed_to_bulk_upload

        return bool(request.user.is_authenticated and user_allowed_to_bulk_upload(request))


class IsFilmImpactManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(can_manage_film_impact(request.user))
