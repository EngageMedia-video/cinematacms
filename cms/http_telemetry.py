"""Bounded HTTP operation classification for application telemetry.

The route table below is deliberately keyed by Django's resolved route
identity, rather than by the request path. A path can contain identifiers and
query data, while a ``ResolverMatch`` contains the stable URLconf identity that
the application actually selected.
"""

from collections.abc import Iterable
from dataclasses import dataclass

from files.metrics import record_contract_violation

HTTP_METHODS = frozenset({"GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"})
HTTP_ROUTE_METHODS = HTTP_METHODS | {"OTHER"}


HTTP_ROUTE_GROUPS = frozenset(
    {
        "system",
        "pages",
        "web_search",
        "media_delivery",
        "upload_ui",
        "upload_transfer",
        "search_api",
        "media_api",
        "moderation_api",
        "moderation_ui",
        "self_upload_api",
        "notifications_api",
        "users_api",
        "playlists_api",
        "taxonomy_api",
        "task_api",
        "api_other",
        "third_party",
        "unmatched",
    }
)


@dataclass(frozen=True)
class RouteOperation:
    route_group: str
    operation: str


@dataclass(frozen=True)
class _RouteRule:
    namespace: str
    url_name: str
    route: str
    default: RouteOperation
    by_method: tuple[tuple[str, RouteOperation], ...] = ()

    def operation_for(self, method: str) -> RouteOperation:
        return dict(self.by_method).get(method, self.default)


def _operation(route_group: str, operation: str) -> RouteOperation:
    return RouteOperation(route_group, operation)


def _rule(
    route: str,
    route_group: str,
    operation: str,
    *,
    url_name: str = "",
    namespace: str = "",
    by_method: tuple[tuple[str, RouteOperation], ...] = (),
) -> _RouteRule:
    return _RouteRule(namespace, url_name, route, _operation(route_group, operation), by_method)


_MEDIA_CREATE = _operation("upload_transfer", "upload_transfer")


# This is the owned URLconf inventory. Keep route strings identical to
# ResolverMatch.route, including the ``^`` used by re_path(). Every entry is
# expanded below for all bounded HTTP methods so a resolved 405 remains
# attributed to its registered operation.
_OWNED_ROUTE_RULES = (
    # cms.urls
    _rule("robots.txt", "pages", "robots"),
    _rule("metrics", "system", "metrics"),
    _rule("health/live", "system", "health_live"),
    _rule("health/ready", "system", "health_ready"),
    # notifications.urls
    _rule("api/v1/notifications/", "notifications_api", "notifications_list", url_name="notification-list"),
    _rule(
        "api/v1/notifications/unread-count/",
        "notifications_api",
        "notifications_unread_count",
        url_name="notification-unread-count",
    ),
    _rule(
        "api/v1/notifications/preferences/",
        "notifications_api",
        "notifications_preferences",
        url_name="notification-preferences",
    ),
    _rule(
        "api/v1/notifications/<int:notification_id>/read/",
        "notifications_api",
        "notification_read",
        url_name="notification-read",
    ),
    _rule(
        "api/v1/notifications/mark-all-read/",
        "notifications_api",
        "notifications_mark_all_read",
        url_name="notification-mark-all-read",
    ),
    # files.urls, secure media and template views
    _rule("media/<path:file_path>", "media_delivery", "media_delivery", url_name="secure_media"),
    _rule("rss/", "web_search", "rss_search"),
    _rule("rss", "web_search", "rss_search"),
    _rule("^rss/search", "web_search", "rss_search"),
    _rule("", "pages", "home"),
    _rule("latest", "pages", "other"),
    _rule("featured", "pages", "other"),
    _rule("recommended", "pages", "other"),
    _rule("popular", "pages", "other"),
    _rule("^p/(?P<slug>[\\w-]*)$", "pages", "other", url_name="get_page"),
    _rule("tos", "pages", "other", url_name="terms_of_service"),
    _rule("creative-commons", "pages", "other", url_name="creative_commons"),
    _rule("categories", "pages", "other", url_name="categories"),
    _rule("^members", "pages", "other", url_name="members"),
    _rule("^tags", "pages", "other", url_name="tags"),
    _rule("contact", "pages", "other", url_name="contact"),
    _rule("countries", "pages", "other", url_name="countries"),
    _rule("languages", "pages", "other", url_name="languages"),
    _rule("topics", "pages", "other", url_name="topics"),
    _rule("history", "pages", "other", url_name="history"),
    _rule("liked", "pages", "other", url_name="liked_media"),
    _rule("notifications/", "pages", "other", url_name="notifications"),
    _rule("^view", "pages", "other", url_name="get_media"),
    _rule("edit", "pages", "other", url_name="edit_media"),
    _rule("^add_subtitle", "pages", "other", url_name="add_subtitle"),
    _rule("^edit_subtitle", "pages", "other", url_name="edit_subtitle"),
    _rule("^embed", "pages", "other", url_name="get_embed"),
    _rule("^upload", "upload_ui", "upload_page", url_name="upload_media"),
    _rule("^scpublisher", "upload_ui", "upload_page", url_name="upload_media"),
    _rule("^search", "web_search", "web_search", url_name="search"),
    _rule("^playlist/(?P<friendly_token>[\\w]+(-[\\w]+)*)$", "pages", "other", url_name="get_playlist"),
    _rule("^playlists/(?P<friendly_token>[\\w]+(-[\\w]+)*)$", "pages", "other", url_name="get_playlist"),
    # files.urls, API views
    _rule("api/v1/media", "media_api", "media_list", by_method=(("POST", _MEDIA_CREATE),)),
    _rule("api/v1/media/", "media_api", "media_list", by_method=(("POST", _MEDIA_CREATE),)),
    _rule(
        "^api/v1/media/(?P<friendly_token>[\\w]+(-[\\w]+)*)$",
        "media_api",
        "media_detail",
        url_name="api_get_media",
    ),
    _rule(
        "^api/v1/media/(?P<friendly_token>[\\w]+(-[\\w]+)*)/abandon$",
        "media_api",
        "other",
        url_name="api_abandon_media",
    ),
    _rule(
        "^api/v1/media/encoding/(?P<encoding_id>[\\w]*)$",
        "media_api",
        "other",
        url_name="api_get_encoding",
    ),
    _rule("api/v1/search", "search_api", "search"),
    _rule("^api/v1/media/(?P<friendly_token>[\\w]+(-[\\w]+)*)/actions$", "media_api", "other"),
    _rule(
        "^api/v1/media/(?P<friendly_token>[\\w]+(-[\\w]+)*)/password$",
        "media_api",
        "restricted_media_token",
        url_name="api_media_password",
    ),
    _rule("api/v1/categories", "taxonomy_api", "taxonomy_categories"),
    _rule("api/v1/topics", "taxonomy_api", "taxonomy_topics"),
    _rule("api/v1/content-sensitivities", "taxonomy_api", "other"),
    _rule("api/v1/languages", "taxonomy_api", "other"),
    _rule("api/v1/countries", "taxonomy_api", "taxonomy_countries"),
    _rule("api/v1/tags", "taxonomy_api", "other"),
    _rule("api/v1/subtitle-languages", "taxonomy_api", "taxonomy_subtitle_languages"),
    _rule("api/v1/comments", "media_api", "other"),
    _rule(
        "^api/v1/media/(?P<friendly_token>[\\w]+(-[\\w]+)*)/comments$",
        "media_api",
        "other",
    ),
    _rule(
        "^api/v1/media/(?P<friendly_token>[\\w]+(-[\\w]+)*)/comments/(?P<uid>[\\w]+(-[\\w]+)*)$",
        "media_api",
        "other",
    ),
    _rule(
        "^api/v1/media/(?P<friendly_token>[\\w]+(-[\\w]+)*)/private-journal$",
        "media_api",
        "private_journal",
    ),
    _rule(
        "^api/v1/media/(?P<friendly_token>[\\w]+(-[\\w]+)*)/private-journal/(?P<uid>[\\w]+(-[\\w]+)*)$",
        "media_api",
        "private_journal",
    ),
    _rule(
        "^api/v1/media/(?P<friendly_token>[\\w]+(-[\\w]+)*)/community-impacts$",
        "media_api",
        "other",
    ),
    _rule("api/v1/playlists", "playlists_api", "playlist_list"),
    _rule("api/v1/playlists/", "playlists_api", "playlist_list"),
    _rule(
        "^api/v1/playlists/(?P<friendly_token>[\\w]+(-[\\w]+)*)$",
        "playlists_api",
        "playlist_detail",
        url_name="api_get_playlist",
    ),
    _rule("^api/v1/user/action/(?P<action>[\\w]*)$", "api_other", "api_other"),
    _rule(
        "^api/v1/keys/(?P<friendly_token>[\\w]+(-[\\w]+)*)/?$",
        "media_delivery",
        "media_delivery",
        url_name="api_get_media_key",
    ),
    # uploader.urls
    _rule("fu/upload/", "upload_transfer", "upload_transfer", url_name="upload", namespace="uploader"),
    _rule(
        "fu/^upload/update/(?P<friendly_token>[\\w-]+)/$",
        "upload_transfer",
        "upload_transfer",
        url_name="update",
        namespace="uploader",
    ),
    _rule(
        "fu/^upload/cancel/(?P<friendly_token>[\\w-]+)/$",
        "upload_transfer",
        "upload_transfer",
        url_name="cancel",
        namespace="uploader",
    ),
    # files.urls, moderation and self-upload views
    _rule("api/v1/manage_media", "moderation_api", "moderation_media"),
    _rule("api/v1/manage_comments", "moderation_api", "other"),
    _rule("api/v1/manage_film_impact", "moderation_api", "moderation_film_impact"),
    _rule("api/v1/manage_film_impact/<uuid:uid>", "moderation_api", "moderation_film_impact"),
    _rule("api/v1/manage_users", "moderation_api", "other"),
    _rule("manage/users", "moderation_ui", "other", url_name="manage_users"),
    _rule("manage/media", "moderation_ui", "other", url_name="manage_media"),
    _rule("manage/comments", "moderation_ui", "other", url_name="manage_comments"),
    _rule("manage/film-impact", "moderation_ui", "film_impact_page", url_name="manage_film_impact"),
    _rule(
        "manage/film-impact/<uuid:uid>/edit",
        "moderation_ui",
        "other",
        url_name="manage_film_impact_edit",
    ),
    _rule("api/v1/my_uploads", "self_upload_api", "self_uploads_list"),
    _rule("api/v1/my_uploads/bulk_state", "self_upload_api", "self_uploads_bulk_state"),
    _rule("api/v1/my_uploads/upload_options", "self_upload_api", "self_upload_options"),
    _rule("manage/uploads", "moderation_ui", "manage_uploads", url_name="manage_uploads"),
    _rule("manage/users/export", "moderation_ui", "other", url_name="export_users"),
    _rule("api/v1/encode_profiles/", "api_other", "other"),
    _rule("api/v1/tasks", "task_api", "task_control"),
    _rule("api/v1/tasks/", "task_api", "task_control"),
    _rule("^api/v1/tasks/(?P<friendly_token>[\\w|\\W]*)$", "task_api", "task_control"),
    _rule("api/v1/topmessage", "api_other", "other"),
    _rule("api/v1/indexfeatured", "api_other", "other"),
    _rule("api/v1/homepagepopup", "api_other", "other"),
    _rule(
        "^Members/(?P<user>[\\w.@-]*)/videos/(?P<video>[\\w.@-]*)$",
        "pages",
        "other",
        url_name="get_old_media",
    ),
    _rule(
        "^Members/(?P<user>[\\w.@-]*)/videos/(?P<video>[\\w.@-]*)/$",
        "pages",
        "other",
        url_name="get_old_media",
    ),
    _rule(
        "^Members/(?P<user>[\\w.@-]*)/videos/(?P<video>[\\w.@-]*)/view$",
        "pages",
        "other",
        url_name="get_old_media",
    ),
    _rule(
        "^Members/(?P<user>[\\w.@-]*)/videos/(?P<video>[\\w.@-]*)/embed_view",
        "pages",
        "other",
        url_name="embed_old_media",
    ),
    _rule("modern-demo", "pages", "other", url_name="modern_demo"),
    _rule("^(?P<slug>[\\w.-]*)$", "pages", "other", url_name="get_page"),
    _rule("tinymce/upload/", "third_party", "third_party", url_name="tinymce_upload_image"),
    # users.urls
    _rule("^user/(?P<username>[\\w@._-]+)$", "pages", "other", url_name="get_user"),
    _rule("^user/(?P<username>[\\w@._-]+)/$", "pages", "other", url_name="get_user"),
    _rule("^user/(?P<username>[\\w@._-]+)/media$", "pages", "other", url_name="get_user_media"),
    _rule("^user/(?P<username>[\\w@._-]+)/playlists$", "pages", "other", url_name="get_user_playlists"),
    _rule("^user/(?P<username>[\\w@._-]+)/about$", "pages", "other", url_name="get_user_about"),
    _rule("^user/(?P<username>[\\w@._-]+)/uploads$", "pages", "other", url_name="get_user_manage_uploads"),
    _rule("^user/(?P<username>[\\w@._-]+)/notes$", "pages", "other", url_name="get_user_notes"),
    _rule("^user/(?P<username>[\\w@._-]+)/impact$", "pages", "other", url_name="get_user_impact"),
    _rule("^user/(?P<username>[\\w@._-]+)/contact$", "pages", "other", url_name="get_user_contact"),
    _rule("^user/(?P<username>[\\w@._-]+)/history$", "pages", "other", url_name="get_user_history"),
    _rule("^user/(?P<username>[\\w@._-]+)/liked$", "pages", "other", url_name="get_user_liked"),
    _rule("^user/(?P<username>[\\w@._-]+)/edit$", "pages", "other", url_name="edit_user"),
    _rule("^user/(?P<username>[\\w@._-]+)/settings$", "pages", "other", url_name="user_settings"),
    _rule("^channel/(?P<friendly_token>\\w+(-\\w+)*)$", "pages", "other", url_name="view_channel"),
    _rule("^channel/(?P<friendly_token>\\w+(-\\w+)*)/edit$", "pages", "other", url_name="edit_channel"),
    _rule("api/v1/users", "users_api", "user_list", url_name="api_users"),
    _rule("api/v1/users/", "users_api", "user_list"),
    _rule(
        "api/v1/users/mention-suggestions",
        "users_api",
        "mention_suggestions",
        url_name="api_mention_suggestions",
    ),
    _rule("^api/v1/users/(?P<username>[\\w@._-]+)$", "users_api", "other", url_name="api_get_user"),
    _rule(
        "^api/v1/users/(?P<username>[\\w@._-]+)/community-impacts$",
        "users_api",
        "user_community_impacts",
        url_name="api_user_community_impacts",
    ),
    _rule(
        "^api/v1/users/(?P<username>[\\w@._-]+)/private-journal$",
        "users_api",
        "private_journal",
        url_name="api_user_private_journal",
    ),
    _rule("^api/v1/users/(?P<username>[\\w@._-]+)/contact", "users_api", "user_contact", url_name="api_contact_user"),
    _rule("^accounts/2fa/totp/success", "third_party", "third_party", url_name="mfa_success"),
)


def _rule_key(rule: _RouteRule) -> tuple[str, str, str]:
    return rule.namespace, rule.url_name, rule.route


def _route_key(match) -> tuple[str, str, str]:
    return (
        getattr(match, "namespace", "") or "",
        getattr(match, "url_name", "") or "",
        getattr(match, "route", "") or "",
    )


def route_identity(match) -> tuple[str, str, str]:
    """Return the stable identity used to look up a resolved URLconf route."""

    return _route_key(match)


def _build_registry() -> dict[tuple[str, str, str, str], RouteOperation]:
    registry: dict[tuple[str, str, str, str], RouteOperation] = {}
    for rule in _OWNED_ROUTE_RULES:
        for method in HTTP_ROUTE_METHODS:
            registry[(*_rule_key(rule), method)] = rule.operation_for(method)
    return registry


ROUTE_OPERATION_REGISTRY = _build_registry()
# These aliases make the owned contract discoverable without requiring callers
# to know the implementation's historical name.
HTTP_ROUTE_REGISTRY = ROUTE_OPERATION_REGISTRY
ROUTE_REGISTRY = ROUTE_OPERATION_REGISTRY


# Retain the named-operation view for code and tests that only need a URL name.
# Route classification itself always performs the complete route-and-method
# lookup above.
NAMED_OPERATIONS = {
    rule.url_name: rule.default for rule in _OWNED_ROUTE_RULES if rule.url_name and rule.namespace == ""
}


THIRD_PARTY_NAMESPACES = frozenset({"admin", "djdt", "rest_framework"})
THIRD_PARTY_MODULE_PREFIXES = ("allauth.", "debug_toolbar.", "django.", "tinymce.")
THIRD_PARTY_OPERATION = RouteOperation("third_party", "third_party")
UNMATCHED_OPERATION = RouteOperation("unmatched", "not_found")
CONTRACT_FALLBACK_OPERATION = RouteOperation("api_other", "other")


def _runtime_contract_violation(field: str) -> None:
    try:
        record_contract_violation("http", field)
    except Exception:
        # Telemetry must not change request behavior, including when the
        # contract-violation metric itself is unavailable.
        return


def normalize_method(method: str) -> str:
    normalized = str(method or "").upper()
    if normalized in HTTP_METHODS:
        return normalized
    if normalized != "OTHER":
        _runtime_contract_violation("method")
    return "OTHER"


def normalize_status_code(status_code: int) -> str:
    try:
        normalized = int(status_code)
    except (TypeError, ValueError, OverflowError):
        _runtime_contract_violation("status_code")
        return "other"
    if 100 <= normalized <= 599:
        return str(normalized)
    _runtime_contract_violation("status_code")
    return "other"


def normalize_status_class(status_code: int) -> str:
    try:
        normalized = int(status_code)
    except (TypeError, ValueError, OverflowError):
        _runtime_contract_violation("status_class")
        return "other"
    if 100 <= normalized <= 599:
        return f"{normalized // 100}xx"
    _runtime_contract_violation("status_class")
    return "other"


def _is_third_party(match) -> bool:
    namespace = getattr(match, "namespace", "") or ""
    if namespace in THIRD_PARTY_NAMESPACES:
        return True
    module = getattr(getattr(match, "func", None), "__module__", "") or ""
    return module.startswith(THIRD_PARTY_MODULE_PREFIXES)


def classify_request(request, method: str | None = None) -> tuple[str, str]:
    """Classify a request by its resolved route identity and bounded method.

    ``request.resolver_match`` is populated by Django's URL resolver. The
    optional method argument is useful to callers that already have a resolved
    match; normal middleware passes the request method.
    """

    match = getattr(request, "resolver_match", None)
    if match is None:
        return UNMATCHED_OPERATION.route_group, UNMATCHED_OPERATION.operation

    if _is_third_party(match):
        return THIRD_PARTY_OPERATION.route_group, THIRD_PARTY_OPERATION.operation

    normalized_method = normalize_method(method if method is not None else getattr(request, "method", ""))
    entry = ROUTE_OPERATION_REGISTRY.get((*route_identity(match), normalized_method))
    if entry is not None:
        return entry.route_group, entry.operation

    _runtime_contract_violation("route")
    return CONTRACT_FALLBACK_OPERATION.route_group, CONTRACT_FALLBACK_OPERATION.operation


def iter_owned_route_identities(patterns: Iterable) -> Iterable[tuple[str, str, str]]:
    """Yield route identities for first-party URLconf patterns.

    This helper is only an inventory reader. The registry is the static
    contract above; callers can compare the two sets in CI to catch a URLconf
    change that forgot to add telemetry coverage.
    """

    from django.urls import URLResolver

    def walk(current, prefix="", namespace=""):
        for pattern in current:
            route = getattr(pattern.pattern, "_route", None)
            if route is None:
                route = pattern.pattern.regex.pattern
            if isinstance(pattern, URLResolver):
                child_namespace = namespace + (":" if namespace else "") + (pattern.namespace or "")
                yield from walk(pattern.url_patterns, prefix + route, child_namespace)
                continue
            callback = pattern.callback
            module = getattr(callback, "__module__", "") or ""
            if module.startswith(("cms.", "files.", "notifications.", "uploader.", "users.")):
                yield namespace, pattern.name or "", prefix + route

    yield from walk(patterns)
