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
