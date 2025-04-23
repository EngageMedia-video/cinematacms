import os

# PORTAL SETTINGS
PORTAL_NAME = "EngageMedia Video"  #  this is shown on several places, eg on contact email, or html title
LANGUAGE_CODE = "en-us"
TIME_ZONE = "Europe/London"
ALLOWED_HOSTS = ["*"]
INTERNAL_IPS = "127.0.0.1"
FRONTEND_HOST = "http://localhost:8000"
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
    "ckeditor",
    "captcha",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "debug_toolbar.middleware.DebugToolbarMiddleware",
    "allauth.account.middleware.AccountMiddleware",
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
        # Checks whether the password ’isnt entirely numeric
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
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": "cinemata_local.sqlite3",
    }
}


CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.filebased.FileBasedCache",
        "LOCATION": "django_cache",
    }
}

SESSION_ENGINE = "django.contrib.sessions.backends.cache"
SESSION_CACHE_ALIAS = "default"
USE_I18N = True
USE_L10N = True
USE_TZ = True
SITE_ID = 1

STATIC_URL = "/static/"  #  where js/css files are stored on the filesystem
MEDIA_ROOT = BASE_DIR + "/media_files/"  #  where uploaded + encoded media are stored
MEDIA_URL = "/media/"  #  URL where static files are served from the server
STATICFILES_DIRS = (os.path.join(BASE_DIR, "static/"),)

AUTH_USER_MODEL = "users.User"
LOGIN_REDIRECT_URL = "/"


# protection agains anonymous users
# per ip address limit, for actions as like/dislike/report
TIME_TO_ACTION_ANONYMOUS = 10 * 60

# django-allauth settings
ACCOUNT_SESSION_REMEMBER = True
ACCOUNT_AUTHENTICATION_METHOD = "username_email"
ACCOUNT_EMAIL_REQUIRED = True  #  new users need to specify email
ACCOUNT_EMAIL_VERIFICATION = "optional"  # 'mandatory' 'none'
ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION = True
ACCOUNT_USERNAME_MIN_LENGTH = "4"
ACCOUNT_ADAPTER = "users.adapter.MyAccountAdapter"
ACCOUNT_SIGNUP_FORM_CLASS = "users.forms.SignupForm"
ACCOUNT_USERNAME_VALIDATORS = "users.validators.custom_username_validators"
ACCOUNT_SIGNUP_PASSWORD_ENTER_TWICE = False
ACCOUNT_USERNAME_REQUIRED = True
ACCOUNT_LOGIN_ON_PASSWORD_RESET = True
ACCOUNT_EMAIL_CONFIRMATION_EXPIRE_DAYS = 1
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
}


SECRET_KEY = "2dii4cog7k=5n37$fz)8dst)kg(s3&10)^qa*gv(kk+nv-z&cu"
# mediacms related

# valid choices here are 'public', 'private', 'unlisted
PORTAL_WORKFLOW = "public"

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


DEFAULT_FROM_EMAIL = "info@mediacms.io"
EMAIL_HOST_PASSWORD = "xyz"
EMAIL_HOST_USER = "info@mediacms.io"
EMAIL_USE_TLS = True
SERVER_EMAIL = DEFAULT_FROM_EMAIL
EMAIL_HOST = "mediacms.io"
EMAIL_PORT = 587
ADMIN_EMAIL_LIST = ["info@mediacms.io"]

CKEDITOR_CONFIGS = {
    "default": {
        "toolbar": "Custom",
        "width": "100%",
        "toolbar_Custom": [
            ["Styles"],
            ["Format"],
            ["Bold", "Italic", "Underline"],
            ["HorizontalRule"],
            [
                "NumberedList",
                "BulletedList",
                "-",
                "Outdent",
                "Indent",
                "-",
                "JustifyLeft",
                "JustifyCenter",
                "JustifyRight",
                "JustifyBlock",
            ],
            ["Link", "Unlink"],
            ["Image"],
            ["RemoveFormat", "Source"],
        ],
        "allowedContent": True,
    },
    "extraAllowedContent": "ul(tick-list,box-list,box-list-half,box-list-third) p(emphasis,emphasis-large) span(board-member,box-icon-title,open-tech,video4change,research,skills-build) a(external-link)",
}

# settings that are related with UX/appearance
# whether a featured item appears enlarged with player on index page
VIDEO_PLAYER_FEATURED_VIDEO_ON_INDEX_PAGE = False

CELERY_BEAT_SCHEDULE = {}
CELERY_SOFT_TIME_LIMIT = 1
# TODO: add proper separation dev/prod/staging

DEBUG = False


CELERY_TASK_ALWAYS_EAGER = True
CELERY_ALWAYS_EAGER = True

# STATICFILES_STORAGE = "whitenoise.storage.CompressedStaticFilesStorage"
DEBUG = True
CORS_ORIGIN_ALLOW_ALL = True
INSTALLED_APPS.append("corsheaders")

PYSUBS_COMMAND = "pysubs2"

WHISPER_CPP_COMMAND = "/home/cinemata/whisper.cpp/build/bin/main"
WHISPER_CPP_MODEL = "/home/cinemata/whisper.cpp/models/ggml-large-v3.bin"

DJANGO_ADMIN_URL = "adminx/"
ALLOWED_MEDIA_UPLOAD_TYPES = ['video']

RECAPTCHA_PRIVATE_KEY = ''
RECAPTCHA_PUBLIC_KEY = ''
