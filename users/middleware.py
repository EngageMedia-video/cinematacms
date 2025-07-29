from django.http import HttpResponseRedirect, Http404
from allauth.mfa.utils import is_mfa_enabled
from cms.permissions import user_requires_mfa, should_enforce_mfa_on_path

class AdminMFAMiddleware:
  def __init__(self, get_response):
      self.get_response = get_response

  def __call__(self, request):
    if should_enforce_mfa_on_path(request.path):
      if not request.user.is_authenticated:
        return HttpResponseRedirect('/accounts/login/')
      if user_requires_mfa(request.user):
         if not is_mfa_enabled(request.user):
            return HttpResponseRedirect('/accounts/2fa/totp/activate')

    response = self.get_response(request)
    return response
