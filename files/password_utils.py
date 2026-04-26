from django.contrib.auth.hashers import identify_hasher


def is_valid_password_hash(encoded_password):
    """Return True only for structurally valid Django password hashes."""
    if not encoded_password:
        return False

    try:
        hasher = identify_hasher(encoded_password)
        hasher.decode(encoded_password)
    except (AttributeError, KeyError, TypeError, ValueError):
        return False

    return True
