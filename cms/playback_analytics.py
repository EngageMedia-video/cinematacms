"""Anonymous playback snapshots. Umami remains the authority for event counts."""

import json
import uuid
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from django.conf import settings
from django.core import signing
from django.db import transaction
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

from cms.analytics import visitor_segment
from files.models import Media, PlaybackSummary

SALT = "cinemata.playback.v1"
MAX_DURATION_MS = 24 * 60 * 60 * 1000
MAX_RANGES = 1000
MAX_WATCH_BUCKETS = 1441  # At most 24 hours of UTC minutes, including partial endpoints.


def measurement_token(media, context):
    return signing.dumps(
        {"media": str(media.uid), "revision": str(media.analytics_revision), "state": media.state, "context": context},
        salt=SALT,
    )


def merge_ranges(ranges):
    merged = []
    for start, end in sorted(ranges):
        if merged and start <= merged[-1][1]:
            merged[-1][1] = max(end, merged[-1][1])
        else:
            merged.append([start, end])
    return merged


def validate_snapshot(body, media):
    if not isinstance(body, dict) or set(body) != {
        "token",
        "play_id",
        "duration_ms",
        "coverage",
        "watch_days",
        "initiation",
    }:
        raise ValueError
    play_id = uuid.UUID(body["play_id"])
    duration = body["duration_ms"]
    if type(duration) is not int or not 0 < duration <= MAX_DURATION_MS:
        raise ValueError
    initiation = body["initiation"]
    if initiation not in ("deliberate", "autoplay", "unknown"):
        raise ValueError
    ranges = body["coverage"]
    if not isinstance(ranges, list) or len(ranges) > MAX_RANGES:
        raise ValueError
    for pair in ranges:
        if (
            not isinstance(pair, list)
            or len(pair) != 2
            or any(type(value) is not int for value in pair)
            or not 0 <= pair[0] < pair[1] <= duration
        ):
            raise ValueError
    days = body["watch_days"]
    if not isinstance(days, dict) or len(days) > MAX_WATCH_BUCKETS:
        raise ValueError
    now = datetime.now(timezone.utc)
    formats = set()
    for day, millis in days.items():
        try:
            legacy = len(day) == 10
            parsed = datetime.strptime(day, "%Y-%m-%d" if legacy else "%Y-%m-%dT%H:%MZ").replace(tzinfo=timezone.utc)
        except (TypeError, ValueError) as exc:
            raise ValueError from exc
        formats.add(legacy)
        expected = parsed.strftime("%Y-%m-%d" if legacy else "%Y-%m-%dT%H:%MZ")
        earliest = (
            (now - timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
            if legacy
            else now - timedelta(days=1, minutes=1)
        )
        if day != expected or not earliest <= parsed <= now:
            raise ValueError
        if type(millis) is not int or not 0 <= millis <= (MAX_DURATION_MS if legacy else 60000):
            raise ValueError
    if len(formats) > 1 or sum(days.values()) > MAX_DURATION_MS:
        raise ValueError
    return play_id, duration, initiation, merge_ranges(ranges), days


def playback_figures(owner, days, media_uid=None, revision=None, end_date=None, report_timezone="UTC"):
    """Aggregate measured plays without reading visitor identity or URL data."""
    zone = ZoneInfo(report_timezone)
    today = end_date or datetime.now(timezone.utc).astimezone(zone).date()
    first = today - timedelta(days=days - 1)
    cohort_start = datetime.combine(first, datetime.min.time(), tzinfo=zone)
    cohort_end = datetime.combine(today + timedelta(days=1), datetime.min.time(), tzinfo=zone)
    queryset = PlaybackSummary.objects.filter(
        media__user=owner,
        started_at__gte=cohort_start.astimezone(timezone.utc) - timedelta(days=1),
        started_at__lt=cohort_end,
    )
    if media_uid:
        queryset = queryset.filter(media__uid=media_uid)
    if revision == "unknown":
        queryset = queryset.none()
    elif revision:
        queryset = queryset.filter(revision=revision)
    daily = {str(first + timedelta(days=offset)): 0 for offset in range(days)}
    per_media = {}
    per_media_plays = {}
    initiation = {"deliberate": 0, "autoplay": 0, "unknown": 0}
    retention = [0.0] * 20
    watched_fraction = 0.0
    measured_plays = 0
    cohort_ms = 0
    watch_time_incomplete = False
    for row in queryset.values(
        "media__uid", "started_at", "duration_ms", "coverage", "watch_days", "initiation"
    ).iterator():
        media_id = str(row["media__uid"])
        row_ms = 0
        for day, millis in row["watch_days"].items():
            instant = datetime.fromisoformat(day.replace("Z", "+00:00")).replace(tzinfo=timezone.utc)
            if len(day) == 10 and (
                instant.astimezone(zone).utcoffset() != timedelta(0)
                or (instant + timedelta(days=1)).astimezone(zone).utcoffset() != timedelta(0)
            ):
                # Legacy UTC-day totals cannot be divided across local midnight.
                if millis and instant < cohort_end and instant + timedelta(days=1) > cohort_start:
                    watch_time_incomplete = True
                continue
            day = instant.astimezone(zone).date().isoformat()
            if day in daily:
                daily[day] += millis
                row_ms += millis
                per_media[media_id] = per_media.get(media_id, 0) + millis
        if row["started_at"] < cohort_start:
            continue
        measured_plays += 1
        per_media_plays[media_id] = per_media_plays.get(media_id, 0) + 1
        cohort_ms += row_ms
        initiation[row["initiation"]] += 1
        duration = row["duration_ms"]
        covered = sum(end - start for start, end in row["coverage"])
        watched_fraction += covered / duration
        for index in range(20):
            low = index * duration / 20
            high = (index + 1) * duration / 20
            retention[index] += sum(max(0, min(end, high) - max(start, low)) for start, end in row["coverage"]) / (
                high - low
            )
    total_ms = sum(daily.values())
    return {
        "watch_seconds": round(total_ms / 1000),
        "average_watch_seconds": round(cohort_ms / measured_plays / 1000)
        if measured_plays and not watch_time_incomplete
        else None,
        "watch_time_incomplete": watch_time_incomplete,
        "average_percent_watched": round(100 * watched_fraction / measured_plays, 1) if measured_plays else None,
        "measured_plays": measured_plays,
        "initiation": initiation,
        "retention": [round(100 * value / measured_plays, 1) for value in retention] if measured_plays else [],
        "daily_watch_seconds": {day: round(millis / 1000) for day, millis in daily.items()},
        "per_media_watch_seconds": {uid: round(millis / 1000) for uid, millis in per_media.items()},
        "per_media_measured_plays": per_media_plays,
    }


@csrf_exempt
@require_POST
def record_playback(request):
    """A signed page-load grant lets anonymous embeds report without third-party cookies."""
    if not settings.ANALYTICS_ENABLED or request.headers.get("DNT") == "1" or visitor_segment(request.user) is None:
        return HttpResponse(status=404)
    # HTTPS terminates at the proxy, so Django may see HTTP for an HTTPS page.
    host = request.get_host()
    if request.headers.get("Origin") not in {f"{request.scheme}://{host}", f"https://{host}"}:
        return HttpResponse(status=403)
    if len(request.body) > 65536:
        return HttpResponse(status=413)
    try:
        body = json.loads(request.body)
        grant = signing.loads(body["token"], salt=SALT, max_age=12 * 60 * 60)
        media = Media.objects.get(uid=uuid.UUID(grant["media"]))
        if (
            media.state != grant["state"]
            or str(media.analytics_revision) != grant["revision"]
            or grant["context"] not in ("page", "embed", "hero")
            or media.media_type not in ("video", "audio")
        ):
            return HttpResponse(status=403)
        play_id, duration, initiation, coverage, days = validate_snapshot(body, media)
    except (
        ValueError,
        TypeError,
        AttributeError,
        KeyError,
        json.JSONDecodeError,
        signing.BadSignature,
        Media.DoesNotExist,
    ):
        return HttpResponse(status=400)

    with transaction.atomic():
        summary, created = PlaybackSummary.objects.select_for_update().get_or_create(
            id=play_id,
            defaults={
                "media": media,
                "revision": media.analytics_revision,
                "context": grant["context"],
                "initiation": initiation,
                "started_at": datetime.now(timezone.utc),
                "duration_ms": duration,
            },
        )
        if (
            summary.media_id != media.pk
            or summary.revision != media.analytics_revision
            or summary.context != grant["context"]
            or summary.initiation != initiation
            or summary.duration_ms != duration
        ):
            return HttpResponse(status=409)
        merged_coverage = merge_ranges(summary.coverage + coverage)
        if len(merged_coverage) > MAX_RANGES:
            return HttpResponse(status=400)
        summary.coverage = merged_coverage
        merged_days = {
            day: max(summary.watch_days.get(day, 0), days.get(day, 0))
            for day in summary.watch_days.keys() | days.keys()
        }
        if (
            len(merged_days) > MAX_WATCH_BUCKETS
            or sum(merged_days.values()) > MAX_DURATION_MS
            or len({len(key) == 10 for key in merged_days}) > 1
        ):
            return HttpResponse(status=400)
        summary.watch_days = merged_days
        summary.save(update_fields=["coverage", "watch_days", "updated_at"])
    return HttpResponse(status=204)
