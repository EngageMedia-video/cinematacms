from django.conf import settings
from django.conf.urls import include
from django.conf.urls.static import static
from django.urls import path, re_path
from django.views.static import serve

from . import management_views, views, tinymce_handlers
from .feeds import IndexRSSFeed, SearchRSSFeed

urlpatterns = [
    # TEMPLATE (NON API) VIEWS
    path("rss/", IndexRSSFeed()),
    path("rss", IndexRSSFeed()),
    re_path("^rss/search", SearchRSSFeed()),
    re_path("^$", views.index),
    re_path("^latest$", views.latest_media),
    re_path("^featured$", views.featured_media),
    re_path("^recommended$", views.recommended_media),
    re_path("^popular$", views.recommended_media),
    re_path("^p/(?P<slug>[\w-]*)$", views.view_page, name="get_page"),
    re_path("^tos$", views.tos, name="terms_of_service"),
    re_path("^creative-commons$", views.creative_commons, name="creative_commons"),
    re_path("^categories$", views.categories, name="categories"),
    re_path("^members", views.members, name="members"),
    re_path("^tags", views.tags, name="tags"),
    re_path("^contact$", views.contact, name="contact"),
    re_path("^countries$", views.countries, name="countries"),
    re_path("^languages$", views.languages, name="languages"),
    re_path("^topics$", views.topics, name="topics"),
    re_path("^history$", views.history, name="history"),
    re_path("^liked$", views.liked_media, name="liked_media"),
    re_path("^view", views.view_media, name="get_media"),
    re_path("^edit$", views.edit_media, name="edit_media"),
    re_path("^add_subtitle", views.add_subtitle, name="add_subtitle"),
    re_path("^edit_subtitle", views.edit_subtitle, name="edit_subtitle"),
    re_path("^embed", views.embed_media, name="get_embed"),
    re_path("^upload", views.upload_media, name="upload_media"),
    re_path("^scpublisher", views.upload_media, name="upload_media"),
    re_path("^search", views.search, name="search"),
    re_path(
        r"^playlist/(?P<friendly_token>[\w]*)$",
        views.view_playlist,
        name="get_playlist",
    ),
    re_path(
        r"^playlists/(?P<friendly_token>[\w]*)$",
        views.view_playlist,
        name="get_playlist",
    ),
    # API VIEWS
    re_path("^api/v1/media$", views.MediaList.as_view()),
    re_path("^api/v1/media/$", views.MediaList.as_view()),
    re_path(
        r"^api/v1/media/(?P<friendly_token>[\w]*)$",
        views.MediaDetail.as_view(),
        name="api_get_media",
    ),
    re_path(
        r"^api/v1/media/encoding/(?P<encoding_id>[\w]*)$",
        views.EncodingDetail.as_view(),
        name="api_get_encoding",
    ),
    re_path("^api/v1/search$", views.MediaSearch.as_view()),
    re_path(
        r"^api/v1/media/(?P<friendly_token>[\w]*)/actions$",
        views.MediaActions.as_view(),
    ),
    #    url(r'^api/v1/media/(?P<friendly_token>[\w]*)/subtitless$',
    #        views.MediaSubtitles.as_view()),
    re_path("^api/v1/categories$", views.CategoryList.as_view()),
    re_path("^api/v1/topics$", views.TopicList.as_view()),
    re_path("^api/v1/languages$", views.MediaLanguageList.as_view(), name='api_get_languages'),
    re_path("^api/v1/countries$", views.MediaCountryList.as_view()),
    re_path("^api/v1/tags$", views.TagList.as_view()),
    re_path("^api/v1/comments$", views.CommentList.as_view()),
    re_path(
        r"^api/v1/media/(?P<friendly_token>[\w]*)/comments$",
        views.CommentDetail.as_view(),
    ),
    re_path(
        r"^api/v1/media/(?P<friendly_token>[\w]*)/comments/(?P<uid>[\w-]*)$",
        views.CommentDetail.as_view(),
    ),
    re_path("^api/v1/playlists$", views.PlaylistList.as_view()),
    re_path("^api/v1/playlists/$", views.PlaylistList.as_view()),
    re_path(
        r"^api/v1/playlists/(?P<friendly_token>[\w]*)$",
        views.PlaylistDetail.as_view(),
        name="api_get_playlist",
    ),
    re_path("^api/v1/user/action/(?P<action>[\w]*)$", views.UserActions.as_view()),
    re_path("^fu/", include(("uploader.urls", "uploader"), namespace="uploader")),
    # TODO: https://site.com/channel/UCwobzUc3z-0PrFpoRxNszXQ channel
    # ADMIN VIEWS
    re_path("^api/v1/manage_media$", management_views.MediaList.as_view()),
    re_path("^api/v1/manage_comments$", management_views.CommentList.as_view()),
    re_path("^api/v1/manage_users$", management_views.UserList.as_view()),
    re_path("^manage/users$", views.manage_users, name="manage_users"),
    re_path("^manage/media$", views.manage_media, name="manage_media"),
    re_path("^manage/comments$", views.manage_comments, name="manage_comments"),
    re_path("^manage/users/export$", views.export_users, name="export_users"),
    re_path("^api/v1/encode_profiles/$", views.EncodeProfileList.as_view()),
    re_path("^api/v1/tasks$", views.TasksList.as_view()),
    re_path("^api/v1/tasks/$", views.TasksList.as_view()),
    re_path("^api/v1/tasks/(?P<friendly_token>[\w|\W]*)$", views.TaskDetail.as_view()),
    re_path("^api/v1/topmessage/$", views.TopMessageList.as_view()),
    re_path("^api/v1/indexfeatured/$", views.IndexPageFeaturedList.as_view()),
    re_path("^api/v1/homepagepopup/$", views.HomepagePopupList.as_view()),
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
    re_path("^(?P<slug>[\w.-]*)$", views.view_page, name="get_page"),
    # TinyMCE upload handlers
    path("tinymce/upload/", tinymce_handlers.upload_image, name="tinymce_upload_image"),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# urlpatterns = format_suffix_patterns(urlpatterns)


if settings.DEBUG:
    # Fixed: removed leading slash and removed all duplicate patterns
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",  # NO leading slash
            serve,
            {
                "document_root": settings.MEDIA_ROOT,
            },
        ),
        # ALL duplicate playlist patterns REMOVED
    ]
