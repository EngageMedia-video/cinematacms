import csv
import logging
from datetime import timedelta
from io import StringIO
from urllib.parse import quote
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import redirect_to_login
from django.core.mail import EmailMessage
from django.core.paginator import Paginator
from django.db.models import Case, Count, IntegerField, Max, Q, Value, When
from django.http import Http404, HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt
from rest_framework import permissions, status
from rest_framework.decorators import api_view
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import (
    FileUploadParser,
    FormParser,
    JSONParser,
    MultiPartParser,
)
from rest_framework.response import Response
from rest_framework.settings import api_settings
from rest_framework.views import APIView

from cms.creator_analytics import RANGES, AnalyticsUnavailable, cms_media_totals, creator_analytics
from cms.custom_pagination import SmallPreviewPagination
from cms.permissions import IsUserOrManager
from cms.playback_analytics import playback_figures
from cms.ui_variant import resolve_template
from files.lists import video_countries
from files.methods import is_curator, is_mediacms_editor, is_mediacms_manager
from files.models import Comment, CommunityImpact, Media, PrivateJournalNote
from files.serializers import CommunityImpactSerializer

from .forms import ChannelForm, UserForm
from .models import Channel, User
from .serializers import (
    MentionSuggestionSerializer,
    ProfilePrivateJournalNoteSerializer,
    UserDetailSerializer,
    UserSerializer,
)

logger = logging.getLogger(__name__)


def get_user(username):
    try:
        user = User.objects.get(username=username)
        return user
    except User.DoesNotExist:
        return None


def can_contact_user(viewer, target):
    """Whether ``viewer`` may send a contact message to ``target``.

    A single source of truth shared by the profile bootstrap (``can_contact``),
    the Contact tab view, and the ``contact_user`` POST endpoint so the modern
    tab is only shown when the send will actually succeed. The viewer must be
    authenticated and not the target; the target must allow contact, unless the
    viewer is an editor (the override role the original ``contact_user`` gate
    honoured). Curators are intentionally NOT included here — this PR does not
    change the pre-existing contact/email behaviour, and the original send gate
    was ``allow_contact or is_mediacms_editor`` only.
    """
    if not viewer.is_authenticated or viewer == target:
        return False
    return bool(target.allow_contact or is_mediacms_editor(viewer))


def _profile_context(request, user, active_tab):
    can_edit = bool(user == request.user or is_mediacms_manager(request.user))
    can_delete = bool(user == request.user or is_mediacms_manager(request.user))
    can_contact = can_contact_user(request.user, user)
    serialized_user = dict(UserDetailSerializer(user, context={"request": request}).data)
    serialized_user.update(
        {
            "is_owner": bool(request.user.is_authenticated and user == request.user),
            "can_edit": can_edit,
            "can_delete": can_delete,
            "can_contact": can_contact,
            "playlist_count": user.playlists.count(),
            "active_tab": active_tab,
        }
    )
    return {
        "user": user,
        "active_tab": active_tab,
        "CAN_EDIT": can_edit,
        "CAN_DELETE": can_delete,
        # Legacy template config (templates/config/core/user.html) keys
        # member.can.contactUser off this; keep its profile-level semantics
        # (allow_contact / editor / curator) — the legacy frontend applies its
        # own non-owner/anonymous checks.
        "SHOW_CONTACT_FORM": bool(user.allow_contact or is_mediacms_editor(request.user) or is_curator(request.user)),
        "PROFILE_INITIAL_DATA": serialized_user,
    }


def _render_profile(request, user, active_tab, legacy_template):
    template = resolve_template(request, "profile")
    if request.ui_variant == "legacy":
        template = legacy_template
    return render(request, template, _profile_context(request, user, active_tab))


def _get_profile_user_or_redirect(username):
    user = get_user(username=username)
    if not user:
        return None, HttpResponseRedirect("/members")
    return user, None


def view_user(request, username):
    user, redirect_response = _get_profile_user_or_redirect(username)
    if redirect_response:
        return redirect_response
    return _render_profile(request, user, "about", "cms/user.html")


def analytics_timezone(request):
    """Validate the browser's IANA timezone before using it in report queries."""
    name = request.GET.get("tz", "UTC")
    try:
        ZoneInfo(name)
    except (ValueError, ZoneInfoNotFoundError) as exc:
        raise Http404("Unknown report timezone") from exc
    return name


@login_required
def view_analytics(request):
    report_timezone = analytics_timezone(request)
    timezone_query = f"&tz={quote(report_timezone, safe='')}"
    selected_media = None
    media_uid = request.GET.get("media")
    if media_uid is not None:
        try:
            media_uid = UUID(media_uid)
        except ValueError as exc:
            raise Http404 from exc
        selected_media = get_object_or_404(Media, user=request.user, uid=media_uid)
    try:
        days = int(request.GET.get("days", 30))
    except ValueError:
        days = 30
    days = days if days in RANGES else 30
    revision = None
    versions = []
    if selected_media:
        versions = [
            {"value": "all", "label": "All versions"},
            {
                "value": str(selected_media.analytics_revision),
                "label": f"Version {len(selected_media.analytics_revisions) + 1} - Current",
            },
            *[
                {"value": old, "label": f"Version {index + 1}"}
                for index, old in reversed(list(enumerate(selected_media.analytics_revisions)))
            ],
            {"value": "unknown", "label": "Data without a film version"},
        ]
        requested = request.GET.get("version", str(selected_media.analytics_revision))
        if requested not in {version["value"] for version in versions}:
            raise Http404
        revision = None if requested == "all" else requested
    context = {"days": days, "ranges": RANGES, "unavailable": True}
    measured = playback_figures(
        request.user,
        days,
        media_uid=media_uid,
        revision=revision,
        report_timezone=report_timezone,
    )
    context["measurement"] = measured
    context["umami_unavailable"] = True
    if all(
        (settings.ANALYTICS_ENABLED, settings.ANALYTICS_URL, settings.ANALYTICS_WEBSITE_ID, settings.ANALYTICS_API_KEY)
    ):
        try:
            context.update(
                creator_analytics(
                    request.user,
                    days,
                    request.GET.get("page"),
                    media_uid=media_uid,
                    revision=revision,
                    report_timezone=report_timezone,
                )
            )
            context["umami_unavailable"] = False
            context["unavailable"] = False
        except (AnalyticsUnavailable, KeyError, TypeError, AttributeError):
            pass

    if context["unavailable"] and selected_media is None:
        page = Paginator(Media.objects.filter(user=request.user).order_by("-add_date", "-pk"), 20).get_page(
            request.GET.get("page")
        )
        context["media_page"] = page
        context["rows"] = [
            {"media": item, "views": None, "starts": None, "finishes": None, "completion_rate": None} for item in page
        ]
    page = context.get("media_page")
    context["ANALYTICS_DATA"] = {
        "unavailable": context["unavailable"],
        "umami_unavailable": context["umami_unavailable"],
        "measurement": measured,
        "cms_totals": cms_media_totals(request.user, media_uid),
        "comparison": context.get("comparison"),
        "updated_at": timezone.now().isoformat(),
        "timezone": report_timezone,
        "days": days,
        "ranges": RANGES,
        "versions": versions,
        "version": requested if selected_media else None,
        "selected_media": {
            "uid": str(selected_media.uid),
            "title": selected_media.title or "Untitled media",
            "state": selected_media.get_state_display(),
            "url": selected_media.get_absolute_url(),
            "thumbnail_url": selected_media.thumbnail_url,
            "media_type": selected_media.media_type,
            "duration": selected_media.duration,
        }
        if selected_media
        else None,
        "media_views": context.get("media_views"),
        "totals": context.get("totals"),
        "completion_rate": context.get("completion_rate", 0),
        "deliberate_starts": context.get("deliberate_starts"),
        "start_per_load": context.get("start_per_load"),
        "start_contexts": context.get("start_contexts"),
        "daily": context.get("daily"),
        "engagement": context.get("engagement"),
        "contexts": context.get("contexts"),
        "initiations": context.get("initiations"),
        "referrers": context.get("referrers"),
        "errors": context.get("errors"),
        "rows": [
            {
                "title": row["media"].title or "Untitled media",
                "state": row["media"].get_state_display(),
                "url": row["media"].get_absolute_url(),
                "analytics_url": f"?media={row['media'].uid}&days={days}{timezone_query}",
                "views": row["views"],
                "starts": row["starts"],
                "finishes": row["finishes"],
                "completion_rate": row["completion_rate"],
                "watch_seconds": measured["per_media_watch_seconds"].get(str(row["media"].uid), 0),
                "measured_plays": measured["per_media_measured_plays"].get(str(row["media"].uid), 0),
                "legacy_views": row["media"].views,
            }
            for row in context.get("rows", [])
        ],
        "pagination": {
            "number": page.number,
            "count": page.paginator.num_pages,
            "previous": page.previous_page_number() if page.has_previous() else None,
            "next": page.next_page_number() if page.has_next() else None,
        }
        if page
        else None,
    }
    response = render(request, "cms/creator_analytics.html", context)
    response["Cache-Control"] = "private, no-store"
    response["Referrer-Policy"] = "no-referrer"
    return response


@login_required
def export_analytics(request):
    """Export the full owner-scoped range; blank cells mean a source is unavailable."""
    report_timezone = analytics_timezone(request)
    try:
        days = int(request.GET.get("days", 30))
    except ValueError:
        days = 30
    days = days if days in RANGES else 30
    media_uid = request.GET.get("media")
    selected = None
    if media_uid is not None:
        try:
            selected = get_object_or_404(Media, user=request.user, uid=UUID(media_uid))
        except ValueError as exc:
            raise Http404 from exc
    dataset = request.GET.get("dataset", "portfolio")
    if dataset not in (("summary", "daily", "retention", "engagement") if selected else ("portfolio",)):
        raise Http404
    revision = request.GET.get("version", str(selected.analytics_revision)) if selected else None
    if selected and revision not in {"all", str(selected.analytics_revision), *selected.analytics_revisions, "unknown"}:
        raise Http404
    revision_filter = None if revision == "all" else revision
    measured = playback_figures(
        request.user,
        days,
        media_uid=selected.uid if selected else None,
        revision=revision_filter,
        report_timezone=report_timezone,
    )
    umami = None
    if all(
        (settings.ANALYTICS_ENABLED, settings.ANALYTICS_URL, settings.ANALYTICS_WEBSITE_ID, settings.ANALYTICS_API_KEY)
    ):
        try:
            umami = creator_analytics(
                request.user,
                days,
                None,
                media_uid=selected.uid if selected else None,
                revision=revision_filter,
                all_rows=True,
                report_timezone=report_timezone,
            )
        except (AnalyticsUnavailable, KeyError, TypeError, AttributeError):
            pass
    output = StringIO()
    writer = csv.writer(output)

    def write_row(values):
        if values[0] == "media_id":
            writer.writerow((*values, "timezone", "watch_time_status"))
        else:
            writer.writerow((*values, report_timezone, "partial" if measured["watch_time_incomplete"] else "complete"))

    def safe(value):
        if value is None:
            return ""
        value = str(value)
        return (
            "'" + value
            if value.lstrip().startswith(("=", "+", "-", "@")) or value.startswith(("\t", "\r", "\n"))
            else value
        )

    today = timezone.now().astimezone(ZoneInfo(report_timezone)).date()
    start = today - timedelta(days=days - 1)
    if dataset == "portfolio":
        write_row(
            (
                "media_id",
                "title",
                "state",
                "views",
                "starts",
                "end_events",
                "watch_seconds",
                "start_date",
                "end_date",
                "umami_status",
                "cms_measured_plays",
                "legacy_views_all_time",
                "current_likes",
                "current_comments",
            )
        )
        if umami:
            rows = umami["rows"]
        else:
            rows = [{"media": item} for item in Media.objects.filter(user=request.user).order_by("-add_date", "-pk")]
        comments = {
            row["media_id"]: row["count"]
            for row in Comment.objects.filter(media__user=request.user)
            .order_by()
            .values("media_id")
            .annotate(count=Count("id"))
        }
        for row in rows:
            item = row["media"]
            write_row(
                (
                    item.uid,
                    safe(item.title),
                    item.state,
                    row.get("views") if umami else "",
                    row.get("starts") if umami else "",
                    row.get("finishes") if umami else "",
                    measured["per_media_watch_seconds"].get(str(item.uid), 0),
                    start,
                    today,
                    "available" if umami else "unavailable",
                    measured["per_media_measured_plays"].get(str(item.uid), 0),
                    item.views,
                    item.likes,
                    comments.get(item.pk, 0),
                )
            )
    elif dataset == "summary":
        write_row(("media_id", "cut", "metric", "value", "definition", "start_date", "end_date", "source_status"))
        current_totals = cms_media_totals(request.user, selected.uid)
        summary = (
            ("media_views", umami["media_views"] if umami else None, "Eligible media page and embed loads", "Umami"),
            ("playback_starts", umami["totals"]["playback_start"] if umami else None, "All playback starts", "Umami"),
            (
                "starts_after_interaction",
                umami["deliberate_starts"] if umami else None,
                "Starts after a player action or on-site navigation",
                "Umami",
            ),
            (
                "end_events",
                umami["totals"]["finish"] if umami else None,
                "Playback finish events, including seeks to end",
                "Umami",
            ),
            (
                "end_events_per_start_percent",
                umami["completion_rate"] if umami else None,
                "Finish events divided by start events in this period; not a play completion rate",
                "Umami",
            ),
            ("watch_seconds", measured["watch_seconds"], "Qualified real viewing seconds", "CMS"),
            (
                "average_watch_seconds",
                measured["average_watch_seconds"],
                "Qualified seconds from plays started in range divided by measured plays",
                "CMS",
            ),
            (
                "average_percent_watched",
                measured["average_percent_watched"],
                "Mean unique content coverage per measured play",
                "CMS",
            ),
            ("measured_plays", measured["measured_plays"], "Plays with a CMS snapshot", "CMS"),
            (
                "legacy_views_all_time",
                current_totals["legacy_views"],
                "Existing CMS view counter across all versions, not date filtered",
                "CMS current",
            ),
            (
                "current_likes",
                current_totals["likes"],
                "Current CMS likes across all versions, not date filtered",
                "CMS current",
            ),
            (
                "current_comments",
                current_totals["comments"],
                "Current comment count across all versions, not date filtered",
                "CMS current",
            ),
        )
        for name, value, definition, source in summary:
            write_row(
                (
                    selected.uid,
                    "" if source == "CMS current" else revision,
                    name,
                    value if value is not None else "",
                    definition,
                    "" if source == "CMS current" else start,
                    "" if source == "CMS current" else today,
                    "available" if source.startswith("CMS") or umami else "unavailable",
                )
            )
    elif dataset == "daily":
        write_row(("media_id", "cut", "date", "views", "starts", "end_events", "watch_seconds", "umami_status"))
        for index in range(days):
            day = (start + timedelta(days=index)).isoformat()
            events = umami["daily"][index] if umami else {}
            write_row(
                (
                    selected.uid,
                    revision,
                    day,
                    events.get("media_views", ""),
                    events.get("playback_start", ""),
                    events.get("finish", ""),
                    measured["daily_watch_seconds"][day],
                    "available" if umami else "unavailable",
                )
            )
    elif dataset == "retention":
        write_row(
            (
                "media_id",
                "cut",
                "segment_start_percent",
                "segment_end_percent",
                "average_segment_watched_percent",
                "measured_plays",
                "start_date",
                "end_date",
            )
        )
        for index, value in enumerate(measured["retention"]):
            write_row(
                (selected.uid, revision, index * 5, (index + 1) * 5, value, measured["measured_plays"], start, today)
            )
    else:
        write_row(("media_id", "cut", "category", "name", "count", "start_date", "end_date", "umami_status"))
        if umami:
            for category, entries in (
                ("engagement", umami["engagement"]),
                ("context", umami["contexts"]),
                ("initiation", umami["initiations"]),
                ("referrer_domain", umami["referrers"]),
                ("player_error", umami["errors"]),
            ):
                for name, count in entries:
                    write_row((selected.uid, revision, category, safe(name), count, start, today, "available"))
        else:
            write_row((selected.uid, revision, "", "", "", start, today, "unavailable"))
    response = HttpResponse(output.getvalue(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="analytics-{dataset}.csv"'
    response["Cache-Control"] = "private, no-store"
    response["Referrer-Policy"] = "no-referrer"
    return response


@login_required
def view_user_analytics(request, username):
    if request.user.username != username:
        raise Http404
    query = request.META.get("QUERY_STRING", "")
    destination = reverse("creator_analytics")
    return HttpResponseRedirect(f"{destination}?{query}" if query else destination)


def view_user_media(request, username):
    user, redirect_response = _get_profile_user_or_redirect(username)
    if redirect_response:
        return redirect_response
    return _render_profile(request, user, "media", "cms/user_media.html")


def view_user_playlists(request, username):
    user, redirect_response = _get_profile_user_or_redirect(username)
    if redirect_response:
        return redirect_response
    return _render_profile(request, user, "playlists", "cms/user_playlists.html")


def view_user_about(request, username):
    user, redirect_response = _get_profile_user_or_redirect(username)
    if redirect_response:
        return redirect_response
    return _render_profile(request, user, "about", "cms/user_about.html")


def _owner_profile_tab(request, username, active_tab, legacy_redirect=None):
    user, redirect_response = _get_profile_user_or_redirect(username)
    if redirect_response:
        return redirect_response
    if not request.user.is_authenticated or request.user != user:
        return HttpResponseRedirect(user.get_absolute_url())

    template = resolve_template(request, "profile")
    if request.ui_variant == "legacy":
        return HttpResponseRedirect(legacy_redirect or user.get_absolute_url())
    from cms.analytics import allow_workflow_analytics

    allow_workflow_analytics(request, "profile_activity")
    return render(request, template, _profile_context(request, user, active_tab))


def view_user_manage_uploads(request, username):
    return _owner_profile_tab(request, username, "manage-uploads", "/manage/uploads")


def view_user_notes(request, username):
    return _owner_profile_tab(request, username, "notes")


def view_user_history(request, username):
    return _owner_profile_tab(request, username, "history", "/history")


def view_user_liked(request, username):
    return _owner_profile_tab(request, username, "liked", "/liked")


def view_user_impact(request, username):
    user, redirect_response = _get_profile_user_or_redirect(username)
    if redirect_response:
        return redirect_response
    template = resolve_template(request, "profile")
    if request.ui_variant == "legacy":
        return HttpResponseRedirect(user.get_absolute_url())
    return render(request, template, _profile_context(request, user, "impact"))


def view_user_contact(request, username):
    user, redirect_response = _get_profile_user_or_redirect(username)
    if redirect_response:
        return redirect_response
    template = resolve_template(request, "profile")
    if request.ui_variant == "legacy":
        return HttpResponseRedirect(user.get_absolute_url())
    # Contact requires an authenticated non-owner on a profile that accepts
    # contact (mirrors the contact_user POST gate). Send anonymous visitors who
    # follow a shared /contact link to login with a next back to the tab, like
    # the rest of the site's gated pages; everyone else bounces to the profile.
    if not request.user.is_authenticated:
        return redirect_to_login(request.get_full_path())
    if not can_contact_user(request.user, user):
        return HttpResponseRedirect(user.get_absolute_url())
    from cms.analytics import allow_workflow_analytics

    allow_workflow_analytics(request, "contact")
    return render(request, template, _profile_context(request, user, "contact"))


@login_required
def edit_user(request, username):
    user = get_user(username=username)
    if not user or (user != request.user and not is_mediacms_manager(request.user)):
        return HttpResponseRedirect("/")

    from cms.analytics import allow_workflow_analytics

    allow_workflow_analytics(request, "profile_edit")
    if request.method == "POST":
        form = UserForm(request.user, request.POST, request.FILES, instance=user)
        if form.is_valid():
            user = form.save(commit=False)
            user.save()
            from cms.analytics import queue_action

            queue_action(request, "profile_update")
            return HttpResponseRedirect(user.get_absolute_url())
    else:
        form = UserForm(request.user, instance=user)
    return render(request, "cms/user_edit.html", {"form": form})


@login_required
def legacy_settings_redirect(request, username):
    # Back-compat only: the settings UI now lives as the "Preferences" tab on
    # `/notifications/`. This route is kept alive so the footer link in
    # already-sent notification emails (prefs_link in notifications/tasks.py)
    # still lands users in the right place.
    #
    # The `username` path parameter is captured for URL-pattern matching only
    # and is intentionally ignored — the redirect target is self-scoped, so a
    # caller requesting another user's URL lands on their own preferences.
    return HttpResponseRedirect("/notifications/#preferences")


@login_required
def mfa_success_message(request):
    user = get_user(request.user)
    if not user or (user != request.user and not is_mediacms_manager(request.user)):
        return HttpResponseRedirect("/")
    return render(request, "mfa/totp/success.html")


def view_channel(request, friendly_token):
    context = {}
    channel = Channel.objects.filter(friendly_token=friendly_token).first()
    user = None if not channel else channel.user
    context["user"] = user
    context["CAN_EDIT"] = bool(user and user == request.user or request.user.is_superuser)

    return render(request, "cms/channel.html", context)


@login_required
def edit_channel(request, friendly_token):
    channel = Channel.objects.filter(friendly_token=friendly_token).first()
    if not (channel and request.user.is_authenticated and (request.user == channel.user)):
        return HttpResponseRedirect("/")

    from cms.analytics import allow_workflow_analytics

    allow_workflow_analytics(request, "channel_edit")
    if request.method == "POST":
        form = ChannelForm(request.POST, request.FILES, instance=channel)
        if form.is_valid():
            channel = form.save(commit=False)
            channel.save()
            from cms.analytics import queue_action

            queue_action(request, "channel_update")
            return HttpResponseRedirect(request.user.get_absolute_url())
    else:
        form = ChannelForm(instance=channel)
    return render(request, "cms/channel_edit.html", {"form": form})


# Contact message length caps (characters). Subject sits in an email header;
# body is the message. Generous but bounded so the endpoint cannot be abused to
# send huge emails.
CONTACT_SUBJECT_MAX_LENGTH = 200
CONTACT_BODY_MAX_LENGTH = 5000


@csrf_exempt
@api_view(["POST"])
def contact_user(request, username):
    if not request.user.is_authenticated:
        return Response(
            {"detail": "request need be authenticated"},
            status=status.HTTP_401_UNAUTHORIZED,
        )
    user = User.objects.filter(username=username).first()
    if not user:
        return Response({"detail": "user does not exist"}, status=status.HTTP_404_NOT_FOUND)
    if not can_contact_user(request.user, user):
        return Response(
            {"detail": "You are not allowed to contact this user"},
            status=status.HTTP_403_FORBIDDEN,
        )

    sender = request.user
    recipient = user
    sender_display_name = sender.name or sender.username
    recipient_display_name = recipient.name or recipient.username
    form_subject = request.data.get("subject", "")
    form_body = request.data.get("body", "")

    if not isinstance(form_subject, str) or not isinstance(form_body, str):
        return Response(
            {"detail": "Subject and body are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    form_subject = form_subject.strip()
    form_body = form_body.strip()

    if not form_subject or not form_body:
        return Response(
            {"detail": "Subject and body are required"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # The subject is interpolated into an email Subject header. A newline would
    # make Django raise BadHeaderError from EmailMessage.message() — which is
    # NOT swallowed by fail_silently (that only covers SMTP send errors) — so an
    # unvalidated newline turns into a 500. Reject it here as a 400 instead.
    if "\n" in form_subject or "\r" in form_subject:
        return Response(
            {"detail": "Subject may not contain line breaks"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Bound both fields so the endpoint cannot be used to send arbitrarily large
    # emails (otherwise limited only by DATA_UPLOAD_MAX_MEMORY_SIZE).
    if len(form_subject) > CONTACT_SUBJECT_MAX_LENGTH:
        return Response(
            {"detail": f"Subject may not exceed {CONTACT_SUBJECT_MAX_LENGTH} characters"},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(form_body) > CONTACT_BODY_MAX_LENGTH:
        return Response(
            {"detail": f"Message may not exceed {CONTACT_BODY_MAX_LENGTH} characters"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Email to recipient
    recipient_email = EmailMessage(
        subject=f"[{settings.PORTAL_NAME}] Message from {sender.username}: {form_subject}",
        body=(
            f"You have received a message from {sender_display_name} ({sender.email}) on {settings.PORTAL_NAME}.\n\n"
            f"Subject: {form_subject}\n\n"
            f"---\n{form_body}\n---\n\n"
            f"Reply to this email to reach {sender_display_name} directly.\n\n"
            f"--\nThis message was sent via {settings.PORTAL_NAME}\n"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[recipient.email],
        reply_to=[sender.email],
        headers={"X-Cinemata-Email-Kind": "contact_form"},
    )
    if not recipient_email.send(fail_silently=True):
        logger.error(
            "Failed to send contact email from user %s to user %s (recipient)",
            sender.username,
            recipient.username,
        )

    # Copy to sender
    timestamp = timezone.now().strftime("%B %d, %Y at %I:%M %p")
    sender_copy = EmailMessage(
        subject=f"[{settings.PORTAL_NAME}] Copy of your message to {recipient_display_name}",
        body=(
            f"This is a copy of the message you sent on {settings.PORTAL_NAME}.\n\n"
            f"To: {recipient_display_name}\n"
            f"Date: {timestamp}\n"
            f"Subject: {form_subject}\n\n"
            f"---\n{form_body}\n---\n\n"
            f"This is a confirmation copy for your records.\n\n"
            f"--\nThis message was sent via {settings.PORTAL_NAME}\n"
        ),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[sender.email],
        headers={"X-Cinemata-Email-Kind": "contact_form"},
    )
    if not sender_copy.send(fail_silently=True):
        logger.error(
            "Failed to send contact email copy to sender %s (message to %s)",
            sender.username,
            recipient.username,
        )

    return Response(status=status.HTTP_204_NO_CONTENT)


class UserList(APIView):
    permission_classes = (permissions.IsAuthenticatedOrReadOnly,)
    parser_classes = (JSONParser, MultiPartParser, FormParser, FileUploadParser)

    def get(self, request, format=None):
        # SmallPreviewPagination: default page_size remains 50; ?page_size=
        # up to 10 is honoured for preview callers (e.g. global-search).
        paginator = SmallPreviewPagination()

        # Base queryset: active users with at least one video (combat spam)
        users = User.objects.filter(is_active=True, media_count__gt=0).exclude(username="emnews")

        # Get user's country for same-country sorting
        user_country = None
        if request.user.is_authenticated:
            user_country = request.user.location_country

        # Filter by location/country
        location = request.GET.get("location", "").strip()
        if location:
            # Normalize input for ISO code checking
            location_upper = location.upper()
            countries_dict = dict(video_countries)

            # Check if it's already an ISO country code (2-letter uppercase)
            if location_upper in countries_dict:
                # Direct ISO code match (e.g., "PH", "MY")
                users = users.filter(location_country=location_upper)
            else:
                # Try to match display name to country code (case-insensitive)
                name_to_code = {value.lower(): key for key, value in countries_dict.items()}
                location_code = name_to_code.get(location.lower())

                if location_code:
                    # Matched a country display name (e.g., "Philippines" -> "PH")
                    users = users.filter(location_country=location_code)
                else:
                    # Not a country code or name, search in location field (free text)
                    users = users.filter(location__icontains=location)

        # Search functionality
        search = request.GET.get("search", "").strip()
        if search:
            users = users.filter(
                Q(name__icontains=search) | Q(username__icontains=search) | Q(location__icontains=search)
            )

        # Apply sorting
        # sort=smart: Default "Most Active" sort - prioritizes users from the same country,
        #             then sorts by media count (activity level) and join date.
        #             This provides personalized results while showing the most engaged members.
        # sort=country: Same country first, then by join date only (less emphasis on activity)
        # sort=recent: Newest members first
        # sort=videos: Members with most videos first
        sort = request.GET.get("sort", "smart")

        if sort == "smart" and user_country:
            # Smart sort: same country first, then by media count and join date
            # Using Django ORM annotations (secure, no SQL injection)
            users = users.annotate(
                same_country=Case(When(location_country=user_country, then=Value(1)), default=Value(0))
            ).order_by("-same_country", "-media_count", "-date_added")
        elif sort == "country" and user_country:
            # Same Country First: prioritize same country, then by join date
            users = users.annotate(
                same_country=Case(When(location_country=user_country, then=Value(1)), default=Value(0))
            ).order_by("-same_country", "-date_added")
        elif sort == "recent":
            users = users.order_by("-date_added")
        elif sort == "videos":
            users = users.order_by("-media_count")
        else:
            # Default: prioritize trusted users, then by video count
            users = users.order_by("-advancedUser", "-media_count", "-date_added")

        page = paginator.paginate_queryset(users, request)

        serializer = UserSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)


class MentionSuggestionList(APIView):
    """Autocomplete source for @mentions in the comment box.

    Matches on display name and handle, and is limited to authenticated callers
    so the user directory is not enumerable anonymously. Users who turned off
    ``allow_mentions`` are never suggested; ``files.mentions`` drops them again
    at resolution time, so a hand-typed handle does not reach them either.
    """

    permission_classes = (permissions.IsAuthenticated,)

    MAX_RESULTS = 10

    def get(self, request, format=None):
        users = User.objects.filter(is_active=True, allow_mentions=True).exclude(pk=request.user.pk)

        query = request.GET.get("q", "").strip().lstrip("@")
        if query:
            users = users.filter(Q(username__icontains=query) | Q(name__icontains=query))
            # Handle prefix matches first, then name prefix matches, then the rest,
            # so typing "@an" surfaces "andria" ahead of "deandra".
            users = users.annotate(
                match_rank=Case(
                    When(username__istartswith=query, then=Value(0)),
                    When(name__istartswith=query, then=Value(1)),
                    default=Value(2),
                    output_field=IntegerField(),
                )
            ).order_by("match_rank", "username")
        else:
            # An empty query is the moment right after "@" was typed. Show the
            # most active accounts so the list is never empty.
            users = users.order_by("-media_count", "username")

        serializer = MentionSuggestionSerializer(users[: self.MAX_RESULTS], many=True, context={"request": request})
        return Response(serializer.data)


class UserDetail(APIView):
    """ """

    permission_classes = (permissions.IsAuthenticatedOrReadOnly, IsUserOrManager)
    parser_classes = (JSONParser, MultiPartParser, FormParser, FileUploadParser)

    def get_user(self, username):
        try:
            user = User.objects.get(username=username)
            # this need be explicitly called, and will call
            # has_object_permission() after has_permission has succeeded
            self.check_object_permissions(self.request, user)
            return user
        except PermissionDenied:
            return Response({"detail": "not enough permissions"}, status=status.HTTP_400_BAD_REQUEST)
        except User.DoesNotExist:
            return Response({"detail": "user does not exist"}, status=status.HTTP_400_BAD_REQUEST)

    def get(self, request, username, format=None):
        # Get user details
        user = self.get_user(username)
        if isinstance(user, Response):
            return user

        serializer = UserDetailSerializer(user, context={"request": request})
        return Response(serializer.data)

    def post(self, request, uid, format=None):
        # USER
        user = self.get_user(uid)
        if isinstance(user, Response):
            return user

        serializer = UserDetailSerializer(user, data=request.data, context={"request": request})
        if serializer.is_valid():
            logo = request.data.get("logo")
            if logo:
                serializer.save(logo=logo)
            else:
                serializer.save()

            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, uid, format=None):
        # ADMIN
        user = self.get_user(uid)
        if isinstance(user, Response):
            return user

        if not request.user.is_superuser:
            return Response({"detail": "not allowed"}, status=status.HTTP_400_BAD_REQUEST)

        action = request.data.get("action")
        if action == "feature":
            user.is_featured = True
            user.save()
        elif action == "unfeature":
            user.is_featured = False
            user.save()

        serializer = UserDetailSerializer(user, context={"request": request})
        return Response(serializer.data)

    def delete(self, request, username, format=None):
        # Delete a user
        user = self.get_user(username)
        if isinstance(user, Response):
            return user

        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


def _impact_film_media(media, request):
    """Minimal media payload for an Impact-tab film-row header.

    ImpactFilmRow (mirroring the Playlist FilmRow) only needs title, url,
    thumbnail, uploader, country, views, synopsis and duration. Building this
    dict directly — instead of the full MediaSerializer — avoids that
    serializer's per-media work (e.g. encoding/preview lookups), so the endpoint
    stays flat regardless of how many films are returned, and keeps the payload
    scoped to what the UI renders.
    """
    thumbnail_url = media.thumbnail_url
    return {
        "friendly_token": media.friendly_token,
        "title": media.title,
        "url": request.build_absolute_uri(media.get_absolute_url()),
        "thumbnail_url": request.build_absolute_uri(thumbnail_url) if thumbnail_url else None,
        "author_name": media.author_name,
        "author_profile": request.build_absolute_uri(media.author_profile()),
        "duration": media.duration,
        "views": media.views,
        "summary": media.summary,
        "media_country_info": media.media_country_info,
    }


class UserCommunityImpactList(APIView):
    permission_classes = (permissions.AllowAny,)
    # Entries kept per category per film. The profile UI lists individual
    # entries, so this caps a single film's list; it does not cap the number of
    # films (see film_limit).
    category_limit = 50
    # Films returned per request. Community impact is manually submitted and
    # admin-approved per film, so a single author realistically has impact on a
    # handful of films (single digits in practice). This cap is defensive
    # insurance against a future data explosion, surfaced via `has_more` rather
    # than full pagination, which the tiny realistic bound does not warrant.
    film_limit = 50

    def get(self, request, username):
        user = get_user(username)
        if not user:
            return Response({"detail": "user does not exist"}, status=status.HTTP_404_NOT_FOUND)

        # Only categories the profile Impact tab actually renders (see
        # ImpactFilmGroup). "curated" is never shown, and "saves" is a
        # summary-only category with no listable entries, so excluding both
        # keeps the payload aligned with the UI and avoids empty film groups.
        display_categories = [
            category
            for category, _ in CommunityImpact.CATEGORY_CHOICES
            if category not in (CommunityImpact.CURATED, CommunityImpact.SAVES)
        ]
        entries = (
            CommunityImpact.objects.filter(
                media__user=user,
                media__state="public",
                media__is_reviewed=True,
                media__encoding_status="success",
                status=CommunityImpact.APPROVED,
                category__in=display_categories,
            )
            # select_related covers everything _impact_film_media reads (media +
            # its user); it builds a minimal dict, so there is no per-film m2m or
            # encoding lookup to prefetch.
            .select_related("media", "media__user", "user")
        )

        # Group entries under the film they belong to so the profile Impact tab
        # can attribute each entry to its media (issue #810). Films keep the
        # order in which their most recent impact entry appears (entries keep
        # CommunityImpact's default newest-impact-first ordering). Films beyond
        # film_limit are dropped and flagged via has_more.
        films = {}
        has_more = False
        for entry in entries:
            media = entry.media
            film = films.get(media.pk)
            if film is None:
                if len(films) >= self.film_limit:
                    has_more = True
                    continue
                film = {
                    "media": _impact_film_media(media, request),
                    "impact": {category: {"entries": []} for category in display_categories},
                }
                films[media.pk] = film

            bucket = film["impact"][entry.category]
            if len(bucket["entries"]) < self.category_limit:
                bucket["entries"].append(CommunityImpactSerializer(entry, context={"request": request}).data)

        return Response({"films": list(films.values()), "has_more": has_more})


class UserPrivateJournalList(APIView):
    """Author-scoped private journal notes for the profile "My Notes" tab,
    aggregated by film.

    The tab renders one card per film (latest note + a total count), so this
    endpoint groups server-side and paginates by *film* — mirroring the Impact
    endpoint's per-film shape — instead of returning every note and collapsing
    on the client. That keeps the note count authoritative and the request
    count constant regardless of how many notes a user has.

    Private notes: a user may only list their own notes, so this requires
    authentication and matching the requested username (403 otherwise).
    """

    permission_classes = (permissions.IsAuthenticated,)

    def get(self, request, username):
        if request.user.username != username:
            return Response(
                {"detail": "You may only view your own notes"},
                status=status.HTTP_403_FORBIDDEN,
            )

        # One row per film the user has notes on, ordered by the most recent
        # note, with the per-film note count. Uses the (user, -add_date) index.
        films = (
            PrivateJournalNote.objects.filter(user=request.user)
            .values("media")
            .annotate(note_count=Count("id"), latest_note_date=Max("add_date"))
            .order_by("-latest_note_date")
        )

        paginator = api_settings.DEFAULT_PAGINATION_CLASS()
        page = paginator.paginate_queryset(films, request)

        # Fetch the latest note per film in the page. self.request.user scopes
        # this to the owner, and there is one film row per media, so this is a
        # bounded number of point lookups (page size), not an N+1 over all notes.
        counts = {row["media"]: row["note_count"] for row in page}
        latest_notes = []
        for media_pk in counts:
            note = (
                PrivateJournalNote.objects.filter(user=request.user, media=media_pk)
                .select_related("media")
                .order_by("-add_date")
                .first()
            )
            if note is not None:
                latest_notes.append(note)

        serializer = ProfilePrivateJournalNoteSerializer(
            latest_notes,
            many=True,
            context={"request": request, "note_counts": counts},
        )
        return paginator.get_paginated_response(serializer.data)
