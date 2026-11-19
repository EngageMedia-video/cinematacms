import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "cms.settings")

from cms.error_tracking import configure_error_tracking  # noqa: E402
from cms.observability import configure_django_observability  # noqa: E402
from cms.request_utils import take_client_address_from_local_proxy  # noqa: E402

configure_error_tracking()
configure_django_observability()

application = take_client_address_from_local_proxy(get_wsgi_application())
