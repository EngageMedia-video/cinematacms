from datetime import timedelta
from typing import NamedTuple

from django.utils import timezone

from files.helpers import MASKED_IP_PATTERN, mask_ip

from .models import MediaAction

IP_RETENTION = timedelta(days=7)


class LegacyIPCleanup(NamedTuple):
    masked: int
    invalid: int


def expire_action_ips(*, batch_size=1000, dry_run=False):
    """Clear IP fields older than the retention window; served by the partial action_date index."""
    expired = MediaAction.objects.filter(action_date__lte=timezone.now() - IP_RETENTION, remote_ip__isnull=False)
    if dry_run:
        return expired.count()
    count = 0
    # Unordered batches: ordering by pk would let the planner walk the primary key instead of the index.
    while expired_pks := list(expired.values_list("pk", flat=True)[:batch_size]):
        count += MediaAction.objects.filter(pk__in=expired_pks).update(remote_ip=None)
    return count


def mask_legacy_action_ips(*, batch_size=1000, dry_run=False):
    """Mask raw IPs written before field-level masking; a full scan meant for rollout, not the hourly job."""
    legacy = (
        MediaAction.objects.filter(remote_ip__isnull=False)
        .exclude(remote_ip="")
        .exclude(remote_ip__regex=rf"^{MASKED_IP_PATTERN}$")
    )
    masked = invalid = 0
    for rows in _batches(legacy, batch_size):
        for row in rows:
            try:
                row.remote_ip = mask_ip(row.remote_ip)
                masked += 1
            except ValueError:
                row.remote_ip = None
                invalid += 1
        if not dry_run:
            MediaAction.objects.bulk_update(rows, ["remote_ip"])
    return LegacyIPCleanup(masked, invalid)


def _batches(queryset, batch_size):
    last_pk = 0
    while rows := list(queryset.filter(pk__gt=last_pk).order_by("pk")[:batch_size]):
        yield rows
        last_pk = rows[-1].pk
