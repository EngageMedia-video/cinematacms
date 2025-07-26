import os
from pathlib import Path
from celery.schedules import crontab
from .settings_utils import get_whisper_cpp_paths

# PORTAL SETTINGS
PORTAL_NAME = "EngageMedia Video"  #  this is shown on several places, eg on contact email, or html title
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Europe/London"
ALLOWED_HOSTS = [
    "127.0.0.1",
    "localhost",
]
INTERNAL_IPS = "127.0.0.1"
FRONTEND_HOST = "http://cinemata.org"
SSL_FRONTEND_HOST = FRONTEND_HOST.replace("http", "https")

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

AUTHENTICATION_BACKENDS = (
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.mfa",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.sites",
    "rest_framework",
    "rest_framework.authtoken",
    "imagekit",
    "files.apps.FilesConfig",
    "users.apps.UsersConfig",
    "actions.apps.ActionsConfig",
    "debug_toolbar",
    "mptt",
    "crispy_forms",
    "uploader.apps.UploaderConfig",
    "djcelery_email",
    "tinymce",
    "captcha",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "debug_toolbar.middleware.DebugToolbarMiddleware",
    "allauth.account.middleware.AccountMiddleware",
    "users.middleware.AdminMFAMiddleware",
]

ROOT_URLCONF = "cms.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": ["templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.template.context_processors.media",
                "django.contrib.messages.context_processors.messages",
                "files.context_processors.stuff",
                'cms.context_processors.ui_settings',
            ],
        },
    },
]

WSGI_APPLICATION = "cms.wsgi.application"

AUTH_PASSWORD_VALIDATORS = [
    {
        # Checks the similarity between the password and a set of attributes of the user.
        "NAME": "users.password_validators.CustomUserAttributeSimilarityValidator",
        "OPTIONS": {
            "user_attributes": ("username", "email", "first_name", "last_name"),
            "max_similarity": 0.7,
        },
    },
    {
        # Checks whether the password meets a minimum length.
        "NAME": "users.password_validators.CustomMinimumLengthValidator",
        "OPTIONS": {
            "min_length": 14,
        },
    },
    {
        # Checks whether the password occurs in a list of common passwords
        "NAME": "users.password_validators.CustomCommonPasswordValidator",
    },
    {
        # Checks whether the password 'isnt entirely numeric
        "NAME": "users.password_validators.CustomNumericPasswordValidator",
    },
]


FILE_UPLOAD_HANDLERS = [
    "django.core.files.uploadhandler.TemporaryFileUploadHandler",
]

LOGS_DIR = os.path.join(BASE_DIR, "logs")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "file": {
            "level": "ERROR",
            "class": "logging.FileHandler",
            "filename": os.path.join(LOGS_DIR, "debug.log"),
        },
    },
    "loggers": {
        "django": {
            "handlers": ["file"],
            "level": "ERROR",
            "propagate": True,
        },
    },
}

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "mediacms",
        "HOST": "127.0.0.1",
        "PORT": "5432",
        "USER": "mediacms",
        "PASSWORD": "mediacms",
        "TEST": {
            "MIRROR": "default",  # mirror - default enables you to work on the database's copy
            "MIGRATE": False,
        },
    }
}

DEFAULT_AUTO_FIELD = 'django.db.models.AutoField'


REDIS_LOCATION = "redis://127.0.0.1:6379/1"
CACHES = {
    "default": {
        "BACKEND": "django_redis.cache.RedisCache",
        "LOCATION": REDIS_LOCATION,
        "OPTIONS": {
            "CLIENT_CLASS": "django_redis.client.DefaultClient",
        },
    }
}

SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"
USE_I18N = True
USE_L10N = True
USE_TZ = True
SITE_ID = 1

# Security improvements
SESSION_COOKIE_AGE = 28800  # 8 hours in seconds
CSRF_COOKIE_AGE = None  # Make CSRF token session-based

STATIC_URL = "/static/"  #  where js/css files are stored on the filesystem
MEDIA_ROOT = BASE_DIR + "/media_files/"  #  where uploaded + encoded media are stored
MEDIA_URL = "/media/"  #  URL where static files are served from the server
STATIC_ROOT = BASE_DIR + "/static/"

AUTH_USER_MODEL = "users.User"
LOGIN_REDIRECT_URL = "/"


# CELERY STUFF
BROKER_URL = REDIS_LOCATION
CELERY_RESULT_BACKEND = BROKER_URL
CELERY_ACCEPT_CONTENT = ["application/json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_SOFT_TIME_LIMIT = 2 * 60 * 60
CELERY_WORKER_PREFETCH_MULTIPLIER = 1
CELERYD_PREFETCH_MULTIPLIER = 1

CELERY_BEAT_SCHEDULE = {
    #    'check_running_states': {
    #        'task': 'check_running_states',
    #        'schedule': crontab(minute='*/10'),
    #    },
    #    'check_pending_states': {
    #        'task': 'check_pending_states',
    #        'schedule': crontab(minute='*/120'),
    #    },
    #    'check_media_states': {
    #        'task': 'check_media_states',
    #        'schedule': crontab(hour='*/10'),
    #    },
    # clear expired sessions, every sunday 1.01am. By default Django has 2week expire date
    "clear_sessions": {
        "task": "clear_sessions",
        "schedule": crontab(hour=1, minute=1, day_of_week=6),
    },
    "get_list_of_popular_media": {
        "task": "get_list_of_popular_media",
        "schedule": crontab(hour="*/10"),
    },
    "update_listings_thumbnails": {
        "task": "update_listings_thumbnails",
        "schedule": crontab(hour="*/30"),
    },
    #     "schedule": timedelta(seconds=5),
    #     "args": (16, 16)
}
# TODO: beat, delete chunks from media root
# chunks_dir after xx days...(also uploads_dir)


# protection agains anonymous users
# per ip address limit, for actions as like/dislike/report
TIME_TO_ACTION_ANONYMOUS = 10 * 60

# django-allauth settings
ACCOUNT_SESSION_REMEMBER = True
ACCOUNT_LOGIN_METHODS = {'username', 'email'}
ACCOUNT_SIGNUP_FIELDS = ['email*', 'username*', 'password1*']
ACCOUNT_EMAIL_VERIFICATION = "optional"  # 'mandatory' 'none'
ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION = True
ACCOUNT_USERNAME_MIN_LENGTH = "4"
ACCOUNT_ADAPTER = "users.adapter.MyAccountAdapter"
ACCOUNT_SIGNUP_FORM_CLASS = "users.forms.SignupForm"
ACCOUNT_USERNAME_VALIDATORS = "users.validators.custom_username_validators"
ACCOUNT_LOGIN_ON_PASSWORD_RESET = True
ACCOUNT_EMAIL_CONFIRMATION_EXPIRE_DAYS = 1
ACCOUNT_LOGIN_BY_CODE_ENABLED = True

# MFA custom configurations here
MFA_FORMS = {
    "authenticate": "users.forms.CustomAuthenticateForm",
    "reauthenticate": "users.forms.CustomReauthenticateTOTPForm",
    "activate_totp": "users.forms.CustomActivateTOTPForm",
}
MFA_RECOVERY_CODE_COUNT = 10
MFA_RECOVERY_CODE_DIGITS = 12
MFA_TOTP_TOLERANCE = 120
MFA_SUPPORTED_TYPES = ["totp", "recovery_codes"]
MFA_TOTP_ISSUER = "Cinemata"

# registration won't be open, might also consider to remove links for register
USERS_CAN_SELF_REGISTER = True

RESTRICTED_DOMAINS_FOR_USER_REGISTRATION = ["xxx.com", "emaildomainwhatever.com"]

# valid options include 'all', 'email_verified', 'advancedUser'
CAN_ADD_MEDIA = "all"

# django rest settings
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
        "rest_framework.authentication.TokenAuthentication",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_PARSER_CLASSES": [
        "rest_framework.parsers.JSONParser",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
}


# cinematacms related
# Portal workflow options:
# 'public' - All uploads are public by default
# 'private' - All uploads are private by default (requires manual approval)
# 'unlisted' - All uploads are unlisted by default
# 'private_verified' - Regular users: private, Trusted users: unlisted (RECOMMENDED)
PORTAL_WORKFLOW = "private_verified"

TEMP_DIRECTORY = "/tmp"  # Don't use a temp directory inside BASE_DIR!!!

MEDIA_UPLOAD_DIR = "original/"
MEDIA_ENCODING_DIR = "encoded/"
THUMBNAIL_UPLOAD_DIR = os.path.join(MEDIA_UPLOAD_DIR, "thumbnails/")
SUBTITLES_UPLOAD_DIR = os.path.join(MEDIA_UPLOAD_DIR, "subtitles/")
HLS_DIR = os.path.join(MEDIA_ROOT, "hls/")

FFMPEG_COMMAND = "ffmpeg"  # this is the path
FFPROBE_COMMAND = "ffprobe"  # this is the path
MP4HLS = "mp4hls"

ALLOW_ANONYMOUS_ACTIONS = ["report", "like", "dislike", "watch"]  # need be a list
MASK_IPS_FOR_ACTIONS = True
# how many seconds a process in running state without reporting progress is
# considered as stale...unfortunately v9 seems to not include time
# some times so raising this high
RUNNING_STATE_STALE = 60 * 60 * 2

# how many times an item need be reported
# to get to private state automatically
REPORTED_TIMES_THRESHOLD = 10

MEDIA_IS_REVIEWED = True  # whether an admin needs to review a media file.
# By default consider this is not needed.
# If set to False, then each new media need be reviewed

# if set to True the url for original file is returned to the API.
SHOW_ORIGINAL_MEDIA = True
# Keep in mind that nginx will serve the file unless there's
# some authentication taking place. Check nginx file and setup a
# basic http auth user/password if you want to restrict access

MAX_MEDIA_PER_PLAYLIST = 70
FRIENDLY_TOKEN_LEN = 9

# for videos, after that duration get split into chunks
# and encoded independently
CHUNKIZE_VIDEO_DURATION = 60 * 5
# aparently this has to be smaller than VIDEO_CHUNKIZE_DURATION
VIDEO_CHUNKS_DURATION = 60 * 4

# always get these two, even if upscaling
MINIMUM_RESOLUTIONS_TO_ENCODE = [240, 360]

# NOTIFICATIONS
USERS_NOTIFICATIONS = {
    "MEDIA_ADDED": True,
    "MEDIA_ENCODED": False,
    "MEDIA_REPORTED": False,
}

ADMINS_NOTIFICATIONS = {
    "NEW_USER": True,
    "MEDIA_ADDED": True,
    "MEDIA_ENCODED": False,
    "MEDIA_REPORTED": True,
}

MAX_CHARS_FOR_COMMENT = 10000  # so that it doesn't end up huge

# this is for fineuploader - media uploads
UPLOAD_DIR = "uploads/"
CHUNKS_DIR = "chunks/"
# bytes, size of uploaded media
UPLOAD_MAX_SIZE = 800 * 1024 * 1000 * 5

# number of files to upload using fineuploader at once
UPLOAD_MAX_FILES_NUMBER = 100
CONCURRENT_UPLOADS = True
CHUNKS_DONE_PARAM_NAME = "done"
FILE_STORAGE = "django.core.files.storage.DefaultStorage"


# valid options: content, author
RELATED_MEDIA_STRATEGY = "content"

# These are passed on every request
LOAD_FROM_CDN = True  # if set to False will not fetch external content
LOGIN_ALLOWED = True  # whether the login button appears
REGISTER_ALLOWED = True  # whether the register button appears
UPLOAD_MEDIA_ALLOWED = True  # whether the upload media button appears
CAN_LIKE_MEDIA = True  # whether the like media appears
CAN_DISLIKE_MEDIA = True  # whether the dislike media appears
CAN_REPORT_MEDIA = True  # whether the report media appears
CAN_SHARE_MEDIA = True  # whether the share media appears

# experimental functionality for user ratings
ALLOW_RATINGS = False
ALLOW_RATINGS_CONFIRMED_EMAIL_ONLY = False

X_FRAME_OPTIONS = "ALLOWALL"
EMAIL_BACKEND = "djcelery_email.backends.CeleryEmailBackend"
CELERY_EMAIL_TASK_CONFIG = {
    "queue": "short_tasks",
}

PRE_UPLOAD_MEDIA_MESSAGE = ""

POST_UPLOAD_AUTHOR_MESSAGE_UNLISTED_NO_COMMENTARY = ""
# a message to be shown on the author of a media file and only
# only in case where unlisted workflow is used and no commentary
# exists

CANNOT_ADD_MEDIA_MESSAGE = ""


# settings specific to unlisted workflow
UNLISTED_WORKFLOW_MAKE_PUBLIC_UPON_COMMENTARY_ADD = False
UNLISTED_WORKFLOW_MAKE_PRIVATE_UPON_COMMENTARY_DELETE = False

MP4HLS_COMMAND = (
    "/home/cinemata/cinematacms/Bento4-SDK-1-6-0-632.x86_64-unknown-linux/bin/mp4hls"
)


DEBUG = False

DEFAULT_FROM_EMAIL = "info@mediacms.io"
EMAIL_HOST_PASSWORD = "xyz"
EMAIL_HOST_USER = "info@mediacms.io"
EMAIL_USE_TLS = True
SERVER_EMAIL = DEFAULT_FROM_EMAIL
EMAIL_HOST = "mediacms.io"
EMAIL_PORT = 587
ADMIN_EMAIL_LIST = ["info@mediacms.io"]

TINYMCE_DEFAULT_CONFIG = {
    "theme": "silver",
    "height": 500,
    "resize": "both",
    "menubar": "file edit view insert format tools table help",
    "menu": {
        "format": {
            "title": "Format",
            "items": "blocks | bold italic underline strikethrough superscript subscript code | "
            "fontfamily fontsize align lineheight | "
            "forecolor backcolor removeformat",
        },
    },
    "plugins": "advlist,autolink,autosave,lists,link,image,charmap,print,preview,anchor,"
    "searchreplace,visualblocks,code,fullscreen,insertdatetime,media,table,paste,directionality,"
    "code,help,wordcount,emoticons,file,image,media",
    "toolbar": "undo redo | code preview | blocks | "
    "bold italic | alignleft aligncenter "
    "alignright alignjustify ltr rtl | bullist numlist outdent indent | "
    "removeformat | restoredraft help | image media",
    "branding": False,  # remove branding
    "promotion": False,  # remove promotion
    "content_css": "/static/lib/tinymce/tinymce_editor.css",  # extra css to load on the body of the editor
    "body_class": "page-main-inner custom-page-wrapper",  # class of the body element in tinymce
    "block_formats": "Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3;",
    "formats": {  # customize h2 to always have emphasis-large class
        "h2": {"block": "h2", "classes": "emphasis-large"},
    },
    "font_family_formats": (
        "Amulya='Amulya',sans-serif;Facultad='Facultad',sans-serif;"
    ),
    "font_css": "/static/lib/Amulya/amulya.css,/static/lib/Facultad/Facultad-Regular.css",
    "font_size_formats": "16px 18px 24px 32px",
    "images_upload_url": "/tinymce/upload/",
    "images_upload_handler": "tinymce.views.upload_image",
    "automatic_uploads": True,
    "file_picker_types": "image",
    "paste_data_images": True,
    "paste_as_text": False,
    "paste_enable_default_filters": True,
    "paste_word_valid_elements": "b,strong,i,em,h1,h2,h3,h4,h5,h6,p,br,a,ul,ol,li",
    "paste_retain_style_properties": "all",
    "paste_remove_styles": False,
    "paste_merge_formats": True,
    "sandbox_iframes": False,
}

# settings that are related with UX/appearance
# whether a featured item appears enlarged with player on index page
VIDEO_PLAYER_FEATURED_VIDEO_ON_INDEX_PAGE = False

# Video UI/UX settings
USE_ROUNDED_CORNERS = True  # Default: rounded corners enabled

# allow option to override the default admin url
DJANGO_ADMIN_URL = "admin/"

# additional MFA-permission configs
MFA_REQUIRED_ROLES = ['superuser']
MFA_ENFORCE_ON_PATHS = [f'/{DJANGO_ADMIN_URL}']
MFA_EXCLUDE_PATHS = ['/fu/', '/api/', '/manage/', '/accounts/']

WHISPER_CPP_DIR, WHISPER_CPP_COMMAND, WHISPER_CPP_MODEL = get_whisper_cpp_paths()
from .local_settings import *
ALLOWED_HOSTS.append(FRONTEND_HOST.replace("http://", "").replace("https://", ""))
WHISPER_SIZE = "base"

ALLOWED_MEDIA_UPLOAD_TYPES = ['video']

RECAPTCHA_PRIVATE_KEY = ""
RECAPTCHA_PUBLIC_KEY = ""
