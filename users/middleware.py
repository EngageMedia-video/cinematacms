from django.http import HttpResponseRedirect, Http404
from allauth.mfa.utils import is_mfa_enabled

class AdminMFAMiddleware:
  def __init__(self, get_response):
      self.get_response = get_response

  def __call__(self, request):
    # Only check admin paths, NEVER upload paths
    if (request.path.startswith('/admin/') and 
      not request.path.startswith('/fu/') and  # Exclude file uploads
      not request.path.startswith('/api/')):   # Exclude API endpoints
      
      if not request.user.is_authenticated:
          return HttpResponseRedirect('/accounts/login/')
      
      if not request.user.is_superuser:
          return HttpResponseRedirect('/')
      
      if not is_mfa_enabled(request.user):
          # Redirect to MFA setup
          return HttpResponseRedirect('/accounts/2fa/totp/activate')
    
    response = self.get_response(request)
    return response
