"""Privacy boundary for browser analytics."""

import json
import re
from datetime import timedelta
from urllib.parse import urlsplit
from uuid import UUID

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.core import signing
from django.db.models import F, Sum
from django.http import Http404, HttpResponse, JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST

SEGMENT_SALT = "cinemata.segment.v1"

PUBLIC_ROUTES = {
    "get_page",
    "get_user",
    "get_user_media",
    "get_user_playlists",
    "get_user_about",
    "get_user_impact",
    "view_channel",
    "get_playlist",
}
PUBLIC_PATHS = {
    "/",
    "/latest",
    "/featured",
    "/recommended",
    "/popular",
    "/search",
    "/categories",
    "/members",
    "/tags",
    "/contact",
    "/countries",
    "/languages",
    "/topics",
    "/tos",
    "/creative-commons",
}


def visitor_segment(user):
    if getattr(user, "disable_activity_logging", False) or any(
        getattr(user, role, False) for role in ("is_staff", "is_editor", "is_manager", "is_superuser")
    ):
        return None
    if getattr(user, "is_anonymous", False):
        return "anonymous"
    if getattr(user, "is_curator", False):
        return "curator"
    return "trusted" if getattr(user, "advancedUser", False) else "regular"


def analytics_context(request):
    audience_group = visitor_segment(request.user)
    if not getattr(settings, "ANALYTICS_ENABLED", False) or audience_group is None:
        return {}

    url = getattr(settings, "ANALYTICS_URL", "")
    website_id = getattr(settings, "ANALYTICS_WEBSITE_ID", "")
    parsed_url = urlsplit(url)
    if url and (parsed_url.scheme != "https" or not parsed_url.hostname or parsed_url.username):
        return {}

    workflow = getattr(request, "analytics_workflow", None)
    if workflow:
        return {
            "ANALYTICS": {
                "url": url,
                "website_id": website_id,
                "path": f"/page/{workflow}",
                "nonpublic": True,
                "events": request.session.pop("analytics_events", []) if hasattr(request, "session") else [],
            }
        }

    media = getattr(request, "analytics_media", None)
    if media:
        from cms.playback_analytics import measurement_token

        config = {
            "url": url,
            "website_id": website_id,
            "path": "/media/embed" if media["context"] == "embed" else "/media/view",
            "media_id": media["id"],
            "media_type": media["type"],
            "context": media["context"],
            "nonpublic": media["state"] != "public",
            "revision": media["revision"],
            "measurement_token": measurement_token(media["instance"], media["context"])
            if media["type"] in ("video", "audio")
            else None,
        }
        if media["state"] == "public":
            config["audience_group"] = audience_group
            config["segment_grant"] = signing.dumps({"scope": "media"}, salt=SEGMENT_SALT)
        config["events"] = request.session.pop("analytics_events", []) if hasattr(request, "session") else []
        return {"ANALYTICS": config}

    match = request.resolver_match
    name = match.url_name if match else None
    if name == "get_page" and not getattr(request, "analytics_text_page", False):
        return {}
    if name == "get_playlist" and not getattr(request, "analytics_playlist", None):
        return {}
    opted_in = getattr(request, "analytics_public_page", False)
    if name not in PUBLIC_ROUTES and request.path not in PUBLIC_PATHS and not opted_in:
        return {}

    if opted_in:
        if not name or not re.fullmatch(r"[a-zA-Z0-9_-]{1,64}", name):
            return {}
        path = f"/page/{name}"
    elif name and name.startswith("get_user"):
        section = {
            "get_user_media": "media",
            "get_user_playlists": "playlists",
            "get_user_about": "about",
            "get_user_impact": "impact",
        }.get(name, "home")
        path = f"/user/profile/{section}"
    elif name in {"view_channel", "get_playlist"}:
        path = f"/{name}"
    else:
        path = request.path[2:] if name == "get_page" and request.path.startswith("/p/") else request.path

    scope = f"page:{request.analytics_text_page}" if name == "get_page" else "home" if path == "/" else "other"
    return {
        "ANALYTICS": {
            "url": url,
            "website_id": website_id,
            "path": path,
            "text_page": name == "get_page",
            "playlist_id": getattr(request, "analytics_playlist", None),
            "audience_group": audience_group,
            "segment_grant": signing.dumps({"scope": scope}, salt=SEGMENT_SALT),
            "events": request.session.pop("analytics_events", []) if hasattr(request, "session") else [],
        }
    }


def allow_page_analytics(request):
    """Opt a new public view in after its access check has succeeded."""
    request.analytics_public_page = True


def allow_workflow_analytics(request, name):
    """Admit an authorized owner workflow without a URL or public role grant."""
    if (request.user.is_authenticated or name in {"history", "liked"}) and re.fullmatch(r"[a-z][a-z0-9_]{0,49}", name):
        request.analytics_workflow = name


def action_events(request, *names, media=None):
    """Build count-only browser events after a successful server operation."""
    if not settings.ANALYTICS_ENABLED or visitor_segment(request.user) is None or request.headers.get("DNT") == "1":
        return []
    context = (
        {
            "id": str(media.uid),
            "type": media.media_type,
            "revision": str(media.analytics_revision),
            "context": "workflow",
        }
        if media
        else None
    )
    return [
        {"name": name, **({"media": context} if context else {})}
        for name in names
        if re.fullmatch(r"[a-z][a-z0-9_]{0,49}", name)
    ]


def queue_action(request, name, media=None):
    """Carry successful template-form events across a same-origin redirect."""
    events = action_events(request, name, media=media)
    if events:
        request.session["analytics_events"] = (request.session.get("analytics_events", []) + events)[-20:]


def allow_media_analytics(request, media, context):
    """Called only after the media access check succeeds."""
    request.analytics_media = {
        "id": str(media.uid),
        "type": media.media_type,
        "state": media.state,
        "context": context,
        "revision": str(media.analytics_revision),
        "instance": media,
    }


@csrf_exempt
@require_POST
def record_segment_event(request):
    """Count broad public activity by role without storing a visitor key."""
    segment = visitor_segment(request.user)
    if not settings.ANALYTICS_ENABLED or segment is None or request.headers.get("DNT") == "1":
        return HttpResponse(status=404)
    host = request.get_host()
    if request.headers.get("Origin") not in {f"{request.scheme}://{host}", f"https://{host}"}:
        return HttpResponse(status=403)
    if len(request.body) > 1024:
        return HttpResponse(status=413)
    try:
        body = json.loads(request.body)
        if not isinstance(body, dict) or set(body) != {"grant", "event"}:
            raise ValueError
        scope = signing.loads(body["grant"], salt=SEGMENT_SALT, max_age=12 * 60 * 60)["scope"]
        event = body["event"]
        if scope not in {"home", "media", "other"} and not re.fullmatch(r"page:[1-9][0-9]{0,9}", scope):
            raise ValueError
        if not isinstance(event, str) or not re.fullmatch(r"[a-z][a-z0-9_]{0,49}", event):
            raise ValueError
        if event.startswith("text_read_") and (
            not scope.startswith("page:")
            or event not in {"text_read_15s", "text_read_30s", "text_read_60s", "text_read_120s", "text_read_300s"}
        ):
            raise ValueError
    except (ValueError, TypeError, KeyError, json.JSONDecodeError, signing.BadSignature):
        return HttpResponse(status=400)

    from files.models import DailySegmentMetric

    DailySegmentMetric.objects.update_or_create(
        day=timezone.now().date(),
        segment=segment,
        scope=scope,
        event=event,
        defaults={"count": F("count") + 1},
        create_defaults={"count": 1},
    )
    return HttpResponse(status=204)


def segment_report_data():
    """Recorded public activity by role during the last 30 days."""
    from files.models import DailySegmentMetric, Page

    end = timezone.now().date()
    start = end - timedelta(days=29)
    rows = list(
        DailySegmentMetric.objects.filter(day__range=(start, end))
        .values("segment", "scope", "event")
        .annotate(count=Sum("count"))
        .order_by("scope", "event", "segment")
    )
    page_ids = {
        int(row["scope"][5:]) for row in rows if row["scope"].startswith("page:") and row["scope"][5:].isdigit()
    }
    pages = dict(Page.objects.filter(pk__in=page_ids).values_list("pk", "slug"))
    for row in rows:
        if row["scope"].startswith("page:"):
            row["path"] = f"/{pages[int(row['scope'][5:])]}" if int(row["scope"][5:]) in pages else None
    return {"start_date_utc": start.isoformat(), "end_date_utc": end.isoformat(), "rows": rows}


@login_required
def segment_report(request):
    """Superuser JSON report, independent of the requested content type."""
    if not request.user.is_superuser:
        raise Http404
    response = JsonResponse(segment_report_data())
    response["Cache-Control"] = "private, no-store"
    return response


def umami_report_url():
    """Link to the configured website without exposing credentials or API keys."""
    url = getattr(settings, "ANALYTICS_URL", "")
    try:
        parsed = urlsplit(url)
        website_id = UUID(getattr(settings, "ANALYTICS_WEBSITE_ID", ""))
        if (
            parsed.scheme != "https"
            or not parsed.hostname
            or parsed.username is not None
            or parsed.query
            or parsed.fragment
        ):
            return None
    except (ValueError, TypeError, AttributeError):
        return None
    return f"{parsed.geturl().rstrip('/')}/websites/{website_id}"
