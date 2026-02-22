from django.urls import include, path, re_path

from . import management_views, secure_media_views, tinymce_handlers, views
from .feeds import IndexRSSFeed, SearchRSSFeed

urlpatterns = [
    # SECURE MEDIA FILE SERVING
    path(
        "media/<path:file_path>",
        secure_media_views.secure_media_file,
        name="secure_media",
    ),
    # TEMPLATE (NON API) VIEWS
    path("rss/", IndexRSSFeed()),
    path("rss", IndexRSSFeed()),
    re_path("^rss/search", SearchRSSFeed()),
    path("", views.index),
    path("latest", views.latest_media),
    path("featured", views.featured_media),
    path("recommended", views.recommended_media),
    path("popular", views.recommended_media),
    re_path(r"^p/(?P<slug>[\w-]*)$", views.view_page, name="get_page"),
    path("tos", views.tos, name="terms_of_service"),
    path("creative-commons", views.creative_commons, name="creative_commons"),
    path("categories", views.categories, name="categories"),
    re_path("^members", views.members, name="members"),
    re_path("^tags", views.tags, name="tags"),
    path("contact", views.contact, name="contact"),
    path("countries", views.countries, name="countries"),
    path("languages", views.languages, name="languages"),
    path("topics", views.topics, name="topics"),
    path("history", views.history, name="history"),
    path("liked", views.liked_media, name="liked_media"),
    re_path("^view", views.view_media, name="get_media"),
    path("edit", views.edit_media, name="edit_media"),
    re_path("^add_subtitle", views.add_subtitle, name="add_subtitle"),
    re_path("^edit_subtitle", views.edit_subtitle, name="edit_subtitle"),
    re_path("^embed", views.embed_media, name="get_embed"),
    re_path("^upload", views.upload_media, name="upload_media"),
    re_path("^scpublisher", views.upload_media, name="upload_media"),
    re_path("^search", views.search, name="search"),
    re_path(
        r"^playlist/(?P<friendly_token>[\w]+(-[\w]+)*)$",
        views.view_playlist,
        name="get_playlist",
    ),
    re_path(
        r"^playlists/(?P<friendly_token>[\w]+(-[\w]+)*)$",
        views.view_playlist,
        name="get_playlist",
    ),
    # API VIEWS
    path("api/v1/media", views.MediaList.as_view()),
    path("api/v1/media/", views.MediaList.as_view()),
    re_path(
        r"^api/v1/media/(?P<friendly_token>[\w]+(-[\w]+)*)$",
        views.MediaDetail.as_view(),
        name="api_get_media",
    ),
    re_path(
        r"^api/v1/media/encoding/(?P<encoding_id>[\w]*)$",
        views.EncodingDetail.as_view(),
        name="api_get_encoding",
    ),
    path("api/v1/search", views.MediaSearch.as_view()),
    re_path(
        r"^api/v1/media/(?P<friendly_token>[\w]+(-[\w]+)*)/actions$",
        views.MediaActions.as_view(),
    ),
    #    url(r'^api/v1/media/(?P<friendly_token>[\w]*)/subtitless$',
    #        views.MediaSubtitles.as_view()),
    path("api/v1/categories", views.CategoryList.as_view()),
    path("api/v1/topics", views.TopicList.as_view()),
    path("api/v1/languages", views.MediaLanguageList.as_view()),
    path("api/v1/countries", views.MediaCountryList.as_view()),
    path("api/v1/tags", views.TagList.as_view()),
    path("api/v1/comments", views.CommentList.as_view()),
    re_path(
        r"^api/v1/media/(?P<friendly_token>[\w]+(-[\w]+)*)/comments$",
        views.CommentDetail.as_view(),
    ),
    re_path(
        r"^api/v1/media/(?P<friendly_token>[\w]+(-[\w]+)*)/comments/(?P<uid>[\w]+(-[\w]+)*)$",
        views.CommentDetail.as_view(),
    ),
    path("api/v1/playlists", views.PlaylistList.as_view()),
    path("api/v1/playlists/", views.PlaylistList.as_view()),
    re_path(
        r"^api/v1/playlists/(?P<friendly_token>[\w]+(-[\w]+)*)$",
        views.PlaylistDetail.as_view(),
        name="api_get_playlist",
    ),
    re_path(r"^api/v1/user/action/(?P<action>[\w]*)$", views.UserActions.as_view()),
    path("fu/", include(("uploader.urls", "uploader"), namespace="uploader")),
    # TODO: https://site.com/channel/UCwobzUc3z-0PrFpoRxNszXQ channel
    # ADMIN VIEWS
    path("api/v1/manage_media", management_views.MediaList.as_view()),
    path("api/v1/manage_comments", management_views.CommentList.as_view()),
    path("api/v1/manage_users", management_views.UserList.as_view()),
    path("manage/users", views.manage_users, name="manage_users"),
    path("manage/media", views.manage_media, name="manage_media"),
    path("manage/comments", views.manage_comments, name="manage_comments"),
    path("manage/users/export", views.export_users, name="export_users"),
    path("api/v1/encode_profiles/", views.EncodeProfileList.as_view()),
    path("api/v1/tasks", views.TasksList.as_view()),
    path("api/v1/tasks/", views.TasksList.as_view()),
    re_path(r"^api/v1/tasks/(?P<friendly_token>[\w|\W]*)$", views.TaskDetail.as_view()),
    path("api/v1/topmessage", views.TopMessageList.as_view()),
    path("api/v1/indexfeatured", views.IndexPageFeaturedList.as_view()),
    path("api/v1/homepagepopup", views.HomepagePopupList.as_view()),
    ################################
    # These are URLs related with the migration of plumi (plumi.org) systems...
    re_path(
        r"^Members/(?P<user>[\w.@-]*)/videos/(?P<video>[\w.@-]*)$",
        views.view_old_media,
        name="get_old_media",
    ),
    re_path(
        r"^Members/(?P<user>[\w.@-]*)/videos/(?P<video>[\w.@-]*)/$",
        views.view_old_media,
        name="get_old_media",
    ),
    re_path(
        r"^Members/(?P<user>[\w.@-]*)/videos/(?P<video>[\w.@-]*)/view$",
        views.view_old_media,
        name="get_old_media",
    ),
    re_path(
        r"^Members/(?P<user>[\w.@-]*)/videos/(?P<video>[\w.@-]*)/embed_view",
        views.embed_old_media,
        name="embed_old_media",
    ),
    ################################
    # Modern track demo page (staff-only)
    path("modern-demo", views.modern_demo_page, name="modern_demo"),
    re_path(r"^(?P<slug>[\w.-]*)$", views.view_page, name="get_page"),
    # TinyMCE upload handlers
    path("tinymce/upload/", tinymce_handlers.upload_image, name="tinymce_upload_image"),
]

# urlpatterns = format_suffix_patterns(urlpatterns)
