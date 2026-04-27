import logging

from django.conf import settings

logger = logging.getLogger(__name__)


UI_VARIANT_PAGES = {
    "home": ("cms/index.html", "cms/index_revamp.html"),
}


def _get_variant_configuration():
    allowed_variants = set(getattr(settings, "UI_VARIANT_ALLOWED", ["legacy", "revamp"]) or ["legacy"])
    default_variant = getattr(settings, "UI_VARIANT_DEFAULT", "legacy")
    if default_variant not in allowed_variants:
        logger.warning(
            "UI_VARIANT_DEFAULT=%r not in UI_VARIANT_ALLOWED=%r; falling back to 'legacy'",
            default_variant,
            sorted(allowed_variants),
        )
        default_variant = "legacy"

    fallback_variant = "legacy" if "legacy" in allowed_variants else default_variant
    return allowed_variants, fallback_variant


def resolve_template(request, page_key):
    """Resolve template for a page and expose resolved variant on request."""
    try:
        legacy_template, revamp_template = UI_VARIANT_PAGES[page_key]
    except KeyError as exc:
        raise KeyError(f"Unknown UI variant page: {page_key}") from exc

    allowed_variants, fallback_variant = _get_variant_configuration()
    revamp_pages = getattr(settings, "UI_VARIANT_REVAMP_PAGES", []) or []
    variant = fallback_variant

    if "revamp" in allowed_variants and page_key in revamp_pages:
        variant = "revamp"
    elif "revamp" in allowed_variants:
        user = getattr(request, "user", None)
        is_staff = getattr(user, "is_staff", False)
        if is_staff and request.GET.get("ui") == "revamp":
            variant = "revamp"

    request.ui_variant = variant
    return revamp_template if variant == "revamp" else legacy_template


def ui_variant_context_processor(request):
    """Expose resolved UI variant to templates and JS bootstrap."""
    _, fallback_variant = _get_variant_configuration()
    return {"UI_VARIANT": getattr(request, "ui_variant", fallback_variant)}
