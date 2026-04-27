from django.conf import settings
from django.db import models


class NotificationType(models.TextChoices):
    COMMENT = "comment", "New comment on your media"
    REPLY = "reply", "Reply to your comment"
    LIKE = "like", "Someone liked your media"
    FOLLOW = "follow", "Someone followed you"
    MENTION = "mention", "You were mentioned in a comment"
    NEW_MEDIA = "new_media", "New upload from someone you follow"
    ADDED_TO_PLAYLIST = "added_to_playlist", "Your media was added to a playlist"
    MEDIA_REPORT = "media_report", "Media was reported"
    SYSTEM_ANNOUNCEMENT = "system_announcement", "System announcement"


class NotificationChannel(models.TextChoices):
    IN_APP = "in_app", "In-App Only"
    EMAIL = "email", "In-App + Email"
    NONE = "none", "Disabled"


class Notification(models.Model):
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_notifications",
        db_index=True,
    )
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        related_name="triggered_notifications",
        null=True,
        blank=True,
    )
    notification_type = models.CharField(
        max_length=20,
        choices=NotificationType,
        db_index=True,
    )
    message = models.CharField(max_length=500)
    action_url = models.CharField(max_length=500, blank=True)
    is_read = models.BooleanField(default=False, db_index=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["recipient", "-created_at"],
                name="notif_recipient_created",
            ),
            models.Index(
                fields=["recipient", "is_read"],
                name="notif_recipient_read",
            ),
            models.Index(
                fields=["recipient", "actor", "notification_type"],
                name="notif_dedup_check",
            ),
        ]

    def __str__(self):
        return f"[{self.notification_type}] {self.message} → {self.recipient.username}"

    def mark_as_read(self):
        from django.utils import timezone

        Notification.objects.filter(pk=self.pk, is_read=False).update(is_read=True, read_at=timezone.now())
        self.refresh_from_db()


class NotificationPreference(models.Model):
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="notification_preferences",
    )
    on_comment = models.CharField(
        max_length=10,
        choices=NotificationChannel,
        default=NotificationChannel.EMAIL,
    )
    on_reply = models.CharField(
        max_length=10,
        choices=NotificationChannel,
        default=NotificationChannel.EMAIL,
    )
    on_like = models.CharField(
        max_length=10,
        choices=NotificationChannel,
        default=NotificationChannel.IN_APP,
    )
    on_follow = models.CharField(
        max_length=10,
        choices=NotificationChannel,
        default=NotificationChannel.EMAIL,
    )
    on_mention = models.CharField(
        max_length=10,
        choices=NotificationChannel,
        default=NotificationChannel.EMAIL,
    )
    on_new_media_from_following = models.CharField(
        max_length=10,
        choices=NotificationChannel,
        default=NotificationChannel.IN_APP,
    )
    on_added_to_playlist = models.CharField(
        max_length=10,
        choices=NotificationChannel,
        default=NotificationChannel.IN_APP,
    )
    filter_topics = models.JSONField(
        default=list,
        blank=True,
        help_text="Topic slugs to filter new_media notifications. Empty = all.",
    )
    filter_categories = models.JSONField(
        default=list,
        blank=True,
        help_text="Category slugs to filter new_media notifications. Empty = all.",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"NotificationPreference for {self.user.username}"

    def get_channel_for_type(self, notification_type):
        # system_announcement is always delivered (non-disableable)
        if notification_type == NotificationType.SYSTEM_ANNOUNCEMENT:
            return NotificationChannel.IN_APP

        # media_report is admin-facing (delivered to staff via existing
        # notify_users flow in files/tasks.py). Always in-app here;
        # moderation queue may replace this in a future milestone.
        if notification_type == NotificationType.MEDIA_REPORT:
            return NotificationChannel.IN_APP

        channel_map = {
            NotificationType.COMMENT: self.on_comment,
            NotificationType.REPLY: self.on_reply,
            NotificationType.LIKE: self.on_like,
            NotificationType.FOLLOW: self.on_follow,
            NotificationType.MENTION: self.on_mention,
            NotificationType.NEW_MEDIA: self.on_new_media_from_following,
            NotificationType.ADDED_TO_PLAYLIST: self.on_added_to_playlist,
        }
        return channel_map.get(notification_type, NotificationChannel.IN_APP)
