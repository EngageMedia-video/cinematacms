from django.conf import settings


def resolve_template(request, page_key, legacy_template, revamp_template):
    """Resolve template for a page and expose resolved variant on request."""
    allowed_variants = set(getattr(settings, "UI_VARIANT_ALLOWED", ["legacy", "revamp"]) or ["legacy"])
    default_variant = getattr(settings, "UI_VARIANT_DEFAULT", "legacy")
    if default_variant not in allowed_variants:
        default_variant = "legacy"

    revamp_pages = getattr(settings, "UI_VARIANT_REVAMP_PAGES", []) or []
    variant = default_variant

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
    return {"UI_VARIANT": getattr(request, "ui_variant", getattr(settings, "UI_VARIANT_DEFAULT", "legacy"))}
