---
title: "feat: Add legacy/revamp UI variant gate with shared design tokens"
type: feat
status: completed
date: 2026-04-19
origin: docs/brainstorms/2026-04-19-ui-variant-gate-requirements.md
---

# feat: Add legacy/revamp UI variant gate with shared design tokens

## Overview

Introduce a server-side UI variant gate that allows CinemataCMS to incrementally roll out a redesigned frontend (Kumquat design system) page-by-page without a big-bang release. Django views call a helper to resolve which template to render; a context processor propagates the resolved variant to all templates; a body attribute and React bootstrap variable expose the variant to CSS and JavaScript respectively. Staff can preview unfinished revamp pages via `?ui=revamp`. This plan covers Phase 1 (backend infrastructure) and Phase 2 (home page pilot). Phase 3 (Kumquat CSS tokens) is deferred until Figma access is restored.

## Problem Frame

Django renders page templates directly and mounts a specific Vite entry point per page. There is no mechanism to serve a different template on the same URL based on configuration, no runtime gate that keeps legacy and revamp CSS tokens isolated in a single build, and no safe staff-only preview path for unfinished revamp pages. (See origin: `docs/brainstorms/2026-04-19-ui-variant-gate-requirements.md`)

## Requirements Trace

- R1. `resolve_template()` helper — returns the correct template, sets `request.ui_variant`, degrades gracefully via `getattr`.
- R2. `UI_VARIANT` exposed in every template context via `cms/context_processors.ui_settings` extension.
- R3. `UI_VARIANT_DEFAULT` and `UI_VARIANT_REVAMP_PAGES` settings — overridable in `local_settings.py`.
- R4. `?ui=revamp` preview gated to `is_staff` — per-request, no persistence.
- R5. `window.MediaCMS.ui.variant` set inside the bootstrap object literal.
- R6. `<body data-ui-variant="{{ UI_VARIANT }}">` in `root.html`.
- R9. `data-modern-track` on revamp React component root elements (applied in JS, consistent with existing `ModernDemoPage` pattern).
- R10. Revamp code in `frontend/src/features/home/` following modern-track convention.
- R11. Revamp page has template, Vite entry, and registered rollup input.
- R12. `index()` view calls `resolve_template()` for the home page.
- R13. `frontend/src/features/home/` scaffolded following modern-track convention.
- R14. Enabling the home page is a settings-only change (`UI_VARIANT_REVAMP_PAGES = ["home"]`).
- R15. Test suite covering all gate scenarios.

**Deferred (Phase 3):**
- R7. Kumquat CSS vars under `body[data-ui-variant="revamp"]` — **typography now available (Phase 3a)**; color tokens still blocked on Figma access.
- R8. `@theme inline` extension — typography mappings now available (Phase 3a); `--color-kq-*` color entries still blocked.

## Scope Boundaries

- No per-user opt-in, cookies, or session persistence.
- No `django-waffle` or percentage rollout — binary per-page gate.
- `revamp` uses modern-track conventions (`features/` directory, named exports, Tailwind) but is gated by the Django template router, not a separate frontend application. It is a variant of the UI, not a third frontend track — `CONTRIBUTING.md` dual-track architecture (legacy / modern) is unchanged.
- No middleware — variant resolution is per-view via the helper.
- Phase 3a (Kumquat typography tokens) is **now in scope** — token definitions received and documented below.
- Phase 3b (Kumquat color tokens) and Phase 4 (expanding to more pages) remain out of scope — Figma file still inaccessible for colors.
- The `HomePage` component is scaffolded as a working stub; its visual content is separate design work.

## Context & Research

### Relevant Code and Patterns

- `cms/context_processors.py` — `ui_settings()` function: uses `getattr(request, 'attr', default)` pattern to read request-scoped state set by middleware/view. **Pattern to follow exactly for `UI_VARIANT`.**
- `cms/settings.py` — `USE_ROUNDED_CORNERS = True` in the `# settings that are related with UX/appearance` block (~line 577): nearest analog for a visual-gate boolean setting. **Pattern to follow for `UI_VARIANT_REVAMP_PAGES`.**
- `templates/root.html:66` — bare `<body>` with no attributes; confirmed safe to add `data-ui-variant`.
- `templates/config/index.html` — `var MediaCMS = { ... };` object literal, then includes, then `window.MediaCMS = MediaCMS;`. Add `ui` property inside the literal (the includes add post-literal properties via dot notation — they are separate).
- `templates/cms/index.html` — extends `base.html`, block `topimports` loads `src/entries/index.js`, block `content` has `<div id="page-home"></div>`. Revamp template mirrors this structure.
- `frontend/vite.config.js` — `rollupOptions.input`: 29 existing kebab-case entries. Add `'index-revamp': 'src/entries/index-revamp.js'`.
- `frontend/src/static/js/_helpers.js:6` — `renderPage(idSelector, PageComponent)`: mounts PageHeader, PageSidebar, and the page component. Revamp entries use this directly.
- `frontend/src/features/notifications/` — canonical modern-track feature: `index.js` (named exports), `components/`, `hooks/`, `stores/`, dedicated `queryClient.js`. **Directory structure to follow.**
- `frontend/src/entries/notifications.js` — `renderPage('page-notifications', NotificationPage)`. **Entry file pattern to follow.**
- `frontend/src/features/modern-demo/ModernDemoPage.js` — applies `data-modern-track` on root JSX element. **Pattern for CSS isolation attribute.**
- `tests/test_index_page_featured.py` — single existing test file at repo root using `django.test.TestCase` and `@override_settings`. **Test file pattern to follow.**

### Institutional Learnings

- None — `docs/solutions/` does not exist in this repo.

### Kumquat Typography Token Definitions (Phase 3a — now available)

Two font families, two-tier type scale. All heading/display use **Barlow Semi Condensed**; all body/caption use **Inter**.

**Note on naming:** Figma class names (e.g., `title-72`) do not always match the actual `font-size` (64px). CSS custom property names use the **actual pixel value** to avoid confusion.

**Font families:**
```
--kq-font-family-display: "Barlow Semi Condensed", sans-serif
--kq-font-family-body: "Inter", sans-serif
```

**Display/Title scale (Barlow Semi Condensed):**
| Token slot | font-size | line-height | letter-spacing | Figma class label |
|---|---|---|---|---|
| `--kq-font-size-title-64` | 64px | 76px | -0.8px | title-72 |
| `--kq-font-size-title-56` | 56px | 68px | -0.6px | title-56 |

**Heading scale (Barlow Semi Condensed):**
| Token slot | font-size | line-height | letter-spacing |
|---|---|---|---|
| `--kq-font-size-h1` | 56px | 68px | -0.5px |
| `--kq-font-size-h2` | 48px | 58px | -0.4px |
| `--kq-font-size-h3` | 40px | 48px | -0.3px |
| `--kq-font-size-h4` | 32px | 38px | -0.2px |
| `--kq-font-size-h5` | 24px | 30px | -0.15px |
| `--kq-font-size-h6` | 20px | 24px | 0px |

**Body scale (Inter):**
| Token slot | font-size | line-height |
|---|---|---|
| `--kq-font-size-body-18` | 18px | 28px |
| `--kq-font-size-body-16` | 16px | 24px |
| `--kq-font-size-body-14` | 14px | 20px |
| `--kq-font-size-body-12` | 12px | 16px |

**Caption (Inter):**
| Token slot | font-size | line-height |
|---|---|---|
| `--kq-font-size-caption-10` | 10px | 10px |

**Font weights (shared across scales):**
```
--kq-font-weight-regular: 400
--kq-font-weight-medium: 500
--kq-font-weight-bold: 700
```
Note: Figma labels `caption-10-semibold` with `font-weight: 700` — this appears to be a Figma naming error; the token value is 700 (bold), not 600. Use `--kq-font-weight-bold` for this.

**Letter-spacing tokens (for heading scale):**
```
--kq-letter-spacing-title-64:  -0.8px
--kq-letter-spacing-title-56:  -0.6px
--kq-letter-spacing-h1:        -0.5px
--kq-letter-spacing-h2:        -0.4px
--kq-letter-spacing-h3:        -0.3px
--kq-letter-spacing-h4:        -0.2px
--kq-letter-spacing-h5:        -0.15px
--kq-letter-spacing-h6:         0px
```

**Tailwind `@theme inline` mappings to add (Phase 3a):**
```css
/* Font families */
--font-kq-display: var(--kq-font-family-display);
--font-kq-body:    var(--kq-font-family-body);

/* Font sizes — generates text-kq-* utilities */
--text-kq-title-64: var(--kq-font-size-title-64);
--text-kq-title-56: var(--kq-font-size-title-56);
--text-kq-h1: var(--kq-font-size-h1);
--text-kq-h2: var(--kq-font-size-h2);
--text-kq-h3: var(--kq-font-size-h3);
--text-kq-h4: var(--kq-font-size-h4);
--text-kq-h5: var(--kq-font-size-h5);
--text-kq-h6: var(--kq-font-size-h6);
--text-kq-body-18: var(--kq-font-size-body-18);
--text-kq-body-16: var(--kq-font-size-body-16);
--text-kq-body-14: var(--kq-font-size-body-14);
--text-kq-body-12: var(--kq-font-size-body-12);
--text-kq-caption-10: var(--kq-font-size-caption-10);

/* Font weights — generates font-kq-* utilities */
--font-weight-kq-regular: var(--kq-font-weight-regular);
--font-weight-kq-medium:  var(--kq-font-weight-medium);
--font-weight-kq-bold:    var(--kq-font-weight-bold);

/* Tracking (letter-spacing) — generates tracking-kq-* utilities */
--tracking-kq-title-64: var(--kq-letter-spacing-title-64);
--tracking-kq-title-56: var(--kq-letter-spacing-title-56);
--tracking-kq-h1: var(--kq-letter-spacing-h1);
--tracking-kq-h2: var(--kq-letter-spacing-h2);
--tracking-kq-h3: var(--kq-letter-spacing-h3);
--tracking-kq-h4: var(--kq-letter-spacing-h4);
--tracking-kq-h5: var(--kq-letter-spacing-h5);
--tracking-kq-h6: var(--kq-letter-spacing-h6);

/* Leading (line-height) — generates leading-kq-* utilities */
--leading-kq-title-64:  var(--kq-line-height-title-64);   /* 76px */
--leading-kq-title-56:  var(--kq-line-height-title-56);   /* 68px */
--leading-kq-h1:        var(--kq-line-height-h1);          /* 68px */
--leading-kq-h2:        var(--kq-line-height-h2);          /* 58px */
--leading-kq-h3:        var(--kq-line-height-h3);          /* 48px */
--leading-kq-h4:        var(--kq-line-height-h4);          /* 38px */
--leading-kq-h5:        var(--kq-line-height-h5);          /* 30px */
--leading-kq-h6:        var(--kq-line-height-h6);          /* 24px */
--leading-kq-body-18:   var(--kq-line-height-body-18);     /* 28px */
--leading-kq-body-16:   var(--kq-line-height-body-16);     /* 24px */
--leading-kq-body-14:   var(--kq-line-height-body-14);     /* 20px */
--leading-kq-body-12:   var(--kq-line-height-body-12);     /* 16px */
--leading-kq-caption-10: var(--kq-line-height-caption-10); /* 10px */
```

Revamp components compose typography via Tailwind utilities, e.g.:
```jsx
<h1 className="font-kq-display text-kq-h1 leading-kq-h1 tracking-kq-h1 font-kq-bold">
<p  className="font-kq-body text-kq-body-16 leading-kq-body-16 font-kq-regular">
```

## Key Technical Decisions

- **`resolve_template()` in `cms/ui_variant.py` (new module)**: Keeps the helper isolated from views and context processors. Views import it explicitly — no magic. The context processor reads `request.ui_variant` set as a side effect. Note: `request.maintenance_remaining` is set by middleware (not a view helper), so this pattern is new in the codebase — valid because Django context processors run after the view returns, but without a direct precedent.
- **Extend `ui_settings()`, not a new context processor**: Avoids a second entry in `TEMPLATES[0]['OPTIONS']['context_processors']` and keeps all install-level UI flags in one function.
- **`UI_VARIANT` inside the MediaCMS literal**: The `config/index.html` includes (`api.html`, `url.html`, etc.) add properties via dot notation after the literal closes. Adding `ui` inside the literal keeps initialization atomic and avoids a post-assignment `window.MediaCMS not defined` race.
- **`data-modern-track` applied in the React component root**: Consistent with `ModernDemoPage.js`. Django templates do not need to know about this; the React component is responsible for its own CSS isolation.
- **`root.html` edit for body attribute**: The body tag is only in `root.html`. All pages (legacy and revamp) will carry `data-ui-variant="legacy"` or `data-ui-variant="revamp"`. No CSS currently targets `body[data-ui-variant="legacy"]`, so legacy pages are unaffected.
- **`getattr` safety throughout**: `resolve_template` uses `getattr(settings, 'UI_VARIANT_REVAMP_PAGES', [])` so a missing settings key degrades to legacy. For `request.user`, use `getattr(request, 'user', None)` as the outer guard before checking `is_staff`, so calls from contexts without `AuthenticationMiddleware` (e.g., raw `RequestFactory` in tests) don't raise `AttributeError`. The context processor fallback chain `getattr(request, 'ui_variant', getattr(settings, 'UI_VARIANT_DEFAULT', 'legacy'))` ensures `"legacy"` is always returned when the view skipped `resolve_template()`.

## Open Questions

### Resolved During Planning

- **Where is `<body>`?** `root.html:66` — bare, no attributes, safe to edit.
- **Where does `data-modern-track` go?** In the React component root element (JS), not the Django template. Follows `ModernDemoPage.js` pattern.
- **Does legacy `index()` view pass context the revamp page needs?** No — context is `{}`. All data is fetched client-side. Rollback guarantee (remove from allowlist = instant rollback) holds.
- **Where do tests live?** `tests/` at repo root — `tests/test_ui_variant.py`. Uses `django.test.TestCase` + `@override_settings`.
- **Which staff permission?** `request.user.is_staff` (Django native). May need a data migration if `is_staff` is not populated for the preview audience — document as operational note.

### Deferred to Implementation

- **`HomePage` component visual content**: The scaffold renders a placeholder. Actual design implementation follows separately once Figma is accessible.
- **Monitoring signals for Phase 2 rollout**: Define 5xx rate and JS error thresholds before enabling `UI_VARIANT_REVAMP_PAGES = ["home"]` in production. Out of scope for this plan.
- **Kumquat token names**: Figma file was inaccessible during brainstorm. No placeholder `--kq-*` vars should be committed. Phase 3 begins only when token names are confirmed.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
HTTP GET /

  ┌─────────────────────────────────────────────────────┐
  │ files/views.py  index()                             │
  │                                                     │
  │  template = resolve_template(                       │
  │    request, "home",                                 │
  │    "cms/index.html",          ← legacy              │
  │    "cms/index_revamp.html"    ← revamp              │
  │  )                                                  │
  │                                                     │
  │  resolve_template logic:                            │
  │    "home" in REVAMP_PAGES?  ──► revamp              │
  │    is_staff + ?ui=revamp?   ──► revamp              │
  │    else                     ──► legacy              │
  │                                                     │
  │  side effect: request.ui_variant = "legacy|revamp"  │
  │  return: render(request, template, {})              │
  └───────────────────────┬─────────────────────────────┘
                          │
  ┌───────────────────────▼─────────────────────────────┐
  │ cms/context_processors.ui_settings()                │
  │                                                     │
  │  "UI_VARIANT": getattr(request, "ui_variant",       │
  │                         "legacy")                   │
  └───────────────────────┬─────────────────────────────┘
                          │ template context
  ┌───────────────────────▼─────────────────────────────┐
  │ Template rendering                                  │
  │                                                     │
  │  root.html:                                         │
  │    <body data-ui-variant="{{ UI_VARIANT }}">         │
  │      ← CSS gate: body[data-ui-variant="revamp"]     │
  │        activates Kumquat vars (Phase 3)             │
  │                                                     │
  │  config/index.html:                                 │
  │    var MediaCMS = {                                 │
  │      ui: { variant: "{{ UI_VARIANT }}" },           │
  │    };                                               │
  │      ← JS gate: window.MediaCMS.ui.variant          │
  │                                                     │
  │  cms/index_revamp.html (when revamp):               │
  │    {% vite_asset 'src/entries/index-revamp.js' %}   │
  │    <div id="page-home-revamp"></div>                │
  └───────────────────────┬─────────────────────────────┘
                          │
  ┌───────────────────────▼─────────────────────────────┐
  │ Browser: React mount                                │
  │                                                     │
  │  index-revamp.js:                                   │
  │    renderPage('page-home-revamp', HomePage)         │
  │                                                     │
  │  HomePage root JSX:                                 │
  │    <div data-modern-track>   ← CSS isolation        │
  │      ...Tailwind components                         │
  │    </div>                                           │
  └─────────────────────────────────────────────────────┘
```

## Implementation Units

- [ ] **Unit 1: Variant helper and settings**

**Goal:** Create `cms/ui_variant.py` with `resolve_template()` and add `UI_VARIANT_*` settings.

**Requirements:** R1, R3

**Dependencies:** None

**Files:**
- Create: `cms/ui_variant.py`
- Modify: `cms/settings.py`

**Approach:**
- Add two settings in the `# settings that are related with UX/appearance` block (~line 577): `UI_VARIANT_DEFAULT = "legacy"` and `UI_VARIANT_REVAMP_PAGES = []`.
- `resolve_template(request, page_key, legacy_template, revamp_template)`: read `UI_VARIANT_REVAMP_PAGES` via `getattr(settings, ..., [])`; check allowlist first, then check staff + `?ui=revamp`; set `request.ui_variant` to `"revamp"` or `"legacy"` (always one of these two string literals, never the raw query param value); return the selected template string.
- Staff check: `getattr(getattr(request, 'user', None), 'is_staff', False)` — double-guarded so it works with `AnonymousUser` and with raw `RequestFactory` requests lacking `request.user`.
- The helper must not import anything that would cause circular imports — `django.conf.settings` only.
- `legacy_template` and `revamp_template` arguments must always be string literals at call sites — never constructed from user input or URL segments.

**Patterns to follow:**
- `cms/context_processors.py` — `getattr(request, 'maintenance_remaining', 0)` pattern for reading request attributes
- `cms/settings.py` `# settings that are related with UX/appearance` block — setting placement and naming

**Test scenarios:** See Unit 6 for the authoritative list. Unit 1 scenarios (resolve_template unit tests) are a subset of Unit 6's 14 scenarios.

**Verification:**
- All Unit 5 resolve_template scenarios pass using `RequestFactory`.
- No import errors from `cms/ui_variant.py`.

---

- [ ] **Unit 2: Context processor extension, body attribute, and bootstrap**

**Goal:** Propagate `UI_VARIANT` to all templates and expose it to CSS (body attribute) and JS (MediaCMS bootstrap).

**Requirements:** R2, R5, R6

**Dependencies:** Unit 1 (needs `request.ui_variant` to be set by views)

**Files:**
- Modify: `cms/context_processors.py`
- Modify: `templates/root.html`
- Modify: `templates/config/index.html`

**Approach:**
- `cms/context_processors.py` `ui_settings()`: add `"UI_VARIANT": getattr(request, 'ui_variant', getattr(settings, 'UI_VARIANT_DEFAULT', 'legacy'))` to the return dict. Non-migrated pages (no `resolve_template()` call) always default to `"legacy"` — the two-tier fallback guarantees this as long as `UI_VARIANT_DEFAULT` is set to `"legacy"` in `settings.py` (which Unit 1 ensures). Do not set `UI_VARIANT_DEFAULT = "revamp"` — doing so would revamp all non-migrated pages globally.
- `templates/root.html:66`: change `<body>` to `<body data-ui-variant="{{ UI_VARIANT }}">`. All pages receive this attribute. Legacy pages get `data-ui-variant="legacy"` (currently inert — no CSS targets it). Future CSS rules must use `body[data-ui-variant="revamp"]` selectors only, never `body[data-ui-variant="legacy"]`.
- `templates/config/index.html`: add `ui: { variant: "{{ UI_VARIANT }}" },` as the **first** property inside the `var MediaCMS = { ... };` object literal (before the conditional `{% if media %}` blocks). Placing it first ensures its trailing comma is always valid — conditional blocks that follow may or may not emit properties, making it unsafe to rely on any conditional block having a trailing comma before `ui`. The value `"{{ UI_VARIANT }}"` is always one of two known safe string literals (`"legacy"` or `"revamp"`) — never the raw query parameter value.

**Security note (Unit 2):** `UI_VARIANT` is interpolated into a JavaScript string literal in `config/index.html`. This is safe only because `resolve_template()` guarantees `request.ui_variant` is always one of `"legacy"` or `"revamp"`. If this invariant ever breaks, XSS is possible. The implementing agent should add a Django system check or assertion that validates `UI_VARIANT_DEFAULT` is `"legacy"` on startup.

**Patterns to follow:**
- `cms/context_processors.py` existing return dict structure
- `templates/config/index.html` existing `{% if media %}mediaId: "{{media}}", {% endif %}` pattern for conditional properties

**Test scenarios:**
- Context processor — `resolve_template()` called with "home" in allowlist → `UI_VARIANT` in template context equals `"revamp"`
- Context processor — `resolve_template()` not called → `UI_VARIANT` defaults to `"legacy"`
- Bootstrap HTML — `GET /` response body contains `ui: { variant:` string
- Body attribute — `GET /` response body contains `data-ui-variant=` attribute on `<body>` tag

**Verification:**
- Legacy pages (`cms/index.html`) render `data-ui-variant="legacy"` with no visual change.
- Revamp pages render `data-ui-variant="revamp"`.
- `window.MediaCMS.ui.variant` is accessible in browser console after page load.

---

- [ ] **Unit 3: Home page pilot — backend template and view**

**Goal:** Wire the `index()` view to `resolve_template()` and create the revamp template.

**Requirements:** R4, R9, R11, R12

**Dependencies:** Unit 1 (resolve_template must exist)

**Files:**
- Modify: `files/views.py`
- Create: `templates/cms/index_revamp.html`

**Approach:**
- `files/views.py` `index()`: import `resolve_template` from `cms.ui_variant`; call `resolve_template(request, "home", "cms/index.html", "cms/index_revamp.html")`; pass returned template name to `render()`. Context dict stays `{}` — no change to legacy behavior.
- `templates/cms/index_revamp.html`: extends `base.html`, `{% load django_vite %}`, block `topimports` loads `{% vite_asset 'src/entries/index-revamp.js' %}`, block `content` has `<div id="page-home-revamp"></div>`. No `data-modern-track` in the template — that is applied by the React component root (see Unit 4).
- The legacy `cms/index.html` is NOT modified — rollback is guaranteed.

**Patterns to follow:**
- `templates/cms/index.html` — block structure, `{% load django_vite %}`, `{% vite_asset %}` tag
- `files/views.py` existing import pattern for `cms.*` modules

**Test scenarios:**
- `GET /` with `UI_VARIANT_REVAMP_PAGES = ["home"]` → response uses `cms/index_revamp.html` (check for `index-revamp` in response HTML)
- `GET /` with `UI_VARIANT_REVAMP_PAGES = []` → response uses `cms/index.html` (legacy unchanged)
- `GET /?ui=revamp` as staff with `UI_VARIANT_REVAMP_PAGES = []` → response uses `cms/index_revamp.html`
- `GET /?ui=revamp` as anonymous user → response uses `cms/index.html`
- Revamp response body contains `data-ui-variant="revamp"` (via body attribute from Unit 2)

**Verification:**
- `python manage.py check` passes.
- Legacy `GET /` returns HTTP 200 with no template change when `UI_VARIANT_REVAMP_PAGES = []`.

---

- [ ] **Unit 4: Home page pilot — frontend entry and feature scaffold**

**Goal:** Create the Vite entry point and `features/home/` directory for the revamp home page.

**Requirements:** R10, R11, R13

**Dependencies:** Unit 3 (template must reference the entry path)

**Files:**
- Create: `frontend/src/entries/index-revamp.js`
- Modify: `frontend/vite.config.js`
- Create: `frontend/src/features/home/index.js`
- Create: `frontend/src/features/home/components/HomePage.jsx`

**Approach:**
- `frontend/vite.config.js`: add `'index-revamp': 'src/entries/index-revamp.js'` to `rollupOptions.input` after the `'modern-demo'` entry.
- `frontend/src/entries/index-revamp.js`: import `renderPage` from `../static/js/_helpers.js` and `{ HomePage }` from `../features/home`; call `renderPage('page-home-revamp', HomePage)`. Pattern is identical to `notifications.js`.
- `frontend/src/features/home/components/HomePage.jsx`: functional React component. The outermost rendered content `div` (not the component function's root node, which may be a Provider wrapper) carries `data-modern-track` as a static JSX attribute: `<div data-modern-track className="...">`. This follows the `ModernDemoPage.js` pattern where the attribute is on the inner content container, not on `QueryClientProvider`. Renders a placeholder layout using existing Tailwind classes from the current `@theme inline` block (e.g., `bg-surface-body`, `text-content-body`). CSS isolation via `all: revert-layer` (the rule that `[data-modern-track]` activates to prevent legacy SCSS from bleeding into the component) will be validated once Phase 3 CSS token rules are defined — not in this phase.
- `frontend/src/features/home/index.js`: named export `{ HomePage }` from `./components/HomePage`.
- `stores/` and `hooks/` subdirectories are not created at this stage — the stub component has no data fetching. Add them when implementing actual home page content.

**Patterns to follow:**
- `frontend/src/entries/notifications.js` — entry file structure
- `frontend/src/features/notifications/index.js` — named exports pattern
- `frontend/src/features/modern-demo/ModernDemoPage.js` — `data-modern-track` on root element, Tailwind class usage

**Test scenarios:**
- Test expectation: none for Vite config registration (build output verification is a CI concern, not a unit test)
- `HomePage` renders without error when mounted via `renderPage` (smoke test — verify mount point `page-home-revamp` is found and component renders)
- `HomePage` root element carries `data-modern-track` attribute (DOM assertion)

**Verification:**
- `cd frontend && npm run build` (or `pnpm run build`) completes without errors and emits `index-revamp.*` chunk in `build/production/static/`.
- Navigating to `/?ui=revamp` as staff shows the revamp template with the stub `HomePage` rendered. CSS isolation (`all: revert-layer` on `[data-modern-track]`) is not verifiable until Phase 3 CSS rules are added. At this phase, verify only that `data-modern-track` attribute is present on the rendered DOM element.

---

- [ ] **Unit 5 (Phase 3a): Kumquat typography tokens**

**Goal:** Define Kumquat typography CSS custom properties and bridge them into Tailwind, so revamp components can use semantic type utilities.

**Requirements:** R7 (typography portion), R8 (typography portion)

**Dependencies:** Unit 2 (body `data-ui-variant` attribute must exist to scope the selector)

**Files:**
- Modify: `frontend/src/static/css/config/_light_theme.scss`
- Modify: `frontend/src/static/css/config/_dark_theme.scss`
- Modify: `frontend/src/static/css/tailwind.css`

**Approach:**
- Add a `body[data-ui-variant="revamp"]` block in `_light_theme.scss` defining all `--kq-*` typography custom properties listed in the token table above. Use the same selector in `_dark_theme.scss` — typography values are identical in both themes (no dark-mode override needed for type scale or families).
- Font family strings: `--kq-font-family-display: "Barlow Semi Condensed", sans-serif` and `--kq-font-family-body: "Inter", sans-serif`. Both fonts must be loaded — add `@import` or `@font-face` for Barlow Semi Condensed if not already available (verify against existing `base.js` or `styles.scss` font loading).
- Do **not** add color tokens (`--kq-color-*`) — those remain blocked on Figma access.
- Extend `frontend/src/static/css/tailwind.css` `@theme inline` block with all `--font-kq-*`, `--text-kq-*`, `--leading-kq-*`, `--tracking-kq-*`, and `--font-weight-kq-*` entries listed in the token definitions section. These entries extend (not replace) the existing block.
- Tailwind utility naming convention: `font-kq-display`, `text-kq-h1`, `leading-kq-h1`, `tracking-kq-h1`, `font-kq-bold` — verified against the `--kq-*` var names in the token table.

**Patterns to follow:**
- `frontend/src/static/css/config/_light_theme.scss` — `body { --var: value; }` structure; new block follows same pattern under `body[data-ui-variant="revamp"]`
- `frontend/src/static/css/tailwind.css` `@theme inline` block — existing `--color-brand-primary: var(--btn-primary-bg-color)` entries as the extension pattern

**Test scenarios:**
- Build — `pnpm run build` completes without errors; Tailwind generates `font-kq-display`, `text-kq-h1`, etc. utility classes in output CSS
- Scoping — on a legacy page (`data-ui-variant="legacy"`), `--kq-font-family-display` is not defined (selector doesn't match)
- Scoping — on a revamp page (`data-ui-variant="revamp"`), `--kq-font-family-display` resolves to `"Barlow Semi Condensed", sans-serif`
- Component — `HomePage.jsx` updated to use `font-kq-display text-kq-h1` on a heading; visually renders Barlow Semi Condensed at 56px

**Verification:**
- Browser devtools confirm `--kq-font-family-display` resolves only under `body[data-ui-variant="revamp"]`.
- Legacy pages show no visual change (no `--kq-*` vars resolve on them).
- `HomePage` heading uses Barlow Semi Condensed, body copy uses Inter.

---

- [ ] **Unit 6: Test suite**

**Goal:** Cover all gate scenarios from R15 in `tests/test_ui_variant.py`.

**Requirements:** R15

**Dependencies:** Units 1–5 complete (Unit 5 typography is needed for `HomePage` component tests)

**Files:**
- Create: `tests/test_ui_variant.py`

**Approach:**
- Use `django.test.TestCase` and `django.test.override_settings` consistently with `tests/test_index_page_featured.py`.
- Create a staff user fixture with `is_staff=True` for staff preview tests.
- Use `self.client.get('/')` for view-level tests, `self.client.get('/?ui=revamp')` for preview tests.
- For context processor and bootstrap tests, assert on `response.context['UI_VARIANT']` and `response.content`. `response.context` is populated by Django's test client only when the view uses `render()` or `TemplateResponse` with `RequestContext` — always assert `response.context is not None` before key lookup, and add a belt-and-suspenders assertion on `response.content` for the same invariant.
- For the `resolve_template` unit tests (Unit 1 scenarios), call the function directly using `RequestFactory` — no full HTTP stack needed.

**Patterns to follow:**
- `tests/test_index_page_featured.py` — `TestCase`, `override_settings` usage
- `django.test.RequestFactory` for unit testing `resolve_template()` in isolation

**Test scenarios:**
- `resolve_template` unit — page_key in allowlist → revamp_template returned, `request.ui_variant == "revamp"`
- `resolve_template` unit — page_key not in allowlist → legacy_template returned
- `resolve_template` unit — staff + `?ui=revamp`, not allowlisted → revamp_template
- `resolve_template` unit — non-staff + `?ui=revamp` → legacy_template
- `resolve_template` unit — anonymous user + `?ui=revamp` → legacy_template (no exception)
- `resolve_template` unit — `?ui=garbage` → legacy_template
- `resolve_template` unit — `UI_VARIANT_REVAMP_PAGES` not in settings → legacy_template (no exception)
- View integration — `GET /` with `UI_VARIANT_REVAMP_PAGES = ["home"]` → `response.context["UI_VARIANT"] == "revamp"`
- View integration — `GET /` without `"home"` in allowlist → `response.context["UI_VARIANT"] == "legacy"`
- Body attribute — `GET /` with revamp active → `b'data-ui-variant="revamp"'` in `response.content`
- Bootstrap — `GET /` → `b'ui: { variant:'` in `response.content`
- Staff preview — `GET /?ui=revamp` as staff, page not allowlisted → `response.context["UI_VARIANT"] == "revamp"`
- Non-staff preview blocked — `GET /?ui=revamp` as regular user → `response.context["UI_VARIANT"] == "legacy"` and response is indistinguishable from a request without the parameter (same template, same status code — no redirect, no error)
- Template integrity — revamp response HTML contains `index-revamp` (Vite asset reference)

**Verification:**
- `python manage.py test tests.test_ui_variant` passes all 14 scenarios green.
- No test modifies global settings state (each test uses `@override_settings` or `with self.settings(...)`).

## System-Wide Impact

- **Interaction graph:** `ui_settings()` context processor runs on every rendered response (all page views, not just migrated pages). The `UI_VARIANT` key is added to every template context. Templates that don't reference `{{ UI_VARIANT }}` are unaffected.
- **Error propagation:** Missing `UI_VARIANT_REVAMP_PAGES` setting → `getattr` returns `[]` → all pages render legacy (silent degradation). Missing `request.ui_variant` attribute (view didn't call `resolve_template`) → `getattr` returns `"legacy"` → correct behavior.
- **State lifecycle risks:** `request.ui_variant` is a per-request attribute — no cross-request contamination. If `resolve_template()` is called twice in one request (e.g., in a view that delegates), the last call wins. No view should call it conditionally.
- **API surface parity:** The body attribute (`data-ui-variant`) is set on every rendered page. No AJAX/JSON endpoints are affected — those don't render `root.html`.
- **Integration coverage:** Cross-layer: the body attribute and `window.MediaCMS.ui.variant` must both reflect the same variant. These are verified in R15 test scenarios.
- **Unchanged invariants:** Legacy pages continue to receive `cms/index.html` when `"home"` is not in `UI_VARIANT_REVAMP_PAGES`. The `renderPage` helper's behavior (mounts PageHeader, PageSidebar) is unchanged. The `CONTRIBUTING.md` dual-track architecture (legacy track in `src/static/js/`, modern track in `src/features/`) is unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `is_staff` not populated for preview audience | Document as operational prerequisite. Run a query before enabling preview to confirm the intended staff accounts have `is_staff=True`. A data migration is a separate operational step. |
| Legacy SCSS `!important` declarations breaking `all: revert-layer` isolation in `HomePage` | Before Phase 2 ships, grep legacy SCSS for `!important` and verify none apply to elements that appear in the revamp page root. If collisions exist, scope the affected rule more tightly in legacy SCSS. |
| Vite entry registration not picked up by `django-vite` in dev mode | Restart the Vite dev server after adding `'index-revamp'` to `vite.config.js`. The dev server does not hot-reload config changes. |
| Phase 3 token naming locked by Phase 1 placeholders | **No placeholder `--kq-*` CSS vars should be committed.** Phase 3 begins only once Figma is accessible and token names are confirmed. Do not add a `body[data-ui-variant="revamp"]` selector stub in this phase — adding an empty selector creates false signal that Phase 3 has started. The CSS hook is the `data-ui-variant` body attribute (added in Unit 2); no SCSS rule is needed until Phase 3. |
| Binary gate: no partial rollback lever for production incidents | Before adding `"home"` to `UI_VARIANT_REVAMP_PAGES`, agree on monitoring thresholds (5xx rate, JS error rate). Rollback procedure: remove `"home"` from `local_settings.py` (no deploy required if using `local_settings.py` override). |

## Documentation / Operational Notes

- **Enabling the home page**: Add `UI_VARIANT_REVAMP_PAGES = ["home"]` to `cms/local_settings.py` (no deploy required) or `cms/settings.py` (requires deploy). Prefer `local_settings.py` for staged environments.
- **Staff preview setup**: Ensure staff accounts intended for preview have `is_staff=True` in the Django admin before testing `/?ui=revamp`.
- **Phase 3 start condition**: Figma file (`qU7x9Qp9jDAVXzydgwQNjM`) must be accessible and token names extracted before any `--kq-*` CSS vars are committed. The plan for Phase 3 is a separate planning exercise.
- **Expanding to more pages (Phase 4)**: For each new page — add revamp template, add Vite entry + register in config, add feature directory, update view to call `resolve_template()`, add page key to `UI_VARIANT_REVAMP_PAGES`. No changes to `cms/ui_variant.py` or the context processor.

## Sources & References

- **Origin document:** [docs/brainstorms/2026-04-19-ui-variant-gate-requirements.md](docs/brainstorms/2026-04-19-ui-variant-gate-requirements.md)
- Existing context processor: `cms/context_processors.py`
- Body tag location: `templates/root.html:66`
- Bootstrap script: `templates/config/index.html`
- Modern-track feature reference: `frontend/src/features/notifications/`
- CSS isolation reference: `frontend/src/features/modern-demo/ModernDemoPage.js`
- Vite config: `frontend/vite.config.js`
- Test pattern: `tests/test_index_page_featured.py`
- renderPage helper: `frontend/src/static/js/_helpers.js:6`
