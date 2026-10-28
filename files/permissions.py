from rest_framework import permissions

from .methods import can_manage_film_impact, can_manage_uploads, can_upload_media, is_mediacms_editor


class IsMediacmsEditor(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(is_mediacms_editor(request.user))


class IsManageUploadsUser(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and can_manage_uploads(request.user))


class IsUploadMediaUser(permissions.BasePermission):
    """Allows any authenticated user who may upload media (single or bulk).

    Single-file-only users must also be able to fetch the shared form option
    lists for the single-upload page. The options
    are public taxonomy data (categories, languages, licenses) with no per-user
    content, so gating on upload capability alone is sufficient.
    """

    def has_permission(self, request, view):
        return bool(request.user.is_authenticated and can_upload_media(request.user))


class IsFilmImpactManager(permissions.BasePermission):
    def has_permission(self, request, view):
        return bool(can_manage_film_impact(request.user))
