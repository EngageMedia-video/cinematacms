from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings
from django.core.exceptions import ValidationError
from django.urls import reverse
from django.shortcuts import resolve_url
from django.apps import apps
from allauth.mfa.utils import is_mfa_enabled
from utils.security import generate_key, generate_cipher
from cms.permissions import user_requires_mfa

from .models import BlackListedEmail


class MyAccountAdapter(DefaultAccountAdapter):
    def encrypt(self, text: str):
        encrypted_bytes = self.cipher_suite.encrypt(text.encode('utf-8'))
        return encrypted_bytes.decode('utf-8')
    
    def decrypt(self, encrypted_text: str):
        decrypted_bytes = self.cipher_suite.decrypt(encrypted_text.encode('utf-8'))
        return decrypted_bytes.decode('utf-8')

    def get_email_confirmation_url_stub(self, request, emailconfirmation):
        url = reverse("account_confirm_email", args=[emailconfirmation.key])
        return settings.SSL_FRONTEND_HOST + url

    def clean_email(self, email):
        if email.split("@")[1] in settings.RESTRICTED_DOMAINS_FOR_USER_REGISTRATION:
            raise ValidationError("Domain is restricted from registering")
        if BlackListedEmail.objects.filter(email=email.strip()).exists():
            raise ValidationError(
                "This email is banned, please check TOS and do not abuse cinemata.org"
            )
        return email

    def is_open_for_signup(self, request):
        return settings.USERS_CAN_SELF_REGISTER

    def send_mail(self, template_prefix, email, context):
        msg = self.render_mail(template_prefix, email, context)
        msg.send(fail_silently=True)

    def get_login_redirect_url(self, request):
        if user_requires_mfa(request.user):
            mfa_enabled = is_mfa_enabled(request.user)
            if not mfa_enabled:
                return resolve_url('/accounts/2fa/totp/activate')
            return resolve_url('/')
        return resolve_url('/')

    @property
    def key(self):
        return generate_key()
    
    @property
    def cipher_suite(self):
        return generate_cipher(self.key)
