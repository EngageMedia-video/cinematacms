import logging
from datetime import timedelta

from django.utils import timezone

from .models import (
    Notification,
    NotificationChannel,
    NotificationPreference,
    NotificationType,
)

logger = logging.getLogger(__name__)


class NotificationService:
    """Business logic layer for creating and routing notifications.

    Every notification passes through _create_notification() which applies:
    self-notification guard → duplicate check → preference check →
    create record → route to delivery channel.
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
    def _create_notification(cls, recipient, actor, notification_type, message, action_url, metadata):
        # 1. Self-notification guard
        if actor and recipient == actor:
            return None

        # 2. Permission validation — actor must be authenticated (not anonymous)
        if actor and getattr(actor, "is_anonymous", False):
            return None

        # 3. Duplicate check (5-minute window).
        # Mentions are exempt: action_url is the same for every comment on a
        # film, so the window would swallow a second mention of the same person
        # in a different comment. on_mention() keys on the comment instead.
        if (
            actor
            and notification_type != NotificationType.MENTION
            and cls._is_duplicate(recipient, actor, notification_type, action_url)
        ):
            return None

        # 4. Channel preference check
        channel = cls._get_channel(recipient, notification_type)
        if channel == NotificationChannel.NONE:
            return None

        # 5. Create notification record
        notification = Notification.objects.create(
            recipient=recipient,
            actor=actor,
            notification_type=notification_type,
            message=message,
            action_url=action_url,
            metadata=metadata,
        )

        # 6. Route to email. The delivery module publishes only after commit.
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

    @staticmethod
    def _unique_users(users):
        """The given users without repeats, in first-seen order.

        A comment that names the same person more than once — "@naufal @naufal"
        — is one mention as far as the recipient is concerned.
        """
        seen = set()
        unique = []
        for user in users:
            if user.pk in seen:
                continue
            seen.add(user.pk)
            unique.append(user)
        return unique

    @classmethod
    def _mention_message(cls, actor, media, recipient):
        """Mention text for one recipient, without leaking a title they cannot see."""
        from files.methods import can_user_view_media

        if can_user_view_media(recipient, media):
            return f"{actor.username} mentioned you in a comment on '{media.title}'"
        return f"{actor.username} mentioned you in a comment"

    @classmethod
    def _already_mentioned_in_comment(cls, recipient, comment):
        """Whether ``recipient`` already holds a mention notification for ``comment``.

        Keyed on the comment rather than on a time window, so editing a comment
        never re-notifies someone for a mention they were already told about.
        """
        return Notification.objects.filter(
            recipient=recipient,
            notification_type=NotificationType.MENTION,
            metadata__comment_id=comment.id,
        ).exists()

    @classmethod
    def on_mention(cls, actor, media, comment, mentioned_users):
        """Creates mention notifications. Returns set of notified users
        (used by on_comment for overlap prevention)."""
        notified = set()
        for user in cls._unique_users(mentioned_users):
            # A repeat mention of the same person in the same comment — an edit
            # that keeps the handle — must not produce a second notification.
            # They still count as notified so the owner notification stays deduped.
            if cls._already_mentioned_in_comment(user, comment):
                notified.add(user)
                continue

            result = cls._create_notification(
                recipient=user,
                actor=actor,
                notification_type=NotificationType.MENTION,
                message=cls._mention_message(actor, media, user),
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
