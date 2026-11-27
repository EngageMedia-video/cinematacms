"""Every Domain event type that code may emit.

Define a type here only when a handler needs it, for example::

    MEDIA_PUBLISHED = define(EventSpec("media.published", 1, ("media_id", "owner_id")))

A payload holds IDs, plus the fields a handler needs once the subject is gone (for a delete: the title
and the owner id). It never holds an email address, a token or another secret. Changing the fields
bumps the version, and a handler must accept every version that is still inside the retention period.
"""

from .registry import EventSpec, define  # noqa: F401
