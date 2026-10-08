"""Portable Content Security Policy defaults for the CMS."""

from collections.abc import Callable, Mapping, Sequence
from urllib.parse import urlsplit

from csp.constants import NONCE, NONE, SELF
from django.http import HttpRequest, HttpResponse
from django.utils.cache import patch_cache_control


def build_policy(
    *,
    static_url: str,
    media_url: str,
    upload_url: str,
    vite: Mapping[str, object],
    analytics_url: str = "",
    extra_sources: Mapping[str, Sequence[str]] | None = None,
    report_uri: str = "",
):
    directives = {
        "default-src": [NONE],
        "base-uri": [NONE],
        "object-src": [NONE],
        "frame-ancestors": [SELF],
        "form-action": [SELF],
        "script-src": [
            SELF,
            NONCE,
            "https://www.google.com/recaptcha/",
            "https://www.gstatic.com/recaptcha/",
            "https://vjs.zencdn.net/7.20.2/video.min.js",
            "https://cdnjs.cloudflare.com/ajax/libs/file-uploader/5.13.0/fine-uploader.min.js",
        ],
        "script-src-attr": [NONE],
        "style-src": [SELF, NONCE, "https://vjs.zencdn.net/7.20.2/video-js.min.css", "https://fonts.googleapis.com"],
        "style-src-attr": [NONE],
        "img-src": [SELF, "data:", "blob:"],
        "font-src": [SELF, "data:", "https://fonts.gstatic.com"],
        "media-src": [SELF, "blob:"],
        "connect-src": [SELF, "https://www.google.com/recaptcha/"],
        "frame-src": [SELF, "https://www.google.com/recaptcha/", "https://recaptcha.google.com/recaptcha/"],
        "worker-src": [SELF, "blob:"],
        "manifest-src": [SELF],
    }
    parsed_analytics = urlsplit(analytics_url)
    if parsed_analytics.scheme != "https" or not parsed_analytics.hostname or parsed_analytics.username:
        analytics_url = ""
    # CDN assets are selectable at runtime through the load_from_cdn Waffle switch.
    for url, names in (
        (static_url, ("script-src", "style-src", "font-src", "img-src")),
        (media_url, ("img-src", "media-src", "connect-src")),
        (upload_url, ("connect-src",)),
        (analytics_url, ("connect-src",)),
    ):
        parsed = urlsplit(url)
        if parsed.scheme and parsed.netloc:
            origin = f"{parsed.scheme}://{parsed.netloc}"
            for name in names:
                if origin not in directives[name]:
                    directives[name].append(origin)
    if analytics_url:
        directives["script-src"].append(f"{analytics_url.rstrip('/')}/script.js")
    if vite.get("dev_mode"):
        protocol = vite.get("dev_server_protocol", "http")
        host = vite.get("dev_server_host", "localhost")
        port = vite.get("dev_server_port", 5173)
        origin = f"{protocol}://{host}:{port}"
        directives["script-src"].append(origin)
        directives["style-src"].append(origin)
        directives["connect-src"].extend([origin, f"{'wss' if protocol == 'https' else 'ws'}://{host}:{port}"])
    for name, sources in (extra_sources or {}).items():
        directives[name].extend(sources)
    if report_uri:
        directives["report-uri"] = [report_uri]
    return {"DIRECTIVES": directives}


class NonceCacheControlMiddleware:
    """Keep pages carrying a request nonce out of browser and shared caches."""

    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        response = self.get_response(request)
        if getattr(request, "csp_nonce", None):
            patch_cache_control(response, private=True, no_store=True)
        return response
