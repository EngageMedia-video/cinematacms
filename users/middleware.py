from allauth.mfa.utils import is_mfa_enabled
from django.http import HttpResponseRedirect

from cms.permissions import should_enforce_mfa_on_path, user_requires_mfa


class AdminMFAMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if should_enforce_mfa_on_path(request.path):
            if not request.user.is_authenticated:
                return HttpResponseRedirect("/accounts/login/")
            if user_requires_mfa(request.user):
                if not is_mfa_enabled(request.user):
                    return HttpResponseRedirect("/accounts/2fa/totp/activate")

        response = self.get_response(request)
        return response
