from django.conf import settings

_SAFE_VARIANTS = frozenset({"legacy", "revamp"})


def resolve_template(request, page_key, legacy_template, revamp_template):
    """Return the template to render for a page, and set request.ui_variant.

    Resolution order:
    1. page_key in UI_VARIANT_REVAMP_PAGES → revamp (all users)
    2. is_staff + ?ui=revamp query param → revamp (staff preview only)
    3. Otherwise → legacy
    """
    revamp_pages = getattr(settings, "UI_VARIANT_REVAMP_PAGES", None) or []

    if page_key in revamp_pages:
        variant = "revamp"
    else:
        user = getattr(request, "user", None)
        is_staff = getattr(user, "is_staff", False)
        if is_staff and request.GET.get("ui") == "revamp":
            variant = "revamp"
        else:
            variant = "legacy"

    request.ui_variant = variant
    return revamp_template if variant == "revamp" else legacy_template
