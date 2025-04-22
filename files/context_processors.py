from django.conf import settings

from .methods import can_upload_media, is_mediacms_editor, is_mediacms_manager
from .models import HomepagePopup, TopMessage

# NOTE: context_processors.py can be considered as a dumping ground of sorts for 
# multiple variables that, as declared, are then instantiated to be referenced
# as one of multiple contexts in the settings.py's context_processors attribute.
# for frontend developers, think of this is a way to globally declare variables
# that can be used in the templates

def stuff(request):
    ret = {}
    if request.is_secure():
        ret["FRONTEND_HOST"] = settings.SSL_FRONTEND_HOST
    else:
        ret["FRONTEND_HOST"] = settings.FRONTEND_HOST
    ret["PORTAL_NAME"] = settings.PORTAL_NAME
    ret["LOAD_FROM_CDN"] = settings.LOAD_FROM_CDN
    ret["CAN_LOGIN"] = settings.LOGIN_ALLOWED
    ret["CAN_REGISTER"] = settings.REGISTER_ALLOWED
    ret["CAN_UPLOAD_MEDIA"] = can_upload_media(request.user)
    ret["CAN_LIKE_MEDIA"] = settings.CAN_LIKE_MEDIA
    ret["CAN_DISLIKE_MEDIA"] = settings.CAN_DISLIKE_MEDIA
    ret["CAN_REPORT_MEDIA"] = settings.CAN_REPORT_MEDIA
    ret["CAN_SHARE_MEDIA"] = settings.CAN_SHARE_MEDIA
    ret["UPLOAD_MAX_SIZE"] = settings.UPLOAD_MAX_SIZE

    if request.user.is_authenticated and request.user.advancedUser:
        ret["UPLOAD_MAX_FILES_NUMBER"] = 10
    else:
        ret["UPLOAD_MAX_FILES_NUMBER"] = 1

    ret["PRE_UPLOAD_MEDIA_MESSAGE"] = settings.PRE_UPLOAD_MEDIA_MESSAGE
    ret[
        "POST_UPLOAD_AUTHOR_MESSAGE_UNLISTED_NO_COMMENTARY"
    ] = settings.POST_UPLOAD_AUTHOR_MESSAGE_UNLISTED_NO_COMMENTARY
    ret["IS_MEDIACMS_ADMIN"] = request.user.is_superuser
    ret["IS_MEDIACMS_EDITOR"] = is_mediacms_editor(request.user)
    ret["IS_MEDIACMS_MANAGER"] = is_mediacms_manager(request.user)
    ret["ALLOW_RATINGS"] = settings.ALLOW_RATINGS
    ret[
        "ALLOW_RATINGS_CONFIRMED_EMAIL_ONLY"
    ] = settings.ALLOW_RATINGS_CONFIRMED_EMAIL_ONLY
    ret[
        "VIDEO_PLAYER_FEATURED_VIDEO_ON_INDEX_PAGE"
    ] = settings.VIDEO_PLAYER_FEATURED_VIDEO_ON_INDEX_PAGE
    ret["RSS_URL"] = "/rss"

    top_message = TopMessage.objects.filter(active=True).order_by("-add_date").first()
    if top_message:
        top_message = top_message.text
    else:
        top_message = ""
    ret["TOP_MESSAGE"] = top_message

    popup = HomepagePopup.objects.filter().order_by("-id").first()
    popup_img_path = ""
    popup_url = ""
    if popup:
        popup_url = popup.popup_image_url
        popup_img_path = popup.popup.name
    ret["POPUP_IMG_PATH"] = popup_img_path
    ret["POPUP_URL"] = popup_url
    if request.user.is_superuser:
        ret["DJANGO_ADMIN_URL"] = settings.DJANGO_ADMIN_URL
    ret["MFA_REQ_DATE"] = 'April 21, 2025'
    return ret
