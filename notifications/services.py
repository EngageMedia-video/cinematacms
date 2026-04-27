import logging
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import (
    Notification,
    NotificationChannel,
    NotificationPreference,
    NotificationType,
)

logger = logging.getLogger(__name__)
User = get_user_model()


class NotificationService:
    """Business logic layer for creating and routing notifications.

    Every notification passes through _create_notification() which applies:
    self-notification guard → duplicate check → preference check →
    content filter → create record → route to delivery channel.
    """

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @classmethod
    def get_or_create_preferences(cls, user):
        prefs, _ = NotificationPreference.objects.get_or_create(
            user=user,
            defaults={
                "on_comment": (
                    NotificationChannel.EMAIL
                    if getattr(user, "notification_on_comments", True)
                    else NotificationChannel.NONE
                ),
            },
        )
        return prefs

    @classmethod
    def _get_channel(cls, recipient, notification_type):
        prefs = cls.get_or_create_preferences(recipient)
        return prefs.get_channel_for_type(notification_type)

    @classmethod
    def _is_duplicate(cls, recipient, actor, notification_type, action_url):
        cutoff = timezone.now() - timedelta(minutes=5)
        return Notification.objects.filter(
            recipient=recipient,
            actor=actor,
            notification_type=notification_type,
            action_url=action_url,
            created_at__gte=cutoff,
        ).exists()

    @classmethod
    def _passes_content_filter(cls, recipient, media, media_topic_slugs=None, media_category_slugs=None, prefs=None):
        """For new_media only. Returns True if media matches user's filters."""
        if prefs is None:
            prefs = cls.get_or_create_preferences(recipient)

        if not prefs.filter_topics and not prefs.filter_categories:
            return True

        if prefs.filter_topics:
            topics = (
                media_topic_slugs if media_topic_slugs is not None else set(media.topics.values_list("slug", flat=True))
            )
            if not topics.intersection(set(prefs.filter_topics)):
                return False

        if prefs.filter_categories:
            categories = (
                media_category_slugs
                if media_category_slugs is not None
                else set(media.category.values_list("slug", flat=True))
            )
            if not categories.intersection(set(prefs.filter_categories)):
                return False

        return True

    @classmethod
    def _create_notification(cls, recipient, actor, notification_type, message, action_url, metadata, media=None):
        # 1. Self-notification guard
        if actor and recipient == actor:
            return None

        # 2. Permission validation — actor must be authenticated (not anonymous)
        if actor and getattr(actor, "is_anonymous", False):
            return None

        # 3. Duplicate check (5-minute window)
        if actor and cls._is_duplicate(recipient, actor, notification_type, action_url):
            return None

        # 4. Channel preference check — fetch prefs once, reuse for content filter
        prefs = cls.get_or_create_preferences(recipient)
        channel = prefs.get_channel_for_type(notification_type)
        if channel == NotificationChannel.NONE:
            return None

        # 5. Content filter (new_media only)
        if notification_type == NotificationType.NEW_MEDIA and media:
            if not cls._passes_content_filter(recipient, media, prefs=prefs):
                return None

        # 6. Create notification record
        notification = Notification.objects.create(
            recipient=recipient,
            actor=actor,
            notification_type=notification_type,
            message=message,
            action_url=action_url,
            metadata=metadata,
        )

        # 7. Route to email if needed (deferred until transaction commits)
        if channel == NotificationChannel.EMAIL:
            from django.db import transaction as db_transaction

            from .tasks import send_notification_email

            notification_id = notification.id
            db_transaction.on_commit(lambda: send_notification_email.delay(notification_id))

        return notification

    # ------------------------------------------------------------------
    # Public event handlers
    # ------------------------------------------------------------------

    @classmethod
    def on_comment(cls, actor, media, comment, mentioned_users=None):
        """Notify media owner about comment activity (top-level or reply).

        Skips if recipient was already notified (overlap prevention via
        mentioned_users — which may include reply recipients or mentioned users).
        """
        recipient = media.user
        if mentioned_users and recipient in mentioned_users:
            return None

        return cls._create_notification(
            recipient=recipient,
            actor=actor,
            notification_type=NotificationType.COMMENT,
            message=f"{actor.username} commented on '{media.title}'",
            action_url=f"/view?m={media.friendly_token}",
            metadata={
                "media_id": media.id,
                "friendly_token": media.friendly_token,
                "comment_id": comment.id,
            },
        )

    @classmethod
    def on_reply(cls, actor, media, comment, parent_comment, mentioned_users=None):
        recipient = parent_comment.user
        if mentioned_users and recipient in mentioned_users:
            return None
        return cls._create_notification(
            recipient=parent_comment.user,
            actor=actor,
            notification_type=NotificationType.REPLY,
            message=f"{actor.username} replied to your comment on '{media.title}'",
            action_url=f"/view?m={media.friendly_token}",
            metadata={
                "media_id": media.id,
                "friendly_token": media.friendly_token,
                "comment_id": comment.id,
                "parent_comment_id": parent_comment.id,
            },
        )

    @classmethod
    def on_like(cls, actor, media):
        return cls._create_notification(
            recipient=media.user,
            actor=actor,
            notification_type=NotificationType.LIKE,
            message=f"{actor.username} liked '{media.title}'",
            action_url=f"/view?m={media.friendly_token}",
            metadata={
                "media_id": media.id,
                "friendly_token": media.friendly_token,
            },
        )

    @classmethod
    def on_follow(cls, actor, followed_user):
        return cls._create_notification(
            recipient=followed_user,
            actor=actor,
            notification_type=NotificationType.FOLLOW,
            message=f"{actor.username} started following you",
            action_url=f"/user/{actor.username}",
            metadata={},
        )

    @classmethod
    def on_mention(cls, actor, media, comment, mentioned_users):
        """Creates mention notifications. Returns set of notified users
        (used by on_comment for overlap prevention)."""
        notified = set()
        for user in mentioned_users:
            result = cls._create_notification(
                recipient=user,
                actor=actor,
                notification_type=NotificationType.MENTION,
                message=f"{actor.username} mentioned you in a comment on '{media.title}'",
                action_url=f"/view?m={media.friendly_token}",
                metadata={
                    "media_id": media.id,
                    "friendly_token": media.friendly_token,
                    "comment_id": comment.id,
                },
            )
            if result:
                notified.add(user)
        return notified

    @classmethod
    def on_new_media(cls, actor, media):
        """Notify all followers of actor about new media.

        Uses bulk_create for efficiency. Followers are users who subscribe
        to any of the actor's channels.
        """
        from users.models import Channel

        follower_ids = Channel.objects.filter(user=actor).values_list("subscribers", flat=True).distinct()
        followers = list(User.objects.filter(id__in=follower_ids, is_active=True).exclude(id=actor.id))

        # Prefetch all preferences in one query to avoid 2 DB hits per follower
        prefs_map = {p.user_id: p for p in NotificationPreference.objects.filter(user_id__in=[f.id for f in followers])}

        # Precompute media slugs once to avoid N queries in the loop
        topic_slugs = set(media.topics.values_list("slug", flat=True))
        category_slugs = set(media.category.values_list("slug", flat=True))

        # Dedupe: skip followers already notified within the 5-minute window
        action_url = f"/view?m={media.friendly_token}"
        cutoff = timezone.now() - timedelta(minutes=5)
        recent_recipient_ids = set(
            Notification.objects.filter(
                notification_type=NotificationType.NEW_MEDIA,
                actor=actor,
                action_url=action_url,
                created_at__gte=cutoff,
            ).values_list("recipient_id", flat=True)
        )

        notifications = []
        email_indices = []
        for follower in followers:
            if follower.id in recent_recipient_ids:
                continue
            prefs = prefs_map.get(follower.id) or cls.get_or_create_preferences(follower)
            channel = prefs.get_channel_for_type(NotificationType.NEW_MEDIA)
            if channel == NotificationChannel.NONE:
                continue
            if not cls._passes_content_filter(follower, media, topic_slugs, category_slugs, prefs=prefs):
                continue

            notifications.append(
                Notification(
                    recipient=follower,
                    actor=actor,
                    notification_type=NotificationType.NEW_MEDIA,
                    message=f"{actor.username} uploaded '{media.title}'",
                    action_url=action_url,
                    metadata={
                        "media_id": media.id,
                        "friendly_token": media.friendly_token,
                    },
                )
            )
            if channel == NotificationChannel.EMAIL:
                email_indices.append(len(notifications) - 1)

        created = Notification.objects.bulk_create(notifications, batch_size=100)

        from django.db import transaction as db_transaction

        from .tasks import send_notification_email

        for idx in email_indices:
            notification_id = created[idx].id
            db_transaction.on_commit(lambda nid=notification_id: send_notification_email.delay(nid))

        return created

    @classmethod
    def on_added_to_playlist(cls, actor, media, playlist):
        return cls._create_notification(
            recipient=media.user,
            actor=actor,
            notification_type=NotificationType.ADDED_TO_PLAYLIST,
            message=f"{actor.username} added '{media.title}' to playlist '{playlist.title}'",
            action_url=f"/view?m={media.friendly_token}",
            metadata={
                "media_id": media.id,
                "friendly_token": media.friendly_token,
                "playlist_id": playlist.id,
                "playlist_title": playlist.title,
            },
        )

    @classmethod
    def broadcast(cls, message, action_url="", metadata=None):
        """System announcement to all active users. Non-disableable.

        Note: this is synchronous and may take a while on large user bases.
        Call from a management command or Celery task — never from a request/response cycle.
        """
        created = []
        chunk = []
        for user in User.objects.filter(is_active=True).iterator(chunk_size=500):
            chunk.append(
                Notification(
                    recipient=user,
                    actor=None,
                    notification_type=NotificationType.SYSTEM_ANNOUNCEMENT,
                    message=message,
                    action_url=action_url,
                    metadata=metadata or {},
                )
            )
            if len(chunk) >= 500:
                created.extend(Notification.objects.bulk_create(chunk, batch_size=100))
                chunk = []
        if chunk:
            created.extend(Notification.objects.bulk_create(chunk, batch_size=100))
        return created
