UI_VARIANT_PAGES = {
    "home": "cms/index_revamp.html",
    "media": "cms/media_revamp.html",
    "upload": "cms/add-media_revamp.html",
    "edit_media": "cms/edit_media_revamp.html",
    "profile": "cms/user_revamp.html",
}


def resolve_template(request, page_key):
    """Return the template for a migrated page.

    The template's base declares the page shell through the ``ui_variant`` block.
    """
    try:
        return UI_VARIANT_PAGES[page_key]
    except KeyError as exc:
        raise KeyError(f"Unknown UI variant page: {page_key}") from exc
