"""Owner-scoped analytics queries. Umami credentials never reach the browser."""

import logging
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

import requests
from django.conf import settings
from django.core.paginator import Paginator
from django.db.models import Sum

from files.models import Comment, Media

logger = logging.getLogger(__name__)

ENGAGEMENT_EVENTS = (
    "like",
    "unlike",
    "playlist_add",
    "playlist_remove",
    "link_copy",
    "embed_copy",
    "download_click",
    "comment_success",
    "outbound_click",
)
NON_ENGAGEMENT_EVENTS = frozenset(
    (
        "play",
        "pause",
        "finish",
        "playback_start",
        "progress_25",
        "progress_50",
        "progress_75",
        "seek",
        "mute",
        "unmute",
        "quality_change",
        "subtitle_change",
        "speed_change",
        "fullscreen_on",
        "fullscreen_off",
        "theater_change",
        "next",
        "previous",
        "player_error",
        "media_view",
    )
)
EVENT_NAME = re.compile(r"[a-z][a-z0-9_]{0,49}")
RANGES = (7, 30, 90, 365)


class AnalyticsUnavailable(Exception):
    pass


def cms_media_totals(owner, media_uid=None):
    """Current product counters, independent of reporting dates and Umami."""
    media = Media.objects.filter(user=owner)
    if media_uid:
        media = media.filter(uid=media_uid)
    totals = media.aggregate(legacy_views=Sum("views"), likes=Sum("likes"))
    return {
        **{name: value or 0 for name, value in totals.items()},
        "comments": Comment.objects.filter(media__in=media).count(),
    }


def umami_get(endpoint, params):
    base = settings.ANALYTICS_URL.rstrip("/")
    parsed = urlsplit(base)
    if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.query or parsed.fragment:
        raise AnalyticsUnavailable
    website_id = settings.ANALYTICS_WEBSITE_ID
    url = f"{base}/api/websites/{website_id}/{endpoint}"
    try:
        response = requests.get(
            url,
            params=params,
            headers={"Authorization": f"Bearer {settings.ANALYTICS_API_KEY}"},
            timeout=5,
            allow_redirects=False,
        )
        response.raise_for_status()
        if response.status_code != 200:
            raise AnalyticsUnavailable
        return response.json()
    except (requests.RequestException, ValueError) as exc:
        logger.warning("Umami analytics query failed: %s", type(exc).__name__)
        raise AnalyticsUnavailable from exc


def _event_counts(rows):
    return {row["x"]: row["y"] for row in rows if row.get("x") and isinstance(row.get("y"), (int, float))}


def _series(rows, key=None):
    if key:
        rows = rows[key]
    return {row["x"][:10]: row["y"] for row in rows}


def _previous_counts(media, days, current_start, current_end, revision):
    if days == 365:
        return None  # A preceding 365-day window falls outside 12-month retention.
    previous_start = current_start - (current_end - current_start)
    common = {
        "startAt": int(previous_start.timestamp() * 1000),
        "endAt": int(current_start.timestamp() * 1000) - 1,
        "timezone": "UTC",
    }

    def counts_for(cut):
        params = {**common, **({"epf0": f"1.eq.revision.{cut}"} if cut else {})}
        result = {"media_views": 0, "starts": 0, "finishes": 0, "deliberate_starts": 0}
        for offset in range(0, len(media), 50):
            batch = media[offset : offset + 50]
            scoped = {**params, "tag": ",".join(f"media:{item.uid}" for item in batch)}
            counts = _event_counts(umami_get("metrics", {**scoped, "type": "event", "limit": 100}))
            result["media_views"] += counts.get("media_view", 0)
            result["starts"] += counts.get("playback_start", 0)
            result["finishes"] += counts.get("finish", 0)
            result["deliberate_starts"] += sum(
                row["total"]
                for row in umami_get(
                    "event-data/values",
                    {**scoped, "eventName": "playback_start", "propertyName": "initiation"},
                )
                if row.get("value") == "deliberate"
            )
        return result

    result = counts_for(None if revision == "unknown" else revision)
    if revision == "unknown" and len(media) == 1:
        for cut in (str(media[0].analytics_revision), *media[0].analytics_revisions):
            known = counts_for(cut)
            for key in result:
                result[key] = max(0, result[key] - known[key])
    result["completion_rate"] = round(100 * result["finishes"] / result["starts"]) if result["starts"] else 0
    result["start_at"] = previous_start.isoformat()
    result["end_at"] = current_start.isoformat()
    return result


def creator_analytics(owner, days, page, media_uid=None, revision=None, all_rows=False):
    """Aggregate event counts by media tag, scoped to the current owner."""
    if revision == "unknown" and media_uid:
        media_item = Media.objects.get(user=owner, uid=media_uid)
        result = creator_analytics(owner, days, page, media_uid=media_uid)
        known = [str(media_item.analytics_revision), *media_item.analytics_revisions]
        for known_revision in known:
            part = creator_analytics(owner, days, page, media_uid=media_uid, revision=known_revision)
            for key in result["totals"]:
                result["totals"][key] = max(0, result["totals"][key] - part["totals"][key])
            if result["comparison"]:
                for key in ("media_views", "starts", "finishes", "deliberate_starts"):
                    result["comparison"][key] = max(0, result["comparison"][key] - part["comparison"][key])
            for day, known_day in zip(result["daily"], part["daily"], strict=True):
                for key in ("media_views", "playback_start", "finish"):
                    day[key] = max(0, day[key] - known_day[key])
            for key in ("engagement", "contexts", "initiations", "start_contexts", "referrers", "errors"):
                counts = dict(result[key])
                for label, value in part[key]:
                    counts[label] = max(0, counts.get(label, 0) - value)
                result[key] = [(label, value) for label, value in counts.items() if value]
        result["media_views"] = result["totals"]["media_view"]
        starts = result["totals"]["playback_start"]
        result["completion_rate"] = round(100 * result["totals"]["finish"] / starts) if starts else 0
        result["deliberate_starts"] = dict(result["initiations"]).get("deliberate", 0)
        loads = dict(result["contexts"])
        starts_by_context = dict(result["start_contexts"])
        matched_loads = sum(loads.get(name, 0) for name in ("page", "embed"))
        matched_starts = sum(starts_by_context.get(name, 0) for name in ("page", "embed"))
        result["start_per_load"] = round(100 * matched_starts / matched_loads, 1) if matched_loads else None
        if result["comparison"]:
            previous_starts = result["comparison"]["starts"]
            result["comparison"]["completion_rate"] = (
                round(100 * result["comparison"]["finishes"] / previous_starts) if previous_starts else 0
            )
        return result
    days = days if days in RANGES else 30
    queryset = Media.objects.filter(user=owner)
    if media_uid is not None:
        queryset = queryset.filter(uid=media_uid)
    media = list(queryset.order_by("-add_date", "-pk"))
    today = datetime.now(timezone.utc).date()
    start = datetime.combine(today - timedelta(days=days - 1), datetime.min.time(), tzinfo=timezone.utc)
    current_end = datetime.now(timezone.utc)
    common = {
        "startAt": int(start.timestamp() * 1000),
        "endAt": int(current_end.timestamp() * 1000),
        "timezone": "UTC",
    }
    if revision:
        common["epf0"] = f"1.eq.revision.{revision}"
    totals = dict.fromkeys(
        ("media_view", "playback_start", "progress_25", "progress_50", "progress_75", "finish", *ENGAGEMENT_EVENTS),
        0,
    )
    new_engagement = {}
    trends = {name: {} for name in ("media_views", "playback_start", "finish")}
    by_media = {str(item.uid): {"views": 0, "starts": 0, "finishes": 0} for item in media}
    initiations = {"deliberate": 0, "autoplay": 0, "unknown": 0}
    if not media:
        umami_get("stats", {**common, "tag": "media:00000000-0000-4000-8000-000000000000"})
    for offset in range(0, len(media), 50):
        batch = media[offset : offset + 50]
        params = {**common, "tag": ",".join(f"media:{item.uid}" for item in batch)}
        counts = _event_counts(umami_get("metrics", {**params, "type": "event", "limit": 100}))
        for name, count in counts.items():
            if name in totals:
                totals[name] += count
            elif isinstance(name, str) and EVENT_NAME.fullmatch(name) and name not in NON_ENGAGEMENT_EVENTS:
                new_engagement[name] = new_engagement.get(name, 0) + count
        for row in umami_get("events/series", {**params, "unit": "day"}):
            name = "media_views" if row.get("x") == "media_view" else row.get("x")
            if name in trends:
                day = row["t"][:10]
                trends[name][day] = trends[name].get(day, 0) + row["y"]
        for event_name, field in (("media_view", "views"), ("playback_start", "starts"), ("finish", "finishes")):
            values = umami_get(
                "event-data/values",
                {**params, "eventName": event_name, "propertyName": "media_id"},
            )
            for row in values:
                if row.get("value") in by_media:
                    by_media[row["value"]][field] += row["total"]
        for row in umami_get(
            "event-data/values",
            {**params, "eventName": "playback_start", "propertyName": "initiation"},
        ):
            if row.get("value") in initiations:
                initiations[row["value"]] += row["total"]

    if media_uid is None:
        media.sort(key=lambda item: by_media[str(item.uid)]["views"], reverse=True)
        media_page = Paginator(media, 20).get_page(page)
        visible = media if all_rows else media_page
    else:
        media_page = None
        visible = ()
    rows = []
    for item in visible:
        counts = by_media[str(item.uid)]
        starts = counts["starts"]
        rows.append(
            {
                "media": item,
                **counts,
                "completion_rate": round(100 * counts["finishes"] / starts) if starts else 0,
            }
        )

    dates = [today - timedelta(days=i) for i in range(days - 1, -1, -1)]
    daily = [
        {"date": date.isoformat(), **{name: trend.get(date.isoformat(), 0) for name, trend in trends.items()}}
        for date in dates
    ]
    starts = totals["playback_start"]
    engagement = [(name.replace("_", " ").title(), totals[name]) for name in ENGAGEMENT_EVENTS]
    engagement.extend((name.replace("_", " ").title(), count) for name, count in sorted(new_engagement.items()))
    detail = {}
    if media_uid and media:
        params = {**common, "tag": f"media:{media_uid}"}
        for key, event_name, property_name in (
            ("contexts", "media_view", "context"),
            ("initiations", "playback_start", "initiation"),
            ("start_contexts", "playback_start", "context"),
            ("referrers", "media_view", "source_domain"),
            ("errors", "player_error", "category"),
        ):
            detail[key] = [
                (row["value"], row["total"])
                for row in umami_get(
                    "event-data/values",
                    {**params, "eventName": event_name, "propertyName": property_name},
                )
                if row.get("value") and isinstance(row.get("total"), (int, float))
            ]
        known_starts = sum(value for _, value in detail["initiations"])
        if known_starts < totals["playback_start"]:
            current = dict(detail["initiations"])
            current["unknown"] = current.get("unknown", 0) + totals["playback_start"] - known_starts
            detail["initiations"] = list(current.items())
    else:
        initiations["unknown"] += max(0, totals["playback_start"] - sum(initiations.values()))
    load_contexts = dict(detail.get("contexts", []))
    start_contexts = dict(detail.get("start_contexts", []))
    matched_loads = sum(load_contexts.get(name, 0) for name in ("page", "embed"))
    matched_starts = sum(start_contexts.get(name, 0) for name in ("page", "embed"))
    return {
        "days": days,
        "daily": daily,
        "totals": totals,
        "engagement": engagement,
        "media_views": totals["media_view"],
        "initiations": detail.get("initiations", list(initiations.items())),
        "deliberate_starts": initiations["deliberate"],
        "start_per_load": round(100 * matched_starts / matched_loads, 1) if matched_loads else None,
        "completion_rate": round(100 * totals["finish"] / starts) if starts else 0,
        "rows": rows,
        "media_page": media_page,
        "comparison": _previous_counts(media, days, start, current_end, revision),
        **detail,
    }
