import json
import logging
import os
import random
import re
import tempfile
import time
import uuid

import m3u8
from django.conf import settings
from django.contrib.postgres.indexes import BrinIndex, BTreeIndex, GinIndex
from django.contrib.postgres.search import SearchVectorField
from django.core.files import File
from django.db import connection, models
from django.db.models.signals import m2m_changed, post_delete, post_save, pre_delete
from django.dispatch import receiver
from django.template.defaultfilters import slugify
from django.urls import reverse
from django.utils import timezone
from django.utils.functional import cached_property
from django.utils.html import strip_tags
from imagekit.models import ProcessedImageField
from imagekit.processors import ResizeToFit
from mptt.models import MPTTModel, TreeForeignKey

from . import helpers, lists
from .methods import is_mediacms_editor, is_mediacms_manager, notify_users, is_media_allowed_type
from .stop_words import STOP_WORDS

logger = logging.getLogger(__name__)

RE_TIMECODE = re.compile(r"(\d+:\d+:\d+.\d+)")

# the final state of a media, and also encoded medias
MEDIA_ENCODING_STATUS = (
    ("pending", "Pending"),
    ("running", "Running"),
    ("fail", "Fail"),
    ("success", "Success"),
)

# this is set by default according to the portal workflow
MEDIA_STATES = (
    ("private", "Private"),
    ("public", "Public"),
    ("restricted", "Restricted"),
    ("unlisted", "Unlisted"),
)

MEDIA_TYPES_SUPPORTED = (
    ("video", "Video"),
    ("image", "Image"),
    ("pdf", "Pdf"),
    ("audio", "Audio"),
)

ENCODE_EXTENSIONS = (
    ("mp4", "mp4"),
    ("webm", "webm"),
    ("gif", "gif"),
)

ENCODE_RESOLUTIONS = (
    (2160, "2160"),
    (1440, "1440"),
    (1080, "1080"),
    (720, "720"),
    (480, "480"),
    (360, "360"),
    (240, "240"),
)

CODECS = (
    ("h265", "h265"),
    ("h264", "h264"),
    ("vp9", "vp9"),
)

ENCODE_EXTENSIONS_KEYS = [extension for extension, name in ENCODE_EXTENSIONS]
ENCODE_RESOLUTIONS_KEYS = [resolution for resolution, name in ENCODE_RESOLUTIONS]


def original_media_file_path(instance, filename):
    file_name = "{0}.{1}".format(instance.uid.hex, helpers.get_file_name(filename))
    return settings.MEDIA_UPLOAD_DIR + "user/{0}/{1}".format(
        instance.user.username, file_name
    )


def encoding_media_file_path(instance, filename):
    file_name = "{0}.{1}".format(
        instance.media.uid.hex, helpers.get_file_name(filename)
    )
    return settings.MEDIA_ENCODING_DIR + "{0}/{1}/{2}".format(
        instance.profile.id, instance.media.user.username, file_name
    )


def original_thumbnail_file_path(instance, filename):
    return settings.THUMBNAIL_UPLOAD_DIR + "user/{0}/{1}".format(
        instance.user.username, filename
    )


def subtitles_file_path(instance, filename):
    return settings.SUBTITLES_UPLOAD_DIR + "user/{0}/{1}".format(
        instance.media.user.username, filename
    )


def category_thumb_path(instance, filename):
    file_name = "{0}.{1}".format(instance.uid.hex, helpers.get_file_name(filename))
    return settings.MEDIA_UPLOAD_DIR + "categories/{0}".format(file_name)


def topic_thumb_path(instance, filename):
    friendly_token = helpers.produce_friendly_token()

    file_name = "{0}.{1}".format(friendly_token, helpers.get_file_name(filename))
    return settings.MEDIA_UPLOAD_DIR + "topics/{0}".format(file_name)


class Media(models.Model):
    uid = models.UUIDField(unique=True, default=uuid.uuid4)
    friendly_token = models.CharField(blank=True, max_length=12, db_index=True)
    title = models.CharField(max_length=100, blank=True, db_index=True)
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, db_index=True)
    category = models.ManyToManyField("Category", blank=True)
    topics = models.ManyToManyField("Topic", blank=True)
    tags = models.ManyToManyField(
        "Tag", blank=True, help_text="select one or more out of the existing tags"
    )
    channel = models.ForeignKey(
        "users.Channel", on_delete=models.CASCADE, db_index=True, blank=True, null=True
    )

    description = models.TextField("More Information and Credits", blank=True)
    summary = models.TextField("Synopsis", help_text="Maximum 60 words")
    media_language = models.CharField(
        max_length=5,
        blank=True,
        null=True,
        default="en",
        choices=lists.video_languages,
        db_index=True,
    )
    media_country = models.CharField(
        max_length=5,
        blank=True,
        null=True,
        default="en",
        choices=lists.video_countries,
        db_index=True,
    )
    add_date = models.DateTimeField(
        "Published on", blank=True, null=True, db_index=True
    )
    edit_date = models.DateTimeField(auto_now=True)
    media_file = models.FileField(
        "media file", upload_to=original_media_file_path, max_length=500
    )
    thumbnail = ProcessedImageField(
        upload_to=original_thumbnail_file_path,
        processors=[ResizeToFit(width=344, height=None)],
        format="JPEG",
        options={"quality": 95},
        blank=True,
        max_length=500,
    )
    poster = ProcessedImageField(
        upload_to=original_thumbnail_file_path,
        processors=[ResizeToFit(width=1280, height=None)],
        format="JPEG",
        options={"quality": 95},
        blank=True,
        max_length=500,
    )

    uploaded_thumbnail = ProcessedImageField(
        upload_to=original_thumbnail_file_path,
        processors=[ResizeToFit(width=344, height=None)],
        format="JPEG",
        options={"quality": 85},
        blank=True,
        max_length=500,
    )
    uploaded_poster = ProcessedImageField(
        verbose_name="Upload image",
        help_text="Image will appear as poster",
        upload_to=original_thumbnail_file_path,
        processors=[ResizeToFit(width=720, height=None)],
        format="JPEG",
        options={"quality": 85},
        blank=True,
        max_length=500,
    )

    thumbnail_time = models.FloatField(
        blank=True,
        null=True,
        help_text="Time on video file that a thumbnail will be taken",
    )
    sprites = models.FileField(
        upload_to=original_thumbnail_file_path, blank=True, max_length=500
    )
    duration = models.IntegerField(default=0)
    views = models.IntegerField(default=1)
    likes = models.IntegerField(default=1)
    dislikes = models.IntegerField(default=0)
    reported_times = models.IntegerField(default=0)

    state = models.CharField(
        max_length=20,
        choices=MEDIA_STATES,
        default=helpers.get_portal_workflow(),
        db_index=True,
    )
    is_reviewed = models.BooleanField(
        "Reviewed",
        default=settings.MEDIA_IS_REVIEWED,
        db_index=True,
        help_text="Only reviewed films will appear in public listings.",
    )
    encoding_status = models.CharField(
        max_length=20, choices=MEDIA_ENCODING_STATUS, default="pending", db_index=True
    )
    featured = models.BooleanField(
        default=False,
        db_index=True,
        help_text="Videos to be featured on the homepage should have the publishing state set to 'Public' and the most recent publishing date.",
    )
    user_featured = models.BooleanField(
        default=False, db_index=True, help_text="Featured by the user"
    )

    media_type = models.CharField(
        max_length=20,
        blank=True,
        choices=MEDIA_TYPES_SUPPORTED,
        db_index=True,
        default="video",
    )

    media_info = models.TextField(blank=True, help_text="automatically extracted info")
    video_height = models.IntegerField(default=1)
    md5sum = models.CharField(max_length=50, blank=True, null=True)
    size = models.CharField(max_length=20, blank=True, null=True)

    # set this here, so we don't perform extra query for it on media listing
    preview_file_path = models.CharField(max_length=501, blank=True)
    password = models.CharField(
        max_length=100, blank=True, help_text="when video is in restricted state"
    )
    enable_comments = models.BooleanField(
        default=True, help_text="Whether comments will be allowed for this media"
    )
    search = SearchVectorField(null=True)
    license = models.ForeignKey(
        "License", on_delete=models.SET_NULL, db_index=True, blank=True, null=True
    )
    existing_urls = models.ManyToManyField(
        "ExistingURL",
        blank=True,
        help_text="In case existing URLs of media exist, for use in migrations",
    )

    hls_file = models.CharField(max_length=1000, blank=True)
    # keep track if media file has changed
    company = models.CharField(
        "Production Company", max_length=300, blank=True, null=True
    )
    website = models.CharField("Website", max_length=300, blank=True, null=True)
    allow_download = models.BooleanField(
        default=True, help_text="Whether the  original media file can be downloaded"
    )
    year_produced = models.IntegerField(
        help_text="Year media was produced", blank=True, null=True
    )
    allow_whisper_transcribe = models.BooleanField(
        "Transcribe auto-detected language", default=False
    )
    allow_whisper_transcribe_and_translate = models.BooleanField(
        "Translate to English", default=False
    )

    __original_media_file = None
    __original_thumbnail_time = None
    __original_uploaded_poster = None

    class Meta:
        ordering = ["-add_date"]
        verbose_name_plural = "Media"
        indexes = [
            models.Index(fields=["state", "encoding_status", "is_reviewed"]),
            models.Index(fields=["state", "encoding_status", "is_reviewed", "title"]),
            models.Index(fields=["state", "encoding_status", "is_reviewed", "user"]),
            models.Index(fields=["views", "likes"]),
            GinIndex(fields=["search"]),
        ]

    def __str__(self):
        return self.title

    def __init__(self, *args, **kwargs):
        super(Media, self).__init__(*args, **kwargs)
        self.__original_media_file = self.media_file
        self.__original_thumbnail_time = self.thumbnail_time
        self.__original_uploaded_poster = self.uploaded_poster

    def save(self, *args, **kwargs):
        if not self.title:
            self.title = self.media_file.path.split("/")[-1]
        strip_text_items = ["title", "summary", "description"]
        for item in strip_text_items:
            setattr(self, item, strip_tags(getattr(self, item, None)))
        self.title = self.title[:99]
        if self.thumbnail_time:
            self.thumbnail_time = round(self.thumbnail_time, 1)

        if not self.add_date:
            self.add_date = timezone.now()
        if not self.friendly_token:
            while True:
                friendly_token = helpers.produce_friendly_token()
                if not Media.objects.filter(friendly_token=friendly_token):
                    self.friendly_token = friendly_token
                    break

        # TODO: regarding state. Allow a few transitions only
        # taking under consideration settings.PORTAL_WORKFLOW

        # media_file path is not set correctly until mode is saved
        # post_save signal will take care of calling a few functions
        # once model is saved
        if self.pk:
            if self.media_file != self.__original_media_file:
                self.__original_media_file = self.media_file
                # let the file get saved through post_save signal, and then
                # run media_init on it
                from . import tasks

                tasks.media_init.apply_async(args=[self.friendly_token], countdown=5)

            if self.thumbnail_time != self.__original_thumbnail_time:
                self.__original_thumbnail_time = self.thumbnail_time
                self.set_thumbnail(force=True)
        else:
            self.state = helpers.get_default_state(user=self.user)
            self.license = License.objects.filter(id=10).first()
        super(Media, self).save(*args, **kwargs)

        # has to save first for uploaded_poster path to exist
        if (
            self.uploaded_poster
            and self.uploaded_poster != self.__original_uploaded_poster
        ):
            with open(self.uploaded_poster.path, "rb") as f:
                self.__original_uploaded_poster = self.uploaded_poster
                myfile = File(f)
                thumbnail_name = helpers.get_file_name(self.uploaded_poster.path)
                self.uploaded_thumbnail.save(content=myfile, name=thumbnail_name)

    def transcribe_function(self):
        can_transcribe = False
        can_transcribe_and_translate = False
        if self.allow_whisper_transcribe or self.allow_whisper_transcribe_and_translate:
            if self.allow_whisper_transcribe_and_translate:
                if not TranscriptionRequest.objects.filter(
                    media=self, translate_to_english=True
                ).exists():
                    can_transcribe_and_translate = True

            if self.allow_whisper_transcribe:
                if not TranscriptionRequest.objects.filter(
                    media=self, translate_to_english=False
                ).exists():
                    can_transcribe = True

            from . import tasks

            if can_transcribe:
                tasks.whisper_transcribe.delay(self.friendly_token)
            if can_transcribe_and_translate:
                tasks.whisper_transcribe.delay(self.friendly_token, translate=True)

    def update_search_vector(self):
        """
        Update SearchVector field of SearchModel using raw SQL
        :return:
        """
        db_table = self._meta.db_table

        # get the text for current SearchModel instance
        # that we are going to convert to tsvector
        if self.id:
            a_tags = " ".join([tag.title for tag in self.tags.all()])
            b_tags = " ".join([tag.title.replace("-", " ") for tag in self.tags.all()])
        else:
            a_tags = ""
            b_tags = ""

        items = [
            self.title,
            self.user.username,
            self.user.email,
            self.user.name,
            self.description,
            self.summary,
            a_tags,
            self.media_language,
            self.media_country,
            self.website,
            self.company,
            b_tags,
        ]
        items = [item for item in items if item]
        text = " ".join(items)
        text = " ".join(
            [token for token in text.lower().split(" ") if token not in STOP_WORDS]
        )

        text = helpers.clean_query(text)

        sql_code = """
            UPDATE {db_table} SET search = to_tsvector(
                '{config}', '{text}'
            ) WHERE {db_table}.id = {id}
            """.format(
            db_table=db_table, config="simple", text=text, id=self.id
        )
        try:
            with connection.cursor() as cursor:
                cursor.execute(sql_code)
        except:
            pass  # TODO:add log
        return True

    def media_init(self):
        # new media file uploaded. Check if media type,
        # video duration, thumbnail etc. Re-encode
        self.set_media_type()
        if not is_media_allowed_type(self):
            helpers.rm_file(self.media_file.path)
            if self.state == "public":
                self.state = "unlisted"
                self.save(update_fields=["state"])
            return False
        if self.media_type == "video":
            try:
                self.set_thumbnail(force=True)
            except:
                print("something bad just happened1")
            self.encode()
            self.produce_sprite_from_video()
        elif self.media_type == "image":
            try:
                self.set_thumbnail(force=True)
            except:
                print("something bad just happened2")
        return True

    def set_media_type(self, save=True):
        # ffprobe considers as videos images/text
        # will try with filetype lib first
        kind = helpers.get_file_type(self.media_file.path)
        if kind is not None:
            if kind == "image":
                self.media_type = "image"
            elif kind == "pdf":
                self.media_type = "pdf"
            elif kind == "audio":
                self.media_type = "audio"
            else:
                self.media_type = "video"

        if self.media_type in ["image", "pdf"]:
            self.encoding_status = "success"
        else:
            ret = helpers.media_file_info(self.media_file.path)
            if ret.get("fail"):
                self.media_type = ""
                self.encoding_status = "fail"
            elif ret.get("is_video") or ret.get("is_audio"):
                try:
                    self.media_info = json.dumps(ret)
                except TypeError:
                    self.media_info = ""
                self.md5sum = ret.get("md5sum")
                self.size = helpers.show_file_size(ret.get("file_size"))
            else:
                self.media_type = ""
                self.encoding_status = "fail"

            if ret.get("is_video"):
                self.media_type = "video"
                self.duration = int(round(float(ret.get("video_duration", 0))))
                self.video_height = int(ret.get("video_height"))
            elif ret.get("is_audio"):
                self.media_type = "audio"
                self.duration = int(float(ret.get("audio_info", {}).get("duration", 0)))
                self.encoding_status = "success"

        if save:
            self.save(
                update_fields=[
                    "media_type",
                    "duration",
                    "media_info",
                    "video_height",
                    "size",
                    "md5sum",
                    "encoding_status",
                ]
            )
        return True

    def set_thumbnail(self, force=False):
        if force or (not self.thumbnail):
            if self.media_type == "video":
                self.produce_thumbnails_from_video()
            if self.media_type == "image":
                with open(self.media_file.path, "rb") as f:
                    myfile = File(f)
                    thumbnail_name = (
                        helpers.get_file_name(self.media_file.path) + ".jpg"
                    )
                    self.thumbnail.save(content=myfile, name=thumbnail_name)
                    self.poster.save(content=myfile, name=thumbnail_name)
        return True

    def produce_thumbnails_from_video(self):
        if not self.media_type == "video":
            return False

        if self.thumbnail_time and 0 <= self.thumbnail_time < self.duration:
            thumbnail_time = self.thumbnail_time
        else:
            thumbnail_time = round(random.uniform(0, self.duration - 0.1), 1)
            self.thumbnail_time = thumbnail_time  # so that it gets saved

        tf = helpers.create_temp_file(suffix=".jpg")
        command = [
            settings.FFMPEG_COMMAND,
            "-ss",
            str(
                thumbnail_time
            ),  # -ss need to be firt here otherwise time taken is huge
            "-i",
            self.media_file.path,
            "-vframes",
            "1",
            "-y",
            tf,
        ]
        ret = helpers.run_command(command)

        if os.path.exists(tf) and helpers.get_file_type(tf) == "image":
            with open(tf, "rb") as f:
                myfile = File(f)
                thumbnail_name = helpers.get_file_name(self.media_file.path) + ".jpg"
                self.thumbnail.save(content=myfile, name=thumbnail_name)
                self.poster.save(content=myfile, name=thumbnail_name)
        helpers.rm_file(tf)
        return True

    def produce_sprite_from_video(self):
        from . import tasks

        tasks.produce_sprite_from_video.delay(self.friendly_token)
        return True

    def encode(self, profiles=[], force=True, chunkize=True):
        if not profiles:
            profiles = EncodeProfile.objects.filter(active=True)
        profiles = list(profiles)

        from . import tasks

        if self.duration > settings.CHUNKIZE_VIDEO_DURATION and chunkize:
            for profile in profiles:
                if profile.extension == "gif":
                    profiles.remove(profile)
                    encoding = Encoding(media=self, profile=profile)
                    encoding.save()
                    enc_url = settings.SSL_FRONTEND_HOST + encoding.get_absolute_url()
                    tasks.encode_media.apply_async(
                        args=[self.friendly_token, profile.id, encoding.id, enc_url],
                        kwargs={"force": force},
                        priority=0,
                    )
            profiles = [p.id for p in profiles]
            tasks.chunkize_media.delay(self.friendly_token, profiles, force=force)
        else:
            for profile in profiles:
                if profile.extension != "gif":
                    if self.video_height and self.video_height < profile.resolution:
                        if (
                            not profile.resolution
                            in settings.MINIMUM_RESOLUTIONS_TO_ENCODE
                        ):
                            continue
                encoding = Encoding(media=self, profile=profile)
                encoding.save()
                enc_url = settings.SSL_FRONTEND_HOST + encoding.get_absolute_url()
                # priority!
                if profile.resolution in settings.MINIMUM_RESOLUTIONS_TO_ENCODE:
                    priority = 9
                else:
                    priority = 0
                tasks.encode_media.apply_async(
                    args=[self.friendly_token, profile.id, encoding.id, enc_url],
                    kwargs={"force": force},
                    priority=priority,
                )

        return True

    def post_encode_actions(self, encoding=None, action=None):
        # perform things after encode has run
        # (whether it has failed or succeeded)
        self.set_encoding_status()
        # set a preview url
        if encoding:
            if self.media_type == "video" and encoding.profile.extension == "gif":
                if action == "delete":
                    self.preview_file_path = ""
                else:
                    self.preview_file_path = encoding.media_file.path
                self.save(update_fields=["encoding_status", "preview_file_path"])

        self.save(update_fields=["encoding_status"])
        if (
            encoding
            and encoding.status == "success"
            and encoding.profile.codec == "h264"
            and action == "add"
        ):
            from . import tasks

            # TODO: check that this will not run many times in a row
            tasks.create_hls(self.friendly_token)

        return True

    def set_encoding_status(self):
        # set status. set success if at least 1mp4 exist
        # disregard a few encode profiles as preview
        mp4_statuses = set(
            encoding.status
            for encoding in self.encodings.filter(profile__extension="mp4", chunk=False)
        )

        if not mp4_statuses:
            # media is just created, profiles were not created yet
            encoding_status = "pending"
        elif "success" in mp4_statuses:
            encoding_status = "success"
        elif "running" in mp4_statuses:
            encoding_status = "running"
        else:
            encoding_status = "fail"
        self.encoding_status = encoding_status

        return True

    @property
    def encodings_info(self, full=False):
        ret = {}
        chunks_ret = {}
        if self.media_type not in ["video"]:
            return ret
        for key in ENCODE_RESOLUTIONS_KEYS:
            ret[key] = {}
        for encoding in self.encodings.select_related("profile").filter(chunk=False):
            if encoding.profile.extension == "gif":
                continue
            enc = self.get_encoding_info(encoding, full=full)
            resolution = encoding.profile.resolution
            ret[resolution][encoding.profile.codec] = enc

        # if a file is broken in chunks and they are being
        # encoded, the final encoding file won't appear until
        # they are finished. Thus, produce the info for these
        if full:
            extra = []
            for encoding in self.encodings.select_related("profile").filter(chunk=True):
                resolution = encoding.profile.resolution
                if not ret[resolution].get(encoding.profile.codec):
                    extra.append(encoding.profile.codec)
            for codec in extra:
                ret[resolution][codec] = {}
                v = self.encodings.filter(chunk=True, profile__codec=codec).values(
                    "progress"
                )
                ret[resolution][codec]["progress"] = (
                    sum([p["progress"] for p in v]) / v.count()
                )
                # TODO; status/logs/errors
        return ret

    def get_encoding_info(self, encoding, full=False):
        ep = {}
        ep["title"] = encoding.profile.name
        ep["url"] = encoding.media_encoding_url
        ep["progress"] = encoding.progress
        if full:
            ep["logs"] = encoding.logs
            ep["worker"] = encoding.worker
            ep["retries"] = encoding.retries
            if encoding.total_run_time:
                ep["total_run_time"] = encoding.total_run_time
            if encoding.commands:
                ep["commands"] = encoding.commands
            ep["time_started"] = encoding.add_date
            ep["updated_time"] = encoding.update_date
        ep["size"] = encoding.size
        ep["encoding_id"] = encoding.id
        ep["status"] = encoding.status
        return ep

    @property
    def categories_info(self):
        ret = []
        for cat in self.category.all():
            ret.append({"title": cat.title, "url": cat.get_absolute_url()})
        return ret

    @property
    def topics_info(self):
        ret = []
        for topic in self.topics.all():
            ret.append({"title": topic.title, "url": topic.get_absolute_url()})
        return ret

    @property
    def tags_info(self):
        ret = []
        for tag in self.tags.all():
            ret.append({"title": tag.title, "url": tag.get_absolute_url()})
        return ret

    @property
    def license_info(self):
        ret = {}
        if self.license:
            ret["title"] = self.license.title
            ret["url"] = self.license.url
            ret["thumbnail"] = self.license.thumbnail_path
        return ret

    @property
    def media_country_info(self):
        ret = []
        country = (
            dict(lists.video_countries).get(self.media_country, None)
            if self.media_country
            else None
        )
        if country:
            ret = [
                {
                    "title": country,
                    "url": reverse("search") + "?country={0}".format(country),
                }
            ]
        return ret

    @property
    def media_language_info(self):
        ret = []
        media_language = (
            dict(lists.video_languages).get(self.media_language, None)
            if self.media_language
            else None
        )
        if media_language:
            ret = [
                {
                    "title": media_language,
                    "url": reverse("search") + "?language={0}".format(media_language),
                }
            ]
        return ret

    @cached_property
    def media_version(self):
        """Get media version based on edit_date timestamp for URL versioning"""
        if self.edit_date:
            return int(self.edit_date.timestamp())
        # Fallback to add_date if edit_date is not available
        if self.add_date:
            return int(self.add_date.timestamp())
        # Final fallback: use hash of uid to ensure uniqueness
        return hash(str(self.uid)) & 0x7FFFFFFF  # Ensure positive 32-bit integer

    @property
    def original_media_url(self):
        if settings.SHOW_ORIGINAL_MEDIA:
            base_url = helpers.url_from_path(self.media_file.path)
            return helpers.build_versioned_url(base_url, self.media_version)
        else:
            return None

    @property
    def thumbnail_url(self):
        if self.uploaded_thumbnail:
            base_url = helpers.url_from_path(self.uploaded_thumbnail.path)
            return helpers.build_versioned_url(base_url, self.media_version)
        if self.thumbnail:
            base_url = helpers.url_from_path(self.thumbnail.path)
            return helpers.build_versioned_url(base_url, self.media_version)
        return None

    @property
    def poster_url(self):
        if self.uploaded_poster:
            base_url = helpers.url_from_path(self.uploaded_poster.path)
            return helpers.build_versioned_url(base_url, self.media_version)
        if self.poster:
            base_url = helpers.url_from_path(self.poster.path)
            return helpers.build_versioned_url(base_url, self.media_version)
        return None

    @property
    def subtitles_info(self):
        ret = []
        for subtitle in self.subtitles.all():
            base_url = helpers.url_from_path(subtitle.subtitle_file.path)
            ret.append(
                {
                    "src": helpers.build_versioned_url(base_url, self.media_version),
                    "srclang": subtitle.language.code,
                    "label": subtitle.language.title,
                }
            )
        return ret

    @property
    def sprites_url(self):
        if self.sprites:
            base_url = helpers.url_from_path(self.sprites.path)
            return helpers.build_versioned_url(base_url, self.media_version)
        return None

    @property
    def preview_url(self):
        if self.preview_file_path:
            base_url = helpers.url_from_path(self.preview_file_path)
            return helpers.build_versioned_url(base_url, self.media_version)
        # get preview_file out of the encodings, since some times preview_file_path
        # is empty but there is the gif encoding!
        preview_media = self.encodings.filter(profile__extension="gif").first()
        if preview_media and preview_media.media_file:
            base_url = helpers.url_from_path(preview_media.media_file.path)
            return helpers.build_versioned_url(base_url, self.media_version)
        return None

    @property
    def hls_info(self):
        res = {}
        if self.hls_file:
            if os.path.exists(self.hls_file):
                hls_file = self.hls_file
                p = os.path.dirname(hls_file)
                m3u8_obj = m3u8.load(hls_file)
                if os.path.exists(hls_file):
                    base_url = helpers.url_from_path(hls_file)
                    res["master_file"] = helpers.build_versioned_url(base_url, self.media_version)
                    for iframe_playlist in m3u8_obj.iframe_playlists:
                        uri = os.path.join(p, iframe_playlist.uri)
                        if os.path.exists(uri):
                            resolution = iframe_playlist.iframe_stream_info.resolution[
                                1
                            ]
                            base_url = helpers.url_from_path(uri)
                            res["{}_iframe".format(resolution)] = helpers.build_versioned_url(base_url, self.media_version)
                    for playlist in m3u8_obj.playlists:
                        uri = os.path.join(p, playlist.uri)
                        if os.path.exists(uri):
                            resolution = playlist.stream_info.resolution[1]
                            base_url = helpers.url_from_path(uri)
                            res[
                                "{}_playlist".format(resolution)
                            ] = helpers.build_versioned_url(base_url, self.media_version)
        return res

    @property
    def author_name(self):
        return self.user.name

    @property
    def author_username(self):
        return self.user.username

    def author_profile(self):
        return self.user.get_absolute_url()

    def author_thumbnail(self):
        return helpers.url_from_path(self.user.logo.path)

    def get_absolute_url(self, api=False, edit=False):
        if edit:
            return reverse("edit_media") + "?m={0}".format(self.friendly_token)
        if api:
            return reverse(
                "api_get_media", kwargs={"friendly_token": self.friendly_token}
            )
        else:
            return reverse("get_media") + "?m={0}".format(self.friendly_token)

    @property
    def edit_url(self):
        return self.get_absolute_url(edit=True)

    @property
    def add_subtitle_url(self):
        return "/add_subtitle?m=%s" % self.friendly_token

    @property
    def ratings_info(self):
        # to be used if user ratings are allowed
        ret = []
        if not settings.ALLOW_RATINGS:
            return []
        for category in self.category.all():
            ratings = RatingCategory.objects.filter(category=category, enabled=True)
            if ratings:
                ratings_info = []
                for rating in ratings:
                    ratings_info.append(
                        {
                            "rating_category_id": rating.id,
                            "rating_category_name": rating.title,
                            "score": -1,
                            # default score, means no score. In case user has already
                            # rated for this media, it will be populated
                        }
                    )
                ret.append(
                    {
                        "category_id": category.id,
                        "category_title": category.title,
                        "ratings": ratings_info,
                    }
                )
        return ret


class License(models.Model):
    # License for media
    title = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    allow_commercial = models.CharField(
        max_length=10, blank=True, null=True, choices=lists.license_options
    )
    allow_modifications = models.CharField(
        max_length=10, blank=True, null=True, choices=lists.license_options
    )
    url = models.CharField("Url", max_length=300, blank=True, null=True)
    thumbnail_path = models.CharField(
        "Path for thumbnail", max_length=200, null=True, blank=True
    )

    def __str__(self):
        return self.title


class ExistingURL(models.Model):
    url = models.CharField(max_length=200, unique=True)

    def __str__(self):
        return self.url


class Category(models.Model):
    uid = models.UUIDField(unique=True, default=uuid.uuid4)
    add_date = models.DateTimeField(auto_now_add=True)
    title = models.CharField(max_length=100, unique=True, db_index=True)
    description = models.TextField(blank=True)
    user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, blank=True, null=True
    )
    is_global = models.BooleanField(default=False)
    media_count = models.IntegerField(default=0)  # save number of videos
    thumbnail = ProcessedImageField(
        upload_to=category_thumb_path,
        processors=[ResizeToFit(width=344, height=None)],
        format="JPEG",
        options={"quality": 85},
        blank=True,
    )
    listings_thumbnail = models.CharField(
        max_length=400, blank=True, null=True, help_text="Thumbnail to show on listings"
    )

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["title"]
        verbose_name_plural = "Categories"

    def get_absolute_url(self):
        return reverse("search") + "?c={0}".format(self.title)

    def update_category_media(self):
        self.media_count = Media.objects.filter(
            state="public", is_reviewed=True, encoding_status="success", category=self
        ).count()
        self.save(update_fields=["media_count"])
        return True

    @property
    def thumbnail_url(self):
        if self.thumbnail:
            return helpers.url_from_path(self.thumbnail.path)

        if self.listings_thumbnail:
            return self.listings_thumbnail
        media = (
            Media.objects.filter(category=self, state="public")
            .order_by("-views")
            .first()
        )
        if media:
            return media.thumbnail_url

        return None

    def save(self, *args, **kwargs):
        strip_text_items = ["title", "description"]
        for item in strip_text_items:
            setattr(self, item, strip_tags(getattr(self, item, None)))
        super(Category, self).save(*args, **kwargs)


class Topic(models.Model):
    add_date = models.DateTimeField(auto_now_add=True)
    title = models.CharField(max_length=100, unique=True, db_index=True)
    listings_thumbnail = models.CharField(
        max_length=400, blank=True, null=True, help_text="Thumbnail to show on listings"
    )
    media_count = models.IntegerField(default=0)  # save number of videos
    thumbnail = ProcessedImageField(
        upload_to=topic_thumb_path,
        processors=[ResizeToFit(width=344, height=None)],
        format="JPEG",
        options={"quality": 85},
        blank=True,
    )

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["title"]

    def get_absolute_url(self):
        return reverse("search") + "?topic={0}".format(self.title)

    @property
    def thumbnail_url(self):
        if self.thumbnail:
            return helpers.url_from_path(self.thumbnail.path)

        if self.listings_thumbnail:
            return self.listings_thumbnail

        return None

    def update_tag_media(self):
        self.media_count = Media.objects.filter(
            state="public", is_reviewed=True, topics=self
        ).count()
        self.save(update_fields=["media_count"])
        return True


class Tag(models.Model):
    title = models.CharField(max_length=100, unique=True, db_index=True)
    user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, blank=True, null=True
    )
    media_count = models.IntegerField(default=0)  # save number of videos
    listings_thumbnail = models.CharField(
        max_length=400, blank=True, null=True, help_text="Thumbnail to show on listings"
    )

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["title"]

    def get_absolute_url(self):
        return reverse("search") + "?t={0}".format(self.title)

    def update_tag_media(self):
        self.media_count = Media.objects.filter(
            state="public", is_reviewed=True, tags=self
        ).count()
        self.save(update_fields=["media_count"])
        return True

    def save(self, *args, **kwargs):
        self.title = slugify(self.title[:99])
        strip_text_items = ["title"]
        for item in strip_text_items:
            setattr(self, item, strip_tags(getattr(self, item, None)))
        super(Tag, self).save(*args, **kwargs)

    @property
    def thumbnail_url(self):
        if self.listings_thumbnail:
            return self.listings_thumbnail
        media = (
            Media.objects.filter(tags=self, state="public").order_by("-views").first()
        )
        if media:
            return media.thumbnail_url

        return None


class MediaLanguage(models.Model):
    # TODO: to replace lists.media_language!
    add_date = models.DateTimeField(auto_now_add=True)
    title = models.CharField(max_length=100, unique=True, db_index=True)
    listings_thumbnail = models.CharField(
        max_length=400, blank=True, null=True, help_text="Thumbnail to show on listings"
    )
    media_count = models.IntegerField(default=0)  # save number of videos

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["title"]

    def get_absolute_url(self):
        return reverse("search") + "?language={0}".format(self.title)

    @property
    def thumbnail_url(self):
        if self.listings_thumbnail:
            return self.listings_thumbnail
        return None

    def update_language_media(self):
        language = {
            value: key for key, value in dict(lists.video_languages).items()
        }.get(self.title)
        if language:
            self.media_count = Media.objects.filter(
                state="public", is_reviewed=True, media_language=language
            ).count()
        self.save(update_fields=["media_count"])
        return True


class MediaCountry(models.Model):
    # TODO: to replace lists.media_country!
    add_date = models.DateTimeField(auto_now_add=True)
    title = models.CharField(max_length=100, unique=True, db_index=True)
    listings_thumbnail = models.CharField(
        max_length=400, blank=True, null=True, help_text="Thumbnail to show on listings"
    )
    media_count = models.IntegerField(default=0)  # save number of videos

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["title"]

    def get_absolute_url(self):
        return reverse("search") + "?country={0}".format(self.title)

    @property
    def thumbnail_url(self):
        if self.listings_thumbnail:
            return self.listings_thumbnail
        return None

    def update_country_media(self):
        country = {
            value: key for key, value in dict(lists.video_countries).items()
        }.get(self.title)
        if country:
            self.media_count = Media.objects.filter(
                state="public", is_reviewed=True, media_country=country
            ).count()
        self.save(update_fields=["media_count"])
        return True


class EncodeProfile(models.Model):
    "Encode Profiles"
    name = models.CharField(max_length=90)
    extension = models.CharField(max_length=10, choices=ENCODE_EXTENSIONS)
    resolution = models.IntegerField(choices=ENCODE_RESOLUTIONS, blank=True, null=True)
    codec = models.CharField(max_length=10, choices=CODECS, blank=True, null=True)
    description = models.TextField(blank=True, help_text="description")
    active = models.BooleanField(default=True)

    def __str__(self):
        return self.name

    class Meta:
        ordering = ["resolution"]


class Encoding(models.Model):
    "Encoding Media Instances"
    logs = models.TextField(blank=True)
    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name="encodings")
    profile = models.ForeignKey(EncodeProfile, on_delete=models.CASCADE)
    status = models.CharField(
        max_length=20, choices=MEDIA_ENCODING_STATUS, default="pending"
    )
    media_file = models.FileField(
        "encoding file", upload_to=encoding_media_file_path, blank=True, max_length=500
    )
    progress = models.PositiveSmallIntegerField(default=0)
    add_date = models.DateTimeField(auto_now_add=True)
    update_date = models.DateTimeField(auto_now=True)
    temp_file = models.CharField(max_length=400, blank=True)
    task_id = models.CharField(max_length=100, blank=True)
    size = models.CharField(max_length=20, blank=True)
    commands = models.TextField(blank=True, help_text="commands run")
    total_run_time = models.IntegerField(default=0)
    retries = models.IntegerField(default=0)
    worker = models.CharField(max_length=100, blank=True)
    chunk = models.BooleanField(default=False, db_index=True, help_text="is chunk?")
    chunk_file_path = models.CharField(max_length=400, blank=True)
    chunks_info = models.TextField(blank=True)
    md5sum = models.CharField(max_length=50, blank=True, null=True)

    @property
    def media_encoding_url(self):
        if self.media_file:
            base_url = helpers.url_from_path(self.media_file.path)
            return helpers.build_versioned_url(base_url, self.media.media_version)
        return None

    @property
    def media_chunk_url(self):
        if self.chunk_file_path:
            base_url = helpers.url_from_path(self.chunk_file_path)
            return helpers.build_versioned_url(base_url, self.media.media_version)
        return None

    def save(self, *args, **kwargs):
        if self.media_file:
            cmd = ["stat", "-c", "%s", self.media_file.path]
            stdout = helpers.run_command(cmd).get("out")
            if stdout:
                size = int(stdout.strip())
                self.size = helpers.show_file_size(size)
        if self.chunk_file_path and not self.md5sum:
            cmd = ["md5sum", self.chunk_file_path]
            stdout = helpers.run_command(cmd).get("out")
            if stdout:
                md5sum = stdout.strip().split()[0]
                self.md5sum = md5sum

        super(Encoding, self).save(*args, **kwargs)

    def set_progress(self, progress, commit=True):
        if isinstance(progress, int):
            if 0 <= progress <= 100:
                self.progress = progress
                self.save(update_fields=["progress"])
                return True
        return False

    def __str__(self):
        return "{0}-{1}".format(self.profile.name, self.media.title)

    def get_absolute_url(self):
        return reverse("api_get_encoding", kwargs={"encoding_id": self.id})


class Language(models.Model):
    code = models.CharField(max_length=100, help_text="language code")
    title = models.CharField(max_length=100, help_text="language code")

    class Meta:
        ordering = ["title"]

    def __str__(self):
        return self.title


class Subtitle(models.Model):
    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name="subtitles")
    language = models.ForeignKey(Language, on_delete=models.CASCADE)
    subtitle_file = models.FileField(
        "Subtitle/CC file",
        help_text="File has to be WebVTT format",
        upload_to=subtitles_file_path,
        max_length=500,
    )
    user = models.ForeignKey("users.User", on_delete=models.CASCADE)

    class Meta:
        ordering = ["language__title"]

    def __str__(self):
        return "{0}-{1}".format(self.media.title, self.language.title)

    def get_absolute_url(self):
        return f"{reverse('edit_subtitle')}?id={self.id}"

    @property
    def url(self):
        return self.get_absolute_url()

    def convert_to_srt(self):
        input_path = self.subtitle_file.path
        with tempfile.TemporaryDirectory(dir=settings.TEMP_DIRECTORY) as tmpdirname:
            pysub = settings.PYSUBS_COMMAND

            cmd = [pysub, input_path, "--to", "vtt", "-o", tmpdirname]
            stdout = helpers.run_command(cmd)

            list_of_files = os.listdir(tmpdirname)
            if list_of_files:
                subtitles_file = os.path.join(tmpdirname, list_of_files[0])
                cmd = ["cp", subtitles_file, input_path]
                stdout = helpers.run_command(cmd)
            else:
                raise Exception("Could not convert to srt")
        return True


class RatingCategory(models.Model):
    """Rating Category
    Facilitate user ratings.
    One or more rating categories per Category can exist
    will be shown to the media if they are enabled
    """

    title = models.CharField(max_length=200, unique=True, db_index=True)
    description = models.TextField(blank=True)
    enabled = models.BooleanField(default=True)
    category = models.ForeignKey(Category, on_delete=models.CASCADE)

    class Meta:
        verbose_name_plural = "Rating Categories"

    def __str__(self):
        return "{0}, for category {1}".format(self.title, self.category.title)


class Rating(models.Model):
    """User Rating"""

    user = models.ForeignKey("users.User", on_delete=models.CASCADE)
    add_date = models.DateTimeField(auto_now_add=True)
    rating_category = models.ForeignKey(RatingCategory, on_delete=models.CASCADE)
    score = models.IntegerField()
    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name="ratings")

    class Meta:
        verbose_name_plural = "Ratings"
        indexes = [
            models.Index(fields=["user", "media"]),
        ]
        unique_together = ("user", "media", "rating_category")

    def __str__(self):
        return "{0}, rate for {1} for category {2}".format(
            self.user.username, self.media.title, self.rating_category.title
        )


class Playlist(models.Model):
    uid = models.UUIDField(unique=True, default=uuid.uuid4)
    title = models.CharField(max_length=90, db_index=True)
    description = models.TextField(blank=True, help_text="description")
    user = models.ForeignKey(
        "users.User", on_delete=models.CASCADE, db_index=True, related_name="playlists"
    )
    add_date = models.DateTimeField(auto_now_add=True, db_index=True)
    media = models.ManyToManyField(Media, through="playlistmedia", blank=True)
    friendly_token = models.CharField(blank=True, max_length=12)

    def __str__(self):
        return self.title

    @property
    def media_count(self):
        return self.media.count()

    def get_absolute_url(self, api=False):
        if api:
            return reverse(
                "api_get_playlist", kwargs={"friendly_token": self.friendly_token}
            )
        else:
            return reverse(
                "get_playlist", kwargs={"friendly_token": self.friendly_token}
            )

    @property
    def url(self):
        return self.get_absolute_url()

    @property
    def api_url(self):
        return self.get_absolute_url(api=True)

    def user_thumbnail_url(self):
        if self.user.logo:
            return helpers.url_from_path(self.user.logo.path)
        return None

    def set_ordering(self, media, ordering):
        if not media in self.media.all():
            return False
        pm = PlaylistMedia.objects.filter(playlist=self, media=media).first()
        if pm and isinstance(ordering, int) and 0 < ordering:
            pm.ordering = ordering
            pm.save()
            return True
        return False

    def save(self, *args, **kwargs):
        #        strip_text_items = ['title', 'description']
        #       for item in strip_text_items:
        #          setattr(self, item, strip_tags(getattr(self, item, None)))
        #     self.title = slugify(self.title[:89])
        if not self.friendly_token:
            while True:
                friendly_token = helpers.produce_friendly_token()
                if not Playlist.objects.filter(friendly_token=friendly_token):
                    self.friendly_token = friendly_token
                    break
        super(Playlist, self).save(*args, **kwargs)

    @property
    def thumbnail_url(self):
        pm = self.playlistmedia_set.first()
        if pm:
            # return helpers.url_from_path(pm.media.thumbnail.path)
            return pm.media.thumbnail_url
        return None

    class Meta:
        ordering = ["-add_date"]  # This will show newest playlists first

class PlaylistMedia(models.Model):
    media = models.ForeignKey(Media, on_delete=models.CASCADE)
    playlist = models.ForeignKey(Playlist, on_delete=models.CASCADE)
    ordering = models.IntegerField(default=1)
    action_date = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["ordering", "-action_date"]


class Comment(MPTTModel):
    uid = models.UUIDField(unique=True, default=uuid.uuid4)
    text = models.TextField(help_text="text")
    add_date = models.DateTimeField(auto_now_add=True)
    parent = TreeForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="children"
    )
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, db_index=True)
    media = models.ForeignKey(
        Media, on_delete=models.CASCADE, db_index=True, related_name="comments"
    )

    class MPTTMeta:
        order_insertion_by = ["add_date"]

    def __str__(self):
        return "On {0} by {1}".format(self.media.title, self.user.username)

    def save(self, *args, **kwargs):
        strip_text_items = ["text"]
        for item in strip_text_items:
            setattr(self, item, strip_tags(getattr(self, item, None)))
        if self.text:
            self.text = self.text[: settings.MAX_CHARS_FOR_COMMENT]
        super(Comment, self).save(*args, **kwargs)
        if settings.UNLISTED_WORKFLOW_MAKE_PUBLIC_UPON_COMMENTARY_ADD:
            if self.media.state == "unlisted":
                self.media.state = "public"
                self.media.save(update_fields=["state"])

    def get_absolute_url(self):
        return reverse("get_media") + "?m={0}".format(self.media.friendly_token)

    @property
    def media_url(self):
        return self.get_absolute_url()


class Page(models.Model):
    slug = models.SlugField(max_length=200, unique=True)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    add_date = models.DateTimeField(auto_now_add=True)
    edit_date = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        return reverse("get_page", args=[str(self.slug)])


class TopMessage(models.Model):
    # messages to appear on top of each page
    add_date = models.DateTimeField(auto_now_add=True)
    text = models.TextField("Text", help_text="add text or html")
    active = models.BooleanField(default=True)

    def __str__(self):
        return self.text

    class Meta:
        ordering = ["-add_date"]


class HomepagePopup(models.Model):
    text = models.TextField(
        "Pop-up name", blank=True, help_text="This will not appear on the pop-up"
    )

    popup = models.FileField(
        "popup",
        help_text="Only this image will appear on the pop-up. Ideal image size is 900 x 650 pixels",
        max_length=500,
    )

    url = models.CharField("URL", max_length=300)

    add_date = models.DateTimeField(auto_now_add=True)
    active = models.BooleanField(default=True)

    class Meta:
        ordering = ["-add_date"]
        verbose_name = "Homepage pop-up"
        verbose_name_plural = "Homepage pop-ups"

    def __str__(self):
        return self.text

    @property
    def popup_image_url(self):
        return helpers.url_from_path(self.popup.path)


class IndexPageFeatured(models.Model):
    # listings that will appear on index page
    title = models.CharField(max_length=200)
    api_url = models.CharField(
        "API URL",
        help_text="has to be link to API listing here, eg /api/v1/playlists/rwrVixsnW",
        max_length=300,
    )
    url = models.CharField(
        "Link",
        help_text="has to be the url to link on more, eg /view?m=Pz14Nbkc7&pl=rwrVixsnW",
        max_length=300,
    )
    active = models.BooleanField(default=True)
    ordering = models.IntegerField(
        default=1, help_text="ordering, 1 comes first, 2 follows etc"
    )
    text = models.TextField(help_text="text", blank=True, null=True)

    def __str__(self):
        return f"{self.title} - {self.url} - {self.ordering}"

    class Meta:
        ordering = ["ordering"]
        verbose_name = "Index page featured"
        verbose_name_plural = "Index page featured"


class TranscriptionRequest(models.Model):
    # helper model to assess whether a Whisper transcription request is already in place
    media = models.ForeignKey(
        Media, on_delete=models.CASCADE, related_name="transcriptionrequests"
    )
    add_date = models.DateTimeField(auto_now_add=True)
    translate_to_english = models.BooleanField(default=False)


class TinyMCEMedia(models.Model):
    file = models.FileField(upload_to='tinymce_media/')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    file_type = models.CharField(max_length=10, choices=(
        ('image', 'Image'),
        ('media', 'Media'),
    ))
    original_filename = models.CharField(max_length=255)
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, null=True, blank=True)

    class Meta:
        verbose_name = 'TinyMCE Media'
        verbose_name_plural = 'TinyMCE Media'
        ordering = ['-uploaded_at']

    def __str__(self):
        return f"{self.original_filename} ({self.file_type})"

    @property
    def url(self):
        return self.file.url


@receiver(post_save, sender=Media)
def media_save(sender, instance, created, **kwargs):
    # media_file path is not set correctly until mode is saved
    # post_save signal will take care of calling a few functions
    # once model is saved
    # SOS: do not put anything here, as if more logic is added,
    # we have to disconnect signal to avoid infinite recursion

    if created:
        instance.media_init()
        notify_users(friendly_token=instance.friendly_token, action="media_added")
    instance.user.update_user_media()
    if instance.category.all():
        # this won't catch when a category
        # is removed from a media, which is what we want...
        for category in instance.category.all():
            category.update_category_media()
    if instance.tags.all():
        for tag in instance.tags.all():
            tag.update_tag_media()
    if instance.topics.all():
        for topic in instance.topics.all():
            topic.update_tag_media()

    if instance.media_country:
        country = {
            key: value for key, value in dict(lists.video_countries).items()
        }.get(instance.media_country)
        if country:
            country = MediaCountry.objects.filter(title=country).first()
        if country:
            country.update_country_media()

    if instance.media_language:
        language = {
            key: value for key, value in dict(lists.video_languages).items()
        }.get(instance.media_language)
        if language:
            language = MediaLanguage.objects.filter(title=language).first()
        if language:
            language.update_language_media()

    instance.update_search_vector()
    instance.transcribe_function()


@receiver(pre_delete, sender=Media)
def media_file_pre_delete(sender, instance, **kwargs):
    if instance.category.all():
        for category in instance.category.all():
            instance.category.remove(category)
            category.update_category_media()
    if instance.tags.all():
        for tag in instance.tags.all():
            instance.tags.remove(tag)
            tag.update_tag_media()


@receiver(post_delete, sender=Media)
def media_file_delete(sender, instance, **kwargs):
    """
    Deletes file from filesystem
    when corresponding `Media` object is deleted.
    """
    if instance.media_file:
        helpers.rm_file(instance.media_file.path)
    if instance.thumbnail:
        helpers.rm_file(instance.thumbnail.path)
    if instance.uploaded_thumbnail:
        helpers.rm_file(instance.uploaded_thumbnail.path)
    if instance.uploaded_poster:
        helpers.rm_file(instance.uploaded_poster.path)
    if instance.uploaded_thumbnail:
        helpers.rm_file(instance.uploaded_thumbnail.path)
    if instance.uploaded_poster:
        helpers.rm_file(instance.uploaded_poster.path)
    if instance.poster:
        helpers.rm_file(instance.poster.path)
    if instance.sprites:
        helpers.rm_file(instance.sprites.path)
    if instance.hls_file:
        p = os.path.dirname(instance.hls_file)
        helpers.rm_dir(p)
    instance.user.update_user_media()


@receiver(m2m_changed, sender=Media.category.through)
def media_m2m(sender, instance, **kwargs):
    if instance.category.all():
        for category in instance.category.all():
            category.update_category_media()
    if instance.tags.all():
        for tag in instance.tags.all():
            tag.update_tag_media()


@receiver(post_save, sender=Encoding)
def encoding_file_save(sender, instance, created, **kwargs):
    if instance.chunk and instance.status == "success":
        # check if all chunks are OK
        # then concatenate to new Encoding - and remove chunks
        # this should run only once!
        # in this case means a encoded chunk is complete
        if instance.media_file:
            try:
                orig_chunks = json.loads(instance.chunks_info).keys()
            except:
                instance.delete()
                return False

            chunks = Encoding.objects.filter(
                media=instance.media,
                profile=instance.profile,
                chunks_info=instance.chunks_info,
                chunk=True,
            ).order_by("add_date")

            complete = True
            # perform validation, make sure everything is there
            for chunk in orig_chunks:
                if not chunks.filter(chunk_file_path=chunk):
                    complete = False
                    break

            for chunk in chunks:
                if not (chunk.media_file and chunk.media_file.path):
                    complete = False
                    break

            if complete:
                # this should run only once!
                chunks_paths = [f.media_file.path for f in chunks]

                with tempfile.TemporaryDirectory(
                    dir=settings.TEMP_DIRECTORY
                ) as temp_dir:
                    seg_file = helpers.create_temp_file(suffix=".txt", dir=temp_dir)
                    tf = helpers.create_temp_file(
                        suffix=".{0}".format(instance.profile.extension), dir=temp_dir
                    )
                    with open(seg_file, "w") as ff:
                        for f in chunks_paths:
                            ff.write("file {}\n".format(f))
                    cmd = [
                        settings.FFMPEG_COMMAND,
                        "-y",
                        "-f",
                        "concat",
                        "-safe",
                        "0",
                        "-i",
                        seg_file,
                        "-c",
                        "copy",
                        "-pix_fmt",
                        "yuv420p",
                        "-movflags",
                        "faststart",
                        tf,
                    ]
                    stdout = helpers.run_command(cmd)

                    encoding = Encoding(
                        media=instance.media,
                        profile=instance.profile,
                        status="success",
                        progress=100,
                    )
                    all_logs = "\n".join([st.logs for st in chunks])
                    encoding.logs = "{0}\n{1}\n{2}".format(
                        chunks_paths, stdout, all_logs
                    )
                    workers = list(set([st.worker for st in chunks]))
                    encoding.worker = json.dumps({"workers": workers})

                    start_date = min([st.add_date for st in chunks])
                    end_date = max([st.update_date for st in chunks])
                    encoding.total_run_time = (end_date - start_date).seconds
                    encoding.save()

                    with open(tf, "rb") as f:
                        myfile = File(f)
                        output_name = "{0}.{1}".format(
                            helpers.get_file_name(instance.media.media_file.path),
                            instance.profile.extension,
                        )
                        encoding.media_file.save(content=myfile, name=output_name)

                    # encoding is saved, deleting chunks
                    # and any other encoding that might exist
                    # first perform one last validation
                    # to avoid that this is run twice
                    if (
                        len(orig_chunks)
                        == Encoding.objects.filter(
                            media=instance.media,
                            profile=instance.profile,
                            chunks_info=instance.chunks_info,
                        ).count()
                    ):
                        # if two chunks are finished at the same time, this will be changed
                        who = Encoding.objects.filter(
                            media=encoding.media, profile=encoding.profile
                        ).exclude(id=encoding.id)
                        print(
                            "{0} Deleting".format(encoding.media.friendly_token),
                            [enco.id for enco in who],
                            encoding.id,
                        )
                        who.delete()
                    else:
                        print(
                            "Deleting myself",
                            chunks,
                            Encoding.objects.filter(
                                media=instance.media,
                                profile=instance.profile,
                                chunk=True,
                            ),
                            encoding.id,
                        )
                        encoding.delete()
                    if not Encoding.objects.filter(chunks_info=instance.chunks_info):
                        print("these workers have worked in total: %s" % workers)
                        # TODO: send to specific worker to delete file
                        # for worker in workers:
                        #    for chunk in json.loads(instance.chunks_info).keys():
                        #        remove_media_file.delay(media_file=chunk)
                        for chunk in json.loads(instance.chunks_info).keys():
                            print("deleting chunk: %s" % chunk)
                            helpers.rm_file(chunk)
                    instance.media.post_encode_actions(encoding=instance, action="add")

    elif instance.chunk and instance.status == "fail":
        encoding = Encoding(
            media=instance.media, profile=instance.profile, status="fail", progress=100
        )
        chunks = Encoding.objects.filter(
            media=instance.media, chunks_info=instance.chunks_info, chunk=True
        ).order_by("add_date")
        chunks_paths = [f.media_file.path for f in chunks]

        all_logs = "\n".join([st.logs for st in chunks])
        encoding.logs = "{0}\n{1}\n{2}".format(chunks_paths, all_logs)
        workers = list(set([st.worker for st in chunks]))
        encoding.worker = json.dumps({"workers": workers})
        start_date = min([st.add_date for st in chunks])
        end_date = max([st.update_date for st in chunks])
        encoding.total_run_time = (end_date - start_date).seconds
        encoding.save()

        who = Encoding.objects.filter(
            media=encoding.media, profile=encoding.profile
        ).exclude(id=encoding.id)
        print(
            "{0} deleting failed chunk".format(encoding.media.friendly_token),
            [enco.id for enco in who],
            encoding.id,
        )
        who.delete()
        pass  # TODO: merge with above if, do not repeat code
    else:
        if instance.status in ["fail", "success"]:
            instance.media.post_encode_actions(encoding=instance, action="add")

        encodings = set(
            [
                encoding.status
                for encoding in Encoding.objects.filter(media=instance.media)
            ]
        )
        if ("running" in encodings) or ("pending" in encodings):
            return
        workers = list(
            set(
                [
                    encoding.worker
                    for encoding in Encoding.objects.filter(media=instance.media)
                ]
            )
        )


# TODO: send to specific worker
# for worker in workers:
#     if worker != 'localhost':
#          remove_media_file.delay(media_file=instance.media.media_file.path)


@receiver(post_delete, sender=Encoding)
def encoding_file_delete(sender, instance, **kwargs):
    """
    Deletes file from filesystem
    when corresponding `Encoding` object is deleted.
    """
    if instance.media_file:
        helpers.rm_file(instance.media_file.path)
        if not instance.chunk:
            instance.media.post_encode_actions(encoding=instance, action="delete")
    # delete local chunks, and remote chunks + media file. Only when the
    # last encoding of a media is complete


@receiver(post_delete, sender=Comment)
def comment_delete(sender, instance, **kwargs):
    if instance.media.state == "public":
        if settings.UNLISTED_WORKFLOW_MAKE_PRIVATE_UPON_COMMENTARY_DELETE:
            if instance.media.comments.exclude(uid=instance.uid).count() == 0:
                instance.media.state = "unlisted"
                instance.media.save(update_fields=["state"])
