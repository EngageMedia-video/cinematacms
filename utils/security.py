"""Security util methods for general use."""

import base64
from hashlib import sha256

from cryptography.fernet import Fernet
from django.conf import settings


def generate_key():
    digest = sha256(settings.SECRET_KEY.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def generate_cipher(key):
    return Fernet(key)
