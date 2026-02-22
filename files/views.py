import contextlib
import csv
import json
import logging
import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path

from allauth.mfa.utils import is_mfa_enabled
from django.conf import settings
from django.contrib import messages
from django.contrib.auth.decorators import login_required
from django.contrib.postgres.search import SearchQuery
from django.core.mail import EmailMessage
from django.db import models, transaction
from django.db.models import Case, Exists, F, OuterRef, Q, Value, When
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404, render
from django.template.defaultfilters import slugify
from django.utils import timezone
from django.views.decorators.clickjacking import xframe_options_exempt
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
from cms.custom_pagination import FastPaginationWithoutCount
from cms.permissions import (
    IsAuthorizedToAdd,
    IsUserOrEditor,
    user_requires_mfa,
)
from users.models import User

from . import lists
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
    can_upload_media,
    get_current_featured_media,
    get_user_or_session,
    is_curator,
    is_media_allowed_type,
    is_mediacms_editor,
    is_mediacms_manager,
    list_tasks,
    notify_user_on_comment,
    show_recommended_media,
    show_related_media,
)
from .models import (
    Category,
    Comment,
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
    set_cached_result,
)
from .serializers import (
    CategorySerializer,
    CommentSerializer,
    EncodeProfileSerializer,
    HomepagePopupSerializer,
    IndexPageFeaturedSerializer,
    MediaCountrySerializer,
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
from .tasks import save_user_action

VALID_USER_ACTIONS = [action for action, name in USER_MEDIA_ACTIONS]

logger = logging.getLogger(__name__)


def index(request):
    # Index view
    context = {}
    return render(request, "cms/index.html", context)


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


@login_required
def modern_demo_page(request):
    if not request.user.is_staff:
        return HttpResponseRedirect("/")
    if user_requires_mfa(request.user) and not is_mfa_enabled(request.user):
        return HttpResponseRedirect("/accounts/2fa/totp/activate")
    return render(request, "cms/modern_demo.html")


def manage_users(request):
    if request.user.is_anonymous:
        return HttpResponseRedirect("/")
    # MFA check
    if user_requires_mfa(request.user) and not is_mfa_enabled(request.user):
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
    if user_requires_mfa(request.user) and not is_mfa_enabled(request.user):
        return HttpResponseRedirect("/accounts/2fa/totp/activate")

    # Hard config -> ensure superuser / manager / editor only have access
    if not (request.user.is_superuser or request.user.is_manager or request.user.is_editor):
        return HttpResponseRedirect("/")

    context = {}
    return render(request, "cms/manage_media.html", context)


def manage_comments(request):
    if request.user.is_anonymous:
        return HttpResponseRedirect("/")

    if user_requires_mfa(request.user) and not is_mfa_enabled(request.user):
        return HttpResponseRedirect("/accounts/2fa/totp/activate")

    if not (request.user.is_superuser or request.user.is_manager or request.user.is_editor):
        return HttpResponseRedirect("/")

    context = {}
    return render(request, "cms/manage_comments.html", context)


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


def upload_media(request):
    from allauth.account.forms import LoginForm

    form = LoginForm()
    context = {}
    context["form"] = form
    context["can_add"] = can_upload_media(request.user)
    can_upload_exp = settings.CANNOT_ADD_MEDIA_MESSAGE
    context["can_upload_exp"] = can_upload_exp

    # Get allowed video extensions from helper function
    video_extensions = get_allowed_video_extensions()
    context["allowed_extensions"] = json.dumps(video_extensions)

    return render(request, "cms/add-media.html", context)


def view_media(request):
    friendly_token = request.GET.get("m", "").strip()
    context = {}
    #    if not friendly_token:
    #        return HttpResponseRedirect('/')
    media = Media.objects.filter(friendly_token=friendly_token).first()
    if not media:
        # TODO: 404 selida
        context["media"] = None
        return render(request, "cms/media.html", context)
        # return HttpResponseRedirect('/')
    user_or_session = get_user_or_session(request)
    save_user_action.delay(user_or_session, friendly_token=friendly_token, action="watch")
    context = {}
    context["media"] = friendly_token
    context["media_object"] = media

    can_see_restricted_media = False
    wrong_password_provided = False
    if media.state == "restricted":
        if request.POST.get("password"):
            if media.password == request.POST.get("password"):
                can_see_restricted_media = True
                # Store hashed password in session for file access (avoid persisting plaintext)
                import hashlib

                request.session[f"media_password_{media.friendly_token}"] = hashlib.sha256(
                    media.password.encode("utf-8")
                ).hexdigest()
            else:
                wrong_password_provided = True

    context["CAN_DELETE_MEDIA"] = False
    context["CAN_EDIT_MEDIA"] = False
    context["CAN_DELETE_COMMENTS"] = False

    if request.user.is_authenticated:
        if (media.user.id == request.user.id) or is_mediacms_editor(request.user) or is_mediacms_manager(request.user):
            context["CAN_DELETE_MEDIA"] = True
            context["CAN_EDIT_MEDIA"] = True
            context["CAN_DELETE_COMMENTS"] = True
            can_see_restricted_media = True

    context["can_see_restricted_media"] = can_see_restricted_media
    context["wrong_password_provided"] = wrong_password_provided
    context["is_media_allowed_type"] = is_media_allowed_type(media)
    return render(request, "cms/media.html", context)


#########################
# Old URLs related


def view_old_media(request, user, video):
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
    return render(request, "cms/media.html", context)


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
        form = MediaForm(request.user, request.POST, request.FILES, instance=media)
        if form.is_valid():
            # Set current user for FeaturedVideo signal tracking
            media._current_user = request.user
            media = form.save()
            for tag in media.tags.all():
                media.tags.remove(tag)
            if form.cleaned_data.get("new_tags"):
                for tag in form.cleaned_data.get("new_tags").split(","):
                    tag = slugify(tag)
                    if tag:
                        try:
                            tag = Tag.objects.get(title=tag)
                        except Tag.DoesNotExist:
                            tag = Tag.objects.create(title=tag, user=request.user)
                        if tag not in media.tags.all():
                            media.tags.add(tag)

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

            return HttpResponseRedirect(media.get_absolute_url())
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
    media = Media.objects.values("title").filter(friendly_token=friendly_token).first()
    if not media:
        return HttpResponseRedirect("/")
    get_user_or_session(request)
    # save_user_action.delay(
    #     user_or_session, friendly_token=friendly_token, action='watch')
    context = {}
    context["media"] = friendly_token
    return render(request, "cms/embed.html", context)


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

        if not author_param and not offset_param and show_param != "recommended":
            try:
                page_num = int(page_param)
                user_id = request.user.id if request.user.is_authenticated else None
                cache_key = get_media_list_cache_key(show=show_param or "latest", page=page_num, user_id=user_id)
                cached_result = get_cached_result(cache_key)
                if cached_result is not None:
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
                # Get the scheduled featured video (if any) to show as hero
                scheduled_featured = get_current_featured_media()

                # Subquery to identify videos with future-scheduled FeaturedVideo entries
                # These should not appear in listings until their start_date arrives
                now = timezone.now()
                has_future_schedule = FeaturedVideo.objects.filter(
                    media=OuterRef("pk"), is_active=True, start_date__gt=now
                )

                if scheduled_featured:
                    # Get all other featured videos, ordered by featured date (newest first)
                    # Use F() with nulls_last to ensure NULL featured_dates sort after dated ones
                    # Exclude videos that have a future-scheduled FeaturedVideo entry
                    other_featured_ids = list(
                        Media.objects.filter(basic_query, featured=True)
                        .exclude(pk=scheduled_featured.pk)
                        .exclude(Exists(has_future_schedule))
                        .order_by(F("featured_date").desc(nulls_last=True), "-add_date")
                        .values_list("pk", flat=True)
                    )
                    # Combine: scheduled first, then others
                    all_ids = [scheduled_featured.pk] + other_featured_ids

                    # Use Case/When with Value to maintain order
                    preserved_order = Case(
                        *[When(pk=pk, then=Value(pos)) for pos, pk in enumerate(all_ids)],
                        output_field=models.IntegerField(),
                    )
                    media = Media.objects.filter(pk__in=all_ids).order_by(preserved_order)
                else:
                    # No scheduled video, return all featured videos ordered by featured_date
                    # Exclude videos that have a future-scheduled FeaturedVideo entry
                    media = (
                        Media.objects.filter(basic_query, featured=True)
                        .exclude(Exists(has_future_schedule))
                        .order_by(F("featured_date").desc(nulls_last=True), "-add_date")
                    )
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
        if not author_param and not offset_param and show_param != "recommended":
            try:  # noqa: SIM105
                set_cached_result(cache_key, response_data.data, MEDIA_LIST_TIMEOUT)
            except NameError:
                pass  # cache_key not defined (shouldn't happen, but safe fallback)

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

    def get_object(self, friendly_token, password=None):
        friendly_token = clean_friendly_token(friendly_token)
        try:
            media = (
                Media.objects.select_related("user", "license")
                .prefetch_related(
                    "category",
                    "topics",
                    "tags",
                    "subtitles__language",
                    "encodings__profile",
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

            # Handle RESTRICTED media (password-protected, no login required)
            elif media.state == "restricted" and not (
                self.request.user == media.user or is_mediacms_editor(self.request.user)
            ):
                if (not password) or (not media.password) or (password != media.password):
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
            # Log the actual error for debugging
            import logging

            logger = logging.getLogger(__name__)
            logger.error(f"Error retrieving media {friendly_token}: {str(e)}", exc_info=True)
            return Response(
                {"detail": "error retrieving media"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    def get(self, request, friendly_token, format=None):
        # Get media details
        password = request.GET.get("password") or request.POST.get("password")

        # Try cache for public media only (not private/restricted)
        user_id = request.user.id if request.user.is_authenticated else None
        cache_key = get_media_detail_cache_key(friendly_token, user_id)

        # Skip cache for password-protected requests
        if not password:
            cached_result = get_cached_result(cache_key)
            if cached_result is not None:
                return Response(cached_result)

        media = self.get_object(friendly_token, password=password)
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
        if media.state in ["public", "unlisted"] and not password:
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

        if not (request.user == media.user or is_mediacms_editor(request.user) or is_mediacms_manager(request.user)):
            return Response({"detail": "not allowed"}, status=status.HTTP_400_BAD_REQUEST)

        if isinstance(media, Response):
            return media

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

    def delete(self, request, friendly_token, format=None):
        media = self.get_object(friendly_token)
        if isinstance(media, Response):
            return media

        if not request.user.is_superuser:
            return Response({"detail": "not allowed"}, status=status.HTTP_400_BAD_REQUEST)

        action = request.data.get("type")
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


class MediaSearch(APIView):
    parser_classes = (JSONParser,)

    def get(self, request, format=None):
        params = self.request.query_params
        params.get("show", "")
        query = params.get("q", "").strip().lower()
        category = params.get("c", "").strip()
        tag = params.get("t", "").strip()
        language = params.get("language", "").strip()
        country = params.get("country", "").strip()
        topic = params.get("topic", "").strip()

        ordering = params.get("ordering", "").strip()
        sort_by = params.get("sort_by", "").strip()
        media_type = params.get("media_type", "").strip()
        params.get("add_date", "").strip()
        params.get("edit_date", "").strip()

        author = params.get("author", "").strip()

        license = params.get("license", "").strip()
        upload_date = params.get("upload_date", "").strip()

        sort_by_options = ["title", "add_date", "edit_date", "views", "likes"]
        if sort_by not in sort_by_options:
            sort_by = "add_date"
        ordering = "" if ordering == "asc" else "-"

        if media_type not in ["video", "image", "audio", "pdf"]:
            media_type = None

        if not (query or category or tag or language or country or topic):
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
            media = media.filter(tags__title=tag)

        if category:
            media = media.filter(category__title__contains=category)

        if topic:
            media = media.filter(topics__title__contains=topic)

        if language:
            language = {
                value: key
                for key, value in Language.objects.exclude(code__in=["automatic", "automatic-translation"]).values_list(
                    "code", "title"
                )
            }.get(language)
            media = media.filter(media_language=language)

        if country:
            country = {value: key for key, value in dict(lists.video_countries).items()}.get(country)
            media = media.filter(media_country=country)

        if media_type:
            media = media.filter(media_type=media_type)

        if author:
            media = media.filter(user__username=author)

        if license:
            if license == "no_license":
                media = media.filter(license=None)
            else:
                try:
                    license = int(license)
                    media = media.filter(license_id=license)
                except ValueError:
                    pass

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

        media = media.order_by(f"{ordering}{sort_by}")

        if self.request.query_params.get("show", "").strip() == "titles":
            media = media.values("title")[:40]
            return Response(media, status=status.HTTP_200_OK)
        else:
            media = media.select_related("user").prefetch_related(
                "category",
                "topics",
            )
            if category or tag:
                pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
            else:
                # pagination_class = FastPaginationWithoutCount
                pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
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
        pagination_class = api_settings.DEFAULT_PAGINATION_CLASS
        paginator = pagination_class()
        playlists = Playlist.objects.filter().prefetch_related("user")

        if "author" in self.request.query_params:
            author = self.request.query_params["author"].strip()
            playlists = playlists.filter(user__username=author)

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
        cache_key = get_playlist_detail_cache_key(friendly_token, user_id)
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
            serializer.save(user=request.user, media=media)
            if request.user != media.user:
                notify_user_on_comment(friendly_token=media.friendly_token)
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
        topics = Topic.objects.filter(media_count__gt=0).order_by("title")
        serializer = TopicSerializer(topics, many=True, context={"request": request})
        ret = serializer.data
        return Response(ret)


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
        countries = MediaCountry.objects.exclude(listings_thumbnail="").filter(media_count__gt=0).order_by("title")
        serializer = MediaCountrySerializer(countries, many=True, context={"request": request})
        ret = serializer.data
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
