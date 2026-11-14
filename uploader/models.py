from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class UploadSession(models.Model):
    """One resumable upload: who may send its bytes, which file they belong to, and how it ended.

    A tus upload appends to CHUNKS_DIR/<uuid>/data, and that file's size is its offset.
    The row is the authority for ownership and file identity, so a resumed or repeated
    request can only extend an upload of the same file by the same account.
    """

    class Status(models.TextChoices):
        OPEN = "open"
        ASSEMBLING = "assembling"
        COMPLETE = "complete"
        CANCELLED = "cancelled"
        EXPIRED = "expired"
        FAILED = "failed"

    uuid = models.UUIDField(primary_key=True, help_text="The id the server gave this upload")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="upload_sessions")
    target_media = models.ForeignKey(
        "files.Media",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="+",
        help_text="Media whose file this upload replaces; empty for a new media upload",
    )
    filename = models.CharField(max_length=255)
    total_size = models.BigIntegerField()
    fingerprint = models.CharField(
        max_length=64,
        blank=True,
        help_text="Client SHA-256 of the file's size, modification time and sampled bytes; empty when unavailable",
    )
    is_draft = models.BooleanField(default=False, help_text="Create the media of this upload as a private draft")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    result_url = models.CharField(max_length=255, blank=True, help_text="Response media_url of the completed upload")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        indexes = [models.Index(fields=["user", "fingerprint", "status"], name="uploadsession_resume_idx")]
        constraints = [models.CheckConstraint(condition=Q(total_size__gt=0), name="uploadsession_positive_size")]

    def __str__(self):
        return f"{self.uuid} ({self.status})"
