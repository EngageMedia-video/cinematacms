import json
import logging
import os
import random
import re
import shutil
import tempfile
import uuid

import m3u8
from django.conf import settings
from django.contrib.postgres.search import SearchVectorField
from django.core.files import File
from django.db import connection, models
from django.db.models.signals import m2m_changed, post_delete, post_save, pre_delete
from django.dispatch import receiver
from django.template.defaultfilters import slugify
from django.urls import reverse
from django.utils import timezone
from django.utils.html import strip_tags
from imagekit.models import ProcessedImageField
from imagekit.processors import ResizeToFit
from mptt.models import MPTTModel, TreeForeignKey

from . import helpers, lists
from .methods import is_media_allowed_type, notify_users
from .stop_words import STOP_WORDS

logger = logging.getLogger(__name__)

RE_TIMECODE = re.compile(r"(\d+:\d+:\d+\.\d+)")

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

ENCODE_EXTENSIONS_KEYS = [extension for extension, _ in ENCODE_EXTENSIONS]
ENCODE_RESOLUTIONS_KEYS = [resolution for resolution, _ in ENCODE_RESOLUTIONS]


def original_media_file_path(instance, filename):
    file_name = f"{instance.uid.hex}.{helpers.get_file_name(filename)}"
    return settings.MEDIA_UPLOAD_DIR + f"user/{instance.user.username}/{file_name}"


def encoding_media_file_path(instance, filename):
    file_name = f"{instance.media.uid.hex}.{helpers.get_file_name(filename)}"
    return (
        settings.MEDIA_ENCODING_DIR
        + f"{instance.profile.id}/{instance.media.user.username}/{file_name}"
    )


def original_thumbnail_file_path(instance, filename):
    return settings.THUMBNAIL_UPLOAD_DIR + f"user/{instance.user.username}/{filename}"


def subtitles_file_path(instance, filename):
    return settings.SUBTITLES_UPLOAD_DIR + f"user/{instance.media.user.username}/{filename}"


def category_thumb_path(instance, filename):
    file_name = f"{instance.uid.hex}.{helpers.get_file_name(filename)}"
    return settings.MEDIA_UPLOAD_DIR + f"categories/{file_name}"


def topic_thumb_path(instance, filename):
    friendly_token = helpers.produce_friendly_token()
    file_name = f"{friendly_token}.{helpers.get_file_name(filename)}"
    return settings.MEDIA_UPLOAD_DIR + f"topics/{file_name}"


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
    add_date = models.DateTimeField("Published on", blank=True, null=True, db_index=True)
    edit_date = models.DateTimeField(auto_now=True)
    media_file = models.FileField("media file", upload_to=original_media_file_path, max_length=500)
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
        blank=True, null=True, help_text="Time on video file that a thumbnail will be taken"
    )
    sprites = models.FileField(upload_to=original_thumbnail_file_path, blank=True, max_length=500)
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
        help_text=(
            "Videos to be featured on the homepage should have the publishing state "
            "set to 'Public' and the most recent publishing date."
        ),
    )
    user_featured = models.BooleanField(default=False, db_index=True, help_text="Featured by the user")

    media_type = models.CharField(
        max_length=20, blank=True, choices=MEDIA_TYPES_SUPPORTED, db_index=True, default="video"
    )

    media_info = models.TextField(blank=True, help_text="automatically extracted info")
    video_height = models.IntegerField(default=1)
    md5sum = models.CharField(max_length=50, blank=True, null=True)
    size = models.CharField(max_length=20, blank=True, null=True)

    # set this here, so we don't perform extra query for it on media listing
    preview_file_path = models.CharField(max_length=501, blank=True)
    password = models.CharField(max_length=100, blank=True, help_text="when video is in restricted state")
    enable_comments = models.BooleanField(default=True, help_text="Whether comments will be allowed for this media")
    search = SearchVectorField(null=True)
    license = models.ForeignKey("License", on_delete=models.SET_NULL, db_index=True, blank=True, null=True)
    existing_urls = models.ManyToManyField(
        "ExistingURL",
        blank=True,
        help_text="In case existing URLs of media exist, for use in migrations",
    )

    hls_file = models.CharField(max_length=1000, blank=True)
    company = models.CharField("Production Company", max_length=300, blank=True, null=True)
    website = models.CharField("Website", max_length=300, blank=True, null=True)
    allow_download = models.BooleanField(default=True, help_text="Whether the  original media file can be downloaded")
    year_produced = models.IntegerField(help_text="Year media was produced", blank=True, null=True)
    allow_whisper_transcribe = models.BooleanField("Transcribe auto-detected language", default=False)
    allow_whisper_transcribe_and_translate = models.BooleanField("Translate to English", default=False)

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
            models.Index(fields=["search"], name="media_search_gin", opclasses=["gin_trgm_ops"]),
        ]

    def __str__(self):
        return self.title

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
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
                if not Media.objects.filter(friendly_token=friendly_token).exists():
                    self.friendly_token = friendly_token
                    break

        if self.pk:
            if self.media_file != self.__original_media_file:
                self.__original_media_file = self.media_file
                from . import tasks

                tasks.media_init.apply_async(args=[self.friendly_token], countdown=5)

            if self.thumbnail_time != self.__original_thumbnail_time:
                self.__original_thumbnail_time = self.thumbnail_time
                self.set_thumbnail(force=True)
        else:
            self.state = helpers.get_default_state(user=self.user)
            self.license = License.objects.filter(id=10).first()
        super().save(*args, **kwargs)

        # has to save first for uploaded_poster path to exist
        if self.uploaded_poster and self.uploaded_poster != self.__original_uploaded_poster:
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
                if not TranscriptionRequest.objects.filter(media=self, translate_to_english=True).exists():
                    can_transcribe_and_translate = True

            if self.allow_whisper_transcribe:
                if not TranscriptionRequest.objects.filter(media=self, translate_to_english=False).exists():
                    can_transcribe = True

            from . import tasks

            if can_transcribe:
                tasks.whisper_transcribe.delay(self.friendly_token)
            if can_transcribe_and_translate:
                tasks.whisper_transcribe.delay(self.friendly_token, translate=True)

    def update_search_vector(self):
        """
        Update SearchVector field using raw SQL.
        """
        db_table = self._meta.db_table

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
        text = " ".join([token for token in text.lower().split(" ") if token not in STOP_WORDS])
        text = helpers.clean_query(text)

        sql_code = f"""
            UPDATE {db_table} SET search = to_tsvector(
                '{{config}}', '{{text}}'
            ) WHERE {db_table}.id = {{id}}
        """.format(config="simple", text=text, id=self.id)

        try:
            with connection.cursor() as cursor:
                cursor.execute(sql_code)
        except Exception:  # TODO: add log
            pass
        return True

    def media_init(self):
        # new media file uploaded. Check if media type, video duration, thumbnail etc. Re-encode
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
            except Exception:
                logger.exception("set_thumbnail failed for video")
            self.encode()
            self.produce_sprite_from_video()
        elif self.media_type == "image":
            try:
                self.set_thumbnail(force=True)
            except Exception:
                logger.exception("set_thumbnail failed for image")
        return True

    def set_media_type(self, save=True):
        # ffprobe considers as videos images/text; try filetype lib first
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
        if force or not self.thumbnail:
            if self.media_type == "video":
                self.produce_thumbnails_from_video()
            if self.media_type == "image":
                with open(self.media_file.path, "rb") as f:
                    myfile = File(f)
                    thumbnail_name = f"{helpers.get_file_name(self.media_file.path)}.jpg"
                    self.thumbnail.save(content=myfile, name=thumbnail_name)
                    self.poster.save(content=myfile, name=thumbnail_name)
        return True

    def produce_thumbnails_from_video(self):
        if self.media_type != "video":
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
            str(thumbnail_time),  # -ss needs to be first for speed
            "-i",
            self.media_file.path,
            "-vframes",
            "1",
            "-y",
            tf,
        ]
        helpers.run_command(command)

        if os.path.exists(tf) and helpers.get_file_type(tf) == "image":
            with open(tf, "rb") as f:
                myfile = File(f)
                thumbnail_name = f"{helpers.get_file_name(self.media_file.path)}.jpg"
                self.thumbnail.save(content=myfile, name=thumbnail_name)
                self.poster.save(content=myfile, name=thumbnail_name)
        helpers.rm_file(tf)
        return True

    def produce_sprite_from_video(self):
        from . import tasks

        tasks.produce_sprite_from_video.delay(self.friendly_token)
        return True

    def encode(self, profiles=None, force=True, chunkize=True):
        if profiles is None:
            profiles = EncodeProfile.objects.filter(active=True)
        profiles = list(profiles)

        from . import tasks

        if self.duration > settings.CHUNKIZE_VIDEO_DURATION and chunkize:
            for profile in list(profiles):
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
            profile_ids = [p.id for p in profiles]
            tasks.chunkize_media.delay(self.friendly_token, profile_ids, force=force)
        else:
            for profile in profiles:
                if profile.extension != "gif":
                    if self.video_height and self.video_height < profile.resolution:
                        if profile.resolution not in settings.MINIMUM_RESOLUTIONS_TO_ENCODE:
                            continue
                encoding = Encoding(media=self, profile=profile)
                encoding.save()
                enc_url = settings.SSL_FRONTEND_HOST + encoding.get_absolute_url()
                priority = 9 if profile.resolution in settings.MINIMUM_RESOLUTIONS_TO_ENCODE else 0
                tasks.encode_media.apply_async(
                    args=[self.friendly_token, profile.id, encoding.id, enc_url],
                    kwargs={"force": force},
                    priority=priority,
                )

        return True

    def post_encode_actions(self, encoding=None, action=None):
        # perform things after encode has run (whether it has failed or succeeded)
        self.set_encoding_status()
        # set a preview url
        if encoding and self.media_type == "video" and encoding.profile.extension == "gif":
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

            tasks.create_hls(self.friendly_token)
        return True

    def set_encoding_status(self):
        # set status. set success if at least 1 mp4 exists (non-chunk)
        mp4_statuses = {
            enc.status
            for enc in self.encodings.select_related("profile").filter(
                profile__extension="mp4", chunk=False
            )
        }

        if not mp4_statuses:
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
        if self.media_type not in ["video"]:
            return {}

        ret = {key: {} for key in ENCODE_RESOLUTIONS_KEYS}

        for encoding in self.encodings.select_related("profile").filter(chunk=False):
            if encoding.profile.extension == "gif":
                continue
            enc = self.get_encoding_info(encoding, full=full)
            resolution = encoding.profile.resolution
            ret[resolution][encoding.profile.codec] = enc

        if full:
            # if a file is broken in chunks and they are being encoded, the final encoding file won't appear
            extra = []
            for encoding in self.encodings.select_related("profile").filter(chunk=True):
                resolution = encoding.profile.resolution
                if not ret[resolution].get(encoding.profile.codec):
                    extra.append(encoding.profile.codec)

            for codec in extra:
                ret[resolution][codec] = {}
                v = self.encodings.filter(chunk=True, profile__codec=codec).values("progress")
                ret[resolution][codec]["progress"] = sum(p["progress"] for p in v) / v.count()
        return ret

    @staticmethod
    def get_encoding_info(encoding, full=False):
        ep = {
            "title": encoding.profile.name,
            "url": encoding.media_encoding_url,
            "progress": encoding.progress,
            "size": encoding.size,
            "encoding_id": encoding.id,
            "status": encoding.status,
        }
        if full:
            ep.update(
                {
                    "logs": encoding.logs,
                    "worker": encoding.worker,
                    "retries": encoding.retries,
                    "total_run_time": encoding.total_run_time or None,
                    "commands": encoding.commands or None,
                    "time_started": encoding.add_date,
                    "updated_time": encoding.update_date,
                }
            )
        return ep

    @property
    def categories_info(self):
        return [{"title": c.title, "url": c.get_absolute_url()} for c in self.category.all()]

    @property
    def topics_info(self):
        return [{"title": t.title, "url": t.get_absolute_url()} for t in self.topics.all()]

    @property
    def tags_info(self):
        return [{"title": t.title, "url": t.get_absolute_url()} for t in self.tags.all()]

    @property
    def license_info(self):
        if not self.license:
            return {}
        return {
            "title": self.license.title,
            "url": self.license.url,
            "thumbnail": self.license.thumbnail_path,
        }

    @property
    def media_country_info(self):
        ret = []
        country = dict(lists.video_countries).get(self.media_country) if self.media_country else None
        if country:
            ret = [{"title": country, "url": reverse("search") + f"?country={country}"}]
        return ret

    @property
    def media_language_info(self):
        ret = []
        media_language = dict(lists.video_languages).get(self.media_language) if self.media_language else None
        if media_language:
            ret = [{"title": media_language, "url": reverse("search") + f"?language={media_language}"}]
        return ret

    @property
    def original_media_url(self):
        return helpers.url_from_path(self.media_file.path) if settings.SHOW_ORIGINAL_MEDIA else None

    @property
    def thumbnail_url(self):
        if self.uploaded_thumbnail:
            return helpers.url_from_path(self.uploaded_thumbnail.path)
        if self.thumbnail:
            return helpers.url_from_path(self.thumbnail.path)
        return None

    @property
    def poster_url(self):
        if self.uploaded_poster:
            return helpers.url_from_path(self.uploaded_poster.path)
        if self.poster:
            return helpers.url_from_path(self.poster.path)
        return None

    @property
    def subtitles_info(self):
        return [
            {
                "src": helpers.url_from_path(s.subtitle_file.path),
                "srclang": s.language.code,
                "label": s.language.title,
            }
            for s in self.subtitles.all()
        ]

    @property
    def sprites_url(self):
        return helpers.url_from_path(self.sprites.path) if self.sprites else None

    @property
    def preview_url(self):
        if self.preview_file_path:
            return helpers.url_from_path(self.preview_file_path)
        preview_media = self.encodings.filter(profile__extension="gif").first()
        if preview_media and preview_media.media_file:
            return helpers.url_from_path(preview_media.media_file.path)
        return None

    @property
    def hls_info(self):
        res = {}
        if self.hls_file and os.path.exists(self.hls_file):
            hls_file = self.hls_file
            p = os.path.dirname(hls_file)
            m3u8_obj = m3u8.load(hls_file)
            res["master_file"] = helpers.url_from_path(hls_file)
            for iframe_playlist in m3u8_obj.iframe_playlists:
                uri = os.path.join(p, iframe_playlist.uri)
                if os.path.exists(uri):
                    resolution = iframe_playlist.iframe_stream_info.resolution[1]
                    res[f"{resolution}_iframe"] = helpers.url_from_path(uri)
            for playlist in m3u8_obj.playlists:
                uri = os.path.join(p, playlist.uri)
                if os.path.exists(uri):
                    resolution = playlist.stream_info.resolution[1]
                    res[f"{resolution}_playlist"] = helpers.url_from_path(uri)
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
            return reverse("edit_media") + f"?m={self.friendly_token}"
        if api:
            return reverse("api_get_media", kwargs={"friendly_token": self.friendly_token})
        return reverse("get_media") + f"?m={self.friendly_token}"

    @property
    def edit_url(self):
        return self.get_absolute_url(edit=True)

    @property
    def add_subtitle_url(self):
        return f"/add_subtitle?m={self.friendly_token}"

    @property
    def ratings_info(self):
        # to be used if user ratings are allowed
        if not settings.ALLOW_RATINGS:
            return []
        ret = []
        for category in self.category.all():
            ratings = RatingCategory.objects.filter(category=category, enabled=True)
            if ratings:
                ratings_info = [
                    {
                        "rating_category_id": r.id,
                        "rating_category_name": r.title,
                        "score": -1,  # default score; populated if user already rated
                    }
                    for r in ratings
                ]
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
    allow_commercial = models.CharField(max_length=10, blank=True, null=True, choices=lists.license_options)
    allow_modifications = models.CharField(max_length=10, blank=True, null=True, choices=lists.license_options)
    url = models.CharField("Url", max_length=300, blank=True, null=True)
    thumbnail_path = models.CharField("Path for thumbnail", max_length=200, null=True, blank=True)

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
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, blank=True, null=True)
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
        return reverse("search") + f"?c={self.title}"

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
        media = Media.objects.filter(category=self, state="public").order_by("-views").first()
        if media:
            return media.thumbnail_url
        return None

    def save(self, *args, **kwargs):
        for item in ["title", "description"]:
            setattr(self, item, strip_tags(getattr(self, item, None)))
        super().save(*args, **kwargs)


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
        return reverse("search") + f"?topic={self.title}"

    @property
    def thumbnail_url(self):
        if self.thumbnail:
            return helpers.url_from_path(self.thumbnail.path)
        if self.listings_thumbnail:
            return self.listings_thumbnail
        return None

    def update_tag_media(self):
        self.media_count = Media.objects.filter(state="public", is_reviewed=True, topics=self).count()
        self.save(update_fields=["media_count"])
        return True


class Tag(models.Model):
    title = models.CharField(max_length=100, unique=True, db_index=True)
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, blank=True, null=True)
    media_count = models.IntegerField(default=0)  # save number of videos
    listings_thumbnail = models.CharField(
        max_length=400, blank=True, null=True, help_text="Thumbnail to show on listings"
    )

    def __str__(self):
        return self.title

    class Meta:
        ordering = ["title"]

    def get_absolute_url(self):
        return reverse("search") + f"?t={self.title}"

    def update_tag_media(self):
        self.media_count = Media.objects.filter(state="public", is_reviewed=True, tags=self).count()
        self.save(update_fields=["media_count"])
        return True

    def save(self, *args, **kwargs):
        self.title = slugify(self.title[:99])
        self.title = strip_tags(self.title)
        super().save(*args, **kwargs)

    @property
    def thumbnail_url(self):
        if self.listings_thumbnail:
            return self.listings_thumbnail
        media = Media.objects.filter(tags=self, state="public").order_by("-views").first()
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
        return reverse("search") + f"?language={self.title}"

    @property
    def thumbnail_url(self):
        return self.listings_thumbnail or None

    def update_language_media(self):
        language = {value: key for key, value in dict(lists.video_languages).items()}.get(self.title)
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
        return reverse("search") + f"?country={self.title}"

    @property
    def thumbnail_url(self):
        return self.listings_thumbnail or None

    def update_country_media(self):
        country = {value: key for key, value in dict(lists.video_countries).items()}.get(self.title)
        if country:
            self.media_count = Media.objects.filter(
                state="public", is_reviewed=True, media_country=country
            ).count()
        self.save(update_fields=["media_count"])
        return True


class EncodeProfile(models.Model):
    """Encode Profiles"""

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
    """Encoding Media Instances"""

    logs = models.TextField(blank=True)
    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name="encodings")
    profile = models.ForeignKey(EncodeProfile, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=MEDIA_ENCODING_STATUS, default="pending")
    media_file = models.FileField("encoding file", upload_to=encoding_media_file_path, blank=True, max_length=500)
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
        return helpers.url_from_path(self.media_file.path) if self.media_file else None

    @property
    def media_chunk_url(self):
        return helpers.url_from_path(self.chunk_file_path) if self.chunk_file_path else None

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
                self.md5sum = stdout.strip().split()[0]

        super().save(*args, **kwargs)

    def set_progress(self, progress, commit=True):
        if isinstance(progress, int) and 0 <= progress <= 100:
            self.progress = progress
            if commit:
                self.save(update_fields=["progress"])
            return True
        return False

    def __str__(self):
        return f"{self.profile.name}-{self.media.title}"

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
        help_text="Accepted formats: SubRip (.srt) or WebVTT (.vtt). SRT will be converted to VTT on upload.",
        upload_to=subtitles_file_path,
        max_length=500,
    )
    user = models.ForeignKey("users.User", on_delete=models.CASCADE)

    class Meta:
        ordering = ["language__title"]

    def __str__(self):
        return f"{self.media.title}-{self.language.title}"

    def get_absolute_url(self):
        return f"{reverse('edit_subtitle')}?id={self.id}"

    @property
    def url(self):
        return self.get_absolute_url()

    def convert_to_srt(self):
        """
        Convert uploaded subtitle files to VTT format for web playback.
        Uses FFmpeg (already configured in CinemataCMS). Accepts SRT and VTT inputs.
        SAFETY: Only called on NEW uploads; existing files are untouched.
        """
        from django.conf import settings as dj_settings
        from . import helpers as hlp

        input_path = self.subtitle_file.path

        # 1) Validate file existence
        if not os.path.exists(input_path):
            raise Exception("Subtitle file not found")

        file_lower = input_path.lower()

        # 2) Validate extension
        if not (file_lower.endswith(".srt") or file_lower.endswith(".vtt")):
            raise Exception("Invalid subtitle format. Use SubRip (.srt) and WebVTT (.vtt) files.")

        # 3) Already VTT → no conversion
        if file_lower.endswith(".vtt"):
            return True

        # 4) Convert SRT -> VTT via FFmpeg
        log = logging.getLogger(__name__)
        log.info(f"Converting new subtitle upload: {input_path}")

        with tempfile.TemporaryDirectory(dir=dj_settings.TEMP_DIRECTORY) as tmpdir:
            temp_vtt = os.path.join(tmpdir, "converted.vtt")
            cmd = [
                dj_settings.FFMPEG_COMMAND,
                "-i",
                input_path,
                "-c:s",
                "webvtt",
                temp_vtt,
            ]
            try:
                hlp.run_command(cmd)
                if os.path.exists(temp_vtt) and os.path.getsize(temp_vtt) > 0:
                    # Replace original with VTT
                    shutil.copy2(temp_vtt, input_path)
                    log.info(f"Successfully converted subtitle to VTT: {input_path}")

                    # 5) Rename physical path & FileField from .srt -> .vtt
                    if file_lower.endswith(".srt"):
                        new_path = input_path[:-4] + ".vtt"
                        if new_path != input_path:
                            os.rename(input_path, new_path)
                        self.subtitle_file.name = self.subtitle_file.name[:-4] + ".vtt"
                        self.save(update_fields=["subtitle_file"])
                else:
                    raise Exception("FFmpeg conversion failed - no output file created")
            except Exception as e:
                log.error(f"Subtitle conversion failed for {input_path}: {str(e)}")
                raise Exception(f"Could not convert SRT file to VTT format: {str(e)}")
        return True


class RatingCategory(models.Model):
    """
    Rating Category
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
        return f"{self.title}, for category {self.category.title}"


class Rating(models.Model):
    """User Rating"""

    user = models.ForeignKey("users.User", on_delete=models.CASCADE)
    add_date = models.DateTimeField(auto_now_add=True)
    rating_category = models.ForeignKey(RatingCategory, on_delete=models.CASCADE)
    score = models.IntegerField()
    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name="ratings")

    class Meta:
        verbose_name_plural = "Ratings"
        indexes = [models.Index(fields=["user", "media"])]
        unique_together = ("user", "media", "rating_category")

    def __str__(self):
        return f"{self.user.username}, rate for {self.media.title} for category {self.rating_category.title}"


class Playlist(models.Model):
    uid = models.UUIDField(unique=True, default=uuid.uuid4)
    title = models.CharField(max_length=90, db_index=True)
    description = models.TextField(blank=True, help_text="description")
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, db_index=True, related_name="playlists")
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
            return reverse("api_get_playlist", kwargs={"friendly_token": self.friendly_token})
        return reverse("get_playlist", kwargs={"friendly_token": self.friendly_token})

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
        if media not in self.media.all():
            return False
        pm = PlaylistMedia.objects.filter(playlist=self, media=media).first()
        if pm and isinstance(ordering, int) and ordering > 0:
            pm.ordering = ordering
            pm.save()
            return True
        return False

    def save(self, *args, **kwargs):
        if not self.friendly_token:
            while True:
                friendly_token = helpers.produce_friendly_token()
                if not Playlist.objects.filter(friendly_token=friendly_token).exists():
                    self.friendly_token = friendly_token
                    break
        super().save(*args, **kwargs)

    @property
    def thumbnail_url(self):
        pm = self.playlistmedia_set.first()
        if pm:
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
    parent = TreeForeignKey("self", on_delete=models.CASCADE, null=True, blank=True, related_name="children")
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, db_index=True)
    media = models.ForeignKey(Media, on_delete=models.CASCADE, db_index=True, related_name="comments")

    class MPTTMeta:
        order_insertion_by = ["add_date"]

    def __str__(self):
        return f"On {self.media.title} by {self.user.username}"

    def save(self, *args, **kwargs):
        self.text = strip_tags(getattr(self, "text", "")) if self.text else self.text
        if self.text:
            self.text = self.text[: settings.MAX_CHARS_FOR_COMMENT]
        super().save(*args, **kwargs)
        if settings.UNLISTED_WORKFLOW_MAKE_PUBLIC_UPON_COMMENTARY_ADD and self.media.state == "unlisted":
            self.media.state = "public"
            self.media.save(update_fields=["state"])

    def get_absolute_url(self):
        return reverse("get_media") + f"?m={self.media.friendly_token}"

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
    text = models.TextField("Pop-up name", blank=True, help_text="This will not appear on the pop-up")
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
    ordering = models.IntegerField(default=1, help_text="ordering, 1 comes first, 2 follows etc")
    text = models.TextField(help_text="text", blank=True, null=True)

    def __str__(self):
        return f"{self.title} - {self.url} - {self.ordering}"

    class Meta:
        ordering = ["ordering"]
        verbose_name = "Index page featured"
        verbose_name_plural = "Index page featured"


class TranscriptionRequest(models.Model):
    # helper model to assess whether a Whisper transcription request is already in place
    media = models.ForeignKey(Media, on_delete=models.CASCADE, related_name="transcriptionrequests")
    add_date = models.DateTimeField(auto_now_add=True)
    translate_to_english = models.BooleanField(default=False)


class TinyMCEMedia(models.Model):
    file = models.FileField(upload_to="tinymce_media/")
    uploaded_at = models.DateTimeField(auto_now_add=True)
    file_type = models.CharField(
        max_length=10,
        choices=(
            ("image", "Image"),
            ("media", "Media"),
        ),
    )
    original_filename = models.CharField(max_length=255)
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, null=True, blank=True)

    class Meta:
        verbose_name = "TinyMCE Media"
        verbose_name_plural = "TinyMCE Media"
        ordering = ["-uploaded_at"]

    def __str__(self):
        return f"{self.original_filename} ({self.file_type})"

    @property
    def url(self):
        return self.file.url


# --- Signals -----------------------------------------------------------------


@receiver(post_save, sender=Media)
def media_save(sender, instance, created, **kwargs):
    # media_file path is not set correctly until model is saved
    if created:
        instance.media_init()
        notify_users(friendly_token=instance.friendly_token, action="media_added")

    instance.user.update_user_media()

    if instance.category.all():
        for category in instance.category.all():
            category.update_category_media()

    if instance.tags.all():
        for tag in instance.tags.all():
            tag.update_tag_media()

    if instance.topics.all():
        for topic in instance.topics.all():
            topic.update_tag_media()

    if instance.media_country:
        country = {key: value for key, value in dict(lists.video_countries).items()}.get(instance.media_country)
        if country:
            country_obj = MediaCountry.objects.filter(title=country).first()
            if country_obj:
                country_obj.update_country_media()

    if instance.media_language:
        language = {key: value for key, value in dict(lists.video_languages).items()}.get(instance.media_language)
        if language:
            language_obj = MediaLanguage.objects.filter(title=language).first()
            if language_obj:
                language_obj.update_language_media()

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
    Deletes files from filesystem when corresponding `Media` object is deleted.
    """
    if instance.media_file:
        helpers.rm_file(instance.media_file.path)
    if instance.thumbnail:
        helpers.rm_file(instance.thumbnail.path)
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
        # when an encoded chunk is complete, check if all are ready, then concat and clean up
        if instance.media_file:
            try:
                orig_chunks = json.loads(instance.chunks_info).keys()
            except Exception:
                instance.delete()
                return False

            chunks = Encoding.objects.filter(
                media=instance.media,
                profile=instance.profile,
                chunks_info=instance.chunks_info,
                chunk=True,
            ).order_by("add_date")

            complete = True
            # validate existence and files
            for chunk in orig_chunks:
                if not chunks.filter(chunk_file_path=chunk).exists():
                    complete = False
                    break
            for chunk in chunks:
                if not (chunk.media_file and chunk.media_file.path):
                    complete = False
                    break

            if complete:
                chunks_paths = [f.media_file.path for f in chunks]
                with tempfile.TemporaryDirectory(dir=settings.TEMP_DIRECTORY) as temp_dir:
                    seg_file = helpers.create_temp_file(suffix=".txt", dir=temp_dir)
                    tf = helpers.create_temp_file(
                        suffix=f".{instance.profile.extension}", dir=temp_dir
                    )
                    with open(seg_file, "w") as ff:
                        for fpath in chunks_paths:
                            ff.write(f"file {fpath}\n")
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
                    all_logs = "\n".join(st.logs for st in chunks)
                    encoding.logs = f"{chunks_paths}\n{stdout}\n{all_logs}"
                    workers = list({st.worker for st in chunks})
                    encoding.worker = json.dumps({"workers": workers})

                    start_date = min(st.add_date for st in chunks)
                    end_date = max(st.update_date for st in chunks)
                    encoding.total_run_time = (end_date - start_date).seconds
                    encoding.save()

                    with open(tf, "rb") as f:
                        myfile = File(f)
                        output_name = f"{helpers.get_file_name(instance.media.media_file.path)}.{instance.profile.extension}"
                        encoding.media_file.save(content=myfile, name=output_name)

                    # final validation to avoid double-run
                    if len(orig_chunks) == Encoding.objects.filter(
                        media=instance.media, profile=instance.profile, chunks_info=instance.chunks_info
                    ).count():
                        who = Encoding.objects.filter(
                            media=encoding.media, profile=encoding.profile
                        ).exclude(id=encoding.id)
                        who.delete()
                    else:
                        encoding.delete()

                    if not Encoding.objects.filter(chunks_info=instance.chunks_info).exists():
                        for chunk in json.loads(instance.chunks_info).keys():
                            helpers.rm_file(chunk)

                    instance.media.post_encode_actions(encoding=instance, action="add")

    elif instance.chunk and instance.status == "fail":
        encoding = Encoding(media=instance.media, profile=instance.profile, status="fail", progress=100)
        chunks = Encoding.objects.filter(media=instance.media, chunks_info=instance.chunks_info, chunk=True).order_by(
            "add_date"
        )
        chunks_paths = [f.media_file.path for f in chunks]

        all_logs = "\n".join(st.logs for st in chunks)
        encoding.logs = f"{chunks_paths}\n{all_logs}"
        workers = list({st.worker for st in chunks})
        encoding.worker = json.dumps({"workers": workers})
        start_date = min(st.add_date for st in chunks)
        end_date = max(st.update_date for st in chunks)
        encoding.total_run_time = (end_date - start_date).seconds
        encoding.save()

        who = Encoding.objects.filter(media=encoding.media, profile=encoding.profile).exclude(id=encoding.id)
        who.delete()
    else:
        if instance.status in ["fail", "success"]:
            instance.media.post_encode_actions(encoding=instance, action="add")

        encodings = {e.status for e in Encoding.objects.filter(media=instance.media)}
        if "running" in encodings or "pending" in encodings:
            return
        # workers = list({e.worker for e in Encoding.objects.filter(media=instance.media)})


@receiver(post_delete, sender=Encoding)
def encoding_file_delete(sender, instance, **kwargs):
    """
    Deletes file from filesystem when corresponding `Encoding` object is deleted.
    """
    if instance.media_file:
        helpers.rm_file(instance.media_file.path)
        if not instance.chunk:
            instance.media.post_encode_actions(encoding=instance, action="delete")


@receiver(post_delete, sender=Comment)
def comment_delete(sender, instance, **kwargs):
    if instance.media.state == "public":
        if settings.UNLISTED_WORKFLOW_MAKE_PRIVATE_UPON_COMMENTARY_DELETE:
            if instance.media.comments.exclude(uid=instance.uid).count() == 0:
                instance.media.state = "unlisted"
                instance.media.save(update_fields=["state"])
