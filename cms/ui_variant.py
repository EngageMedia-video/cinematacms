UI_VARIANT_PAGES = {
    "home": "cms/index_revamp.html",
    "media": "cms/media_revamp.html",
    "upload": "cms/add-media_revamp.html",
    "edit_media": "cms/edit_media_revamp.html",
    "profile": "cms/user_revamp.html",
}


def resolve_template(request, page_key):
    """Resolve a migrated page and expose its shell variant on the request."""
    try:
        template = UI_VARIANT_PAGES[page_key]
    except KeyError as exc:
        raise KeyError(f"Unknown UI variant page: {page_key}") from exc

    request.ui_variant = "revamp"
    return template


def ui_variant_context_processor(request):
    """Expose resolved UI variant to templates and JS bootstrap."""
    return {"UI_VARIANT": getattr(request, "ui_variant", "revamp")}
