from django.conf import settings
from django.contrib.auth.models import AbstractUser
from django.core.mail import EmailMessage, send_mail
from django.db import models
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from django.urls import reverse
from django.utils import timezone
from django.utils.html import strip_tags
from imagekit.models import ImageSpecField, ProcessedImageField
from imagekit.processors import ResizeToFill, ResizeToFit

import files.helpers as helpers
from files.lists import video_countries
from files.models import Media, Tag


class User(AbstractUser):
    logo = ProcessedImageField(
        upload_to="userlogos/%Y/%m/%d",
        processors=[ResizeToFit(width=344, height=None)],
        default="userlogos/user.jpg",
        format="JPEG",
        options={"quality": 95},
        blank=True,
        help_text="<br />For best results, use a centre-aligned photo with a 1:1 aspect ratio.",
    )
    description = models.TextField("Biography", blank=True)

    name = models.CharField("full name", max_length=250, db_index=True)
    date_added = models.DateTimeField("date added", default=timezone.now, db_index=True)
    is_featured = models.BooleanField("Is featured", default=False, db_index=True)

    # CC related
    institution = models.CharField("institution", max_length=250, blank=True)
    title = models.CharField("Title", max_length=250, blank=True)
    advancedUser = models.BooleanField(
        "Trusted User",
        default=False,
        db_index=True,
        help_text="Can add unlisted and restricted videos to playlists",
    )
    media_count = models.IntegerField(default=0, db_index=True)  # save number of videos
    notification_on_comments = models.BooleanField(
        "Notify me about comments on my content", default=True
    )
    disable_activity_logging = models.BooleanField(
        "Disable Activity Logging",
        default=False,
        help_text="Views, likes, and watch history will not be recorded.",
    )

    location = models.CharField("Location", max_length=250, blank=True)
    location_country = models.CharField(
        "Country",
        max_length=5,
        blank=True,
        null=True,
        default="XX",
        choices=video_countries,
        db_index=True,
    )
    home_page = models.URLField(
        "Website",
        max_length=250,
        blank=True,
        help_text="Link to your website, blog, or online portfolio",
    )
    social_media_links = models.TextField(
        "Social Media links", blank=True, help_text="Comma separated list of URLs"
    )
    is_editor = models.BooleanField(
        "MediaCMS Editor",
        default=False,
        db_index=True,
        help_text="Can edit and manage all media content on the platform",
    )
    is_manager = models.BooleanField(
        "MediaCMS Manager",
        default=False,
        db_index=True,
        help_text="Full administrative access including users and settings",
    )
    allow_contact = models.BooleanField(
        "Contact Form",
        default=True,
        help_text="Display contact form on your public profile",
    )
    last_published_video_datetime = models.DateTimeField(
        "datetime of the last video that was published",
        default="2008-1-1",
        db_index=True,
    )

    class Meta:
        ordering = ["-date_added", "name"]
        indexes = [models.Index(fields=["-date_added", "name"])]

    def update_user_media(self):
        qs = Media.objects.filter(user=self).order_by("id")
        self.media_count = qs.count()
        if self.media_count:
            self.last_published_video_datetime = qs.last().add_date

        self.save(update_fields=["media_count", "last_published_video_datetime"])
        return True

    def thumbnail_url(self):
        if self.logo:
            return helpers.url_from_path(self.logo.path)
        return None

    def banner_thumbnail_url(self):
        c = self.channels.filter().order_by("add_date").first()
        if c:
            return helpers.url_from_path(c.banner_logo.path)
        return None

    @property
    def email_is_verified(self):
        if self.emailaddress_set.first():
            if self.emailaddress_set.first().verified:
                return True
        return False

    def get_absolute_url(self, api=False):
        if api:
            return reverse("api_get_user", kwargs={"username": self.username})
        else:
            return reverse("get_user", kwargs={"username": self.username})

    def edit_url(self):
        return reverse("edit_user", kwargs={"username": self.username})

    def default_channel_edit_url(self):
        c = self.channels.filter().order_by("add_date").first()
        if c:
            return reverse("edit_channel", kwargs={"friendly_token": c.friendly_token})
        return None

    @property
    def playlists_info(self):
        ret = []
        for playlist in self.playlists.all():
            c = {}
            c["title"] = playlist.title
            c["description"] = playlist.description
            c["media_count"] = playlist.media_count
            c["add_date"] = playlist.add_date
            c["url"] = playlist.get_absolute_url()
            ret.append(c)
        return ret

    @property
    def media_info(self):
        ret = {}
        results = []
        # this doesn't offer any value for now and needs query optimization
        for media in []:
            c = {}
            c["title"] = media.title
            c["description"] = media.description
            c["add_date"] = media.add_date
            c["url"] = media.get_absolute_url()
            results.append(c)
        ret["results"] = results
        ret["user_media"] = "/api/v1/media?author={0}".format(self.username)
        return ret

    @property
    def location_info(self):
        ret = []
        location = (
            dict(video_countries).get(self.location_country, None)
            if self.location_country
            else None
        )
        if location:
            ret = [
                {
                    "title": location,
                    "url": reverse("members") + "?location={0}".format(location),
                }
            ]
        return ret

    def save(self, *args, **kwargs):
        strip_text_items = ["name", "description", "institution", "title"]
        for item in strip_text_items:
            setattr(self, item, strip_tags(getattr(self, item, None)))
        super(User, self).save(*args, **kwargs)


class Channel(models.Model):
    title = models.CharField(max_length=90, db_index=True)
    description = models.TextField(blank=True, help_text="description")
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, db_index=True, related_name="channels"
    )
    add_date = models.DateTimeField(auto_now_add=True, db_index=True)
    subscribers = models.ManyToManyField(User, related_name="subscriptions", blank=True)
    friendly_token = models.CharField(blank=True, max_length=12)
    banner_logo = ProcessedImageField(
        upload_to="userlogos/%Y/%m/%d",
        processors=[ResizeToFill(900, 200)],
        default="userlogos/banner.jpg",
        format="JPEG",
        options={"quality": 85},
        blank=True,
    )

    def save(self, *args, **kwargs):
        strip_text_items = ["description", "title"]
        for item in strip_text_items:
            setattr(self, item, strip_tags(getattr(self, item, None)))

        if not self.friendly_token:
            while True:
                friendly_token = helpers.produce_friendly_token()
                if not Channel.objects.filter(friendly_token=friendly_token):
                    self.friendly_token = friendly_token
                    break
        super(Channel, self).save(*args, **kwargs)

    def __str__(self):
        return "{0} -{1}".format(self.user.username, self.title)

    def get_absolute_url(self, edit=False):
        if edit:
            return reverse(
                "edit_channel", kwargs={"friendly_token": self.friendly_token}
            )
        else:
            return reverse(
                "view_channel", kwargs={"friendly_token": self.friendly_token}
            )

    @property
    def edit_url(self):
        return self.get_absolute_url(edit=True)


@receiver(post_save, sender=User)
def post_user_create(sender, instance, created, **kwargs):
    if created:
        new = Channel.objects.create(title="default", user=instance)
        new.save()
        if settings.ADMINS_NOTIFICATIONS.get("NEW_USER", False):
            title = "[{}] - New user just registered".format(settings.PORTAL_NAME)
            msg = """
User has just registered with email %s\n
Visit user profile page at %s
            """ % (
                instance.email,
                settings.SSL_FRONTEND_HOST + instance.get_absolute_url(),
            )
            email = EmailMessage(
                title, msg, settings.DEFAULT_FROM_EMAIL, settings.ADMIN_EMAIL_LIST
            )
            email.send(fail_silently=True)


NOTIFICATION_METHODS = (("email", "Email"),)


class Notification(models.Model):
    user = models.ForeignKey(
        User, on_delete=models.CASCADE, db_index=True, related_name="notifications"
    )
    action = models.CharField(max_length=30, blank=True)
    notify = models.BooleanField(default=False)
    method = models.CharField(
        max_length=20, choices=NOTIFICATION_METHODS, default="email"
    )

    def save(self, *args, **kwargs):
        super(Notification, self).save(*args, **kwargs)

    def __str__(self):
        return self.user.username


@receiver(post_delete, sender=User)
def delete_content(sender, instance, **kwargs):
    Media.objects.filter(user=instance).delete()
    Tag.objects.filter(user=instance).delete()


class BlackListedEmail(models.Model):
    email = models.CharField(
        max_length=90,
        db_index=True,
        unique=True,
        help_text="email that will be blacklisted",
    )

    def __str__(self):
        return self.email

