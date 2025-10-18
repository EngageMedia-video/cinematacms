# -*- coding: utf-8 -*-
from django.urls import re_path

from . import views

app_name = "uploader"

urlpatterns = [
    re_path(r"^upload/$", views.FineUploaderView.as_view(), name="upload"),
    re_path(r"^upload/update/(?P<friendly_token>[\w-]+)/$", views.MediaFileUpdateView.as_view(), name="update"),
]
