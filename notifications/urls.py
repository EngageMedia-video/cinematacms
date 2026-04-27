from django.urls import path

from . import views

urlpatterns = [
    path("api/v1/notifications/", views.NotificationList.as_view(), name="notification-list"),
    path("api/v1/notifications/unread-count/", views.UnreadCount.as_view(), name="notification-unread-count"),
    path(
        "api/v1/notifications/preferences/",
        views.NotificationPreferenceDetail.as_view(),
        name="notification-preferences",
    ),
    path("api/v1/notifications/<int:notification_id>/read/", views.MarkAsRead.as_view(), name="notification-read"),
    path("api/v1/notifications/mark-all-read/", views.MarkAllAsRead.as_view(), name="notification-mark-all-read"),
]
