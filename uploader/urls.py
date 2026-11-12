from django.urls import path, re_path

from . import tus_views, views

app_name = "uploader"

urlpatterns = [
    path("upload/", views.FineUploaderView.as_view(), name="upload"),
    path("upload/session/", views.UploadSessionLookupView.as_view(), name="session_lookup"),
    path("upload/session/<uuid:upload_id>/", views.UploadSessionView.as_view(), name="session"),
    re_path(r"^upload/update/(?P<friendly_token>[\w-]+)/$", views.MediaFileUpdateView.as_view(), name="update"),
    re_path(
        r"^upload/update/(?P<friendly_token>[\w-]+)/session/$",
        views.UploadSessionLookupView.as_view(),
        name="update_session_lookup",
    ),
    re_path(
        r"^upload/update/(?P<friendly_token>[\w-]+)/session/(?P<upload_id>[0-9a-f-]{36})/$",
        views.UploadSessionView.as_view(),
        name="update_session",
    ),
    path("tus/", tus_views.TusCollectionView.as_view(), name="tus"),
    path("tus/<uuid:upload_id>/", tus_views.TusUploadView.as_view(), name="tus_upload"),
    re_path(
        r"^tus/update/(?P<friendly_token>[\w-]+)/$",
        tus_views.TusCollectionView.as_view(),
        name="tus_update",
    ),
    re_path(
        r"^tus/update/(?P<friendly_token>[\w-]+)/(?P<upload_id>[0-9a-f-]{36})/$",
        tus_views.TusUploadView.as_view(),
        name="tus_update_upload",
    ),
    re_path(r"^upload/cancel/(?P<friendly_token>[\w-]+)/$", views.MediaFileUploadCancelView.as_view(), name="cancel"),
]
