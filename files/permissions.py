from rest_framework import permissions

from .methods import can_manage_film_impact, can_manage_uploads, can_upload_media, is_mediacms_editor


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


class IsUploadMediaUser(permissions.BasePermission):
    """Allows any authenticated user who may upload media (single or bulk).

    Broader than IsBulkUploadUser: single-file-only users must also be able to
    fetch the shared form option lists for the single-upload page. The options
    are public taxonomy data (categories, languages, licenses) with no per-user
    content, so gating on upload capability alone is sufficient.
    """

    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and can_upload_media(request.user))


class IsFilmImpactManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(can_manage_film_impact(request.user))
