import contextlib
import csv
import json
import logging
import os
import shutil
from copy import deepcopy
from datetime import datetime, timedelta
from pathlib import Path

import waffle
from django.apps import apps
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.postgres.search import SearchQuery
from django.core.mail import EmailMessage
from django.db import DatabaseError, models, transaction
from django.db.models import Case, Exists, F, OuterRef, Q, Value, When
from django.http import Http404, HttpResponse, HttpResponseRedirect, JsonResponse
from django.shortcuts import get_object_or_404, redirect, render
from django.urls import reverse
from django.utils import timezone
from django.views.decorators.clickjacking import xframe_options_exempt
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import permissions, status
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

from actions.models import USER_MEDIA_ACTIONS, MediaAction
from cms.custom_pagination import FastPaginationWithoutCount, SmallPreviewPagination
from cms.permissions import (
    IsAuthorizedToAdd,
    IsUserOrEditor,
    is_mfa_enabled_for_user,
    max_bulk_upload_files,
    user_allowed_to_bulk_upload,
    user_requires_mfa,
)
from cms.request_utils import get_client_ip
from cms.ui_variant import resolve_template
from users.models import User

from . import lists
from .draft_utils import apply_media_draft, apply_tags, draft_license_error, form_data_to_draft_metadata
from .forms import ContactForm, EditSubtitleForm, MediaForm, SubtitleForm
from .helpers import (
    clean_friendly_token,
    clean_query,
    cleanup_temp_upload_files,
    get_allowed_video_extensions,
    produce_ffmpeg_commands,
    rm_file,
)
from .methods import (
    can_manage_film_impact,
    can_manage_uploads,
    can_upload_media,
    community_impact_auto_approves,
    get_current_featured_media,
    get_user_or_session,
    is_curator,
    is_media_allowed_type,
    is_mediacms_editor,
    is_mediacms_manager,
    list_tasks,
    pre_save_action,
    show_recommended_media,
    show_related_media,
)
from .models import (
    Category,
    Comment,
    CommunityImpact,
    ContentSensitivity,
    EncodeProfile,
    Encoding,
    FeaturedVideo,
    HomepagePopup,
    IndexPageFeatured,
    Language,
    License,
    Media,
    MediaCountry,
    MediaLanguage,
    Page,
    Playlist,
    PlaylistMedia,
    Subtitle,
    Tag,
    Topic,
    TopMessage,
)
from .query_cache import (
    MEDIA_DETAIL_TIMEOUT,
    MEDIA_LIST_TIMEOUT,
    PLAYLIST_DETAIL_TIMEOUT,
    get_cached_result,
    get_media_detail_cache_key,
    get_media_list_cache_key,
    get_playlist_detail_cache_key,
    get_request_cache_origin,
    invalidate_media_cache,
    set_cached_result,
)
from .secure_media_views import check_media_access_permission
from .serializers import (
    CategorySerializer,
    CommentSerializer,
    CommunityImpactSerializer,
    ContentSensitivitySerializer,
    EncodeProfileSerializer,
    HeroPlaybackSerializer,
    HomepagePopupSerializer,
    IndexPageFeaturedSerializer,
    MediaLanguageSerializer,
    MediaSearchSerializer,
    MediaSerializer,
    PlaylistDetailSerializer,
    PlaylistSerializer,
    SingleMediaSerializer,
    TagSerializer,
    TopicSerializer,
    TopMessageSerializer,
)
from .stop_words import STOP_WORDS
from .storage_usage import schedule_refresh_media_storage_usage
from .tasks import save_user_action

VALID_USER_ACTIONS = [action for action, name in USER_MEDIA_ACTIONS]

logger = logging.getLogger(__name__)

HOME_INITIAL_LIMIT = 20
HOME_INITIAL_MEDIA_FIELDS = (
    "friendly_token",
    "url",
    "api_url",
    "title",
    "description",
    "summary",
    "views",
    "duration",
    "thumbnail_url",
    "author_name",
    "author_profile",
    "media_country_info",
    "media_country",
    "categories_info",
)


def _build_featured_queryset(limit=None):
    basic_query = Q(state="public", encoding_status="success", is_reviewed=True)
    scheduled_featured = get_current_featured_media()
    now = timezone.now()
    has_future_schedule = FeaturedVideo.objects.filter(media=OuterRef("pk"), is_active=True, start_date__gt=now)

    if scheduled_featured:
        other_featured = (
            Media.objects.filter(basic_query, featured=True)
            .exclude(pk=scheduled_featured.pk)
            .exclude(Exists(has_future_schedule))
            .order_by(F("featured_date").desc(nulls_last=True), "-add_date")
        )
        other_featured_ids = other_featured.values_list("pk", flat=True)
        if limit is not None:
            other_featured_ids = other_featured_ids[: max(limit - 1, 0)]
        other_featured_ids = list(other_featured_ids)
        all_ids = [scheduled_featured.pk] + other_featured_ids
        preserved_order = Case(
            *[When(pk=pk, then=Value(pos)) for pos, pk in enumerate(all_ids)],
            output_field=models.IntegerField(),
        )
        return Media.objects.filter(pk__in=all_ids).order_by(preserved_order)

    media = (
        Media.objects.filter(basic_query, featured=True)
        .exclude(Exists(has_future_schedule))
        .order_by(F("featured_date").desc(nulls_last=True), "-add_date")
    )
    if limit is not None:
        return media[:limit]
    return media


def _home_featured_envelope(results, source_envelope=None):
    envelope = {
        "count": len(results),
        "next": None,
        "previous": None,
        "results": results,
    }
    if isinstance(source_envelope, dict):
        envelope.update(
            {
                "count": source_envelope.get("count", envelope["count"]),
                "next": source_envelope.get("next"),
                "previous": source_envelope.get("previous"),
                "results": results,
            }
        )
    return envelope


def _home_recommended_envelope(results):
    return {
        "count": len(results),
        "next": None,
        "previous": None,
        "results": results,
    }


def _slim_home_media_item(item):
    if not isinstance(item, dict):
        return item

    slim_item = {field: item[field] for field in HOME_INITIAL_MEDIA_FIELDS if field in item}
    if "hero_playback" in item:
        slim_item["hero_playback"] = item["hero_playback"]
    return slim_item


def _slim_home_media_results(items):
    return [_slim_home_media_item(item) for item in items]


def _attach_hero_playback_to_first_featured_item(items, request=None):
    """
    Add detail-only playback fields to the first featured item.

    The home hero is the only list item that needs player sources. Keeping this
    nested avoids turning every media list response into a detail payload.
    """
    item_list = list(items)
    if not item_list:
        return item_list

    first = item_list[0]
    if not isinstance(first, dict) or first.get("hero_playback"):
        return item_list

    friendly_token = first.get("friendly_token")
    if not friendly_token:
        return item_list

    try:
        media = (
            Media.objects.filter(
                friendly_token=friendly_token,
                state="public",
                encoding_status="success",
                is_reviewed=True,
            )
            .prefetch_related("encodings__profile", "subtitles__language")
            .first()
        )
        if not media:
            return item_list

        serializer_context = {"request": request} if request else {}
        return [
            {
                **first,
                "hero_playback": HeroPlaybackSerializer(media, context=serializer_context).data,
            },
            *item_list[1:],
        ]
    except Exception:
        logger.exception("Failed to attach hero playback to featured media %s", friendly_token)
        return item_list


def _get_home_initial_data(request):
    """
    Fetch featured and recommended payloads for SSR hydration.

    Uses home-specific cache keys so SSR can cache the hero-enriched payload
    without changing the generic media-list API cache contract.
    Returns paginated envelopes ready for json_script.
    """
    try:
        user_id = request.user.id if request.user.is_authenticated else None
        request_origin = get_request_cache_origin(request)

        # --- Featured ---
        home_featured_cache_key = get_media_list_cache_key(
            show="featured_home", page=1, user_id=user_id, origin=request_origin
        )
        cached_home_featured = get_cached_result(home_featured_cache_key)
        if cached_home_featured is not None:
            home_initial_featured = cached_home_featured
        else:
            featured_cache_key = get_media_list_cache_key(
                show="featured", page=1, user_id=user_id, origin=request_origin
            )
            cached_featured = get_cached_result(featured_cache_key)
            if cached_featured is not None:
                featured_results = list((cached_featured.get("results") or [])[:HOME_INITIAL_LIMIT])
                source_envelope = cached_featured
            else:
                qs = (
                    _build_featured_queryset(limit=HOME_INITIAL_LIMIT)
                    .select_related("user")
                    .prefetch_related("category", "topics")
                )
                featured_results = list(MediaSerializer(qs, many=True, context={"request": request}).data)
                source_envelope = None
            featured_results = _attach_hero_playback_to_first_featured_item(featured_results, request=request)
            featured_results = _slim_home_media_results(featured_results)
            home_initial_featured = _home_featured_envelope(featured_results, source_envelope=source_envelope)
            set_cached_result(home_featured_cache_key, home_initial_featured, MEDIA_LIST_TIMEOUT)

        # --- Recommended ---
        # MediaList.get skips caching for show=recommended; this warms SSR hydration only.
        recommended_cache_key = get_media_list_cache_key(
            show="recommended_home", page=1, user_id=user_id, origin=request_origin
        )
        cached_recommended = get_cached_result(recommended_cache_key)
        if cached_recommended is not None:
            home_initial_recommended = cached_recommended
        else:
            recommended_media = show_recommended_media(request, limit=HOME_INITIAL_LIMIT)
            recommended_results = list(
                MediaSerializer(list(recommended_media), many=True, context={"request": request}).data
            )
            recommended_results = _slim_home_media_results(recommended_results)
            home_initial_recommended = _home_recommended_envelope(recommended_results)
            set_cached_result(recommended_cache_key, home_initial_recommended, MEDIA_LIST_TIMEOUT)

        return home_initial_featured, home_initial_recommended
    except Exception:
        logger.exception("Failed to build home initial data")
        return _home_featured_envelope([]), _home_recommended_envelope([])


def index(request):
    template = resolve_template(request, "home")
    context = {}
    if getattr(request, "ui_variant", None) == "revamp":
        featured, recommended = _get_home_initial_data(request)
        context["home_initial_featured"] = featured
        context["home_initial_recommended"] = recommended
        first_featured = (featured.get("results") or [None])[0] if isinstance(featured, dict) else None
        if isinstance(first_featured, dict):
            hero_playback = first_featured.get("hero_playback") or {}
            context["home_hero_preload_image"] = hero_playback.get("poster_url") or first_featured.get("thumbnail_url")
    return render(request, template, context)


def tos(request):
    context = {}
    return render(request, "cms/tos.html", context)


def creative_commons(request):
    context = {}
    return render(request, "cms/creative_commons.html", context)


def countries(request):
    context = {}
    countries = [country[1] for country in lists.video_countries]
    context["countries"] = countries
    return render(request, "cms/countries.html", context)


def languages(request):
    context = {}
    languages = MediaLanguage.objects.order_by("title")
    context["languages"] = languages
    return render(request, "cms/languages.html", context)


def view_page(request, slug):
    context = {}
    page = Page.objects.filter(slug=slug).first()
    if page:
        context["page"] = page
    else:
        return render(request, "404.html", context)
        # return HttpResponseRedirect('/')
    return render(request, "cms/page.html", context)


def modern_demo_page(request):
    if not settings.DEBUG:
        raise Http404
    return render(request, "cms/modern_demo.html")


def manage_users(request):
    if request.user.is_anonymous:
        return HttpResponseRedirect("/")
    # MFA check
    if user_requires_mfa(request.user) and not is_mfa_enabled_for_user(request.user):
        return HttpResponseRedirect("/accounts/2fa/totp/activate")

    # Hard config -> ensure superuser / manager only have access
    if not (request.user.is_superuser or request.user.is_manager):
        return HttpResponseRedirect("/")

    context = {}
    return render(request, "cms/manage_users.html", context)


def manage_media(request):
    if request.user.is_anonymous:
        return HttpResponseRedirect("/")

    # MFA check
    if user_requires_mfa(request.user) and not is_mfa_enabled_for_user(request.user):
        return HttpResponseRedirect("/accounts/2fa/totp/activate")

    # Hard config -> ensure superuser / manager / editor only have access
    if not (request.user.is_superuser or request.user.is_manager or request.user.is_editor):
        return HttpResponseRedirect("/")

    context = {}
    return render(request, "cms/manage_media.html", context)


def manage_comments(request):
    if request.user.is_anonymous:
        return HttpResponseRedirect("/")

    if user_requires_mfa(request.user) and not is_mfa_enabled_for_user(request.user):
        return HttpResponseRedirect("/accounts/2fa/totp/activate")

    if not (request.user.is_superuser or request.user.is_manager or request.user.is_editor):
        return HttpResponseRedirect("/")

    context = {}
    return render(request, "cms/manage_comments.html", context)


@ensure_csrf_cookie
def manage_film_impact(request):
    if request.user.is_anonymous:
        return HttpResponseRedirect("/")

    if user_requires_mfa(request.user) and not is_mfa_enabled_for_user(request.user):
        return HttpResponseRedirect("/accounts/2fa/totp/activate")

    if not can_manage_film_impact(request.user):
        return HttpResponseRedirect("/")

    context = {}
    return render(request, "cms/manage_film_impact.html", context)


@ensure_csrf_cookie
def manage_film_impact_edit(request, uid):
    if request.user.is_anonymous:
        return HttpResponseRedirect("/")

    if user_requires_mfa(request.user) and not is_mfa_enabled_for_user(request.user):
        return HttpResponseRedirect("/accounts/2fa/totp/activate")

    if not can_manage_film_impact(request.user):
        return HttpResponseRedirect("/")

    context = {}
    return render(request, "cms/manage_film_impact.html", context)


def manage_uploads(request):
    if request.user.is_anonymous:
        return HttpResponseRedirect("/")

    if user_requires_mfa(request.user) and not is_mfa_enabled_for_user(request.user):
        return HttpResponseRedirect("/accounts/2fa/totp/activate")

    if not can_manage_uploads(request.user):
        return HttpResponseRedirect("/")

    context = {}
    return render(request, "cms/manage_uploads.html", context)


def export_users(request):
    if request.user.is_anonymous:
        return HttpResponseRedirect("/")

    if not (request.user.is_superuser or request.user.is_manager or request.user.is_editor):
        return HttpResponseRedirect("/")

    response = HttpResponse(content_type="text/csv")
    response["Content-Disposition"] = 'attachment; filename="users.csv"'
    writer = csv.writer(response)
    writer.writerow(
        [
            "Username",
            "Email",
            "Name",
            "Trusted User",
            "Date Added",
            "MediaCMS Editor",
            "MediaCMS Manager",
            "MediaCMS Administrator",
        ]
    )
    for user in User.objects.filter().order_by("date_added"):
        writer.writerow(
            [
                user.username,
                user.email,
                user.name,
                user.advancedUser,
                user.date_added.strftime("%Y-%m-%d"),
                user.is_editor,
                user.is_manager,
                user.is_superuser,
            ]
        )
    return response


def contact(request):
    context = {}
    if request.method == "GET":
        form = ContactForm(request.user)
        context["form"] = form

    else:
        form = ContactForm(request.user, request.POST)

        if form.is_valid():
            if request.user.is_authenticated:
                from_email = request.user.email
                name = request.user.name
            else:
                from_email = request.POST.get("from_email")
                name = request.POST.get("name")
            message = request.POST.get("message")

            title = f"[{settings.PORTAL_NAME}] - Contact form message received"

            msg = """
You have received a message through the contact form\n
Sender name: %s
Sender email: %s\n
\n %s
""" % (
                name,
                from_email,
                message,
            )
            email = EmailMessage(
                title,
                msg,
                settings.DEFAULT_FROM_EMAIL,
                settings.ADMIN_EMAIL_LIST,
                reply_to=[from_email],
            )
            email.send(fail_silently=True)
            success_msg = "Message was sent! Thanks for contacting"
            context["success_msg"] = success_msg

        else:
            if "captcha" in form.errors:
                messages.error(request, "CAPTCHA validation failed. Please try again.")
                return HttpResponseRedirect("/contact")

    return render(request, "cms/contact.html", context)


def categories(request):
    context = {}
    return render(request, "cms/categories.html", context)


def members(request):
    context = {}
    return render(request, "cms/members.html", context)


def tags(request):
    context = {}
    return render(request, "cms/tags.html", context)


def topics(request):
    context = {}
    return render(request, "cms/topics.html", context)


def history(request):
    context = {}
    return render(request, "cms/history.html", context)


@login_required
def notifications_page(request):
    context = {}
    return render(request, "cms/notifications.html", context)


def liked_media(request):
    context = {}
    return render(request, "cms/liked_media.html", context)


def latest_media(request):
    context = {}
    return render(request, "cms/latest-media.html", context)


def recommended_media(request):
    context = {}
    return render(request, "cms/recommended-media.html", context)


def featured_media(request):
    context = {}
    return render(request, "cms/featured-media.html", context)


def search(request):
    try:
        RSS_URL = f"/rss{request.environ['REQUEST_URI']}"
    except:
        RSS_URL = "/rss"
    context = {}
    context["RSS_URL"] = RSS_URL
    return render(request, "cms/search.html", context)


@ensure_csrf_cookie
def upload_media(request):
    from allauth.account.forms import LoginForm

    template = resolve_template(request, "upload")
    form = LoginForm()
    context = {}
    context["form"] = form
    if apps.is_installed("waffle"):
        try:
            upload_allowed = waffle.switch_is_active("upload_media_allowed")
        except DatabaseError:
            upload_allowed = getattr(settings, "UPLOAD_MEDIA_ALLOWED", True)
    else:
        upload_allowed = getattr(settings, "UPLOAD_MEDIA_ALLOWED", True)
    context["can_add"] = upload_allowed and can_upload_media(request.user)
    # Trusted users (advancedUser/editor/manager/superuser) publish without admin
    # review; regular users get the "Submit For Review?" confirmation instead.
    context["can_publish_directly"] = can_manage_uploads(request.user)
    can_upload_exp = settings.CANNOT_ADD_MEDIA_MESSAGE
    context["can_upload_exp"] = can_upload_exp

    # Get allowed video extensions from helper function
    video_extensions = get_allowed_video_extensions()
    context["allowed_extensions"] = json.dumps(video_extensions)

    # Media language / country options, sourced from the DB and lists the same
    # way edit-media does so both pages stay in sync.
    language_choices = Language.objects.exclude(code__in=["automatic", "automatic-translation"]).values_list(
        "code", "title"
    )
    context["media_languages"] = json.dumps([{"value": code, "label": title} for code, title in language_choices])
    context["media_countries"] = json.dumps([{"value": code, "label": title} for code, title in lists.video_countries])

    # Taxonomy options (Category/Topic/ContentSensitivity), value=pk, label=title,
    # ordered by title via each model's Meta — same source the edit-media form uses.
    context["categories"] = json.dumps(
        [{"value": pk, "label": title} for pk, title in Category.objects.values_list("id", "title")]
    )
    context["topics"] = json.dumps(
        [{"value": pk, "label": title} for pk, title in Topic.objects.values_list("id", "title")]
    )
    context["content_sensitivities"] = json.dumps(
        [{"value": pk, "label": title} for pk, title in ContentSensitivity.objects.values_list("id", "title")]
    )

    return render(request, template, context)


@ensure_csrf_cookie
def bulk_upload_media(request):
    """Dedicated bulk-upload page (issue #524), a sibling of the single-upload page.

    Single-file-only users (per-batch limit < 2) are rejected server-side and
    redirected to the single-upload page (decision D8). Anonymous users fall
    through to the sign-in prompt rendered by the template.
    """
    from allauth.account.forms import LoginForm

    if request.user.is_authenticated and not user_allowed_to_bulk_upload(request):
        # Canonical single-upload path. The "upload_media" name is bound to two
        # patterns (^upload and ^scpublisher), so reverse() is ambiguous here.
        return redirect("/upload")

    context = {}
    context["form"] = LoginForm()
    if apps.is_installed("waffle"):
        try:
            upload_allowed = waffle.switch_is_active("upload_media_allowed")
        except DatabaseError:
            upload_allowed = getattr(settings, "UPLOAD_MEDIA_ALLOWED", True)
    else:
        upload_allowed = getattr(settings, "UPLOAD_MEDIA_ALLOWED", True)
    context["can_add"] = upload_allowed and can_upload_media(request.user)
    context["can_upload_exp"] = settings.CANNOT_ADD_MEDIA_MESSAGE

    context["allowed_extensions"] = json.dumps(get_allowed_video_extensions())
    context["max_bulk_files"] = max_bulk_upload_files(request.user)
    context["upload_max_size"] = settings.UPLOAD_MAX_SIZE
    context["chunks_done_param"] = settings.CHUNKS_DONE_PARAM_NAME
    context["is_trusted_user"] = bool(
        request.user.is_authenticated
        and (
            request.user.is_superuser or request.user.is_manager or request.user.is_editor or request.user.advancedUser
        )
    )

    return render(request, "cms/bulk_upload.html", context)


def view_media(request):
    template = resolve_template(request, "media")
    friendly_token = request.GET.get("m", "").strip()
    context = {}
    #    if not friendly_token:
    #        return HttpResponseRedirect('/')
    media = Media.objects.filter(friendly_token=friendly_token).first()
    if not media:
        # TODO: 404 selida
        context["media"] = None
        return render(request, template, context)
        # return HttpResponseRedirect('/')
    user_or_session = get_user_or_session(request)
    save_user_action.delay(user_or_session, friendly_token=friendly_token, action="watch")
    context = {}
    context["media"] = friendly_token
    context["media_object"] = media

    context["CAN_DELETE_MEDIA"] = False
    context["CAN_EDIT_MEDIA"] = False
    context["CAN_DELETE_COMMENTS"] = False

    can_see_restricted_media = False
    wrong_password_provided = False
    rate_limited = False
    media_access_token = None

    # Owner/editor bypass FIRST — unaffected by Redis outages
    if request.user.is_authenticated:
        if (media.user.id == request.user.id) or is_mediacms_editor(request.user) or is_mediacms_manager(request.user):
            context["CAN_DELETE_MEDIA"] = True
            context["CAN_EDIT_MEDIA"] = True
            context["CAN_DELETE_COMMENTS"] = True
            can_see_restricted_media = True

    if media.state == "restricted" and not can_see_restricted_media:
        from files.token_utils import (
            authenticate_restricted_media,
            validate_token,
        )

        media_uid = media.uid_hex
        ip = get_client_ip(request)

        # Check session token on GET (avoid re-prompting)
        session_token = request.session.get(f"media_token_{media.friendly_token}")
        if session_token and validate_token(session_token, media_uid):
            can_see_restricted_media = True
            media_access_token = session_token
        elif session_token:
            # Stale session token — clean up
            request.session.pop(f"media_token_{media.friendly_token}", None)

        # Handle password POST
        if not can_see_restricted_media and request.POST.get("password"):
            try:
                token, error = authenticate_restricted_media(media, request.POST.get("password"), ip)
            except Exception:
                logger.exception("Failed to generate token for media %s", media.friendly_token)
                wrong_password_provided = True
                error = None
                token = None

            if error:
                if error["status_code"] == 429:
                    rate_limited = True
                else:
                    wrong_password_provided = True
            elif token:
                request.session[f"media_token_{media.friendly_token}"] = token
                media_access_token = token
                can_see_restricted_media = True

    context["can_see_restricted_media"] = can_see_restricted_media
    context["wrong_password_provided"] = wrong_password_provided
    context["rate_limited"] = rate_limited
    context["media_access_token"] = media_access_token
    context["is_media_allowed_type"] = is_media_allowed_type(media)

    response = render(request, template, context)
    if media.state == "restricted":
        response["Referrer-Policy"] = "same-origin"
        response["Cache-Control"] = "no-store"
    return response


#########################
# Old URLs related


def view_old_media(request, user, video):
    template = resolve_template(request, "media")
    url = f"/Members/{user}/videos/{video}"
    media = Media.objects.filter(existing_urls__url__in=[url]).first()
    if media:
        friendly_token = media.friendly_token
    else:
        return HttpResponseRedirect("/")
    user_or_session = get_user_or_session(request)
    save_user_action.delay(user_or_session, friendly_token=friendly_token, action="watch")
    context = {}
    context["media"] = friendly_token
    context["media_object"] = media

    context["CAN_DELETE_MEDIA"] = False
    context["CAN_EDIT_MEDIA"] = False
    context["CAN_DELETE_COMMENTS"] = False

    if request.user.is_authenticated:
        if (media.user.id == request.user.id) or is_mediacms_editor(request.user) or is_mediacms_manager(request.user):
            context["CAN_DELETE_MEDIA"] = True
            context["CAN_EDIT_MEDIA"] = True
            context["CAN_DELETE_COMMENTS"] = True
    return render(request, template, context)


@xframe_options_exempt
def embed_old_media(request, user, video):
    url = f"/Members/{user}/videos/{video}"
    media = Media.objects.values("friendly_token").filter(existing_urls__url__in=[url]).first()
    if media:
        friendly_token = media["friendly_token"]
    else:
        return HttpResponseRedirect("/")
    get_user_or_session(request)
    # save_user_action.delay(
    #     user_or_session, friendly_token=friendly_token, action='watch')
    context = {}
    context["media"] = friendly_token
    return render(request, "cms/embed.html", context)


#########################


@login_required
def edit_media(request):
    friendly_token = request.GET.get("m", "").strip()
    if not friendly_token:
        return HttpResponseRedirect("/")
    media = Media.objects.filter(friendly_token=friendly_token).first()
    if not media:
        return HttpResponseRedirect("/")

    if not (request.user == media.user or is_mediacms_editor(request.user) or is_mediacms_manager(request.user)):
        return HttpResponseRedirect("/")
    # redirect to media page if invalid type
    if not is_media_allowed_type(media):
        return HttpResponseRedirect(media.get_absolute_url())

    if request.method == "POST":
        action = request.POST.get("action", "submit").strip().lower()
        if action == "draft":
            metadata = form_data_to_draft_metadata(request.POST)
            license_error = draft_license_error(metadata)
            if license_error:
                return JsonResponse(
                    {"success": False, "errors": {"custom_license": [license_error]}},
                    status=400,
                )
            apply_media_draft(media, metadata, request.user)
            messages.add_message(request, messages.INFO, "Media draft was saved!")
            draft_url = reverse("get_user_media", kwargs={"username": request.user.username})
            if request.headers.get("x-requested-with") == "XMLHttpRequest":
                return JsonResponse({"success": True, "url": draft_url})
            return HttpResponseRedirect(draft_url)

        form = MediaForm(request.user, request.POST, request.FILES, instance=media)
        if form.is_valid():
            # Set current user for FeaturedVideo signal tracking
            media._current_user = request.user
            media = form.save()
            apply_tags(media, form.cleaned_data.get("new_tags"), request.user)

            # Check if a new media file was uploaded via Fine Uploader
            session_key = f"media_file_updated_{media.friendly_token}"
            media_update_info = request.session.get(session_key, {})

            if media_update_info.get("updated"):
                from django.core.files import File

                # Get the temporary file path from session
                temp_file_path = media_update_info.get("temp_file_path")
                upload_file_path = media_update_info.get("upload_file_path")

                if not temp_file_path or not os.path.exists(temp_file_path):
                    logger.error(
                        f"Temporary uploaded file not found at {temp_file_path} for media {media.friendly_token}"
                    )
                    messages.add_message(
                        request,
                        messages.ERROR,
                        "Uploaded file not found. Please try uploading again.",
                    )
                    # Clean up pending upload directory before returning
                    try:
                        cleanup_temp_upload_files(temp_file_path, upload_file_path, media.friendly_token, logger)
                    except Exception as cleanup_error:
                        # Log cleanup errors but don't raise - we're already in error handling
                        logger.warning(
                            f"Failed to clean up pending upload for media {media.friendly_token}: {cleanup_error}"
                        )
                    # Clear the session flag
                    request.session.pop(session_key, None)
                    return HttpResponseRedirect(media.get_absolute_url())

                # Assign the new media file from temporary path
                # Note: We need to keep the file open during the save operation
                temp_file_handle = None
                try:
                    try:
                        temp_file_handle = open(temp_file_path, "rb")  # noqa: SIM115
                        myfile = File(temp_file_handle, name=os.path.basename(temp_file_path))
                        media.media_file = myfile
                        # File will be saved in the transaction below
                    except Exception as e:
                        logger.error(
                            f"Failed to assign new media file from {temp_file_path} for media {media.friendly_token}: {e}",
                            exc_info=True,
                        )
                        messages.add_message(request, messages.ERROR, "Failed to assign new media file")
                        return HttpResponseRedirect(media.get_absolute_url())

                    # Clean up old files and encodings
                    # Use original_file_path which is the media file when the upload session started
                    original_file_path = media_update_info.get("original_file_path")
                    if original_file_path and os.path.exists(original_file_path):
                        try:
                            # Resolve MEDIA_ROOT and original_file_path for directory traversal protection
                            media_root = Path(settings.MEDIA_ROOT).resolve()
                            original_file_resolved = Path(original_file_path).resolve()

                            # Verify original_file_path is within MEDIA_ROOT
                            try:
                                is_safe = original_file_resolved.is_relative_to(media_root)
                            except AttributeError:
                                # Fallback for Python < 3.9
                                try:
                                    is_safe = os.path.commonpath([media_root, original_file_resolved]) == str(
                                        media_root
                                    )
                                except ValueError:
                                    is_safe = False

                            if is_safe:
                                rm_file(original_file_path)
                            else:
                                logger.error(
                                    f"Attempted directory traversal: original_file_path {original_file_resolved} is outside MEDIA_ROOT "
                                    f"for media {media.friendly_token}"
                                )
                        except Exception as e:
                            logger.error(
                                f"Failed to remove original media file {original_file_path} for media {media.friendly_token}: {e}",
                                exc_info=True,
                            )

                    # Delete old encodings and HLS files
                    from files.models import Encoding

                    old_encodings = Encoding.objects.filter(media=media)
                    for encoding in old_encodings:
                        try:
                            if encoding.media_file and os.path.exists(encoding.media_file.path):
                                rm_file(encoding.media_file.path)
                        except Exception as e:
                            logger.error(
                                f"Failed to remove encoding file {encoding.media_file.path if encoding.media_file else 'unknown'} "
                                f"for encoding {encoding.id} of media {media.friendly_token}: {e}",
                                exc_info=True,
                            )
                    old_encodings.delete()

                    # Delete old HLS files if they exist (with directory traversal protection)
                    if media.hls_file:
                        # Guard against missing HLS_DIR setting
                        hls_dir_setting = getattr(settings, "HLS_DIR", None)
                        if hls_dir_setting:
                            try:
                                # Build the full path relative to MEDIA_ROOT
                                media_root = Path(settings.MEDIA_ROOT).resolve()
                                hls_base_dir = Path(hls_dir_setting).resolve()
                                hls_dir = (media_root / media.hls_file).parent.resolve()

                                # Security checks:
                                # 1. Ensure HLS_DIR is within MEDIA_ROOT
                                # 2. Ensure hls_dir is a direct child of HLS_DIR (not deeply nested)
                                # 3. Prevent directory traversal outside HLS_DIR
                                try:
                                    # Check if hls_dir is relative to hls_base_dir (Python 3.9+)
                                    is_within_hls_dir = hls_dir.is_relative_to(hls_base_dir)
                                except AttributeError:
                                    # Fallback for Python < 3.9
                                    try:
                                        is_within_hls_dir = hls_base_dir in hls_dir.parents or hls_base_dir == hls_dir
                                    except ValueError:
                                        is_within_hls_dir = False

                                # Additional check: ensure it's a direct subdirectory of HLS_DIR
                                # (i.e., HLS_DIR/{uid}/, not HLS_DIR/../../etc/)
                                is_direct_child = hls_dir.parent == hls_base_dir

                                if is_within_hls_dir and is_direct_child:
                                    if hls_dir.exists():
                                        shutil.rmtree(hls_dir)
                                else:
                                    logger.warning(
                                        f"Attempted directory traversal or invalid HLS path: {hls_dir} "
                                        f"(expected direct child of {hls_base_dir}) "
                                        f"for media {media.friendly_token}"
                                    )
                            except Exception as e:
                                logger.error(
                                    f"Failed to remove HLS directory for media {media.friendly_token} "
                                    f"(hls_file={media.hls_file}): {e}",
                                    exc_info=True,
                                )
                        else:
                            logger.warning(
                                f"HLS_DIR setting not configured, skipping HLS cleanup for media {media.friendly_token}"
                            )

                    # Delete preview_file_path if it exists (with directory traversal protection)
                    if media.preview_file_path:
                        try:
                            # Resolve MEDIA_ROOT and preview file path
                            media_root = Path(settings.MEDIA_ROOT).resolve()

                            # Handle both absolute and relative preview paths
                            preview_path_input = Path(media.preview_file_path)
                            if preview_path_input.is_absolute():
                                preview_path = preview_path_input.resolve()
                            else:
                                preview_path = (media_root / preview_path_input).resolve()

                            # Ensure the resolved preview path is within MEDIA_ROOT
                            # Use try-except for is_relative_to compatibility (Python 3.9+)
                            try:
                                is_safe = preview_path.is_relative_to(media_root)
                            except AttributeError:
                                # Fallback for Python < 3.9: use commonpath check
                                try:
                                    is_safe = os.path.commonpath([media_root, preview_path]) == str(media_root)
                                except ValueError:
                                    # Different drives on Windows
                                    is_safe = False

                            if is_safe:
                                if preview_path.exists():
                                    preview_path.unlink()
                            else:
                                logger.warning(
                                    f"Attempted directory traversal: Preview file {preview_path} is outside MEDIA_ROOT "
                                    f"for media {media.friendly_token}"
                                )
                        except Exception as e:
                            logger.error(
                                f"Failed to remove preview file {media.preview_file_path} for media {media.friendly_token}: {e}",
                                exc_info=True,
                            )

                    # Wrap DB updates in transaction.atomic() for consistency
                    try:
                        with transaction.atomic():
                            # Reset encoding-related fields and save the new media_file
                            media.encoding_status = "pending"
                            media.hls_file = ""
                            media.preview_file_path = ""
                            # Bump edit_date to invalidate caches/CDNs
                            media.edit_date = timezone.now()
                            media.save(
                                update_fields=[
                                    "media_file",  # Save the new media file
                                    "encoding_status",
                                    "hls_file",
                                    "preview_file_path",
                                    "edit_date",
                                ]
                            )

                            # Now trigger re-encoding
                            from files import tasks

                            tasks.media_init.apply_async(args=[media.friendly_token], countdown=5)
                    except Exception as e:
                        logger.error(
                            f"Failed to update media {media.friendly_token} during re-encode preparation: {e}",
                            exc_info=True,
                        )
                        messages.add_message(
                            request,
                            messages.ERROR,
                            "Failed to prepare media for re-encoding",
                        )
                        return HttpResponseRedirect(media.get_absolute_url())
                finally:
                    # Always close the temporary file handle on all paths (including early returns)
                    if temp_file_handle:
                        try:
                            temp_file_handle.close()
                        except Exception as close_error:
                            logger.warning(
                                f"Failed to close temporary file handle for media {media.friendly_token}: {close_error}"
                            )

                    # Always clean up temporary upload files (on success AND error paths)
                    cleanup_temp_upload_files(temp_file_path, upload_file_path, media.friendly_token, logger)

                    # Always clear the session flag to prevent stale session state
                    request.session.pop(session_key, None)

                messages.add_message(request, messages.INFO, "Media was edited and will be re-encoded!")
            else:
                messages.add_message(request, messages.INFO, "Media was edited!")

            if request.headers.get("x-requested-with") == "XMLHttpRequest":
                return JsonResponse({"success": True, "url": media.get_absolute_url()})

            return HttpResponseRedirect(media.get_absolute_url())
        elif request.headers.get("x-requested-with") == "XMLHttpRequest":
            # Surface validation errors to the async add-media form instead of
            # re-rendering the legacy edit page.
            return JsonResponse({"success": False, "errors": form.errors}, status=400)
    else:
        form = MediaForm(request.user, instance=media)
    licenses = License.objects.filter()
    licenses_dict = {}
    for license in licenses:
        licenses_dict[license.id] = {
            "id": license.id,
            "title": license.title,
            "allow_commercial": license.allow_commercial,
            "allow_modifications": license.allow_modifications,
        }
    # Get allowed video extensions from helper function
    video_extensions = get_allowed_video_extensions()

    return render(
        request,
        "cms/edit_media.html",
        {
            "form": form,
            "licenses": json.dumps(licenses_dict),
            "add_subtitle_url": media.add_subtitle_url,
            "allowed_extensions": json.dumps(video_extensions),
        },
    )


@login_required
def add_subtitle(request):
    friendly_token = request.GET.get("m", "").strip()
    if not friendly_token:
        return HttpResponseRedirect("/")
    media = Media.objects.filter(friendly_token=friendly_token).first()
    if not media:
        return HttpResponseRedirect("/")

    if not (request.user == media.user or is_mediacms_editor(request.user) or is_mediacms_manager(request.user)):
        return HttpResponseRedirect("/")

    if request.method == "POST":
        form = SubtitleForm(media, request.POST, request.FILES)
        if form.is_valid():
            subtitle = form.save()
            new_subtitle = Subtitle.objects.filter(id=subtitle.id).first()
            try:
                new_subtitle.convert_to_vtt()

                # UPDATE MEDIA VERSION WHEN SUBTITLE ADDED
                media.edit_date = timezone.now()
                media.save(update_fields=["edit_date"])

                messages.add_message(request, messages.INFO, "Subtitle was added!")
                return HttpResponseRedirect(subtitle.media.get_absolute_url())
            except Exception:
                new_subtitle.delete()
                error_msg = "Invalid subtitle format. Use SubRip (.srt) and WebVTT (.vtt) files."
                form.add_error("subtitle_file", error_msg)
    else:
        form = SubtitleForm(media_item=media)
    subtitles = media.subtitles.all()
    context = {"media": media, "form": form, "subtitles": subtitles}
    return render(request, "cms/add_subtitle.html", context)


@login_required
def edit_subtitle(request):
    subtitle_id = request.GET.get("id", "").strip()
    action = request.GET.get("action", "").strip()
    if not subtitle_id:
        return HttpResponseRedirect("/")
    subtitle = Subtitle.objects.filter(id=subtitle_id).first()

    if not subtitle:
        return HttpResponseRedirect("/")

    if not (request.user == subtitle.user or is_mediacms_editor(request.user) or is_mediacms_manager(request.user)):
        return HttpResponseRedirect("/")

    context = {"subtitle": subtitle, "action": action}

    if action == "download":
        response = HttpResponse(subtitle.subtitle_file.read(), content_type="text/vtt")
        filename = subtitle.subtitle_file.name.split("/")[-1]

        if not filename.endswith(".vtt"):
            filename = f"{filename}.vtt"

        print(filename)
        response["Content-Disposition"] = f"attachment; filename={filename}"

        return response

    if request.method == "GET":
        form = EditSubtitleForm(subtitle)
        context["form"] = form
    elif request.method == "POST":
        confirm = request.GET.get("confirm", "").strip()
        if confirm == "true":
            messages.add_message(request, messages.INFO, "Subtitle was deleted")
            redirect_url = subtitle.media.get_absolute_url()

            # Update the edit_date as the associated URL for this media file is affected by the edit_date of subtitles
            subtitle.media.edit_date = timezone.now()
            subtitle.media.save(update_fields=["edit_date"])
            subtitle.delete()

            return HttpResponseRedirect(redirect_url)
        form = EditSubtitleForm(subtitle, request.POST)

        if form.is_valid():
            subtitle_text = form.cleaned_data["subtitle"]
            try:
                with open(subtitle.subtitle_file.path, "w", encoding="utf-8") as ff:
                    ff.write(subtitle_text)

                # CRITICAL FIX: Update media edit_date to bust cache
                subtitle.media.edit_date = timezone.now()
                subtitle.media.save(update_fields=["edit_date"])
                schedule_refresh_media_storage_usage(subtitle.media_id)

                messages.add_message(request, messages.INFO, "Subtitle was edited")
                return HttpResponseRedirect(subtitle.media.get_absolute_url())
            except Exception as e:
                logger.error(f"Failed to save subtitle edit for {subtitle.subtitle_file.path}: {str(e)}")
                form.add_error(None, f"Could not save subtitle: {str(e)}")
        else:
            if not form.data.get("subtitle"):
                form.add_error(None, "No subtitle content provided.")
    return render(request, "cms/edit_subtitle.html", context)


@xframe_options_exempt
def embed_media(request):
    friendly_token = request.GET.get("m", "").strip()
    if not friendly_token:
        return HttpResponseRedirect("/")
    media = Media.objects.filter(friendly_token=friendly_token).first()
    if not media:
        return HttpResponseRedirect("/")
    get_user_or_session(request)

    context = {}
    context["media"] = friendly_token
    context["media_access_token"] = None

    # Validate token for restricted media
    if media.state == "restricted":
        from files.token_utils import validate_token

        token = request.GET.get("token")
        media_uid = media.uid_hex
        if token and validate_token(token, media_uid):
            context["media_access_token"] = token
        else:
            response = HttpResponse("Unauthorized", status=401)
            response["Cache-Control"] = "no-store"
            return response

    response = render(request, "cms/embed.html", context)
    if media.state == "restricted":
        response["Referrer-Policy"] = "same-origin"
        response["Cache-Control"] = "no-store"
    return response


def view_playlist(request, friendly_token):
    try:
        playlist = Playlist.objects.get(friendly_token=friendly_token)
    except:
        playlist = None

    context = {}
    context["playlist"] = playlist
    return render(request, "cms/playlist.html", context)


class MediaList(APIView):
    # media listing views
    # this includes anonymous sessions GET
    permission_classes = (IsAuthorizedToAdd,)
    parser_classes = (JSONParser, MultiPartParser, FormParser, FileUploadParser)

    def get(self, request, format=None):
        # Show media
        params = self.request.query_params
        show_param = params.get("show", "")
        offset_param = params.get("offset", "")

        # Try cache for standard queries (no author, no offset, no recommended)
        author_param = params.get("author", "").strip()
        page_param = params.get("page", "1")
        cache_key = None
        page_num = None

        if not author_param and not offset_param and show_param != "recommended":
            try:
                page_num = int(page_param or "1")
                user_id = request.user.id if request.user.is_authenticated else None
                cache_key = get_media_list_cache_key(
                    show=show_param or "latest",
                    page=page_num,
                    user_id=user_id,
                    origin=get_request_cache_origin(request),
                )
                cached_result = get_cached_result(cache_key)
                if cached_result is not None:
                    if show_param == "featured" and page_num == 1:
                        cached_result = {
                            **cached_result,
                            "results": _attach_hero_playback_to_first_featured_item(
                                cached_result.get("results") or [], request=request
                            ),
                        }
                    return Response(cached_result)
            except (ValueError, TypeError):
                pass  # Invalid page number, skip cache

        if author_param:
            user_queryset = User.objects.all()
            user = get_object_or_404(user_queryset, username=author_param)
        if show_param == "recommended":
            pagination_class = FastPaginationWithoutCount
            media = show_recommended_media(request, limit=50)
        else:
            pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
            if author_param:
                from .helpers import can_view_all_user_media

                if can_view_all_user_media(self.request.user, user):
                    # Owners, managers, curators, and superusers see ALL videos (including private, unlisted, restricted)
                    basic_query = Q(user=user)
                else:
                    # Everyone else sees only public, reviewed videos
                    basic_query = Q(state="public", is_reviewed=True, user=user)
            else:
                basic_query = Q(state="public", encoding_status="success", is_reviewed=True)

            if show_param == "latest":
                media = Media.objects.filter(basic_query).order_by("-add_date")
            elif show_param == "featured":
                media = _build_featured_queryset()
            else:
                media = Media.objects.filter(basic_query).order_by("-add_date")
        paginator = pagination_class()
        if offset_param:
            media = media[int(offset_param) :]
        if show_param != "recommended":
            media = media.select_related("user").prefetch_related(
                "category",
                "topics",
            )
        page = paginator.paginate_queryset(media, request)

        serializer = MediaSerializer(page, many=True, context={"request": request})
        response_data = paginator.get_paginated_response(serializer.data)

        # Cache the response for standard queries
        if cache_key and not author_param and not offset_param and show_param != "recommended":
            set_cached_result(cache_key, deepcopy(response_data.data), MEDIA_LIST_TIMEOUT)

        if show_param == "featured" and page_num == 1:
            response_data.data["results"] = _attach_hero_playback_to_first_featured_item(
                response_data.data.get("results") or [], request=request
            )

        return response_data

    def post(self, request, format=None):
        # Add new media
        serializer = MediaSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            media_file = request.data["media_file"]
            serializer.save(user=request.user, media_file=media_file)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class MediaDetail(APIView):
    """
    Retrieve, update or delete a snippet instance.
    """

    permission_classes = (permissions.IsAuthenticatedOrReadOnly, IsUserOrEditor)
    parser_classes = (JSONParser, MultiPartParser, FormParser, FileUploadParser)

    def get_object(self, friendly_token, token=None):
        friendly_token = clean_friendly_token(friendly_token)
        try:
            media = (
                Media.objects.select_related("user", "license")
                .prefetch_related(
                    "category",
                    "topics",
                    "tags",
                    "content_sensitivity",
                    "subtitles__language",
                    "encodings__profile",
                    "community_impacts__user",
                )
                .get(friendly_token=friendly_token)
            )
            # this need be explicitly called, and will call
            # has_object_permission() after has_permission has succeeded
            self.check_object_permissions(self.request, media)
            # Handle PRIVATE media first (only owner/editor can access)
            if media.state == "private" and not (
                self.request.user == media.user
                or is_mediacms_editor(self.request.user)
                or is_curator(self.request.user)
            ):
                return Response(
                    {"detail": "media is private"},
                    status=status.HTTP_401_UNAUTHORIZED,
                )

            # Handle RESTRICTED media — owner/editor/manager bypass FIRST
            elif media.state == "restricted" and not (
                self.request.user == media.user
                or is_mediacms_editor(self.request.user)
                or is_mediacms_manager(self.request.user)
            ):
                from files.token_utils import validate_token

                media_uid = media.uid_hex
                if not token or not validate_token(token, media_uid):
                    return Response(
                        {"detail": "media is restricted"},
                        status=status.HTTP_401_UNAUTHORIZED,
                    )
            return media
        except PermissionDenied:
            return Response({"detail": "bad permissions"}, status=status.HTTP_401_UNAUTHORIZED)
        except Media.DoesNotExist:
            return Response(
                {"detail": "media file does not exist"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            import logging

            logger = logging.getLogger(__name__)
            logger.error(f"Error retrieving media {friendly_token}: {str(e)}", exc_info=True)
            return Response(
                {"detail": "error retrieving media"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def get(self, request, friendly_token, format=None):
        # Get media details
        token = request.GET.get("token")

        # Try cache for public media only (not private/restricted)
        user_id = request.user.id if request.user.is_authenticated else None
        cache_key = get_media_detail_cache_key(friendly_token, user_id, origin=get_request_cache_origin(request))

        # Skip cache for token-protected requests
        if not token:
            cached_result = get_cached_result(cache_key)
            if cached_result is not None:
                return Response(cached_result)

        media = self.get_object(friendly_token, token=token)
        if isinstance(media, Response):
            return media

        serializer = SingleMediaSerializer(media, context={"request": request})
        if media.state in ["restricted", "private"]:
            related_media = []
        else:
            related_media = show_related_media(media, request=request, limit=100)
            related_media_serializer = MediaSerializer(related_media, many=True, context={"request": request})
            related_media = related_media_serializer.data
        ret = serializer.data
        ret["related_media"] = related_media

        # Cache public/unlisted media only
        if media.state in ["public", "unlisted"] and not token:
            set_cached_result(cache_key, ret, MEDIA_DETAIL_TIMEOUT)

        return Response(ret)

    def post(self, request, friendly_token, format=None):
        # superuser actions

        media = self.get_object(friendly_token)
        if isinstance(media, Response):  # eg permissionerror, check get_object()
            return media

        if not (is_mediacms_editor(request.user) or is_mediacms_manager(request.user)):
            return Response({"detail": "not allowed"}, status=status.HTTP_400_BAD_REQUEST)

        action = request.data.get("type")
        profiles_list = request.data.get("encoding_profiles")
        result = request.data.get("result", True)

        if action == "encode":
            valid_profiles = []
            if profiles_list:
                if isinstance(profiles_list, list):
                    for p in profiles_list:
                        p = EncodeProfile.objects.filter(id=p).first()
                        if p:
                            valid_profiles.append(p)
                elif isinstance(profiles_list, str):
                    try:
                        p = EncodeProfile.objects.filter(id=int(profiles_list)).first()
                        valid_profiles.append(p)
                    except ValueError:
                        return Response(
                            {"detail": "encoding_profiles must be int or list of ints of valid encode profiles"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
            media.encode(profiles=valid_profiles)
            return Response({"detail": "media will be encoded"}, status=status.HTTP_201_CREATED)
        elif action == "review":
            if result:
                media.is_reviewed = True
            elif not result:
                media.is_reviewed = False
            media.save(update_fields=["is_reviewed"])
            return Response({"detail": "media reviewed set"}, status=status.HTTP_201_CREATED)
        return Response(
            {"detail": "not valid action or no action specified"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def put(self, request, friendly_token, format=None):
        # Update a media object
        media = self.get_object(friendly_token)
        if isinstance(media, Response):
            return media

        serializer = MediaSerializer(media, data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, friendly_token, format=None):
        # Delete a media object
        media = self.get_object(friendly_token)
        if isinstance(media, Response):
            return media
        media.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class MediaActions(APIView):
    """
    Retrieve, update or delete a snippet instance.
    """

    permission_classes = (permissions.AllowAny,)
    parser_classes = (JSONParser,)

    def get_object(self, friendly_token):
        try:
            media = (
                Media.objects.select_related("user")
                .prefetch_related("encodings__profile")
                .get(friendly_token=friendly_token)
            )
            if media.state == "private" and self.request.user != media.user:
                return Response({"detail": "media is private"}, status=status.HTTP_400_BAD_REQUEST)
            return media
        except PermissionDenied:
            return Response({"detail": "bad permissions"}, status=status.HTTP_400_BAD_REQUEST)
        except Media.DoesNotExist:
            return Response(
                {"detail": "media file does not exist"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            # Log the actual error for debugging
            import logging

            logger = logging.getLogger(__name__)
            logger.error(f"Error retrieving media {friendly_token}: {str(e)}", exc_info=True)
            return Response(
                {"detail": "error retrieving media"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def get(self, request, friendly_token, format=None):
        # GET: only show reported messages
        media = self.get_object(friendly_token)

        if isinstance(media, Response):
            return media

        if not (request.user == media.user or is_mediacms_editor(request.user) or is_mediacms_manager(request.user)):
            return Response({"detail": "not allowed"}, status=status.HTTP_400_BAD_REQUEST)

        ret = {}
        reported = MediaAction.objects.filter(media=media, action="report")
        ret["reported"] = []
        for rep in reported:
            item = {"reported_date": rep.action_date, "reason": rep.extra_info}
            ret["reported"].append(item)

        return Response(ret, status=status.HTTP_200_OK)

    def post(self, request, friendly_token, format=None):
        # POST actions, as like/dislike/report
        media = self.get_object(friendly_token)
        if isinstance(media, Response):
            return media

        action = request.data.get("type")
        extra = request.data.get("extra_info")
        if request.user.is_anonymous:
            if action not in settings.ALLOW_ANONYMOUS_ACTIONS:
                return Response(
                    {"detail": "action allowed on logged in users only"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        if action:
            if action in ("like", "dislike"):
                # Handle like/dislike synchronously so the response reflects
                # the actual outcome and the cache is invalidated immediately.
                return self._handle_like_dislike(request, media, action)

            user_or_session = get_user_or_session(request)
            save_user_action.delay(
                user_or_session,
                friendly_token=media.friendly_token,
                action=action,
                extra_info=extra,
            )

            return Response({"detail": "action received"}, status=status.HTTP_201_CREATED)
        else:
            return Response({"detail": "no action specified"}, status=status.HTTP_400_BAD_REQUEST)

    def _handle_like_dislike(self, request, media, action):
        """Process like/dislike inline and return the updated count."""
        from actions.models import MediaAction

        user = request.user if request.user.is_authenticated else None
        session_key = None
        if not user:
            if not request.session.session_key:
                request.session.save()
            session_key = request.session.session_key

        if not user and not session_key:
            return Response({"detail": "action not allowed"}, status=status.HTTP_400_BAD_REQUEST)

        remote_ip = request.META.get("REMOTE_ADDR")
        if not pre_save_action(media=media, user=user, session_key=session_key, action=action, remote_ip=remote_ip):
            # Already performed this action — return current count without error
            media.refresh_from_db()
            return Response(
                {"detail": "action already performed", "likes": media.likes, "dislikes": media.dislikes},
                status=status.HTTP_200_OK,
            )

        MediaAction.objects.create(
            user=user,
            session_key=session_key,
            media=media,
            action=action,
            remote_ip=remote_ip,
        )

        if action == "like":
            Media.objects.filter(pk=media.pk).update(likes=F("likes") + 1)

            # In-app notification — only for authenticated users
            if user:
                try:
                    from notifications.services import NotificationService

                    NotificationService.on_like(actor=user, media=media)
                except Exception:
                    logger.exception("Notification failed for like on %s", media.friendly_token)
        else:
            Media.objects.filter(pk=media.pk).update(dislikes=F("dislikes") + 1)

        invalidate_media_cache(media.friendly_token)

        media.refresh_from_db()
        return Response(
            {"detail": "action received", "likes": media.likes, "dislikes": media.dislikes},
            status=status.HTTP_201_CREATED,
        )

    def _handle_like_dislike_removal(self, request, media, action):
        """Remove a user's like/dislike and return the updated count."""
        from actions.models import MediaAction

        user = request.user if request.user.is_authenticated else None
        session_key = None
        if not user:
            if not request.session.session_key:
                request.session.save()
            session_key = request.session.session_key

        if not user and not session_key:
            return Response({"detail": "action not allowed"}, status=status.HTTP_400_BAD_REQUEST)

        action_query = MediaAction.objects.filter(media=media, action=action)
        action_query = action_query.filter(user=user) if user else action_query.filter(session_key=session_key)

        deleted_count, _ = action_query.delete()
        if deleted_count:
            if action == "like":
                Media.objects.filter(pk=media.pk).update(likes=Case(When(likes__gt=0, then=F("likes") - 1), default=0))
            else:
                Media.objects.filter(pk=media.pk).update(
                    dislikes=Case(When(dislikes__gt=0, then=F("dislikes") - 1), default=0)
                )
            invalidate_media_cache(media.friendly_token)

        media.refresh_from_db()
        return Response(
            {"detail": "action removed", "likes": media.likes, "dislikes": media.dislikes},
            status=status.HTTP_200_OK,
        )

    def delete(self, request, friendly_token, format=None):
        media = self.get_object(friendly_token)
        if isinstance(media, Response):
            return media

        action = request.data.get("type")
        if action in ("like", "dislike"):
            return self._handle_like_dislike_removal(request, media, action)

        if not request.user.is_superuser:
            return Response({"detail": "not allowed"}, status=status.HTTP_400_BAD_REQUEST)

        if action:
            if action == "report":  # delete reported actions
                MediaAction.objects.filter(media=media, action="report").delete()
                media.reported_times = 0
                media.save(update_fields=["reported_times"])
                return Response(
                    {"detail": "reset reported times counter"},
                    status=status.HTTP_201_CREATED,
                )
        else:
            return Response({"detail": "no action specified"}, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, friendly_token, format=None):
        # Admin actions
        media = self.get_object(friendly_token)
        if isinstance(media, Response):
            return media

        if not request.user.is_superuser:
            return Response({"detail": "not allowed"}, status=status.HTTP_400_BAD_REQUEST)

        action = request.data.get("type")
        if action == "feature":
            media._current_user = request.user
            media.featured = True
            media.save(update_fields=["featured"])
            return Response({"detail": "media featured"}, status=status.HTTP_201_CREATED)
        elif action == "unfeature":
            media.featured = False
            media.save(update_fields=["featured"])
            return Response({"detail": "media unfeatured"}, status=status.HTTP_201_CREATED)
        return Response(
            {"detail": "not valid action or no action specified"},
            status=status.HTTP_400_BAD_REQUEST,
        )


class MediaPasswordView(APIView):
    """Validate password for restricted media and issue an access token."""

    permission_classes = (permissions.AllowAny,)
    parser_classes = (JSONParser,)

    def post(self, request, friendly_token):
        from files.token_utils import (
            authenticate_restricted_media,
            generate_token,
        )

        friendly_token = clean_friendly_token(friendly_token)
        try:
            media = Media.objects.get(friendly_token=friendly_token)
        except Media.DoesNotExist:
            return Response({"detail": "media not found"}, status=status.HTTP_404_NOT_FOUND)

        if media.state != "restricted":
            return Response({"detail": "media is not restricted"}, status=status.HTTP_400_BAD_REQUEST)

        # Owner/editor/manager bypass — no password needed
        if request.user.is_authenticated:
            if request.user == media.user or is_mediacms_editor(request.user) or is_mediacms_manager(request.user):
                try:
                    token = generate_token(media.uid_hex)
                    request.session[f"media_token_{media.friendly_token}"] = token
                    return Response({"token": token}, status=status.HTTP_200_OK)
                except Exception:
                    logger.exception("Failed to generate token for media %s", media.friendly_token)
                    return Response(
                        {"detail": "Server error generating token."},
                        status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    )

        # Authenticated non-owners share IP-keyed rate limit bucket with anonymous users
        ip = get_client_ip(request)
        password = request.data.get("password", "")

        try:
            token, error = authenticate_restricted_media(media, password, ip)
        except Exception:
            logger.exception("Failed to generate token for media %s", media.friendly_token)
            return Response(
                {"detail": "Server error generating token."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        if error:
            return Response({"detail": error["detail"]}, status=error["status_code"])

        request.session[f"media_token_{media.friendly_token}"] = token
        return Response({"token": token}, status=status.HTTP_200_OK)


class MediaSearch(APIView):
    parser_classes = (JSONParser,)

    def _getlist(self, params, *keys):
        values = []
        for key in keys:
            values.extend(value.strip() for value in params.getlist(key) if value.strip())
        return values

    def _resolve_language_codes(self, values):
        if not values:
            return []

        languages = Language.objects.exclude(code__in=["automatic", "automatic-translation"]).values_list(
            "code", "title"
        )
        valid_codes = set()
        code_by_title = {}
        for code, title in languages:
            valid_codes.add(code)
            code_by_title[title] = code

        return [
            value if value in valid_codes else code_by_title[value]
            for value in values
            if value in valid_codes or value in code_by_title
        ]

    def _resolve_country_codes(self, values):
        country_by_title = {title: code for code, title in lists.video_countries}
        return [country_by_title[value] for value in values if value in country_by_title]

    def get(self, request, format=None):
        params = self.request.query_params
        params.get("show", "")
        query = params.get("q", "").strip().lower()
        category = self._getlist(params, "category", "c")
        tag = self._getlist(params, "tag", "t")
        language = self._getlist(params, "language")
        country = self._getlist(params, "country")
        topic = self._getlist(params, "topic")

        ordering = params.get("ordering", "").strip()
        sort_by = params.get("sort_by", "").strip()
        media_type = params.get("media_type", "").strip()
        params.get("add_date", "").strip()
        params.get("edit_date", "").strip()

        author = params.get("author", "").strip()

        license_values = self._getlist(params, "license")
        upload_date = params.get("upload_date", "").strip()

        subtitle_language = self._getlist(params, "subtitle_language")
        length = params.get("length", "").strip()
        award = params.get("award", "").strip()
        community_impact = self._getlist(params, "community_impact")

        sort_by_options = ["title", "add_date", "edit_date", "views", "likes", "comment_count", "featured_date"]
        if sort_by not in sort_by_options:
            sort_by = "add_date"
        ordering = "" if ordering == "asc" else "-"

        if media_type not in ["video", "image", "audio", "pdf"]:
            media_type = None

        if not (
            query
            or category
            or tag
            or language
            or country
            or topic
            or subtitle_language
            or length
            or award
            or community_impact
            or media_type
            or license_values
            or upload_date
        ):
            ret = {}
            return Response(ret, status=status.HTTP_200_OK)

        media = Media.objects.filter(state="public", is_reviewed=True)

        if query:
            query = clean_query(query)
            q_parts = [q_part.rstrip("y") for q_part in query.split() if q_part not in STOP_WORDS]
            if q_parts:
                query = SearchQuery(q_parts[0] + ":*", search_type="raw")
                for part in q_parts[1:]:
                    query &= SearchQuery(part + ":*", search_type="raw")
            else:
                query = None
        if query:
            media = media.filter(search=query)

        if tag:
            media = media.filter(tags__title__in=tag).distinct()

        if category:
            media = media.filter(category__title__in=category).distinct()

        if topic:
            media = media.filter(topics__title__in=topic).distinct()

        if language:
            language_codes = self._resolve_language_codes(language)
            if language_codes:
                media = media.filter(media_language__in=language_codes)

        if country:
            country_codes = self._resolve_country_codes(country)
            if country_codes:
                media = media.filter(media_country__in=country_codes)

        if subtitle_language:
            media = media.filter(subtitles__language__code__in=subtitle_language).distinct()

        if length:
            if length == "less_than_10":
                media = media.filter(duration__lt=600)
            elif length == "more_than_10":
                media = media.filter(duration__gte=600)

        if award:
            if award == "yes":
                media = media.filter(
                    community_impacts__status=CommunityImpact.APPROVED,
                    community_impacts__category__in=[
                        CommunityImpact.SCREENING,
                        CommunityImpact.FEATURED,
                    ],
                ).distinct()

        if community_impact:
            community_impact_options = {
                CommunityImpact.SCREENING,
                CommunityImpact.FEATURED,
                CommunityImpact.SAVES,
                CommunityImpact.ACADEMIC,
            }
            community_impact_values = [value for value in community_impact if value in community_impact_options]
            if community_impact_values:
                media = media.filter(
                    community_impacts__status=CommunityImpact.APPROVED,
                    community_impacts__category__in=community_impact_values,
                ).distinct()

        if media_type:
            media = media.filter(media_type=media_type)

        if author:
            media = media.filter(user__username=author)

        if license_values:
            license_query = Q()
            license_ids = []
            if "no_license" in license_values:
                license_query |= Q(license=None)
            for license_value in license_values:
                if license_value == "no_license":
                    continue
                try:
                    license_ids.append(int(license_value))
                except ValueError:
                    pass
            if license_ids:
                license_query |= Q(license_id__in=license_ids)
            if license_query:
                media = media.filter(license_query)

        if upload_date:
            gte = lte = None
            if upload_date == "today":
                gte = datetime.now().date()
            if upload_date == "this_week":
                gte = datetime.now() - timedelta(days=7)
            if upload_date == "this_month":
                year = datetime.now().date().year
                month = datetime.now().date().month
                gte = datetime(year, month, 1)
            if upload_date == "this_year":
                year = datetime.now().date().year
                gte = datetime(year, 1, 1)
            if lte:
                media = media.filter(add_date__lte=lte)
            if gte:
                media = media.filter(add_date__gte=gte)

        if sort_by == "featured_date":
            if ordering == "":
                media = media.order_by(F("featured_date").asc(nulls_last=True))
            else:
                media = media.order_by(F("featured_date").desc(nulls_last=True))
        else:
            media = media.order_by(f"{ordering}{sort_by}")

        if self.request.query_params.get("show", "").strip() == "titles":
            media = media.values("title")[:40]
            return Response(media, status=status.HTTP_200_OK)
        else:
            media = media.select_related("user").prefetch_related(
                "category",
                "topics",
            )
            # SmallPreviewPagination (else branch) is a strict superset of
            # the default PageNumberPagination: identical default page_size
            # (50) but additionally honours ?page_size= up to 10 so preview
            # callers (e.g. the global-search dropdown) can avoid pulling
            # the full default page and discarding most of it client-side.
            pagination_class = api_settings.DEFAULT_PAGINATION_CLASS if category or tag else SmallPreviewPagination
            paginator = pagination_class()
            page = paginator.paginate_queryset(media, request)
            serializer = MediaSearchSerializer(page, many=True, context={"request": request})
            return paginator.get_paginated_response(serializer.data)


class EncodeProfileList(APIView):
    def get(self, request, format=None):
        profiles = EncodeProfile.objects.all()
        serializer = EncodeProfileSerializer(profiles, many=True, context={"request": request})
        return Response(serializer.data)


class TasksList(APIView):
    # task listing view. Shows running tasks, plus
    permission_classes = (permissions.IsAdminUser,)

    def get(self, request, format=None):
        ret = list_tasks()
        return Response(ret)


class TaskDetail(APIView):
    """
    Cancel a task
    """

    permission_classes = (permissions.IsAdminUser,)

    def delete(self, request, uid, format=None):
        # revoke(uid, terminate=True)
        return Response(status=status.HTTP_204_NO_CONTENT)


class PlaylistList(APIView):
    permission_classes = (permissions.IsAuthenticatedOrReadOnly, IsAuthorizedToAdd)
    parser_classes = (JSONParser, MultiPartParser, FormParser, FileUploadParser)

    def get(self, request, format=None):
        # SmallPreviewPagination: default page_size remains 50; ?page_size=
        # up to 10 is honoured for preview callers (e.g. global-search).
        paginator = SmallPreviewPagination()
        playlists = Playlist.objects.filter().prefetch_related("user")

        if "author" in self.request.query_params:
            author = self.request.query_params["author"].strip()
            playlists = playlists.filter(user__username=author)

        search = self.request.query_params.get("search", "").strip()
        if search:
            playlists = playlists.filter(title__icontains=search)

        # add_date is the natural ordering field and is db_index'd. Without an
        # explicit order_by, paginate_queryset can hand back different rows
        # for the same query depending on planner choice; that breaks the
        # global-search preview (page_size=4) where the cursor is stable per
        # keystroke and breaks plain ?page=2 too.
        playlists = playlists.order_by("-add_date")

        page = paginator.paginate_queryset(playlists, request)

        serializer = PlaylistSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    def post(self, request, format=None):
        serializer = PlaylistSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class PlaylistDetail(APIView):
    """ """

    permission_classes = (permissions.IsAuthenticatedOrReadOnly, IsUserOrEditor)
    parser_classes = (JSONParser, MultiPartParser, FormParser, FileUploadParser)

    def get_playlist(self, friendly_token):
        try:
            playlist = Playlist.objects.get(friendly_token=friendly_token)
            self.check_object_permissions(self.request, playlist)
            return playlist
        except PermissionDenied:
            return Response({"detail": "not enough permissions"}, status=status.HTTP_400_BAD_REQUEST)
        except:
            return Response(
                {"detail": "Playlist does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )

    def get(self, request, friendly_token, format=None):
        # Try cache first
        user_id = request.user.id if request.user.is_authenticated else None
        cache_key = get_playlist_detail_cache_key(friendly_token, user_id, origin=get_request_cache_origin(request))
        cached_result = get_cached_result(cache_key)
        if cached_result is not None:
            return Response(cached_result)

        playlist = self.get_playlist(friendly_token)
        if isinstance(playlist, Response):
            return playlist

        serializer = PlaylistDetailSerializer(playlist, context={"request": request})

        # Import helper functions
        from .helpers import can_user_see_video_in_playlist, is_advanced_user

        # Determine which videos to show based on user permissions
        if is_advanced_user(request.user) and playlist.user == request.user:
            # Advanced users viewing their own playlists can see all non-private videos
            playlist_media_queryset = (
                PlaylistMedia.objects.filter(playlist=playlist)
                .exclude(media__state="private")
                .select_related("media__user", "media__license")
                .prefetch_related(
                    "media__category",
                    "media__topics",
                    "media__tags",
                )
            )
        elif request.user.is_authenticated:
            # Authenticated users can see public, unlisted, and restricted videos
            playlist_media_queryset = (
                PlaylistMedia.objects.filter(playlist=playlist)
                .exclude(media__state="private")
                .select_related("media__user", "media__license")
                .prefetch_related(
                    "media__category",
                    "media__topics",
                    "media__tags",
                )
            )
        else:
            # Anonymous users see only public videos
            playlist_media_queryset = (
                PlaylistMedia.objects.filter(playlist=playlist, media__state="public")
                .select_related("media__user", "media__license")
                .prefetch_related(
                    "media__category",
                    "media__topics",
                    "media__tags",
                )
            )

        # Filter videos based on what the current viewer can see
        accessible_media = []
        for playlist_media in playlist_media_queryset:
            if can_user_see_video_in_playlist(request.user, playlist_media.media):
                accessible_media.append(playlist_media.media)

        playlist_media_serializer = MediaSerializer(accessible_media, many=True, context={"request": request})

        ret = serializer.data
        ret["playlist_media"] = playlist_media_serializer.data
        # needed for index page featured
        ret["results"] = playlist_media_serializer.data[:8]

        # Cache the result
        set_cached_result(cache_key, ret, PLAYLIST_DETAIL_TIMEOUT)

        return Response(ret)

    def post(self, request, friendly_token, format=None):
        playlist = self.get_playlist(friendly_token)
        if isinstance(playlist, Response):
            return playlist
        serializer = PlaylistDetailSerializer(playlist, data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save(user=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def put(self, request, friendly_token, format=None):
        playlist = self.get_playlist(friendly_token)
        if isinstance(playlist, Response):
            return playlist
        action = request.data.get("type")
        media_friendly_token = request.data.get("media_friendly_token")
        ordering = 0
        if request.data.get("ordering"):
            with contextlib.suppress(ValueError):
                ordering = int(request.data.get("ordering"))

        if action in ["add", "remove", "ordering"]:
            # Import helper functions
            from .helpers import can_user_see_video_in_playlist, is_advanced_user

            # Determine media query based on user permissions
            if is_advanced_user(request.user) and playlist.user == request.user:
                # Advanced users can add public, unlisted, and restricted videos
                media = (
                    Media.objects.filter(friendly_token=media_friendly_token, media_type="video")
                    .exclude(state="private")
                    .first()
                )
            else:
                # Regular users can only add public videos (existing behavior)
                media = Media.objects.filter(
                    friendly_token=media_friendly_token,
                    media_type="video",
                    state="public",
                ).first()

            if media:
                # Additional access check - ensure user can see this video in playlist
                if not can_user_see_video_in_playlist(request.user, media):
                    return Response(
                        {"detail": "insufficient permissions to access this video"},
                        status=status.HTTP_403_FORBIDDEN,
                    )

                if action == "add":
                    media_in_playlist = PlaylistMedia.objects.filter(playlist=playlist).count()
                    if media_in_playlist >= settings.MAX_MEDIA_PER_PLAYLIST:
                        return Response(
                            {"detail": "max number of media for a Playlist reached"},
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    else:
                        obj, created = PlaylistMedia.objects.get_or_create(
                            playlist=playlist,
                            media=media,
                            ordering=media_in_playlist + 1,
                        )
                        obj.save()

                        # In-app notification
                        if created:
                            try:
                                from notifications.services import NotificationService

                                NotificationService.on_added_to_playlist(
                                    actor=request.user, media=media, playlist=playlist
                                )
                            except Exception:
                                logger.exception("Notification failed for playlist add %s", playlist.pk)

                        return Response(
                            {"detail": "media added to Playlist"},
                            status=status.HTTP_201_CREATED,
                        )
                elif action == "remove":
                    PlaylistMedia.objects.filter(playlist=playlist, media=media).delete()
                    return Response(
                        {"detail": "media removed from Playlist"},
                        status=status.HTTP_201_CREATED,
                    )
                elif action == "ordering":
                    if ordering:
                        playlist.set_ordering(media, ordering)
                        return Response(
                            {"detail": "new ordering set"},
                            status=status.HTTP_201_CREATED,
                        )
            else:
                return Response(
                    {"detail": "media is not valid or accessible"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        return Response(
            {"detail": "invalid or not specified action"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def delete(self, request, friendly_token, format=None):
        playlist = self.get_playlist(friendly_token)
        if isinstance(playlist, Response):
            return playlist

        playlist.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class EncodingDetail(APIView):
    permission_classes = (permissions.IsAdminUser,)
    parser_classes = (JSONParser, MultiPartParser, FormParser, FileUploadParser)

    def post(self, request, encoding_id):
        ret = {}
        force = request.data.get("force", False)
        task_id = request.data.get("task_id", False)
        action = request.data.get("action", "")
        chunk = request.data.get("chunk", False)
        chunk_file_path = request.data.get("chunk_file_path", "")

        encoding_status = request.data.get("status", "")
        progress = request.data.get("progress", "")
        commands = request.data.get("commands", "")
        logs = request.data.get("logs", "")
        retries = request.data.get("retries", "")
        worker = request.data.get("worker", "")
        temp_file = request.data.get("temp_file", "")
        total_run_time = request.data.get("total_run_time", "")
        if action == "start":
            try:
                encoding = Encoding.objects.get(id=encoding_id)
                media = encoding.media
                profile = encoding.profile
            except:
                Encoding.objects.filter(id=encoding_id).delete()
                return Response({"status": "fail"}, status=status.HTTP_400_BAD_REQUEST)
            # TODO: break chunk True/False logic here
            if (
                Encoding.objects.filter(
                    media=media,
                    profile=profile,
                    chunk=chunk,
                    chunk_file_path=chunk_file_path,
                ).count()
                > 1
                and not force
            ):
                Encoding.objects.filter(id=encoding_id).delete()
                return Response({"status": "fail"}, status=status.HTTP_400_BAD_REQUEST)
            else:
                Encoding.objects.filter(
                    media=media,
                    profile=profile,
                    chunk=chunk,
                    chunk_file_path=chunk_file_path,
                ).exclude(id=encoding.id).delete()

            encoding.status = "running"
            if task_id:
                encoding.task_id = task_id

            encoding.save()
            if chunk:
                original_media_path = chunk_file_path
                original_media_md5sum = encoding.md5sum
                original_media_url = settings.SSL_FRONTEND_HOST + encoding.media_chunk_url
            else:
                original_media_path = media.media_file.path
                original_media_md5sum = media.md5sum
                original_media_url = settings.SSL_FRONTEND_HOST + media.original_media_url

            ret["original_media_url"] = original_media_url
            ret["original_media_path"] = original_media_path
            ret["original_media_md5sum"] = original_media_md5sum

            # generating the commands here, and will replace these with temporary
            # files created on the remote server
            tf = "TEMP_FILE_REPLACE"
            tfpass = "TEMP_FPASS_FILE_REPLACE"
            ffmpeg_commands = produce_ffmpeg_commands(
                original_media_path,
                media.media_info,
                resolution=profile.resolution,
                codec=profile.codec,
                output_filename=tf,
                pass_file=tfpass,
                chunk=chunk,
            )
            if not ffmpeg_commands:
                encoding.delete()
                return Response({"status": "fail"}, status=status.HTTP_400_BAD_REQUEST)

            ret["duration"] = media.duration
            ret["ffmpeg_commands"] = ffmpeg_commands
            ret["profile_extension"] = profile.extension
            return Response(ret, status=status.HTTP_201_CREATED)
        elif action == "update_fields":
            try:
                encoding = Encoding.objects.get(id=encoding_id)
            except:
                return Response({"status": "fail"}, status=status.HTTP_400_BAD_REQUEST)
            to_update = ["size", "update_date"]
            if encoding_status:
                encoding.status = encoding_status
                to_update.append("status")
            if progress:
                encoding.progress = progress
                to_update.append("progress")
            if logs:
                encoding.logs = logs
                to_update.append("logs")
            if commands:
                encoding.commands = commands
                to_update.append("commands")
            if task_id:
                encoding.task_id = task_id
                to_update.append("task_id")
            if total_run_time:
                encoding.total_run_time = total_run_time
                to_update.append("total_run_time")
            if worker:
                encoding.worker = worker
                to_update.append("worker")
            if temp_file:
                encoding.temp_file = temp_file
                to_update.append("temp_file")

            if retries:
                encoding.retries = retries
                to_update.append("retries")

            try:
                encoding.save(update_fields=to_update)
            except:
                return Response({"status": "fail"}, status=status.HTTP_400_BAD_REQUEST)
            return Response({"status": "success"}, status=status.HTTP_201_CREATED)

    def put(self, request, encoding_id, format=None):
        encoding_file = request.data["file"]
        encoding = Encoding.objects.filter(id=encoding_id).first()
        if not encoding:
            return Response(
                {"detail": "encoding does not exist"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        encoding.media_file = encoding_file
        encoding.save()
        return Response({"detail": "ok"}, status=status.HTTP_201_CREATED)


class CommentList(APIView):
    permission_classes = (permissions.IsAuthenticated, IsAuthorizedToAdd)
    parser_classes = (JSONParser, MultiPartParser, FormParser, FileUploadParser)

    def get(self, request, format=None):
        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
        paginator = pagination_class()
        comments = Comment.objects.filter(media__state="public").order_by("-add_date")
        comments = comments.prefetch_related("user")
        comments = comments.prefetch_related("media")
        params = self.request.query_params
        if "author" in params:
            author_param = params["author"].strip()
            user_queryset = User.objects.all()
            user = get_object_or_404(user_queryset, username=author_param)
            comments = comments.filter(user=user)

        page = paginator.paginate_queryset(comments, request)

        serializer = CommentSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)


class CommentDetail(APIView):
    # These views refer to both listing comments for a media (get)
    # and also creating/deleting speficic comments (delete/post)
    permission_classes = (IsAuthorizedToAdd,)
    parser_classes = (JSONParser, MultiPartParser, FormParser, FileUploadParser)

    def get_object(self, friendly_token):
        try:
            media = Media.objects.select_related("user").get(friendly_token=friendly_token)
            self.check_object_permissions(self.request, media)
            if media.state == "private" and self.request.user != media.user:
                return Response({"detail": "media is private"}, status=status.HTTP_400_BAD_REQUEST)
            return media
        except PermissionDenied:
            return Response({"detail": "bad permissions"}, status=status.HTTP_400_BAD_REQUEST)
        except Media.DoesNotExist:
            return Response(
                {"detail": "media file does not exist"},
                status=status.HTTP_404_NOT_FOUND,
            )
        except Exception as e:
            # Log the actual error for debugging
            import logging

            logger = logging.getLogger(__name__)
            logger.error(f"Error retrieving media {friendly_token}: {str(e)}", exc_info=True)
            return Response(
                {"detail": "error retrieving media"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def get(self, request, friendly_token):
        # list comments for a media
        media = self.get_object(friendly_token)
        if isinstance(media, Response):
            return media
        comments = media.comments.select_related("user").all()
        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
        paginator = pagination_class()
        page = paginator.paginate_queryset(comments, request)
        serializer = CommentSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)

    def delete(self, request, friendly_token, uid=None):
        # the following can delete a comment:
        # administrators
        # media author
        # comment author
        if uid:
            try:
                comment = Comment.objects.get(uid=uid)
            except:
                return Response(
                    {"detail": "comment does not exist"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if (
                (comment.user == self.request.user)
                or request.user.is_superuser
                or comment.media.user == self.request.user
                or is_mediacms_editor(self.request.user)
                or is_mediacms_manager(self.request.user)
            ):
                comment.delete()
            else:
                return Response({"detail": "bad permissions"}, status=status.HTTP_400_BAD_REQUEST)
        return Response(status=status.HTTP_204_NO_CONTENT)

    def post(self, request, friendly_token):
        media = self.get_object(friendly_token)
        if isinstance(media, Response):
            return media

        if not media.enable_comments:
            return Response(
                {"detail": "comments not allowed here"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = CommentSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            comment = serializer.save(user=request.user, media=media)

            # Notification dispatch
            try:
                from notifications.services import NotificationService

                # TODO: When @mention parsing is built (Tribute.js),
                # parse mentioned_users from comment.text and call:
                # mentioned = NotificationService.on_mention(
                #     actor=request.user, media=media, comment=comment,
                #     mentioned_users=parsed_users,
                # )
                # Then merge mentioned into notified below for overlap prevention.

                notified = set()
                if comment.parent is not None:
                    if NotificationService.on_reply(
                        actor=request.user,
                        media=media,
                        comment=comment,
                        parent_comment=comment.parent,
                    ):
                        notified.add(comment.parent.user)

                # Always notify media owner about comment activity (including
                # replies), unless they were already notified as the reply
                # recipient above.
                if media.user not in notified:
                    NotificationService.on_comment(
                        actor=request.user,
                        media=media,
                        comment=comment,
                        mentioned_users=notified,
                    )
            except Exception:
                logger.exception("Notification failed for comment %s", comment.pk)

            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class CommunityImpactList(APIView):
    permission_classes = (permissions.IsAuthenticatedOrReadOnly,)
    parser_classes = (JSONParser, MultiPartParser, FormParser, FileUploadParser)

    def get_object(self, friendly_token):
        media = get_object_or_404(
            Media.objects.select_related("user").prefetch_related("community_impacts__user"),
            friendly_token=clean_friendly_token(friendly_token),
        )
        if not check_media_access_permission(self.request, media):
            return Response({"detail": "bad permissions"}, status=status.HTTP_403_FORBIDDEN)
        return media

    def get(self, request, friendly_token):
        media = self.get_object(friendly_token)
        if isinstance(media, Response):
            return media
        entries = media.community_impacts.select_related("user").filter(status=CommunityImpact.APPROVED)
        serializer = CommunityImpactSerializer(entries, many=True, context={"request": request})
        return Response(serializer.data)

    def post(self, request, friendly_token):
        media = self.get_object(friendly_token)
        if isinstance(media, Response):
            return media

        serializer = CommunityImpactSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            new_status = (
                CommunityImpact.APPROVED
                if community_impact_auto_approves(request.user, media)
                else CommunityImpact.WAITING_APPROVAL
            )
            serializer.save(user=request.user, media=media, status=new_status)
            invalidate_media_cache(media.friendly_token)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserActions(APIView):
    parser_classes = (JSONParser,)

    def get(self, request, action):
        media = []
        if action in VALID_USER_ACTIONS:
            if request.user.is_authenticated:
                media = (
                    Media.objects.select_related("user")
                    .filter(mediaactions__user=request.user, mediaactions__action=action)
                    .order_by("-mediaactions__action_date")
                )
            elif request.session.session_key:
                media = (
                    Media.objects.select_related("user")
                    .filter(
                        mediaactions__session_key=request.session.session_key,
                        mediaactions__action=action,
                    )
                    .order_by("-mediaactions__action_date")
                )

        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
        paginator = pagination_class()
        page = paginator.paginate_queryset(media, request)
        serializer = MediaSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)


class CategoryList(APIView):
    def get(self, request, format=None):
        categories = Category.objects.filter().order_by("title")
        serializer = CategorySerializer(categories, many=True, context={"request": request})
        ret = serializer.data
        return Response(ret)


class TopicList(APIView):
    def get(self, request, format=None):
        topics = Topic.objects.filter().order_by("title")
        serializer = TopicSerializer(topics, many=True, context={"request": request})
        ret = serializer.data
        return Response(ret)


class ContentSensitivityList(APIView):
    def get(self, request, format=None):
        sensitivities = ContentSensitivity.objects.all().order_by("title")
        serializer = ContentSensitivitySerializer(sensitivities, many=True, context={"request": request})
        return Response(serializer.data)


class MediaLanguageList(APIView):
    """
    Enhanced API view that serves languages from database into the 'languages' page.
    This view retrieves languages that have a non-empty listings_thumbnail and a media_count greater than zero.
    """

    def get(self, request, format=None):
        languages = MediaLanguage.objects.filter(media_count__gt=0).order_by("title")
        serializer = MediaLanguageSerializer(languages, many=True, context={"request": request})
        ret = serializer.data
        return Response(ret)


class MediaCountryList(APIView):
    def get(self, request, format=None):
        country_counts = dict(
            Media.objects.filter(state="public", is_reviewed=True)
            .exclude(media_country__isnull=True)
            .exclude(media_country="")
            .values("media_country")
            .annotate(media_count=models.Count("id"))
            .values_list("media_country", "media_count")
        )
        stored_countries = {country.title: country for country in MediaCountry.objects.filter()}
        ret = []

        for code, title in lists.video_countries:
            stored_country = stored_countries.pop(title, None)
            ret.append(
                {
                    "title": title,
                    "thumbnail_url": stored_country.thumbnail_url if stored_country else None,
                    "media_count": country_counts.get(code, stored_country.media_count if stored_country else 0),
                }
            )

        for stored_country in stored_countries.values():
            ret.append(
                {
                    "title": stored_country.title,
                    "thumbnail_url": stored_country.thumbnail_url,
                    "media_count": stored_country.media_count,
                }
            )

        ret.sort(key=lambda country: country["title"])
        return Response(ret)


class TagList(APIView):
    def get(self, request, format=None):
        tags = (
            Tag.objects.exclude(listings_thumbnail=None)
            .exclude(listings_thumbnail="")
            .filter()
            .order_by("-media_count")
        )
        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
        paginator = pagination_class()
        page = paginator.paginate_queryset(tags, request)
        serializer = TagSerializer(page, many=True, context={"request": request})
        return paginator.get_paginated_response(serializer.data)


class SubtitleLanguageList(APIView):
    def get(self, request, format=None):
        languages = (
            Language.objects.exclude(code__in=["automatic", "automatic-translation"])
            .order_by("title")
            .values("code", "title")
        )
        return Response(list(languages))


class TopMessageList(APIView):
    def get(self, request, format=None):
        top_message = TopMessage.objects.filter(active=True).order_by("-add_date").first()
        serializer = TopMessageSerializer(top_message, context={"request": request})
        return Response(serializer.data)


class HomepagePopupList(APIView):
    def get(self, request, format=None):
        # return results only on the index page
        # referer = request.META.get('HTTP_REFERER', '')
        # if not referer.endswith(('cinemata.org/', 'cinemata.org')):
        #     return Response([])
        popup = HomepagePopup.objects.filter(active=True).order_by("-add_date").first()
        serializer = HomepagePopupSerializer(popup, context={"request": request})
        return Response(serializer.data)


class IndexPageFeaturedList(APIView):
    def get(self, request, format=None):
        indexfeatured = IndexPageFeatured.objects.filter(active=True).order_by("ordering")
        serializer = IndexPageFeaturedSerializer(indexfeatured, many=True, context={"request": request})
        return Response(serializer.data)


class MediaKeyView(APIView):
    """Serve AES-128 decryption key for encrypted HLS streams."""

    def get(self, request, friendly_token):
        try:
            media = Media.objects.select_related("user").get(friendly_token=friendly_token)
        except Media.DoesNotExist:
            raise Http404

        if not media.is_encrypted or not media.encryption_key:
            raise Http404

        if not check_media_access_permission(request, media):
            return HttpResponse(status=403)

        try:
            key_bytes = bytes.fromhex(media.encryption_key)
        except ValueError:
            raise Http404

        if len(key_bytes) != 16:
            raise Http404

        response = HttpResponse(key_bytes, content_type="application/octet-stream")
        response["Content-Length"] = len(key_bytes)
        response["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response["Pragma"] = "no-cache"
        return response
