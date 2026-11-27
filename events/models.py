import uuid

from django.conf import settings
from django.db import models
from django.utils import timezone

MAX_ATTEMPTS = 4


class DomainEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    type = models.CharField(max_length=100)
    version = models.PositiveSmallIntegerField()
    occurred_at = models.DateTimeField(default=timezone.now)
    # The actor may be deleted later. A payload that needs the actor after that carries a snapshot.
    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    payload = models.JSONField()
    dispatched_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=["occurred_at"], name="domain_event_occurred_idx"),
            models.Index(
                fields=["occurred_at"],
                condition=models.Q(dispatched_at__isnull=True),
                name="domain_event_undispatched_idx",
            ),
        ]
        constraints = [
            models.CheckConstraint(condition=models.Q(version__gte=1), name="domain_event_version_positive"),
        ]

    def __str__(self):
        return f"{self.type} v{self.version} {self.id}"


class HandlerRunStatus(models.TextChoices):
    PENDING = "pending", "Pending"
    RUNNING = "running", "Running"
    RETRYING = "retrying", "Retrying"
    SUCCEEDED = "succeeded", "Succeeded"
    FAILED = "failed", "Failed"


ACTIVE_STATUSES = (HandlerRunStatus.PENDING, HandlerRunStatus.RUNNING, HandlerRunStatus.RETRYING)


class EventHandlerRun(models.Model):
    event = models.ForeignKey(DomainEvent, on_delete=models.CASCADE, related_name="handler_runs")
    handler = models.CharField(max_length=200)
    status = models.CharField(max_length=16, choices=HandlerRunStatus, default=HandlerRunStatus.PENDING)
    attempt_count = models.PositiveSmallIntegerField(default=0)
    reason_code = models.CharField(max_length=32, blank=True)
    celery_task_id = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["status", "updated_at"], name="event_run_status_updated_idx")]
        constraints = [
            models.UniqueConstraint(fields=["event", "handler"], name="event_handler_run_unique"),
            models.CheckConstraint(
                condition=models.Q(status__in=HandlerRunStatus.values), name="event_handler_run_valid_status"
            ),
            models.CheckConstraint(
                condition=models.Q(attempt_count__lte=MAX_ATTEMPTS), name="event_handler_run_attempt_limit"
            ),
        ]

    def __str__(self):
        return f"{self.handler} for {self.event_id}: {self.status}"
