from datetime import datetime

from captcha.fields import ReCaptchaField
from captcha.widgets import ReCaptchaV2Checkbox
from django import forms
from django.conf import settings
from django.contrib.admin.sites import site

from .methods import is_mediacms_editor
from .models import Language, Media, Subtitle

MEDIA_STATES = (
    ("private", "Private"),
    ("public", "Public"),
    ("unlisted", "Unlisted"),
)


class MultipleSelect(forms.CheckboxSelectMultiple):
    input_type = "checkbox"


class MediaForm(forms.ModelForm):
    new_tags = forms.CharField(
        label="Tags", help_text="Use a comma to separate multiple tags.", required=False
    )
    no_license = forms.BooleanField(required=False, label="All Rights Reserved")
    custom_license = forms.CharField(required=False, label="Just a placeholder")

    class Meta:
        model = Media
        fields = [
            "title",
            "summary",
            "description",
            "year_produced",
            "media_file",
            "uploaded_poster",
            "allow_whisper_transcribe_and_translate",
            "add_date",
            "company",
            "website",
            "media_language",
            "media_country",
            "category",
            "topics",
            "new_tags",
            "custom_license",
            "no_license",
            "enable_comments",
            "reported_times",
            "featured",
            "is_reviewed",
            "state",
            "password",
            "allow_download",
        ]

        widgets = {
            "tags": MultipleSelect(),
            "year_produced": forms.Select(), 
        }

    def __init__(self, user, *args, **kwargs):
        self.user = user
        super(MediaForm, self).__init__(*args, **kwargs)
        current_year = datetime.now().year
        year_choices = [('', '-- Select Year --')]  # Empty option first

        # Create list of years from current year down to 2000
        for year in range(current_year, 1999, -1):  # 1999 because range is exclusive
            year_choices.append((year, str(year)))

        # Apply choices to the dropdown widget
        self.fields["year_produced"].widget.choices = year_choices
        self.fields["state"].label = "Status"
        self.fields["allow_download"].label = "Allow Download"
        self.fields["reported_times"].label = "Reported Times"
        self.fields["enable_comments"].label = "Enable Comments"
        self.fields["new_tags"].label = "Tags"
        self.fields[
            "category"
        ].help_text = "Hold the Shift or Command key to select multiple categories."
        self.fields[
            "topics"
        ].help_text = "Hold the Shift or Command key to select multiple topics."
        self.fields["topics"].label = "Topic"

        self.fields["media_country"].label = "Media Country"
        self.fields["media_language"].label = "Media Language"

        self.fields["add_date"].label = "Publication Date"
        self.fields["uploaded_poster"].label = "Thumbnail Image Upload"

        self.fields["media_file"].label = "Media Upload"

        self.fields["year_produced"].label = "Year Produced"

        self.fields["year_produced"].required = True
        self.fields["category"].required = True
        self.fields["media_language"].required = True
        self.fields["media_country"].required = True

        self.fields[
            "password"
        ].help_text = "Set a password to protect Restricted Media. Limited to Trusted Users. Contact Cinemata to become one."

        if self.instance.media_type != "video":
            self.fields.pop("thumbnail_time", None)
        if not is_mediacms_editor(user):
            self.fields.pop("featured")
            self.fields.pop("reported_times")
            self.fields.pop("is_reviewed")
            self.fields.pop("add_date")

        if not is_mediacms_editor(user):
            if not user.advancedUser:
                self.fields.pop("media_file")
                self.fields.pop("password")
                self.fields["state"]
                self.fields["state"] = forms.ChoiceField(
                    choices=MEDIA_STATES,
                    help_text=self.fields["state"].help_text,
                    required=True,
                    label=self.fields["state"].label,
                )

        self.fields["new_tags"].initial = ", ".join(
            [tag.title for tag in self.instance.tags.all()]
        )
        if not self.instance.license:
            self.fields["no_license"].initial = True
        else:
            self.fields["no_license"].initial = False
            self.fields["custom_license"].initial = self.instance.license_id
        if not is_mediacms_editor(user):
            if not user.advancedUser:
                self.fields.pop("allow_whisper_transcribe_and_translate")
                # self.fields.pop('allow_whisper_transcribe')

    def clean_website(self):
        website = self.cleaned_data.get("website", "")
        if website and not website.startswith("https://"):
            raise forms.ValidationError("Website should start with https://")
        return website

    def clean_summary(self):
        summary = self.cleaned_data.get("summary", "")
        num_words = len(summary.split(" "))
        if num_words > 60:
            raise forms.ValidationError("Synopsis should have 60 words maximum")
        return summary

    def clean_year_produced(self):
        year_produced = self.cleaned_data.get("year_produced", "")
        if year_produced:
            if not isinstance(year_produced, int):
                raise forms.ValidationError(
                    "Year produced must be a year between 2000 and now"
                )
            current_year = datetime.now().year
            if not (2000 <= year_produced <= current_year):
                raise forms.ValidationError(
                    f"Year produced must be between 2000 and {current_year}"
                )
        return year_produced

    def clean_uploaded_poster(self):
        image = self.cleaned_data.get("uploaded_poster", False)
        if image:
            if image.size > 5 * 1024 * 1024:
                raise forms.ValidationError("Image file too large ( > 5mb )")
            return image

    def clean(self):
        cleaned_data = super().clean()
        state = cleaned_data.get("state", False)
        password = cleaned_data.get("password", False)
        featured = cleaned_data.get("featured", False)
        if state == "restricted" and not password:
            error = "Password has to be set when state is Restricted"
            self.add_error("password", error)
        if state == "restricted" and featured:
            error = "This video cannot be featured as it is Restricted."
            self.add_error("featured", error)

    def save(self, *args, **kwargs):
        data = self.cleaned_data
        # take care of state changes, only interested if a transition private to public is not allowed
        state = data.get("state")
        if state != self.initial["state"]:
            if not is_mediacms_editor(self.user):
                if settings.PORTAL_WORKFLOW == "private":
                    self.instance.state = "private"
                if settings.PORTAL_WORKFLOW == "unlisted":
                    if state == "public":
                        self.instance.state = self.initial["state"]
                if settings.PORTAL_WORKFLOW == "private_verified":
                    # only for advanced users, allow from public/private to unlisted but not
                    # from private/unlisted to public
                    if self.user.advancedUser:
                        if state == "public":
                            pass
                            # allow
                            # self.instance.state = self.initial['state']
                    else:
                        self.instance.state = "private"

        if data.get("custom_license", "") and data.get("custom_license", "") not in [
            "None"
        ]:
            self.instance.license_id = data.get("custom_license")
            self.instance.save()
        if data.get("no_license"):
            self.instance.license = None
            self.instance.save()
        media = super(MediaForm, self).save(*args, **kwargs)
        return media


class SubtitleForm(forms.ModelForm):
    class Meta:
        model = Subtitle
        fields = ["language", "subtitle_file"]

    def __init__(self, media_item, *args, **kwargs):
        super(SubtitleForm, self).__init__(*args, **kwargs)
        self.instance.media = media_item
        self.fields[
            "subtitle_file"
        ].help_text = "SubRip (.srt) and WebVTT (.vtt) are supported file formats."
        self.fields["subtitle_file"].label = "Subtitle or Closed Caption File"

        self.fields["language"] = forms.ModelChoiceField(
            queryset=Language.objects.filter().exclude(code__contains="automatic"),
            # help_text=self.fields["subtitle_file"].help_text,
            required=True,
            label="Language",
        )

    def save(self, *args, **kwargs):
        data = self.cleaned_data
        self.instance.user = self.instance.media.user
        media = super(SubtitleForm, self).save(*args, **kwargs)
        return media


class EditSubtitleForm(forms.Form):
    subtitle = forms.CharField(widget=forms.Textarea, required=True)

    def __init__(self, subtitle, *args, **kwargs):
        super(EditSubtitleForm, self).__init__(*args, **kwargs)
        self.fields["subtitle"].initial = subtitle.subtitle_file.read().decode("utf-8")


class ContactForm(forms.Form):
    from_email = forms.EmailField(required=True)
    name = forms.CharField(required=False)
    message = forms.CharField(widget=forms.Textarea, required=True)
    captcha = ReCaptchaField(widget=ReCaptchaV2Checkbox)

    def __init__(self, user, *args, **kwargs):
        super(ContactForm, self).__init__(*args, **kwargs)
        self.fields["name"].label = "Your name:"
        self.fields["from_email"].label = "Your email:"
        self.fields["message"].label = "Please add your message here and submit:"
        self.user = user
        if user.is_authenticated:
            self.fields.pop("name")
            self.fields.pop("from_email")
