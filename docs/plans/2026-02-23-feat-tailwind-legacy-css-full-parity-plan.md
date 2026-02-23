---
title: "feat: Tailwind Legacy CSS Full Parity"
type: feat
status: completed
date: 2026-02-23
origin: docs/brainstorms/2026-02-23-tailwind-legacy-full-parity-brainstorm.md
---

# feat: Tailwind Legacy CSS Full Parity

## Overview

Achieve full parity between Tailwind (modern track) and the legacy CSS theming system so that new features built with Tailwind look identical to existing pages. Bridge every remaining CSS variable, typography, and spacing token into `tailwind.css`, then migrate `_extra.css` into the Vite build pipeline for a unified build.

After this work, a developer writing modern-track components uses only Tailwind classes — no arbitrary values like `text-[var(--something)]` — and gets automatic dark/light theme switching plus per-deployment customization for free.

## Problem Statement / Motivation

The modern track (Tailwind) already bridges ~205 theme-switching color vars, but gaps remain: theme/brand colors, status colors, links, typography, and layout dimensions are missing. Meanwhile, `_extra.css` (the per-deployment customization file) lives outside the Vite pipeline, creating a split build. New features need the existing visual identity without a new design system — Tailwind should provide full access to the legacy theme. (see brainstorm: `docs/brainstorms/2026-02-23-tailwind-legacy-full-parity-brainstorm.md`)

## Proposed Solution

Three-phase implementation:

1. **Phase 1 — Bridge the Gaps** (low risk): Add missing color variables, typography tokens, and dynamic spacing to `tailwind.css`
2. **Phase 2 — Migrate `_extra.css`** (high risk): Move the file into Vite, fix `url()` paths, update import chain, remove Django `<link>` tag
3. **Phase 3 — Clean Up & Verify** (maintenance): Remove dead code, update docs, run visual regression

## Technical Approach

### Phase 1: Bridge Missing Tokens

**File:** `frontend/src/static/css/tailwind.css`

#### 1A. Bridge 7 missing color variables

Add to the existing `@theme inline` block:

```css
/* ── Brand / Theme ────────────────────────── */
--color-brand-theme:   var(--default-theme-color);
--color-brand-accent:  var(--default-brand-color);
--color-content-link:  var(--links-color);

/* ── Status ───────────────────────────────── */
--color-content-success: var(--success-color);
--color-content-warning: var(--warning-color);
--color-content-danger:  var(--danger-color);

/* ── Form ─────────────────────────────────── */
--color-surface-input-disabled: var(--input-disabled-bg-color);
```

**Usage:** `text-brand-theme`, `bg-brand-accent`, `text-content-link`, `text-content-success`, `text-content-warning`, `text-content-danger`, `bg-surface-input-disabled`

**Note on `--input-disabled-bg-color`:** This var is defined only once (`hsla(0,0%,0%,0.05)` in `config/index.scss`) with no dark-mode counterpart. Bridge it as-is. Add a dark-mode value as a follow-up when a modern-track form component actually needs it.

#### 1B. Bridge typography (font families only)

Add font-family tokens to `@theme inline`:

```css
/* ── Typography ───────────────────────────── */
--font-sans:    'Amulya', 'Arial', sans-serif;
--font-heading: 'Facultad', 'Arial', sans-serif;
```

**Usage:** `font-sans` (body text — also Tailwind's default), `font-heading` (headings)

**Important:** The `[data-modern-track] :where(h1, h2, ...)` cascade isolation (`all: revert-layer`) strips legacy `_extra.css` font declarations from modern-track containers. This is intentional. Modern-track components must explicitly apply `font-heading` on headings and `font-sans` on body text — they do NOT inherit from `_extra.css`.

Do NOT bridge heading scale sizes (h1=2.13em, etc.) — modern track uses standard Tailwind sizes (`text-2xl`, `text-lg`). (see brainstorm: Decision #2)

#### 1C. Make spacing tokens dynamic

Change hardcoded spacing values to read live CSS vars:

```css
/* Before (hardcoded): */
--spacing-header-height: 3.5rem;
--spacing-sidebar-width: 15rem;

/* After (dynamic): */
--spacing-header-height: var(--header-height);
--spacing-sidebar-width: var(--sidebar-width);
```

**Visible change:** `_extra.css` overrides `--header-height: 90px !important`. Modern-track components using `h-header-height` will get 90px instead of the previous 56px (3.5rem). This is correct behavior — the modern track should respect per-deployment overrides.

#### 1D. Bridge additional layout spacing tokens

Add new spacing tokens for item/card layout dimensions that `_extra.css` commonly overrides:

```css
--spacing-logo-height:  var(--default-logo-height);
--spacing-item-width:   var(--default-item-width);
```

**Not bridged (and why):**
- `--default-max-row-items`: A count, not a visual token — stays as raw CSS var
- `--item-title-font-size`, `--item-title-line-height`, etc.: These are item-card-specific values. Bridge them only if a modern-track card component is built. Add a code comment documenting this decision in `tailwind.css`.

### Phase 2: Migrate `_extra.css` into Vite

This is the highest-risk phase. Follow these steps in exact order.

#### 2A. Audit `url()` references (~80 occurrences)

Before moving the file, extract every relative `url()` path in `_extra.css` and verify each referenced image exists in `frontend/src/static/images/`.

**Known risk:** Some filenames contain spaces (e.g., `Recent Uploads_light_active.svg`, `Upload Media_light_hover_selected.svg`). Vite should handle these, but verify the build succeeds.

**Action items:**
- Run a grep to extract all `url()` paths from `_extra.css`
- Cross-reference against `frontend/src/static/images/` directory
- Copy any missing images from `static/images/` to `frontend/src/static/images/`
- Verify Vite builds successfully with space-containing paths

#### 2B. Move the file

```
static/css/_extra.css → frontend/src/static/css/_extra.css
```

**Path adjustment:** After moving, `url()` references like `url('../images/icons/search-icon.svg')` will resolve relative to `frontend/src/static/css/`, pointing to `frontend/src/static/images/icons/search-icon.svg`. This matches the existing frontend source tree structure.

#### 2C. Clean up dead code inside `_extra.css`

Remove the `:root` block (around line 3440-3443) that sets `--header-height: 64px` with a comment "example; adjust to your actual header height." This contradicts the live value of `--header-height: 90px !important` on `body` and is dead code from a previous developer.

#### 2D. Import `_extra.css` in the SCSS build chain

Import `_extra.css` inside `frontend/src/static/css/styles.scss`, AFTER the theme config imports:

```scss
// styles.scss — existing imports:
@import 'config/index';     // defines --default-theme-color, --success-color, etc.

// NEW — insert here:
@import '_extra.css';        // per-deployment overrides (must come after theme defaults)

// ... rest of styles.scss continues
```

**Why `styles.scss`?** It is imported by every page via the `PageHeader` component in `base.js`. This ensures `_extra.css` overrides load on all pages — including account/*, mfa/*, and static content pages that don't have their own Vite entry.

**Implementation note:** Native Sass treats `@import "file.css"` as a plain CSS `@import` statement (not inlined). This works here because Vite intercepts CSS imports at the bundler level and inlines the file. If Sass is ever run outside Vite (e.g., standalone `sass` CLI), this import would break. Keep this dependency in mind.

**CSS cascade after migration:**
1. `normalize.css` (imported by `styles.scss`)
2. Theme defaults from `config/index.scss` (imported by `styles.scss`)
3. `_extra.css` overrides (imported by `styles.scss` — NEW)
4. Tailwind `@layer theme`, `@layer utilities` (imported by modern-track components)

#### 2E. Remove the Django `<link>` tag

In `templates/common/head-links.html`, remove line 25:

```html
<!-- REMOVE THIS LINE: -->
<link href="{% static "css/_extra.css" %}?v={{ EXTRA_CSS_VERSION }}" rel="stylesheet">
```

#### 2F. Clean up `EXTRA_CSS_VERSION` in settings.py

In `cms/settings.py` (around line 240-244), remove the `EXTRA_CSS_VERSION` computation (reads old file path, computes MD5 hash — now dead code):

```python
# DELETE these lines:
_extra_css_path = os.path.join(BASE_DIR, 'static', 'css', '_extra.css')
try:
    EXTRA_CSS_VERSION = _hashlib.md5(open(_extra_css_path, "rb").read()).hexdigest()[:8]
except Exception:
    EXTRA_CSS_VERSION = "1"
```

Also search for `EXTRA_CSS_VERSION` in template context processors and remove any references.

### Phase 3: Clean Up & Verify

#### 3A. Update documentation

- **`CONTRIBUTING.md`**: Note that `_extra.css` modifications now require a Vite build (`npm run build` or `make frontend-build`)
- **`CLAUDE.md`**: Update the "Frontend Theming System" section to reflect `_extra.css` is now inside Vite
- **`docs/technical/STATIC_FILES_VERSIONING.md`**: Remove references to `_extra.css` query-string cache busting

#### 3B. Update the modern demo page

In `frontend/src/features/modern-demo/ModernDemoPage.js`, add a small "Token Showcase" section (not a redesign) demonstrating the newly bridged tokens:
- `text-brand-theme`, `bg-brand-accent` for theme/brand colors
- `text-content-success`, `text-content-warning`, `text-content-danger` for status colors
- `font-heading` on a demo heading
- This validates the bridge works end-to-end

#### 3C. Visual regression testing

| Test | What to verify | Pages |
|------|---------------|-------|
| Light mode screenshots | All colors, icons, fonts match pre-migration | Home, media, search, profile, playlist, login, 404 |
| Dark mode screenshots | Dark theme overrides still apply | Same pages |
| Theme toggle | Real-time switching works | Home page |
| Sidebar icons | All ~30 `url()` icon references render | Any page with sidebar |
| Modern demo page | New tokens work, fonts correct, spacing correct | `/modern-demo/` |
| Vite dev HMR | Edit `_extra.css` → changes reflect instantly | Any page |
| Production build | `make frontend-build` succeeds, no broken paths | Build output |
| Account pages | `_extra.css` overrides apply (header height, fonts) | `/accounts/login/` |

## System-Wide Impact

- **Interaction graph**: `_extra.css` import in `styles.scss` → loaded by PageHeader → loaded by every page entry via `base.js`. Font `<link>` tags in `head-links.html` remain unchanged (Amulya, Facultad CSS files stay as Django static assets).
- **Error propagation**: If `_extra.css` has a syntax error, Vite build fails at build time (improvement over current behavior where a broken `_extra.css` is silently served).

## Acceptance Criteria

- [x] All 7 missing color vars bridged in `tailwind.css` (`brand-theme`, `brand-accent`, `content-link`, `content-success`, `content-warning`, `content-danger`, `surface-input-disabled`)
- [x] Font families bridged (`font-sans` → Amulya, `font-heading` → Facultad)
- [x] Spacing tokens dynamic (`--spacing-header-height: var(--header-height)`, `--spacing-sidebar-width: var(--sidebar-width)`)
- [x] `_extra.css` moved into `frontend/src/static/css/_extra.css`
- [x] `_extra.css` imported in `styles.scss` after `config/index.scss`
- [x] Django `<link>` tag for `_extra.css` removed from `head-links.html`
- [x] `EXTRA_CSS_VERSION` dead code removed from `settings.py`
- [x] All `url()` references in `_extra.css` resolve correctly after migration
- [x] `make frontend-build` succeeds without errors
- [ ] Light mode and dark mode visually match pre-migration screenshots
- [ ] Theme toggle works on modern demo page with new tokens
- [x] Modern demo page updated with examples of newly bridged tokens
- [x] Documentation updated (`CONTRIBUTING.md`, `CLAUDE.md`, `STATIC_FILES_VERSIONING.md`)

## Dependencies & Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `url()` paths break after `_extra.css` migration | Medium | High — broken sidebar icons visible to all users | Audit all ~80 references before migration; verify images exist in frontend source tree |
| Files with spaces in `url()` paths fail Vite build | Low | High — build fails | Test build with space-containing paths early; rename files if Vite can't handle them |
| CSS cascade order breaks `_extra.css` overrides | Low | Medium — visual regressions | `!important` on CSS vars is immune to cascade order; non-var rules are unlayered (beat Tailwind layers) |
| Header height change (56px → 90px) in modern track | Certain | Low — only affects modern demo page | Intentional behavior; document the change |
| `--input-disabled-bg-color` invisible in dark mode | Low | Low — no modern-track forms exist yet | Bridge as-is; add dark-mode value when needed |

## Sources & References

### Origin

- **Brainstorm document:** [docs/brainstorms/2026-02-23-tailwind-legacy-full-parity-brainstorm.md](docs/brainstorms/2026-02-23-tailwind-legacy-full-parity-brainstorm.md) — Key decisions carried forward: full parity scope, bridge fonts not heading scale, keep Tailwind breakpoints, move `_extra.css` into Vite, keep semantic naming tiers

### Internal References

- Tailwind bridge: `frontend/src/static/css/tailwind.css`
- Light theme vars: `frontend/src/static/css/config/_light_theme.scss`
- Dark theme vars: `frontend/src/static/css/config/_dark_theme.scss`
- Shared tokens: `frontend/src/static/css/config/index.scss`
- Main stylesheet: `frontend/src/static/css/styles.scss`
- Django CSS loading: `templates/common/head-links.html`
- Settings (EXTRA_CSS_VERSION): `cms/settings.py:240-244`
- Vite config: `frontend/vite.config.js`
- Modern demo: `frontend/src/features/modern-demo/ModernDemoPage.js`
- ADR: `docs/technical/adr-001-webpack-to-vite.md`
- Static versioning: `docs/technical/STATIC_FILES_VERSIONING.md`
