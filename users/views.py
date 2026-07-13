import logging

from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.contrib.auth.views import redirect_to_login
from django.core.mail import EmailMessage
from django.db.models import Case, Count, Max, Q, Value, When
from django.http import HttpResponseRedirect
from django.shortcuts import render
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

from cms.custom_pagination import SmallPreviewPagination
from cms.permissions import IsUserOrManager
from cms.ui_variant import resolve_template
from files.lists import video_countries
from files.methods import is_curator, is_mediacms_editor, is_mediacms_manager
from files.models import CommunityImpact, PrivateJournalNote
from files.serializers import CommunityImpactSerializer

from .forms import ChannelForm, UserForm
from .models import Channel, User
from .serializers import ProfilePrivateJournalNoteSerializer, UserDetailSerializer, UserSerializer

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
    return render(request, template, _profile_context(request, user, "contact"))


@login_required
def edit_user(request, username):
    user = get_user(username=username)
    if not user or (user != request.user and not is_mediacms_manager(request.user)):
        return HttpResponseRedirect("/")

    if request.method == "POST":
        form = UserForm(request.user, request.POST, request.FILES, instance=user)
        if form.is_valid():
            user = form.save(commit=False)
            user.save()
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

    if request.method == "POST":
        form = ChannelForm(request.POST, request.FILES, instance=channel)
        if form.is_valid():
            channel = form.save(commit=False)
            channel.save()
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
            .order_by("-event_date", "-add_date")
        )

        # Group entries under the film they belong to so the profile Impact tab
        # can attribute each entry to its media (issue #810). Films keep the
        # order in which their most recent impact entry appears (entries are
        # already ordered by -event_date, -add_date above). Films beyond
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
