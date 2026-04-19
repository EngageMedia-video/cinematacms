---
date: 2026-04-19
topic: ui-variant-gate
---

# UI Variant Gate with Shared Design Tokens

## Problem Frame

CinemataCMS is undergoing a major frontend redesign (Kumquat design system). Django renders templates directly and mounts Vite entry points per page. Three gaps block an incremental rollout:

1. No server-side mechanism to serve a different template on the same URL based on configuration.
2. Legacy SCSS pages and revamp Tailwind pages will have different CSS token palettes — without a runtime gate, either the old tokens bleed into revamp pages or the new tokens break legacy pages.
3. Developers need a safe way to preview revamp pages before they are released to all users.

## Requirements

**Backend Variant Infrastructure**

- R1. A `resolve_template(request, page_key, legacy_template, revamp_template)` helper returns `revamp_template` when `page_key` is in `settings.UI_VARIANT_REVAMP_PAGES` (accessed via `getattr(settings, 'UI_VARIANT_REVAMP_PAGES', [])` so a missing entry degrades to legacy, not an error), `legacy_template` otherwise. Users with `request.user.is_staff` can override to revamp via `?ui=revamp` query param (per-request, not persisted). The helper sets `request.ui_variant` as a side effect so downstream code can read the resolved value.
- R2. `UI_VARIANT` is exposed to every template by extending the existing `cms/context_processors.ui_settings` function (not a new registered processor), defaulting to `"legacy"` if no view called `resolve_template()` (i.e., non-migrated pages). This keeps context processor registration to a single entry.
- R3. Settings in `cms/settings.py` control the gate: `UI_VARIANT_DEFAULT = "legacy"`, `UI_VARIANT_REVAMP_PAGES = []`. Operators may override in `local_settings.py` for per-environment control.
- R4. `?ui=revamp` staff preview is per-request only — no cookie, no session persistence. Non-staff users who send this param see the legacy template.

**Frontend Bootstrap**

- R5. The `templates/config/index.html` bootstrap adds `ui: { variant: "{{ UI_VARIANT }}" }` as a property inside the `MediaCMS` object literal (not as a separate post-assignment), so React code can read `window.MediaCMS.ui.variant` at initialization.

**CSS Token Gate**

- R6. `base.html` (or equivalent shared layout) sets `data-ui-variant="{{ UI_VARIANT }}"` on `<body>`. This is the runtime gate that makes CSS token scoping possible without build-time branching.
- R7. **[Phase 3 — blocked on Figma token extraction]** Kumquat (revamp) design tokens use a distinct CSS var namespace (e.g., `--kq-brand-primary`) and are defined under the `body[data-ui-variant="revamp"]` selector. Legacy tokens (`body.light_theme` / `body.dark_theme`) are not modified. The Kumquat namespace avoids any collision with existing legacy vars.
- R8. **[Phase 3 — blocked on Figma token extraction]** The `@theme inline` block in `frontend/src/static/css/tailwind.css` is extended with new entries mapping Kumquat CSS vars to Tailwind utility classes (e.g., `--color-kq-brand-primary: var(--kq-brand-primary)`). Revamp components use these new utility classes; legacy components use existing ones. Both sets of Tailwind mappings coexist in the same build.

**Revamp Page Convention**

- R9. Each revamp page container must carry `data-modern-track` to activate the `all: revert-layer` CSS isolation that prevents legacy SCSS from bleeding into Tailwind-rendered components.
- R10. All revamp page code lives in `frontend/src/features/<page-name>/`, consistent with the modern track convention documented in `CONTRIBUTING.md`. No third frontend directory is created.
- R11. Each revamp page has: a Django template (`templates/cms/<page>_revamp.html`), a Vite entry (`frontend/src/entries/<page>-revamp.js`), and an entry registered in `frontend/vite.config.js`.

**Home Page Pilot (Phase 2)**

- R12. The `index` view in `files/views.py` calls `resolve_template()` with key `"home"`, legacy template `"cms/index.html"`, revamp template `"cms/index_revamp.html"`.
- R13. `frontend/src/features/home/` is created following the modern track convention documented in `CONTRIBUTING.md`. Internal directory structure is a planning decision.
- R14. The home page is enabled for all users by adding `"home"` to `UI_VARIANT_REVAMP_PAGES`. Before that, only staff can preview via `/?ui=revamp`.

**Testing**

- R15. Tests (location to be confirmed against project's test discovery path during planning) cover: legacy default, allowlisted page (anon + logged-in), staff preview param, non-staff preview ignored, invalid variant param ignored, context processor exposes `UI_VARIANT`, bootstrap HTML contains `MediaCMS.ui.variant`, rendered response body carries `data-ui-variant` attribute for allowlisted pages, and the home revamp template contains `data-modern-track` on its root container.

## Success Criteria

- A page added to `UI_VARIANT_REVAMP_PAGES` serves the revamp template to all users with no code changes beyond the settings entry.
- Legacy pages continue rendering unchanged when not in the allowlist.
- Staff can preview any revamp page via `?ui=revamp` with no session side effects.
- Revamp components use Kumquat tokens via Tailwind classes; legacy components use legacy SCSS vars — no visual cross-contamination between the two on the same browser session.
- Removing a page from `UI_VARIANT_REVAMP_PAGES` immediately rolls back to legacy with no deploy required.

## Scope Boundaries

- No per-user opt-in, cookies, or session-based variant persistence.
- No `django-waffle` or percentage rollout — the gate is binary per page.
- `revamp` is a UI variant, not a new frontend track. `CONTRIBUTING.md` dual-track architecture (legacy / modern) is unchanged.
- No middleware for variant resolution — page-specific via view helper.
- Phase 3 (Kumquat token migration) and Phase 4 (expanding to more pages) are in scope as follow-on work but not gating the Phase 1+2 delivery.

## Key Decisions

- **`body[data-ui-variant]` as CSS gate**: Kumquat tokens are scoped under this selector so both palettes can coexist in trunk without conflicting. Separate palette files or build-time branching were rejected as they break trunk-based development.
- **`resolve_template()` helper, not middleware**: Variant is page-specific (depends on the allowlist), so resolution belongs in the view, not on every request.
- **Allowlist is the only gate**: When a page is in `UI_VARIANT_REVAMP_PAGES`, 100% of users see revamp. No opt-in UX.
- **`data-modern-track` required on revamp containers**: The existing CSS isolation mechanism (`all: revert-layer` on `[data-modern-track]`) must be applied to revamp page root elements or legacy SCSS bleeds in.
- **`renderPage` reuse confirmed**: `frontend/src/static/js/_helpers.js:6` exports `renderPage(idSelector, PageComponent)` — revamp entries use this directly.
- **Staff preview uses `is_staff`**: Django's native `is_staff` flag gates `?ui=revamp` access. A data migration may be needed if `is_staff` is not currently populated for the intended preview audience.
- **Kumquat token namespace is additive**: Kumquat vars use a distinct prefix (e.g., `--kq-*`) and extend `@theme inline` with new entries. Legacy vars and Tailwind mappings are unchanged. Revamp components use new utility class names; legacy components use existing ones.

## Dependencies / Assumptions

- Kumquat design tokens will be extracted from Figma and provided as CSS custom property names before Phase 3 begins (Figma file was inaccessible during brainstorm).
- `base.html` can be modified to add `data-ui-variant` to `<body>` without breaking existing pages (the attribute is inert on legacy pages since no CSS targets `body[data-ui-variant="legacy"]`).

## Outstanding Questions

### Resolve Before Planning

_(none — all product decisions resolved)_

### Deferred to Planning

- [Affects R6][Technical] Confirm `root.html` (line 66 has bare `<body>`) can be edited to `<body data-ui-variant="{{ UI_VARIANT }}">` without breaking non-migrated pages. `UI_VARIANT` defaults to `"legacy"` via `ui_settings`, so all pages receive the attribute.
- [Affects R9][Technical] `data-modern-track` is currently applied in the React component (`ModernDemoPage.js`), not the Django template. Confirm whether revamp page components apply it in JS (consistent with existing pattern) or the revamp template applies it in HTML.
- [Affects R7, R8][Needs research] Kumquat CSS var names — to be extracted from Figma once accessible. No placeholder token names should be committed before Figma is accessible. Planner must verify Figma access before starting Phase 3.
- [Affects R13][Technical] Verify whether `HomePage` fetches data client-side via TanStack Query, or replicates context from the legacy `index` view. The rollback guarantee (reverting allowlist entry = immediate rollback) only holds if the legacy template and its view context are unchanged during the revamp rollout.
- [Affects R14][Operational] Define monitoring signals (error rate, JS exception rate) to watch after `"home"` is added to `UI_VARIANT_REVAMP_PAGES`. The binary gate has no partial-rollback lever — monitoring is the safety net.
- [Affects R15][Technical] Confirm test file location against the project's test discovery path. `tests/test_ui_variant.py` at repo root may need to move to an app-level `tests/` directory.

## Next Steps

-> `/ce:plan` for structured implementation planning
