from django import forms


class FineUploaderUploadForm(forms.Form):
    qqfile = forms.FileField()
    qquuid = forms.CharField()
    qqfilename = forms.CharField()
    qqpartindex = forms.IntegerField(required=False)
    qqchunksize = forms.IntegerField(required=False)
    qqtotalparts = forms.IntegerField(required=False)
    qqtotalfilesize = forms.IntegerField(required=False)
    qqpartbyteoffset = forms.IntegerField(required=False)


class FineUploaderUploadSuccessForm(forms.Form):
    qquuid = forms.CharField()
    qqfilename = forms.CharField()
    qqtotalparts = forms.IntegerField()
    qqtotalfilesize = forms.IntegerField(required=False)


class UploadSessionLookupForm(forms.Form):
    """Identity of a file the browser wants to resume; see ``uploader.sessions.find_resumable``."""

    filename = forms.CharField(max_length=255)
    total_size = forms.IntegerField(min_value=1)
    part_size = forms.IntegerField(min_value=1)
    fingerprint = forms.RegexField(regex=r"^[0-9a-f]{64}$")


class TusCreationForm(forms.Form):
    """A new tus upload: its Upload-Length and the Upload-Metadata values the server uses."""

    length = forms.IntegerField(min_value=1)
    filename = forms.CharField(max_length=255)
    fingerprint = forms.RegexField(regex=r"^[0-9a-f]{64}$", required=False)
    is_draft = forms.BooleanField(required=False)


class TusLookupForm(forms.Form):
    """Identity of a file the browser wants to resume; see ``uploader.tus.find_resumable``."""

    filename = forms.CharField(max_length=255)
    total_size = forms.IntegerField(min_value=1)
    fingerprint = forms.RegexField(regex=r"^[0-9a-f]{64}$")
    is_draft = forms.BooleanField(required=False)
