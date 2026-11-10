from dataclasses import dataclass

from waffle import flag_is_active

UI_VARIANT_PAGES = {
    "home": "cms/index_revamp.html",
    "media": "cms/media_revamp.html",
    "upload": "cms/add-media_revamp.html",
    "edit_media": "cms/edit_media_revamp.html",
    "profile": "cms/user_revamp.html",
}


@dataclass(frozen=True)
class PageRollout:
    old_template: str
    new_template: str


PAGES_IN_ROLLOUT: dict[str, PageRollout] = {}


def resolve_template(request, page_key):
    """Return the template for a migrated page.

    A page in ``PAGES_IN_ROLLOUT`` follows its ``ui_v2_<page_key>`` waffle flag.
    The template's base declares the page shell through the ``ui_variant`` block.
    """
    rollout = PAGES_IN_ROLLOUT.get(page_key)
    if rollout is not None:
        return rollout.new_template if flag_is_active(request, f"ui_v2_{page_key}") else rollout.old_template

    try:
        return UI_VARIANT_PAGES[page_key]
    except KeyError as exc:
        raise KeyError(f"Unknown UI variant page: {page_key}") from exc
