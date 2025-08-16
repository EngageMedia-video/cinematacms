import itertools
import logging
import random
from datetime import datetime, timedelta

from django.conf import settings
from django.core.cache import cache
from django.core.mail import EmailMessage, send_mail
from django.db.models import Q

from cms import celery_app

from . import models
from .helpers import mask_ip

logger = logging.getLogger(__name__)


def list_tasks():
    i = celery_app.control.inspect([])
    ret = {}
    temp = {}
    task_ids = []
    media_profile_pairs = []

    temp["active"] = i.active()
    temp["reserved"] = i.reserved()
    temp["scheduled"] = i.scheduled()

    for state, state_dict in temp.items():
        ret[state] = {}
        ret[state]["tasks"] = []
        for worker, worker_dict in state_dict.items():
            for task in worker_dict:
                task_dict = {}
                task_dict["worker"] = worker
                task_dict["task_id"] = task.get("id")
                task_ids.append(task.get("id"))
                task_dict["args"] = task.get("args")
                task_dict["name"] = task.get("name")
                task_dict["time_start"] = task.get("time_start")
                if task.get("name") == "encode_media":
                    task_args = task.get("args")
                    for bad in "(),'":
                        task_args = task_args.replace(bad, "")
                    friendly_token = task_args.split()[0]
                    profile_id = task_args.split()[1]

                    media = models.Media.objects.filter(
                        friendly_token=friendly_token
                    ).first()
                    if media:
                        profile = models.EncodeProfile.objects.filter(
                            id=profile_id
                        ).first()
                        if profile:
                            media_profile_pairs.append(
                                (media.friendly_token, profile.id)
                            )
                            task_dict["info"] = {}
                            task_dict["info"]["profile name"] = profile.name
                            task_dict["info"]["media title"] = media.title
                            encoding = models.Encoding.objects.filter(
                                task_id=task.get("id")
                            ).first()
                            if encoding:
                                task_dict["info"][
                                    "encoding progress"
                                ] = encoding.progress

                ret[state]["tasks"].append(task_dict)
    ret["task_ids"] = task_ids
    ret["media_profile_pairs"] = media_profile_pairs
    return ret


def get_user_or_session(request):
    ret = {}
    if request.user.is_authenticated:
        ret["user_id"] = request.user.id
    else:
        if not request.session.session_key:
            request.session.save()
        ret["user_session"] = request.session.session_key
    if settings.MASK_IPS_FOR_ACTIONS:
        ret["remote_ip_addr"] = mask_ip(request.META.get("REMOTE_ADDR"))
    else:
        ret["remote_ip_addr"] = request.META.get("REMOTE_ADDR")
    return ret


def pre_save_action(media, user, session_key, action, remote_ip):
    # PERFORM THRESHOLD CHECKS
    from actions.models import MediaAction

    if user:
        query = MediaAction.objects.filter(media=media, action=action, user=user)
    else:
        query = MediaAction.objects.filter(
            media=media, action=action, session_key=session_key
        )
    query = query.order_by("-action_date")

    if query:
        query = query.first()
        if action in ["like", "dislike", "report"]:
            return False  # has alread done action once
        elif action == "watch" and user:
            if media.duration:
                now = datetime.now(query.action_date.tzinfo)
                if (now - query.action_date).seconds > media.duration:
                    return True
    else:
        if user:  # first time action
            return True

    if not user:
        query = (
            MediaAction.objects.filter(media=media, action=action, remote_ip=remote_ip)
            .filter(user=None)
            .order_by("-action_date")
        )
        if query:
            query = query.first()
            now = datetime.now(query.action_date.tzinfo)
            if action == "watch":
                if not (now - query.action_date).seconds > media.duration:
                    return False
            if (now - query.action_date).seconds > settings.TIME_TO_ACTION_ANONYMOUS:
                return True
        else:
            return True

    return False


def notify_users(friendly_token=None, action=None, extra=None):
    notify_items = []
    media = None
    if friendly_token:
        media = models.Media.objects.filter(friendly_token=friendly_token).first()
        if not media:
            return False
        media_url = settings.SSL_FRONTEND_HOST + media.get_absolute_url()

    if action == "media_reported" and media:
        if settings.ADMINS_NOTIFICATIONS.get("MEDIA_REPORTED", False):
            title = "[{}] - Media was reported".format(settings.PORTAL_NAME)
            msg = """
            Media %s was reported.
            Reason: %s\n
            Total times this media has been reported: %s
            """ % (
                media_url,
                extra,
                media.reported_times,
            )
            d = {}
            d["title"] = title
            d["msg"] = msg
            d["to"] = settings.ADMIN_EMAIL_LIST
            notify_items.append(d)

    if action == "media_added" and media:
        if settings.ADMINS_NOTIFICATIONS.get("MEDIA_ADDED", False):
            title = "[{}] - Video was added".format(settings.PORTAL_NAME)
            msg = """
Video %s was added by user %s.
""" % (
                media_url,
                media.user,
            )
            d = {}
            d["title"] = title
            d["msg"] = msg
            d["to"] = settings.ADMIN_EMAIL_LIST
            notify_items.append(d)
        if settings.USERS_NOTIFICATIONS.get("MEDIA_ADDED", False):
            title = "[{}] - Your video was uploaded successfully".format(settings.PORTAL_NAME)
            msg = """
Your video has been uploaded successfully! It's now being processed and will be available soon.
URL: %s
            """ % (
                media_url
            )
            d = {}
            d["title"] = title
            d["msg"] = msg
            d["to"] = [media.user.email]
            notify_items.append(d)

    if action == "media_auto_transcription" and media:
        title = f"[{settings.PORTAL_NAME}] - Auto-generated Transcription Completed"
        msg = """
Dear %s,

The auto-generated transcription of your video has been created. You can now view and review it here: %s.

For questions or concerns about the transcription, please reach out to curators@cinemata.org.

Best,
The Cinemata Curatorial Team

        """ % (
            media.user.username,
            media_url,
        )
        if extra == "translation":
            title = f"[{settings.PORTAL_NAME}] - Auto-generated English Translation Completed"

            msg = """
Dear %s,

The auto-generated English translation of your video has been created. You can now view and review it here: %s.

For questions or concerns about the transcription, please reach out to curators@cinemata.org.

Best,
The Cinemata Curatorial Team

        """ % (
                media.user.username,
                media_url,
            )

        d = {}
        d["title"] = title
        d["msg"] = msg
        d["to"] = [media.user.email]
        notify_items.append(d)

    for item in notify_items:
        email = EmailMessage(
            item["title"], item["msg"], settings.DEFAULT_FROM_EMAIL, item["to"]
        )
        email.send(fail_silently=True)
        return True


def show_recommended_media(request, limit=100):
    basic_query = Q(state="public", is_reviewed=True, encoding_status="success")
    pmi = cache.get("popular_media_ids")
    # produced by task get_list_of_popular_media
    if pmi:
        media = list(
            models.Media.objects.filter(friendly_token__in=pmi)
            .filter(basic_query)
            .prefetch_related("user")[:limit]
        )
    else:
        media = list(
            models.Media.objects.filter(basic_query)
            .order_by("-views", "-likes")
            .prefetch_related("user")[:limit]
        )
    random.shuffle(media)
    return media


def show_related_media(media, request=None, limit=100):
    # TODO: this will be a setting that can also be tuned by the user
    # by default show videos of same author.
    # Calculate related with ML
    # TODO: check if user overided
    if settings.RELATED_MEDIA_STRATEGY == "calculated":
        return show_related_media_calculated(media, request, limit)
    elif settings.RELATED_MEDIA_STRATEGY == "author":
        return show_related_media_author(media, request, limit)
    return show_related_media_content(media, request, limit)


def show_related_media_content(media, request, limit):
    # Create list with author items
    # then items on same category, then some random(latest)
    # Aim is to always show enough (limit) videos
    # and include author videos in any case

    q_author = Q(
        state="public", is_reviewed=True, encoding_status="success", user=media.user
    )
    m = list(
        models.Media.objects.filter(q_author)
        .order_by()
        .prefetch_related("user")[:limit]
    )

    # order by random criteria so that it doesn't bring the same results
    # attention: only fields that are indexed make sense here! also need
    # find a way for indexes with more than 1 field
    order_criteria = [
        "-views",
        "views",
        "add_date",
        "-add_date",
        "featured",
        "-featured",
        "user_featured",
        "-user_featured",
    ]
    # TODO: Make this mess more readable, and add TAGS support - aka related tags rather than random media
    extra_limit = max(limit - media.user.media_count, 10)
    if len(m) < limit:
        category = media.category.first()
        if category:
            q_category = Q(
                state="public",
                encoding_status="success",
                is_reviewed=True,
                category=category,
            )
            q_res = (
                models.Media.objects.filter(q_category)
                .order_by(order_criteria[random.randint(0, len(order_criteria) - 1)])
                .prefetch_related("user")[:extra_limit]
            )
            m = list(itertools.chain(m, q_res))

        if len(m) < limit:
            q_generic = Q(state="public", encoding_status="success", is_reviewed=True)
            q_res = (
                models.Media.objects.filter(q_generic)
                .order_by(order_criteria[random.randint(0, len(order_criteria) - 1)])
                .prefetch_related("user")[:extra_limit]
            )
            m = list(itertools.chain(m, q_res))

    m = list(set(m[:limit]))  # remove duplicates

    try:
        m.remove(media)  # remove media from results
    except ValueError:
        pass

    random.shuffle(m)
    return m


def show_related_media_author(media, request, limit):
    q_author = Q(
        state="public", is_reviewed=True, encoding_status="success", user=media.user
    )
    m = list(
        models.Media.objects.filter(q_author)
        .order_by()
        .prefetch_related("user")[:limit]
    )

    # order by random criteria so that it doesn't bring the same results
    # attention: only fields that are indexed make sense here! also need
    # find a way for indexes with more than 1 field
    order_criteria = [
        "-views",
        "views",
        "add_date",
        "-add_date",
        "featured",
        "-featured",
        "user_featured",
        "-user_featured",
    ]

    m = list(set(m[:limit]))  # remove duplicates

    try:
        m.remove(media)  # remove media from results
    except ValueError:
        pass

    random.shuffle(m)
    return m


def show_related_media_calculated(media, request, limit):
    return []


def update_user_ratings(user, media, user_ratings):
    # helper function used to populate user ratings for a media
    # on what the serializer responds as the default response
    # of the rating object
    for category in user_ratings:
        ratings = category.get("ratings", [])
        for rating in ratings:
            user_rating = (
                models.Rating.objects.filter(
                    user=user,
                    media_id=media,
                    rating_category_id=rating.get("rating_category_id"),
                )
                .only("score")
                .first()
            )
            if user_rating:
                rating["score"] = user_rating.score
    return user_ratings


def notify_user_on_comment(friendly_token):
    media = None
    media = models.Media.objects.filter(friendly_token=friendly_token).first()
    if not media:
        return False

    user = media.user
    media_url = settings.SSL_FRONTEND_HOST + media.get_absolute_url()

    if user.notification_on_comments:
        title = "[{}] - A comment was added".format(settings.PORTAL_NAME)
        msg = """
A comment has been added to your media %s .
View it on %s
        """ % (
            media.title,
            media_url,
        )
        email = EmailMessage(
            title, msg, settings.DEFAULT_FROM_EMAIL, [media.user.email]
        )
        email.send(fail_silently=True)
    return True


def is_mediacms_editor(user):
    # helper function
    editor = False
    try:
        if user.is_superuser or user.is_manager or user.is_editor:
            editor = True
    except:
        pass
    return editor


def is_mediacms_manager(user):
    # helper function
    manager = False
    try:
        if user.is_superuser or user.is_manager:
            manager = True
    except:
        pass
    return manager


def can_upload_media(user):
    try:
        # trusted user, or editor/manager?
        if user.advancedUser or user.is_superuser or user.is_manager or user.is_editor:
            return True
    except:
        pass
    try:
        # 30 dates on system?
        if datetime.now().date() - user.date_added.date() > timedelta(days=30):
            return True
        else:
            if user.media_count < 10:
                return True
    except:
        pass

    return False

def is_media_allowed_type(media):
    return media.media_type in settings.ALLOWED_MEDIA_UPLOAD_TYPES
