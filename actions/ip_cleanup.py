from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from files.helpers import mask_ip

from .models import MediaAction


def cleanup_action_ips(*, batch_size=1000, dry_run=False):
    if batch_size < 1:
        raise ValueError("batch_size must be positive")
    cutoff = timezone.now() - timedelta(days=7)
    upper_pk = MediaAction.objects.order_by("-pk").values_list("pk", flat=True).first()
    counts = {"expired": 0, "masked": 0, "invalid": 0}
    if upper_pk is None:
        return counts
    predicate = Q(action_date__lte=cutoff)
    if settings.MASK_IPS_FOR_ACTIONS:
        predicate |= ~Q(remote_ip__regex=r"^[0-9a-f]{64}$")
    candidates = MediaAction.objects.filter(predicate, pk__lte=upper_pk, remote_ip__isnull=False).exclude(remote_ip="")
    last_pk = 0
    while True:
        with transaction.atomic():
            batch = candidates.filter(pk__gt=last_pk).order_by("pk")
            if not dry_run:
                batch = batch.select_for_update()
            rows = list(batch[:batch_size])
            if not rows:
                break
            for row in rows:
                if row.action_date <= cutoff:
                    row.remote_ip = None
                    counts["expired"] += 1
                else:
                    try:
                        row.remote_ip = mask_ip(row.remote_ip)
                        counts["masked"] += 1
                    except ValueError:
                        row.remote_ip = None
                        counts["invalid"] += 1
            if not dry_run:
                MediaAction.objects.bulk_update(rows, ["remote_ip"], batch_size=batch_size)
            last_pk = rows[-1].pk
    return counts
