# Modern Track Color System

> **This is a living document.** Every change that introduces a new color usage, adds or removes a token, or shifts an existing token's meaning must update this file in the same commit. The same applies to the Storybook `Introduction > Colors` page (`frontend/src/storybook/Colors.mdx`), which is the working reference for the token catalogue. Treat updates to both surfaces as part of the definition-of-done for any color or theming change. Stale color docs are a real engineering cost — contributors reach for the wrong token, reviewers don't know what's canonical, and the system drifts.

This document describes the **modern track** color system used in `frontend/src/features/`. Unlike the [legacy color audit](./legacy-color-audit.md) — which catalogs hardcoded values to be migrated — this document describes the intended system: a token-based palette consumed through Tailwind CSS v4 utility classes. For the per-token light/dark lookup table, see the Storybook `Introduction > Colors` page; this document focuses on architecture, rationale, and wiring.

## Overview

The modern track has three layers:

1. **Canonical palette** — `--cinemata-*` CSS custom properties defining the brand color scales. Defined in the SCSS theme config files.
2. **Tailwind theme layer** — `tailwind.css` exposes three kinds of `--color-*` variables: the palette mirror, legacy semantic aliases (`--color-content-*`, `--color-brand-*`), and the **modern semantic tokens** (`--color-bg-*`, `--color-text-*`, `--color-border-*`, `--color-ring-*`). Modern tokens are wired through intermediate vars on `body` / `body.dark_theme` so they invert with the theme cleanly.
3. **Feature consumption** — React components in `features/` consume colors via Tailwind utilities. Modern semantic tokens (`bg-bg-page`, `text-text-strong`, `ring-ring-focus`) are the preferred vocabulary; raw palette utilities and legacy semantic aliases remain available for one-offs and legacy bridges.

```text
_light_theme.scss / _dark_theme.scss     →  tailwind.css @theme            →  features/*.jsx
  --cinemata-strait-blue-500: #026690         palette mirror                    bg-cinemata-strait-blue-500
  --btn-primary-bg-color: …                   --color-brand-primary: …          bg-brand-primary
                                              --color-content-body: …           text-content-body
                                          (modern semantic, body-scoped):
                                              --bg-page on body / .dark_theme   bg-bg-page
                                              --text-strong on body / .dark_t   text-text-strong
                                              --ring-focus (constant)           ring-ring-focus
```

---

# 1. Canonical palette (`--cinemata-*`)

**93 tokens total** (3 singletons + 9 named scales). The palette is **identical between light and dark themes** — it is defined verbatim in both `_light_theme.scss` (lines ~395–495) and `_dark_theme.scss` (lines ~396–501). The brand palette is theme-agnostic; theme variation is handled by *semantic* tokens (section 2), not by the palette itself.

> Note: the duplication across both theme files is a known consolidation candidate (see [legacy audit](./legacy-color-audit.md) migration note 1).

## Singletons

| Token | Value |
|-------|-------|
| `--cinemata-white` | `#ffffff` |
| `--cinemata-black` | `#000000` |
| `--cinemata-transparent` | `rgba(0,0,0,0)` |

## Brand scales

The four brand scales carry the Asia-Pacific identity of the project.

### Strait Blue (primary action / emphasis)

| Token | Value |
|-------|-------|
| `--cinemata-strait-blue-50` | `#defbff` |
| `--cinemata-strait-blue-100` | `#b1dffb` |
| `--cinemata-strait-blue-200` | `#8bc0e0` |
| `--cinemata-strait-blue-300` | `#64a1c5` |
| `--cinemata-strait-blue-400` | `#3d83aa` |
| `--cinemata-strait-blue-500` | `#026690` |
| `--cinemata-strait-blue-600p` | `#026690` |
| `--cinemata-strait-blue-700` | `#004e74` |
| `--cinemata-strait-blue-800` | `#003757` |
| `--cinemata-strait-blue-900` | `#00223d` |
| `--cinemata-strait-blue-950` | `#001023` |

### Pacific Deep (surfaces / headings)

| Token | Value |
|-------|-------|
| `--cinemata-pacific-deep-50` | `#ebf8ff` |
| `--cinemata-pacific-deep-100` | `#c1d9f2` |
| `--cinemata-pacific-deep-200` | `#9eb8d3` |
| `--cinemata-pacific-deep-300` | `#7b98b6` |
| `--cinemata-pacific-deep-400` | `#5a7999` |
| `--cinemata-pacific-deep-500` | `#3a5c7c` |
| `--cinemata-pacific-deep-600p` | `#1a3f61` |
| `--cinemata-pacific-deep-700` | `#1a3f61` |
| `--cinemata-pacific-deep-800` | `#0b2d4a` |
| `--cinemata-pacific-deep-900` | `#011c34` |
| `--cinemata-pacific-deep-950` | `#000c20` |

### Sunset Horizon (accent / links / focus rings)

| Token | Value |
|-------|-------|
| `--cinemata-sunset-horizon-100` | `#ffc9a4` |
| `--cinemata-sunset-horizon-200` | `#f6a474` |
| `--cinemata-sunset-horizon-300` | `#ed7c30` |
| `--cinemata-sunset-horizon-400p` | `#ed7c30` |
| `--cinemata-sunset-horizon-500` | `#c2692f` |
| `--cinemata-sunset-horizon-600` | `#a15728` |
| `--cinemata-sunset-horizon-700` | `#833e0b` |
| `--cinemata-sunset-horizon-800` | `#611e00` |
| `--cinemata-sunset-horizon-900` | `#440f00` |
| `--cinemata-sunset-horizon-950` | `#290400` |

### Coral Reef (secondary accent / borders)

| Token | Value |
|-------|-------|
| `--cinemata-coral-reef-light-50` | `#d3ffef` |
| `--cinemata-coral-reef-100` | `#baead9` |
| `--cinemata-coral-reef-200` | `#7fddbf` |
| `--cinemata-coral-reef-300` | `#4ec8a6` |
| `--cinemata-coral-reef-400p` | `#4ec8a6` |
| `--cinemata-coral-reef-500` | `#2da788` |
| `--cinemata-coral-reef-600` | `#00876a` |
| `--cinemata-coral-reef-700` | `#00684f` |
| `--cinemata-coral-reef-800` | `#004935` |
| `--cinemata-coral-reef-900` | `#002b1f` |
| `--cinemata-coral-reef-950` | `#00150d` |

## Utility scales

### Neutral (text / disabled / auxiliary)

| Token | Value |
|-------|-------|
| `--cinemata-neutral-50` | `#f9fafb` |
| `--cinemata-neutral-100` | `#f3f4f6` |
| `--cinemata-neutral-200` | `#e5e7eb` |
| `--cinemata-neutral-300` | `#d1d5db` |
| `--cinemata-neutral-400` | `#9ca3af` |
| `--cinemata-neutral-500` | `#6b7280` |
| `--cinemata-neutral-600` | `#4b5563` |
| `--cinemata-neutral-700` | `#374151` |
| `--cinemata-neutral-800` | `#1f2937` |
| `--cinemata-neutral-900` | `#111827` |
| `--cinemata-neutral-950` | `#030712` |

### Red (errors)

| Token | Value |
|-------|-------|
| `--cinemata-red-50` | `#fef2f2` |
| `--cinemata-red-100` | `#fee2e2` |
| `--cinemata-red-200` | `#fecaca` |
| `--cinemata-red-300` | `#fca5a5` |
| `--cinemata-red-400` | `#f87171` |
| `--cinemata-red-500` | `#ef4444` |
| `--cinemata-red-600` | `#dc2626` |
| `--cinemata-red-700p` | `#b91c1c` |
| `--cinemata-red-800` | `#991b1b` |
| `--cinemata-red-900` | `#7f1d1d` |
| `--cinemata-red-950` | `#450a0a` |

### Green (success)

| Token | Value |
|-------|-------|
| `--cinemata-green-50` | `#f0fdf4` |
| `--cinemata-green-100` | `#dcfce7` |
| `--cinemata-green-200` | `#bbf7d0` |
| `--cinemata-green-300` | `#86efac` |
| `--cinemata-green-400` | `#4ade80` |
| `--cinemata-green-500` | `#22c55e` |
| `--cinemata-green-600` | `#16a34a` |
| `--cinemata-green-700p` | `#15803d` |
| `--cinemata-green-800` | `#166534` |
| `--cinemata-green-900` | `#14532d` |
| `--cinemata-green-950` | `#052e16` |

### Amber (warnings)

| Token | Value |
|-------|-------|
| `--cinemata-amber-50` | `#fffbeb` |
| `--cinemata-amber-100` | `#fef3c7` |
| `--cinemata-amber-200` | `#fde68a` |
| `--cinemata-amber-300` | `#fcd34d` |
| `--cinemata-amber-400` | `#fbbf24` |
| `--cinemata-amber-500` | `#f59e0b` |
| `--cinemata-amber-600p` | `#d97706` |
| `--cinemata-amber-700` | `#b45309` |
| `--cinemata-amber-800` | `#92400e` |
| `--cinemata-amber-900` | `#78350f` |
| `--cinemata-amber-950` | `#451a03` |

### Sandy Shore (single step)

| Token | Value |
|-------|-------|
| `--cinemata-sandy-shore-50` | `#ffe4cf` |

---

# 2. Tailwind theme layer (`tailwind.css`)

Tailwind CSS v4 is configured **inline** — there is no `tailwind.config.js`. The plugin is wired in `frontend/vite.config.js` via `@tailwindcss/vite`. All color configuration lives in `frontend/src/static/css/tailwind.css` inside an `@theme` block.

## The `@theme` → utility mechanism

In Tailwind v4, any custom property named `--color-X` declared in `@theme` automatically generates color utilities for `X`:

```css
@theme {
  --color-cinemata-strait-blue-500: var(--cinemata-strait-blue-500);
}
```

produces the utilities `bg-cinemata-strait-blue-500`, `text-cinemata-strait-blue-500`, `border-cinemata-strait-blue-500`, `ring-cinemata-strait-blue-500`, `outline-cinemata-strait-blue-500`, `fill-cinemata-strait-blue-500`, etc.

Because the `--color-*` variables point at `var(--cinemata-*)` (palette) or `var(--site-*)` / `var(--body-*)` (semantic tokens that differ per theme), the same utility class renders different colors in light vs dark mode automatically when `body.dark_theme` / `body.light_theme` toggles.

Utilities are imported with `!important` so they win over the legacy SCSS cascade.

## Theme variable groups

`tailwind.css` defines `--color-*` variables across **three** kinds:

**A. Palette mirror** — one `--color-cinemata-*` per palette token (section 1). Each maps `--color-cinemata-X: var(--cinemata-X)`. Representative example per scale:

| Theme Variable | Maps To | Example Utility |
|----------------|---------|-----------------|
| `--color-cinemata-strait-blue-500` | `var(--cinemata-strait-blue-500)` | `bg-cinemata-strait-blue-500` |
| `--color-cinemata-pacific-deep-900` | `var(--cinemata-pacific-deep-900)` | `text-cinemata-pacific-deep-900` |
| `--color-cinemata-sunset-horizon-400p` | `var(--cinemata-sunset-horizon-400p)` | `ring-cinemata-sunset-horizon-400p` |
| `--color-cinemata-coral-reef-400p` | `var(--cinemata-coral-reef-400p)` | `border-cinemata-coral-reef-400p` |
| `--color-cinemata-neutral-900` | `var(--cinemata-neutral-900)` | `text-cinemata-neutral-900` |
| `--color-cinemata-red-500` | `var(--cinemata-red-500)` | `border-cinemata-red-500` |
| `--color-cinemata-white` | `var(--cinemata-white)` | `text-cinemata-white` |

(The full mirror covers all 9 scales + singletons; see [section 1](#1-canonical-palette---cinemata-) for the complete value list.)

**B. Legacy semantic aliases** — theme-aware aliases inherited from the MediaCMS legacy CSS variables. These map to `--site-*`, `--body-*`, `--btn-*`, etc., which DO differ between light and dark themes via `body.dark_theme` overrides in the SCSS theme files. Representative examples:

| Theme Variable | Role | Example Utility |
|----------------|------|-----------------|
| `--color-content-body` | Primary body text | `text-content-body` |
| `--color-content-error` | Error text (`var(--error-text-color, #dc2626)`) | `text-content-error` |
| `--color-surface-popup` | Popup/menu surface | `bg-surface-popup` |
| `--color-bg-cards` | Card background | `bg-bg-cards` |
| `--color-brand-theme` | Brand theme color | `bg-brand-theme` |
| `--color-brand-primary` | Modern primary button bg — redirected to `var(--bg-secondary)` (orange) so the new utility and the legacy `--btn-primary-bg-color` SCSS variable are decoupled. The brand utility resolves to sunset-horizon-400p in light mode and sunset-horizon-500 in dark mode while legacy SCSS rules (e.g. login form `.primaryAction`) still resolve to the legacy blue. | `bg-brand-primary` |

Component-scoped legacy semantic groups also exist (search, comments, playlists, media, profile, upload, sidebar, etc.), each mapping to the corresponding legacy semantic token.

The **video player** group (`--site-player-accent-color`, `--site-player-progress-color`, `--site-player-track-color`, `--site-player-loaded-color`, `--site-player-tooltip-bg-color`, `--site-player-control-color`, `--site-player-canvas-color`, `--site-player-control-surface-color`, `--site-player-subtitle-bg-color`, `--site-player-subtitle-color`, `--site-player-shadow-color`) is theme-aware and exposed as `--color-site-player-*` utilities. It is the shared accent and control-surface system for both the legacy media view page player (`frontend/src/static/js/components/styles/VideoPlayer.scss`, consumed as plain `var(--site-player-*)`) and the home hero player. The progress / volume / subtitle accent resolves to sunset-horizon (500 light / 400p dark); the big play button to strait-blue (500 light / 300 dark); the buffered range to pacific-deep; the seek tooltip to pacific-deep-950; control text and subtitle text to white; the video canvas to black. The hero player consumes these tokens directly instead of declaring its own color aliases. This replaces the player-specific use of the configurable site `--brand-color`.

**C. Modern semantic tokens (role-based)** — the roles in `tokens.json`, and the preferred vocabulary for new code in `features/`. They use slash-prefixed namespaces (`bg/*`, `text/*`, `border/*`, `ring/*`) that become double-prefix Tailwind utilities (`bg-bg-page`, `text-text-strong`, etc.). Intermediate vars are defined on `body` and `body.dark_theme` and exposed through `@theme inline`, so each token resolves at the using element's scope (which is always a body descendant).

| Role (Figma) | Utility | Light | Dark |
|---|---|---|---|
| `bg/chrome/default` | `bg-bg-chrome` | `pacific-deep-800` | `pacific-deep-800` |
| `bg/chrome/hover` | `bg-bg-chrome-hover` | `pacific-deep-700` | `pacific-deep-700` |
| `bg/control/checked` | `bg-bg-control-checked` | `pacific-deep-700` | `sunset-horizon-400p` |
| `bg/control/default` | `bg-bg-control` | `neutral-300` | `pacific-deep-700` |
| `bg/control/thumb` | `bg-bg-control-thumb` | `neutral-100` | `neutral-100` |
| `bg/control/track-off` | `bg-bg-control-track-off` | `pacific-deep-900` | `pacific-deep-800` |
| `bg/control/track-on` | `bg-bg-control-track-on` | `coral-reef-600` | `coral-reef-700` |
| `bg/danger/default` | `bg-bg-danger` | `red-500` | `red-500` |
| `bg/danger/hover` | `bg-bg-danger-hover` | `red-900` | `red-900` |
| `bg/danger/strong` | `bg-bg-danger-strong` | `red-800` | `red-800` |
| `bg/danger/subtle` | `bg-bg-danger-subtle` | `red-100` | `red-950` |
| `bg/emblem/blue` | `bg-bg-emblem-blue` | `pacific-deep-800` | `pacific-deep-800` |
| `bg/emblem/blue-deep` | `bg-bg-emblem-blue-deep` | `pacific-deep-900` | `pacific-deep-950` |
| `bg/emblem/gray` | `bg-bg-emblem-gray` | `neutral-800` | `neutral-900` |
| `bg/emblem/green` | `bg-bg-emblem-green` | `coral-reef-800` | `coral-reef-900` |
| `bg/emblem/orange` | `bg-bg-emblem-orange` | `sunset-horizon-700` | `sunset-horizon-800` |
| `bg/info/default` | `bg-bg-info` | `strait-blue-500` | `strait-blue-500` |
| `bg/info/muted` | `bg-bg-info-muted` | `strait-blue-400` | `strait-blue-400` |
| `bg/info/strong` | `bg-bg-info-strong` | `strait-blue-800` | `strait-blue-800` |
| `bg/label` | `bg-bg-label` | `strait-blue-50` | `strait-blue-50` |
| `bg/marker` | `bg-bg-marker` | `strait-blue-200` | `strait-blue-200` |
| `bg/overlay` | `bg-bg-overlay` | `pacific-deep-900` | `pacific-deep-900` |
| `bg/page` | `bg-bg-page` | `pacific-deep-50` | `pacific-deep-950` |
| `bg/primary/default` | `bg-bg-primary` | `strait-blue-600p` | `strait-blue-500` |
| `bg/primary/hover` | `bg-bg-primary-hover` | `strait-blue-800` | `strait-blue-700` |
| `bg/primary/inverse` | `bg-bg-primary-inverse` | `strait-blue-900` | `strait-blue-600p` |
| `bg/progress` | `bg-bg-progress` | `coral-reef-400p` | `coral-reef-400p` |
| `bg/scrollbar` | `bg-bg-scrollbar` | `strait-blue-200` | `strait-blue-200` |
| `bg/secondary/default` | `bg-bg-secondary` | `sunset-horizon-400p` | `sunset-horizon-500` |
| `bg/secondary/hover` | `bg-bg-secondary-hover` | `sunset-horizon-500` | `sunset-horizon-400p` |
| `bg/secondary/strong` | `bg-bg-secondary-strong` | `sunset-horizon-800` | `sunset-horizon-800` |
| `bg/selected` | `bg-bg-selected` | `strait-blue-200` | `strait-blue-200` |
| `bg/skeleton/default` | `bg-bg-skeleton` | `pacific-deep-100` | `pacific-deep-700` |
| `bg/skeleton/strong` | `bg-bg-skeleton-strong` | `pacific-deep-200` | `pacific-deep-500` |
| `bg/success/default` | `bg-bg-success` | `green-500` | `green-500` |
| `bg/success/strong` | `bg-bg-success-strong` | `green-800` | `green-800` |
| `bg/success/subtle` | `bg-bg-success-subtle` | `green-100` | `green-950` |
| `bg/surface/default` | `bg-bg-surface` | `neutral-50` | `pacific-deep-900` |
| `bg/surface/highlight` | `bg-bg-surface-highlight` | `pacific-deep-100` | `pacific-deep-700` |
| `bg/surface/hover` | `bg-bg-surface-hover` | `pacific-deep-50` | `pacific-deep-700` |
| `bg/surface/inverse` | `bg-bg-surface-inverse` | `pacific-deep-900` | `white` |
| `bg/surface/muted` | `bg-bg-surface-muted` | `neutral-200` | `pacific-deep-800` |
| `bg/surface/raised` | `bg-bg-surface-raised` | `white` | `pacific-deep-800` |
| `bg/tag` | `bg-bg-tag` | `strait-blue-100` | `pacific-deep-700` |
| `bg/warning/default` | `bg-bg-warning` | `amber-500` | `amber-500` |
| `bg/warning/strong` | `bg-bg-warning-strong` | `amber-800` | `amber-800` |
| `bg/warning/subtle` | `bg-bg-warning-subtle` | `amber-100` | `amber-950` |
| `border/accent` | `border-border-accent` | `sunset-horizon-400p` | `sunset-horizon-400p` |
| `border/active` | `border-border-active` | `coral-reef-400p` | `sunset-horizon-400p` |
| `border/chrome` | `border-border-chrome` | `pacific-deep-700` | `pacific-deep-700` |
| `border/danger` | `border-border-danger` | `red-500` | `red-500` |
| `border/default` | `border-border` | `pacific-deep-200` | `pacific-deep-700` |
| `border/disclosure` | `border-border-disclosure` | `pacific-deep-300` | `transparent` |
| `border/info` | `border-border-info` | `strait-blue-500` | `strait-blue-500` |
| `border/strong` | `border-border-strong` | `pacific-deep-500` | `pacific-deep-400` |
| `border/subtle` | `border-border-subtle` | `neutral-200` | `pacific-deep-800` |
| `border/success` | `border-border-success` | `green-500` | `green-500` |
| `border/warning` | `border-border-warning` | `amber-500` | `amber-500` |
| `ring/focus` | `ring-ring-focus` | `sunset-horizon-400p` | `sunset-horizon-400p` |
| `text/accent` | `text-text-accent` | `sunset-horizon-400p` | `sunset-horizon-400p` |
| `text/danger` | `text-text-danger` | `red-700p` | `red-400` |
| `text/default` | `text-text` | `pacific-deep-700` | `strait-blue-50` |
| `text/disabled` | `text-text-disabled` | `pacific-deep-400` | `pacific-deep-400` |
| `text/info/default` | `text-text-info` | `strait-blue-700` | `strait-blue-200` |
| `text/info/muted` | `text-text-info-muted` | `strait-blue-400` | `strait-blue-400` |
| `text/inverse` | `text-text-inverse` | `white` | `pacific-deep-900` |
| `text/link/default` | `text-text-link` | `sunset-horizon-700` | `sunset-horizon-200` |
| `text/link/hover` | `text-text-link-hover` | `sunset-horizon-800` | `sunset-horizon-100` |
| `text/muted` | `text-text-muted` | `pacific-deep-500` | `pacific-deep-300` |
| `text/on-chrome/default` | `text-text-on-chrome` | `strait-blue-50` | `strait-blue-50` |
| `text/on-chrome/muted` | `text-text-on-chrome-muted` | `pacific-deep-300` | `pacific-deep-300` |
| `text/on-control-checked` | `text-text-on-control-checked` | `pacific-deep-100` | `pacific-deep-900` |
| `text/on-emblem/default` | `text-text-on-emblem` | `pacific-deep-200` | `pacific-deep-200` |
| `text/on-emblem/green` | `text-text-on-emblem-green` | `coral-reef-600` | `coral-reef-600` |
| `text/on-info` | `text-text-on-info` | `pacific-deep-900` | `pacific-deep-900` |
| `text/on-label` | `text-text-on-label` | `pacific-deep-900` | `pacific-deep-900` |
| `text/on-primary/default` | `text-text-on-primary` | `white` | `white` |
| `text/on-primary/inverse` | `text-text-on-primary-inverse` | `strait-blue-100` | `strait-blue-50` |
| `text/strong` | `text-text-strong` | `pacific-deep-900` | `white` |
| `text/subtle` | `text-text-subtle` | `strait-blue-700` | `strait-blue-100` |
| `text/success` | `text-text-success` | `green-800` | `green-500` |
| `text/warning` | `text-text-warning` | `amber-800` | `amber-500` |

The table lists the values in `tokens.json`. To change a color, edit `tokens.json`, not this table.

## How modern semantic tokens are wired

The source of truth is `frontend/src/static/css/tokens.json`, in the W3C design-token (DTCG) format. It has two groups:

- `semantic`: the role tokens shared with Figma, named `property/role/variant` (`bg.surface.hover`). A trailing `default` is dropped in code, so `semantic.bg.surface.default` is `--bg-surface`.
- `legacy`: older names kept as aliases of a semantic role until their callers move. Phase 5 of #1172 deletes them.

`$value` is the light mode. `$extensions["org.cinemata.modes"].dark` holds a different dark value. `{palette.<step>}` names a `--cinemata-<step>` primitive.

To change a color, edit `tokens.json` and run `uv run python scripts/generate_color_tokens.py`. The script rewrites the region between the `BEGIN GENERATED` and `END GENERATED` markers in `tailwind.css`. Pre-commit runs it with `--check`, so `make lint` and CI fail when the CSS differs from `tokens.json`. The script also fails on an unknown palette step, a reference to a missing token, and two tokens with one CSS name.

The generated region has three coordinated blocks:

1. **`body { ... }`** declares the light-mode intermediate vars (`--bg-page`, `--text-strong`, `--border`, `--ring-focus`, etc.) and points them at the appropriate `--cinemata-*` palette steps.
2. **`body.dark_theme { ... }`** overrides only the tokens whose value differs in dark mode. Tokens that are theme-agnostic (e.g. `--bg-danger`, `--ring-focus`) appear only in the `body` block.
3. **`@theme inline { --color-bg-page: var(--bg-page); ... }`** exposes the intermediate vars as Tailwind theme tokens so utilities are generated. `inline` is required: it makes Tailwind emit `.bg-bg-page { background-color: var(--bg-page); }` so resolution happens at the *using* element (always a body descendant), where the cascade chain actually works.

The body scope matters. If we had declared `:root { --bg-page: var(--cinemata-pacific-deep-50); }` instead, the inner `var(--cinemata-pacific-deep-50)` would be unresolved at `:root` (the palette is on `body`, not `:root`) and `--bg-page`'s computed value would inherit as "invalid" to every descendant — the regression caught when the topbar and donate button lost their fills during the initial migration.

## Naming convention

Slash-prefixed namespaces become double-prefix Tailwind utilities. The slash exists in the source (`bg/*`, `text/*`, `border/*`, `ring/*`) to group categories visually; in CSS and Tailwind class names it becomes a single hyphen.

| CSS variable | Tailwind utility |
|---|---|
| `--color-bg-page` | `bg-bg-page` |
| `--color-text-strong` | `text-text-strong` |
| `--color-border` | `border-border` |
| `--color-ring-focus` | `ring-ring-focus` |

The double prefix is a Tailwind v4 side-effect: any `--color-X` generates `bg-X`, `text-X`, `border-X`, `ring-X`, `outline-X`, `fill-X`. The slash-prefixed source name is for human readability; the runtime utility name is whatever Tailwind generates.

## Why semantic tokens

Before the migration, components consumed raw palette tokens with `dark:` variants on every utility:

```jsx
<div className="bg-cinemata-pacific-deep-50 dark:bg-cinemata-pacific-deep-950
                text-cinemata-pacific-deep-700 dark:text-cinemata-strait-blue-50">
```

Two problems with that pattern:

1. **Every component re-asserts the theme contract.** Changing the page background means editing every file that paints one.
2. **Components encode shade decisions.** The fact that "primary text" is `pacific-deep-700` in light and `strait-blue-50` in dark is a design system decision, not a component concern.

Semantic tokens flip this: components ask for *roles* (`bg-bg-page`, `text-text`), and the role-to-shade mapping lives in one place. The same JSX renders correctly in both themes because the `--bg-page` and `--text` intermediate vars resolve to different palette values under `body.dark_theme`.

### Before (raw palette + dark variants)

```jsx
<div className="bg-cinemata-neutral-50 dark:bg-cinemata-pacific-deep-900
                border border-cinemata-pacific-deep-100 dark:border-cinemata-pacific-deep-700">
  <h2 className="text-cinemata-pacific-deep-700 dark:text-cinemata-strait-blue-50">Title</h2>
  <p className="text-cinemata-pacific-deep-400 dark:text-cinemata-pacific-deep-300">Caption</p>
  <a className="text-cinemata-sunset-horizon-400p hover:text-cinemata-sunset-horizon-600
                dark:text-cinemata-sunset-horizon-200 dark:hover:text-cinemata-sunset-horizon-100">
    Read more
  </a>
</div>
```

### After (semantic tokens)

```jsx
<div className="bg-bg-surface border border-border">
  <h2 className="text-text">Title</h2>
  <p className="text-text-muted">Caption</p>
  <a className="text-text-link hover:text-text-link-hover">Read more</a>
</div>
```

The component contains no shade decisions, no `dark:` variants, and no palette references. Theme switching is a CSS cascade concern.

### Buttons and inputs

```jsx
<button className="bg-bg-primary hover:bg-bg-primary-hover text-text-on-primary
                   focus-visible:ring-2 focus-visible:ring-ring-focus">
  Primary action
</button>

<input
  className="bg-bg-surface text-text placeholder:text-text-muted
             border border-border-strong focus:border-border-active
             focus-visible:ring-2 focus-visible:ring-ring-focus"
/>
```

## When to use semantic tokens vs raw palette

**Use semantic tokens** for anything that should respond to the theme — the default case. Most production UI falls here.

**Use raw `--cinemata-*` palette** only when:

- A color is intentionally theme-independent (e.g. a brand badge that must stay the same orange in both themes).
- You need a one-off shade that no semantic role covers, AND the case is unique enough that promoting it to a token would not be reused.

If you find yourself reaching for a raw palette token more than once for the same role, add a semantic token for it instead. The chrome family (`bg/chrome`, `text/on-chrome`, etc.) was added precisely because the always-dark UI surface pattern recurred across topbar, search overlays, and dropdown chrome — promoting it to first-class tokens collapsed ~50 raw refs into 5 tokens.

## Literal hardcoded colors in `tailwind.css`

Two literals remain in the tailwind file (the rest are `var()` references):

| Context | Value |
|---------|-------|
| `--color-content-error` fallback | `var(--error-text-color, #dc2626)` |
| Cascade-defence block focus outline (modern topbar override) | `#ed7c30` |

---

# 3. Feature consumption (`frontend/src/features/`)

## How features apply color

Following the semantic token migration, modern features now consume colors through **three layers**, in this order of preference:

1. **Modern semantic tokens** (`bg-bg-page`, `text-text-strong`, `border-border`, `ring-ring-focus`, etc.) — the default and preferred vocabulary. Most components in `features/` were migrated to this layer. Theme-awareness is handled at the token level — no `dark:` variants needed in component code.
2. **Raw `--cinemata-*` palette utilities** (`bg-cinemata-pacific-deep-700`, etc.) — used only for one-off decorations that don't fit any semantic token. Remaining references include the avatar inverted-neutral inner bg, carousel indicator dot pair, HeroSection retry button, and decoration accents.
3. **Legacy semantic aliases** (`bg-brand-primary`, `text-content-body`, `bg-surface-popup`, etc.) — preserved for components that bridge into legacy SCSS contexts. The notable bridge is `bg-brand-primary` itself: it routes through `bg/secondary` so the modern utility renders sunset-horizon-400p in light mode and sunset-horizon-500 in dark mode while the legacy `--btn-primary-bg-color` SCSS variable can independently stay blue (light) / orange (dark) for legacy server-rendered buttons like `.primaryAction` on the login page.

Key characteristics after migration:

- **`dark:` variants are now rare in component code** — handled at the token layer instead. The few remaining `dark:` variants are opacity-based hover overlays (`hover:bg-black/[0.04] dark:hover:bg-white/[0.04]`) where the overlay needs to invert with the surface.
- **Focus rings are unified** on `focus-visible:ring-ring-focus` (= `--cinemata-sunset-horizon-400p`, constant orange) across topbar, sidebar, dropdowns, search, carousel, hero, and movie tiles. The home-screen blue rings have been replaced.
- **Chrome family tokens** (`bg/chrome`, `text/on-chrome`, etc.) cover all the always-dark UI surfaces: topbar buttons, search input, dropdown rows, mobile overlay header.
- **Legacy `--sidebar-navigation-item-*-color` vars** are still used in `NavigationMenuList.jsx` (theme-aware via legacy SCSS) — this is the deliberate dual-track bridge for sidebar nav structure.

## Role conventions

| Token family | Typical role | Light usage | Dark usage |
|--------------|--------------|-------------|------------|
| `cinemata-pacific-deep` | Surfaces, headings | 50–100 backgrounds | 700–950 backgrounds |
| `cinemata-strait-blue` | Secondary text, buttons, focus | 50–800 | 100–600p |
| `cinemata-sunset-horizon` | Accent, links, primary action, rings | 400p–800 | 100–500 |
| `cinemata-neutral` | Subtle / disabled / auxiliary | 50–600 | 300–500 |
| `cinemata-coral-reef` | Borders, sparse accents | 400p–900 | 400p–900 |
| `cinemata-red` | Errors / warnings | 500–950 | 500–950 |
| `cinemata-white` | Foreground on dark surfaces | constant | constant |

## Usage by feature

### creator-analytics

The shared `LineChart` component owns chart styling and resolves axis label size
from the shared body typography. Labels use `fill-text` and grid lines
use `stroke-border`.
Series inherit `currentColor`: `text-text-subtle` for media views,
`text-text-link` for playback starts, watch time and segment coverage, and
`text-text-success` for reached-end events. Use foreground tokens for chart
strokes so both themes retain readable contrast.

Selected orange controls use the existing `text-btn-text` foreground, matching
the primary Button in both themes. Do not introduce a second alias for it.

### home

| File | Color class / token | Element |
|------|---------------------|---------|
| HeroSection.jsx | `bg-cinemata-pacific-deep-50` | Player frame / loading bg |
| HeroSection.jsx | `bg-cinemata-strait-blue-900/80`, `text-cinemata-strait-blue-100` | Duration badge |
| HeroSection.jsx | `bg-cinemata-strait-blue-700`, `hover:bg-cinemata-strait-blue-800`, `focus-visible:ring-cinemata-strait-blue-200` | Retry/play buttons |
| HeroSection.jsx | `text-cinemata-strait-blue-400` | Play button icon |
| Carousel.jsx | `text-cinemata-strait-blue-50`, `hover:bg-cinemata-pacific-deep-700`, `focus-visible:ring-cinemata-strait-blue-200` | Nav arrows |
| Carousel.jsx | `bg-cinemata-strait-blue-800 dark:bg-white`, `bg-cinemata-pacific-deep-400/30 dark:bg-white/30` | Indicator dots |
| Carousel.jsx | `dark:text-cinemata-strait-blue-600p dark:hover:text-cinemata-strait-blue-400` | Dark nav text |
| HeroMediaCard.jsx | `focus-visible:outline-cinemata-strait-blue-700 dark:focus-visible:outline-cinemata-strait-blue-100` | Link focus outline |
| HeroMediaCard.jsx | `text-cinemata-pacific-deep-700 dark:text-cinemata-strait-blue-50` | Card heading |
| HeroMediaCard.jsx | `text-text-muted` | Description |
| HeroMediaCard.jsx | `text-cinemata-sunset-horizon-400p dark:text-cinemata-sunset-horizon-200` | Author/link text |
| HeroMediaCard.jsx | `text-cinemata-pacific-deep-400 dark:text-cinemata-pacific-deep-300` | View count |
| HeroMediaCard.jsx | `bg-cinemata-pacific-deep-100 dark:bg-cinemata-pacific-deep-700` | Loading skeleton |
| ExpandableText.jsx | `text-cinemata-sunset-horizon-400p` | Expand button |
| SectionRow.jsx | `bg-cinemata-neutral-50 dark:bg-cinemata-pacific-deep-800` | Section background |
| SectionRow.jsx | `text-cinemata-pacific-deep-700 dark:text-cinemata-strait-blue-50` | Section heading |
| SectionRow.jsx | `text-cinemata-strait-blue-700 dark:text-cinemata-strait-blue-100` | Section subtitle |
| SectionRow.jsx | `hover:text-cinemata-sunset-horizon-600 dark:hover:text-cinemata-sunset-horizon-100` | "View All" hover |
| SectionRow.jsx | `[&_a]:text-cinemata-sunset-horizon-400p dark:[&_a]:text-cinemata-sunset-horizon-200` | Nested link styling |

### global-search

| File | Color class / token | Element |
|------|---------------------|---------|
| GlobalSearchDropdown.jsx | `bg-cinemata-pacific-deep-800`, `text-cinemata-strait-blue-50` | Search input box |
| GlobalSearchDropdown.jsx | `placeholder:text-cinemata-pacific-deep-300` | Input placeholder |
| GlobalSearchDropdown.jsx | `focus:border-cinemata-sunset-horizon-400p` | Input focus |
| GlobalSearchDropdown.jsx | `bg-cinemata-pacific-deep-900`, `border-cinemata-pacific-deep-700/60` | Dropdown panel |
| GlobalSearchMobileOverlay.jsx | `bg-cinemata-pacific-deep-950` | Overlay background |
| GlobalSearchMobileOverlay.jsx | `border-cinemata-pacific-deep-700/60`, `bg-cinemata-pacific-deep-900` | Search header |
| GlobalSearchMobileOverlay.jsx | `text-cinemata-strait-blue-50`, `hover:bg-cinemata-pacific-deep-700/60` | Close button |
| MemberResultRow.jsx | `hover:bg-cinemata-pacific-deep-700/60`, `focus-visible:ring-cinemata-sunset-horizon-400p` | Row hover/focus |
| MemberResultRow.jsx | `text-cinemata-strait-blue-50`, `text-cinemata-pacific-deep-300` | Name / metadata |
| PlaylistResultRow.jsx | `bg-cinemata-pacific-deep-700`, `text-cinemata-pacific-deep-300`, `text-cinemata-strait-blue-50` | Thumbnail / count / title |
| PlaylistResultRow.jsx | `bg-cinemata-pacific-deep-900/70` | Scrollbar indicator |
| SearchResultSection.jsx | `border-cinemata-pacific-deep-700/60`, `text-cinemata-pacific-deep-300` | Divider / label |
| SearchResultSection.jsx | `text-cinemata-sunset-horizon-400p`, `hover:text-cinemata-sunset-horizon-300` | "Load more" link |
| EmptyState / IdleHint / LoadingState | `text-cinemata-strait-blue-50`, `text-cinemata-pacific-deep-300` | State messages |

### layout

| File | Color class / token | Element |
|------|---------------------|---------|
| Topbar.jsx | `bg-cinemata-pacific-deep-900`, `text-cinemata-white` | Topbar bg + text |
| NavigationMenuList.jsx | `bg-transparent text-[var(--sidebar-navigation-item-text-color)]` | Nav item base (legacy var) |
| NavigationMenuList.jsx | `bg-[var(--sidebar-navigation-item-hover-bg-color)]` | Nav item hover (legacy var) |
| NavigationMenuList.jsx | `bg-[var(--sidebar-navigation-item-active-bg-color)]` | Nav item active (legacy var) |
| NavigationMenuList.jsx | `bg-cinemata-strait-blue-800`, `text-cinemata-strait-blue-50` | Active link (theme token) |
| NavigationMenuList.jsx | `hover:bg-cinemata-pacific-deep-50 dark:hover:bg-cinemata-strait-blue-900` | Link hover |
| NavigationMenuList.jsx | `text-cinemata-sunset-horizon-400p`, `dark:text-cinemata-strait-blue-200` | Active / inactive nav icon |

### notifications

| File | Color class / token | Element |
|------|---------------------|---------|
| NotificationDialog.jsx | `bg-bg-surface`, `text-text-strong`, `text-text-link` | Popup chrome and actions |
| NotificationItem.jsx | `bg-bg-surface`, `bg-bg-surface-highlight`, `text-text`, `text-text-muted` | Row read/unread state and copy |
| NotificationPage.jsx | `bg-bg-surface`, `bg-bg-surface-muted`, `text-text-link` | Tabs and mark-all action |
| NotificationPreferencesForm.jsx | `text-text-strong`, `text-text-subtle`, `bg-border-subtle` | Preference panel text and section dividers |
| notificationBadge.js | `bg-bg-badge-*` | Fixed action-type avatar badge emblems |

### comments

| File | Color class / token | Element |
|------|---------------------|---------|
| CommentsSection.jsx | `bg-bg-page` | Expanded comments overlay backdrop, matching the page background in both themes |
| CommentsPanel.jsx | `bg-bg-surface`, `text-text-strong`, `text-text-muted`, `border-border` | Comments panel, sticky header, tabs, and dividers |
| CommentForm.jsx | `bg-bg-surface`, `bg-bg-control`, `bg-bg-primary`, `bg-bg-secondary`, `text-text-strong`, `text-text-muted`, `text-text-on-primary` | Comment card, inactive/active timestamp controls, input text, and submit CTA |
| CommentItem.jsx | `text-text`, `text-text-muted`, `bg-bg-surface-raised`, `bg-bg-surface-muted` | Comment body, metadata, and moderator menu |

### shared (component library)

| File | Color class / token | Element |
|------|---------------------|---------|
| Button.jsx | `bg-cinemata-strait-blue-600p`, `hover:bg-cinemata-strait-blue-800` | Primary button |
| Button.jsx | `bg-cinemata-sunset-horizon-500`, `hover:bg-cinemata-sunset-horizon-700` | Secondary button |
| Button.jsx | `bg-cinemata-pacific-deep-600p`, `dark:bg-cinemata-pacific-deep-950` | Special button |
| Button.jsx | `text-cinemata-white` | All variants text |
| Badge.jsx | `text-cinemata-neutral-50` | Badge text |
| Badge.jsx | `backgroundColor: resolveBadgeColor(color)` | Dynamic badge bg (JS) |
| Text.jsx | `text-cinemata-pacific-deep-700 dark:text-cinemata-pacific-deep-50` | Body text preset |
| Text.jsx | `text-cinemata-pacific-deep-400 dark:text-cinemata-pacific-deep-300` | Meta text preset |
| Text.jsx | `text-cinemata-sunset-horizon-400p dark:text-cinemata-sunset-horizon-200` | Accent/link preset |
| Text.jsx | `focus-visible:ring-cinemata-sunset-horizon-400p` | Text-button/link focus |
| Card.jsx | `bg-bg-cards dark:bg-cinemata-pacific-deep-900` | Default card |
| Card.jsx | `bg-cinemata-neutral-200 dark:bg-cinemata-pacific-deep-800` | Muted card |
| Card.jsx | `border-cinemata-pacific-deep-100 dark:border-cinemata-pacific-deep-700` | Outlined card |
| CheckboxButton.jsx | `bg-cinemata-neutral-300 dark:bg-cinemata-pacific-deep-900` | Checkbox bg |
| CheckboxButton.jsx | `peer-checked:bg-cinemata-sunset-horizon-400p` | Checked state |
| CheckboxButton.jsx | `peer-focus-visible:ring-cinemata-sunset-horizon-400p` | Focus ring |
| CheckboxButton.jsx | `text-cinemata-white dark:text-cinemata-pacific-deep-900` | Check icon |
| CheckboxButton.jsx | `text-cinemata-neutral-900 dark:text-cinemata-strait-blue-50` | Label |
| TextField.jsx | `bg-cinemata-neutral-50 dark:bg-cinemata-pacific-deep-900` | Input shell bg |
| TextField.jsx | `text-cinemata-pacific-deep-900 dark:text-cinemata-strait-blue-50` | Input text |
| TextField.jsx | `placeholder:text-cinemata-pacific-deep-400 dark:placeholder:text-cinemata-pacific-deep-300` | Placeholder |
| TextField.jsx | `border-cinemata-coral-reef-400p dark:border-cinemata-sunset-horizon-400p` | Active border |
| TextField.jsx | `border-cinemata-pacific-deep-500` | Default border |
| TextField.jsx | `border-cinemata-red-500`, `text-cinemata-red-500` | Error border / text |
| TextField.jsx | `text-cinemata-sunset-horizon-400p` | Helper text |
| TextField.jsx | `transparent` prop → shell `bg-transparent` (no surface fill) | Transparent variant: field inherits the surface behind it (e.g. a gradient panel) instead of painting its own `bg-surface` |
| Switch.jsx | `text-cinemata-neutral-700 dark:text-cinemata-neutral-500` | Switch label |
| Switch.jsx | `bg-bg-control-track-on` (light: `coral-reef-600`, dark: `coral-reef-700`) / `bg-bg-control-track-off` (light: `pacific-deep-900`, dark: `pacific-deep-800`) | Track |
| Switch.jsx | `bg-bg-control-thumb` (`neutral-100`) | Thumb |

### user-settings

| File | Color class / token | Element |
|------|---------------------|---------|
| NotificationPreferencesForm.jsx | `backgroundColor: 'var(--btn-primary-bg-color)'` (inline) | Button (legacy var) |

### account / mfa (auth pages — Django templates + Tailwind)

The redesigned authentication pages (`templates/account/`, `templates/mfa/`) render inside the **legacy Django shell**, not in `features/`, but they consume the modern Tailwind v4 token layer. Because they sit in the legacy unlayered cascade, a small block of **unlayered** overrides in `tailwind.css` (scoped to `.auth-figma-page` and `.auth-message-stack`) is needed to outrank legacy unlayered button/form rules.

**Modern semantic tokens are used directly wherever an existing token already carries the needed value** (no feature alias is created for these):

- `bg-bg-page` — page background; `bg-bg-surface` — gradient panel start stop; fields are **transparent** (no fill) so the panel shows through, separated only by the underline border.
- `text-text-strong` — titles, labels, input text; `text-text-muted`/`text-text-danger` — help and error copy.
- `border-border-danger`, `bg-bg-danger` — non-field error callouts.
- `ring-ring-focus` — every focusable control; `text-text-link` / `text-text-link-hover` — inline links.
- `var(--bg-primary)` / `var(--bg-primary-hover)` — primary button background and the header status icon color (value-identical to the brand primary, so no alias).

**Component styling uses purpose-based semantic tokens, not feature-scoped `--auth-*` aliases**, so auth controls stay uniform with the rest of the modern component library. Buttons, the checkbox, field border, requirements panel and status badges map to existing semantic tokens (where the dark value already matched, the light value follows the semantic token since Figma only specs dark mode):

| Auth use | Now uses | Notes |
|----------|----------|-------|
| Accent / CTA submit button (`.auth-button-accent`) | `bg-secondary` / `bg-secondary-hover` | the brand CTA used app-wide |
| Primary & secondary buttons (`.auth-button-primary` / `.auth-button-secondary`) | `bg-primary` / `bg-primary-hover` | both were already the same strait-blue |
| Button label text | `text-on-primary` | |
| Checkbox checked fill / accent | `bg-secondary` | matches the shared `CheckboxButton` |
| Underline field border | `border` | |
| Password-requirements panel bg / text | `bg-surface-muted` / `text-subtle` | |
| Success / error status icon badge | `bg-success-subtle` / `bg-danger-subtle` (new) + `text-success` / `text-danger` | |

Two **new purpose tokens** were added to the global layer for soft feedback tints (reusable, not auth-scoped):

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `bg-bg-success-subtle` | `green-100` | `green-950` | Soft success badge / surface tint |
| `bg-bg-danger-subtle` | `red-100` | `red-950` | Soft danger badge / surface tint |

Only one genuinely auth-specific **decorative** token remains on `.auth-figma-page` (the panel gradient end stop now uses `bg-page` directly: `bg-surface` → `bg-page`):

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `--auth-ring-color` | `pacific-deep-200` | `pacific-deep-500` | Decorative concentric ring outlines. Light coincides with `border`, but no existing token has the dark `pacific-deep-500` (lighter than `border`'s `pacific-deep-700`) needed to keep the faint rings visible on the dark panel |

The full-screen flash/message overlay defines a parallel feature set on `.auth-message-stack` (and its dark override): a scrim (`--auth-message-overlay`), banner gradient (`--auth-message-panel-from/-to`), `color-mix`-based ring/shadow, and success / error / info icon-badge pairs. These are genuine one-offs with no existing-token equivalent; see `tailwind.css` for the authoritative values.

> Tokens that resolve to an existing token in **both** themes (`--auth-page-bg` → `bg-page`, `--auth-field-bg` → `bg-surface`, `--auth-panel-from` → `bg-surface`, `--auth-text-strong` → `text-strong`, `--auth-icon-color` → `bg-primary`, `--auth-button-primary-bg/-hover` → `bg-primary/-hover`, `--auth-text-muted` → `text-muted`, `--auth-panel-to` → `bg-page`) were removed in favour of the existing token, per the no-duplicate-alias rule. `--auth-text-muted` once differed in light (`pacific-deep-500` vs `text-muted`'s `pacific-deep-400`), but `text-muted` was later moved to `pacific-deep-500`, so the two now coincide and the feature alias was dropped.
>
> `*.stories.jsx` and `*.test.jsx` files contain color fixtures but are not part of the production styling path; they are excluded here.

### profile — My Notes (features/profile)

The profile **My Notes** tab renders each film-note card with a film thumbnail (with a **film duration pill** at the bottom-right) and the latest note timestamp beside a standalone vertical divider (per `jeremy-tasks/design/notes-in-profile/notes-in-profile.svg`). The pill is a light chip in both themes, so it has its own roles, `bg/label` and `text/on-label`. The divider uses the shared `border/strong` role:

| Token | Light | Dark | Role |
|-------|-------|------|------|
| `bg-bg-label` | `strait-blue-50` | `strait-blue-50` | Film duration pill background on the note thumbnail (theme-invariant light chip) |
| `text-text-on-label` | `pacific-deep-900` | `pacific-deep-900` | Film duration text on the pill |
| `border-border-strong` | `pacific-deep-500` | `pacific-deep-400` | Standalone vertical divider in profile note entries |

The note thumbnail's empty/loading fill reuses the theme-aware `bg-bg-skeleton` (consistent with `FilmRow` / `ImpactFilmRow`).

---

# 4. Consistency observations & remaining work

## Migrated (no further action)

- **All `dark:bg-cinemata-*` / `dark:text-cinemata-*` pairs with matching semantic mappings** — replaced with `bg/*`, `text/*`, `border/*` tokens.
- **Focus rings** — every interactive control now uses `focus-visible:ring-ring-focus` or `focus-visible:outline-ring-focus`.
- **Always-dark UI chrome** — collapsed onto the `bg/chrome`, `bg/chrome-hover`, `text/on-chrome`, `text/on-chrome-muted`, `border/chrome` family. ~50 raw refs collapsed to 5 tokens.
- **Stories and tests** — story wrappers migrated to `bg-bg-page`; test assertions in `Card.stories.jsx` and `Text.stories.jsx` updated to match the new class names emitted by the migrated components.

## Intentionally raw (will not migrate)

- **Avatar inverted-neutral inner bg** (`bg-cinemata-neutral-200 dark:bg-cinemata-neutral-50`) — INVERTS neutrals between themes for the initials-fallback ring. No clean semantic.
- **Carousel indicator dot pair** (`bg-cinemata-strait-blue-800 dark:bg-white` for active, `bg-cinemata-pacific-deep-400/30 dark:bg-white/30` for inactive) — one-off "active indicator on media surface" pattern.
- **HeroSection retry button** (`strait-blue-700 / strait-blue-800` solid) — bespoke decorative button.
- **Carousel overlay arrow text** (theme-aware blue pair `strait-blue-700 → strait-blue-600p`) — large chrome controls overlaid on media; no other component shares the color treatment.
- **Sidebar navigation legacy bridge** — `NavigationMenuList.jsx` references `var(--sidebar-navigation-item-*-color)` deliberately. This is the documented dual-track bridge.
- **Inline `var()` references** in `NotificationPage.jsx` and `NotificationPreferencesForm.jsx` — `var(--btn-primary-bg-color)` / `var(--body-text-color)` legacy bridges, deliberately preserved so legacy/modern button colors can diverge.

## Strengths after migration

- **Single canonical palette** consumed through a uniform Tailwind v4 mechanism, now with **three named layers** (palette mirror → legacy aliases → modern semantic tokens) and clean preference order.
- **No `dark:` variants in most component code** — theme awareness lives in the token layer.
- **Consistent focus indicator** across the entire modern track (`ring/focus` = sunset-horizon-400p).
- **Chrome family** captures the "always-dark UI surface" concept as first-class tokens, distinct from theme-aware surfaces.
- **`bg-brand-primary` ↔ `bg/secondary` bridge** preserves legacy/modern divergence: the modern utility renders sunset-horizon-400p in light mode and sunset-horizon-500 in dark mode while legacy SCSS button rules can keep their historical blue.
- **Shared component library** (`features/shared/`) centralizes color decisions for Button, Text, Card, TextField, Checkbox, Badge, Switch.

## Source files

| Layer | File |
|-------|------|
| Palette | `frontend/src/static/css/config/_light_theme.scss`, `frontend/src/static/css/config/_dark_theme.scss` |
| Semantic defaults | `frontend/src/static/css/config/index.scss` |
| Tailwind theme | `frontend/src/static/css/tailwind.css` |
| Build wiring | `frontend/vite.config.js` (`@tailwindcss/vite`) |
| Consumption | `frontend/src/features/**/*.jsx` |
