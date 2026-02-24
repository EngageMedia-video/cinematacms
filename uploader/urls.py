from django.urls import path, re_path

from . import views

app_name = "uploader"

urlpatterns = [
    path("upload/", views.FineUploaderView.as_view(), name="upload"),
    re_path(r"^upload/update/(?P<friendly_token>[\w-]+)/$", views.MediaFileUpdateView.as_view(), name="update"),
    re_path(r"^upload/cancel/(?P<friendly_token>[\w-]+)/$", views.MediaFileUploadCancelView.as_view(), name="cancel"),
]
