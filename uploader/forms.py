from django import forms


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
