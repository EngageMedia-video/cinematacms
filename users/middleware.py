from django.shortcuts import redirect

class AuxiliaryDjangoAdminMiddleware:
  def __init__(self, get_response):
    self.get_response = get_response

  def __call__(self, request):
    response = self.get_response(request)
    # intercept attempts to access django admin if not logged in
    if request.path == '/admin/login':
      # Check if user is not authenticated or not a superuser or not logged in.
      if not request.user.is_authenticated or not request.user.is_superuser or not request.user:
        return redirect('/')
    response = self.get_response(request)

    return response