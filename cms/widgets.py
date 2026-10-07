from django.template.loader import render_to_string
from django.utils.safestring import mark_safe
from django_recaptcha.widgets import ReCaptchaV2Checkbox


class CSPReCaptchaV2Checkbox(ReCaptchaV2Checkbox):
    """Render the contact CAPTCHA without the package's inline callback."""

    template_name: str = "widgets/recaptcha_checkbox.html"

    def __init__(self):
        super().__init__(attrs={"data-callback": "cmsRecaptchaVerified"})

    def render(self, name, value, attrs=None, renderer=None):
        # The default form renderer does not search the project's templates.
        return mark_safe(render_to_string(self.template_name, self.get_context(name, value, attrs)))
