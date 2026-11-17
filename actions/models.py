from django.db import models, transaction
from django.db.models import Count, OuterRef, Subquery
from django.db.models.functions import Coalesce
from django.db.models.signals import pre_delete
from django.dispatch import receiver

from files.models import Media
from files.query_cache import invalidate_media_cache
from users.models import User

from .fields import MaskedIPField

USER_MEDIA_ACTIONS = (
    ("like", "Like"),
    ("dislike", "Dislike"),
    ("watch", "Watch"),
    ("report", "Report"),
)


class MediaAction(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        db_index=True,
        blank=True,
        null=True,
        related_name="useractions",
    )
    session_key = models.CharField(max_length=33, db_index=True, blank=True, null=True)

    action = models.CharField(max_length=20, choices=USER_MEDIA_ACTIONS, default="watch")
    # eg on report action, why it is reported...
    extra_info = models.TextField(blank=True, null=True)

    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name="mediaactions")
    action_date = models.DateTimeField(auto_now_add=True)
    remote_ip = MaskedIPField(max_length=64, blank=True, null=True)

    def save(self, *args, **kwargs):
        super(MediaAction, self).save(*args, **kwargs)

    def __str__(self):
        return self.action

    class Meta:
        indexes = [
            models.Index(fields=["user", "action", "-action_date"]),
            models.Index(fields=["session_key", "action"]),
            models.Index(
                fields=["action_date"],
                condition=models.Q(remote_ip__isnull=False),
                name="mediaaction_ip_expiry_idx",
            ),
            models.Index(
                fields=["media"],
                condition=models.Q(action="report"),
                name="mediaaction_report_media_idx",
            ),
        ]
        constraints = [
            # Anonymous Reports have no user and stay outside the constraint.
            models.UniqueConstraint(
                fields=["media", "user"],
                condition=models.Q(action="report", user__isnull=False),
                name="mediaaction_one_report_per_user",
            ),
        ]


class ReportManager(models.Manager):
    def get_queryset(self):
        return super().get_queryset().filter(action="report")


class MediaReport(MediaAction):
    objects = ReportManager()

    class Meta:
        proxy = True
        verbose_name = "report"


def recount_reported_times(media_ids):
    """Set each media's reported_times to the number of its Reports."""
    reported_media = Media.objects.filter(pk__in=media_ids)
    report_count = MediaReport.objects.filter(media=OuterRef("pk")).values("media").annotate(total=Count("pk"))
    with transaction.atomic():
        # An UPDATE that waits on another recount counts from its stale snapshot,
        # so wait on the lock first. no_key leaves MediaAction inserts unblocked.
        list(reported_media.order_by("pk").select_for_update(no_key=True).values_list("pk", flat=True))
        reported_media.update(reported_times=Coalesce(Subquery(report_count.values("total")), 0))


@receiver(pre_delete, sender=User)
def withdraw_reports_of_deleted_account(sender, instance, **kwargs):
    # Runs inside the account deletion's transaction. A receiver on MediaAction
    # would instead turn off Django's fast delete for every watch row.
    reports = MediaReport.objects.filter(user=instance)
    reported_media = list(reports.values_list("media_id", "media__friendly_token"))
    if not reported_media:
        return

    reports.delete()
    recount_reported_times([media_id for media_id, _ in reported_media])

    def invalidate_reported_media():
        for _, friendly_token in reported_media:
            invalidate_media_cache(friendly_token)

    transaction.on_commit(invalidate_reported_media)
