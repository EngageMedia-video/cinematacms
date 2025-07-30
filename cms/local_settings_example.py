'''This is an example Python script for local_settings.py.'''

import os
from dotenv import load_dotenv
load_dotenv()

BASE_DIR = os.path.abspath('.')

FRONTEND_HOST='http://127.0.0.1:8000'
PORTAL_NAME='MediaCMS'
SSL_FRONTEND_HOST=FRONTEND_HOST.replace('http', 'https')
SECRET_KEY=os.getenv('SECRET_KEY')
LOCAL_INSTALL=True
DEBUG = True
STATIC_URL = '/static/'
STATICFILES_DIRS = [os.path.join(BASE_DIR, "static")]
STATIC_ROOT = os.path.join(BASE_DIR, 'static_collected')

# Custom MFA settings
MFA_REQUIRED_ROLES = ['superuser'] # options: superuser, advanced_user, authenticated, manager, editor