"""Parsing and resolution of ``@handle`` mentions written inside comment text.

The mention set is resolved on the server so that the notification recipients
never depend on what the browser claims was mentioned.
"""

import functools
import operator
import re

from django.contrib.auth import get_user_model
from django.db.models import Q

User = get_user_model()

# A mention starts at the beginning of the text or after whitespace so that an
# email address such as ``someone@example.com`` is not read as a mention. The
# handle body accepts the same characters as ``users.urls.USERNAME_RE``.
MENTION_RE = re.compile(r"(?:^|(?<=\s))@(\w[\w.@_-]*)")

# Trailing punctuation belongs to the sentence rather than to the handle.
_TRAILING_PUNCTUATION = ".-_@"

# Upper bound on how many distinct handles one comment may resolve, so a single
# comment cannot fan out into an unbounded number of notifications or queries.
MAX_MENTIONS_PER_COMMENT = 20


def extract_mention_handles(text):
    """Return the distinct handles mentioned in ``text``, in first-seen order.

    Comparison is case-insensitive: ``@Alice`` and ``@alice`` yield one handle.
    """
    if not text:
        return []

    handles = []
    seen = set()
    for raw in MENTION_RE.findall(str(text)):
        handle = raw.rstrip(_TRAILING_PUNCTUATION)
        if not handle:
            continue
        lowered = handle.lower()
        if lowered in seen:
            continue
        seen.add(lowered)
        handles.append(handle)
        if len(handles) >= MAX_MENTIONS_PER_COMMENT:
            break
    return handles


def resolve_mentioned_users(text, exclude=None):
    """Return the active users named by the ``@handles`` in ``text``.

    Handles that match no active user are dropped. ``exclude`` removes one user
    from the result, which the comment view uses to skip the comment author.
    """
    handles = extract_mention_handles(text)
    if not handles:
        return []

    lookup = functools.reduce(operator.or_, (Q(username__iexact=handle) for handle in handles))
    users = User.objects.filter(lookup, is_active=True)
    if exclude is not None and getattr(exclude, "pk", None) is not None:
        users = users.exclude(pk=exclude.pk)

    # Usernames are unique but case-sensitive, so "Alice" and "alice" can both
    # exist and one iexact lookup can return both. Prefer the exact spelling the
    # comment used; fall back to a case-insensitive match for a hand-typed handle.
    exact = {user.username: user for user in users}
    folded = {}
    for user in users:
        folded.setdefault(user.username.lower(), user)

    resolved = []
    for handle in handles:
        user = exact.get(handle) or folded.get(handle.lower())
        if user is not None:
            resolved.append(user)
    return resolved
