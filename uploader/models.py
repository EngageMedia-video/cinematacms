from django.conf import settings
from django.db import models
from django.db.models import Q
from django.utils import timezone


class UploadSession(models.Model):
    """One resumable upload: who may send its bytes, which file they belong to, and how it ended.

    A Fine Uploader upload keeps its chunks under CHUNKS_DIR/<uuid>/<part index>. A tus
    upload appends to CHUNKS_DIR/<uuid>/data, and that file's size is its offset. The row
    is the authority for ownership and file identity, so a resumed or repeated request
    can only extend an upload of the same file by the same account.
    """

    class Protocol(models.TextChoices):
        CHUNKED = "chunked"
        TUS = "tus"

    class Status(models.TextChoices):
        OPEN = "open"
        ASSEMBLING = "assembling"
        COMPLETE = "complete"
        CANCELLED = "cancelled"
        EXPIRED = "expired"
        FAILED = "failed"

    uuid = models.UUIDField(
        primary_key=True, help_text="Fine Uploader's qquuid for this file, or the id the server gave a tus upload"
    )
    protocol = models.CharField(max_length=8, choices=Protocol.choices, default=Protocol.CHUNKED)
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
    part_size = models.PositiveIntegerField()
    total_parts = models.PositiveIntegerField()
    fingerprint = models.CharField(
        max_length=64,
        blank=True,
        help_text="Client SHA-256 of the file's size, modification time and sampled bytes; empty when unavailable",
    )
    is_draft = models.BooleanField(default=False, help_text="Create the media of a tus upload as a private draft")
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.OPEN)
    result_url = models.CharField(max_length=255, blank=True, help_text="Response media_url of the completed upload")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(default=timezone.now, db_index=True)

    class Meta:
        indexes = [models.Index(fields=["user", "fingerprint", "status"], name="uploadsession_resume_idx")]
        constraints = [
            # A tus upload is one byte stream, so it has no part layout.
            models.CheckConstraint(
                condition=Q(total_size__gt=0)
                & (
                    Q(protocol="chunked", part_size__gt=0, total_parts__gt=1)
                    | Q(protocol="tus", part_size=0, total_parts=0)
                ),
                name="uploadsession_layout",
            )
        ]

    def __str__(self):
        return f"{self.uuid} ({self.status})"
