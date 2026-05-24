# Modern Semantic Color Tokens

This document describes the **role-based semantic color tokens** used in the modern track (`frontend/src/features/`). These tokens sit on top of the [raw `--cinemata-*` palette](./modern-track-color-system.md) and are designed to be consumed directly by Tailwind utilities, with light/dark theme switching handled automatically by a single CSS variable override.

## Why semantic tokens

The modern track originally consumed raw palette tokens with `dark:` variants on every utility:

```jsx
<div className="bg-cinemata-pacific-deep-50 dark:bg-cinemata-pacific-deep-950
                text-cinemata-pacific-deep-700 dark:text-cinemata-strait-blue-50">
```

Two problems with that pattern:

1. **Every component re-asserts the theme contract.** Changing the page background means editing every file that paints one.
2. **Components encode shade decisions.** The fact that "primary text" is `pacific-deep-700` in light and `strait-blue-50` in dark is a design system decision, not a component concern.

Semantic tokens flip this: components ask for *roles* (`bg-bg-page`, `text-text-primary`), and the role-to-shade mapping lives in one place.

```jsx
<div className="bg-bg-page text-text-primary">
```

The same JSX renders correctly in both themes because `--color-bg-page` and `--color-text-primary` resolve to different palette values under `.dark`.

## How it works

Defined in `frontend/src/static/css/tailwind.css` in three blocks:

1. **`body { ... }`** — declares intermediate vars `--bg-*`, `--text-*`, `--border-*`, `--ring-*` with their light-mode values. Crucial that this is on `body`, not `:root`: the raw `--cinemata-*` palette is defined on `body` in SCSS, and CSS resolves `var()` chains at the variable's *definition* scope. If we wrote `:root { --bg-page: var(--cinemata-pacific-deep-50); }`, the inner var would be invalid (palette isn't on `:root`) and propagate "invalid" to every descendant.
2. **`body.dark_theme { ... }`** — overrides only the tokens whose value differs in dark mode. `body.dark_theme` is toggled by `ThemeStore.js` alongside `<html class="dark">`. Tokens whose value is theme-agnostic (e.g. `bg/danger`) appear only in the `body` block.
3. **`@theme inline { --color-X: var(--X); ... }`** — exposes the intermediate vars as Tailwind theme tokens so utilities are generated. `inline` is required: it makes Tailwind emit `.bg-bg-page { background-color: var(--bg-page); }` so resolution happens at the using element (always a body descendant), where the cascade chain actually works.

## Naming convention

Slash-prefixed namespaces become double-prefix Tailwind utilities:

| CSS variable | Tailwind utility |
|---|---|
| `--color-bg-page` | `bg-bg-page` |
| `--color-text-primary` | `text-text-primary` |
| `--color-border-default` | `border-border-default` |
| `--color-ring-focus` | `ring-ring-focus` |

The double prefix is a Tailwind v4 side-effect: any `--color-X` generates `bg-X`, `text-X`, `border-X`, `ring-X`, `outline-X`, `fill-X`. The slash-prefixed name keeps semantic categories visually grouped in the source.

## Token reference

### `bg/*` — background colors

| Token | Light | Dark | Use for |
|---|---|---|---|
| `bg/page` | `pacific-deep-50` | `pacific-deep-950` | Page body background |
| `bg/surface` | `neutral-50` | `pacific-deep-900` | Default card/panel background |
| `bg/surface-raised` | `white` | `pacific-deep-800` | Popups, modals, dropdowns — surfaces that float above the page |
| `bg/surface-muted` | `neutral-200` | `pacific-deep-800` | Muted/recessed regions, sunken cards |
| `bg/surface-inverse` | `pacific-deep-900` | `white` | High-contrast inverted callouts. Inverts per theme. |
| `bg/overlay-dark` | `pacific-deep-900` | `pacific-deep-900` | Theme-agnostic dark UI chrome (Topbar root, mobile overlays, modal scrims). Does not invert. |
| `bg/chrome` | `pacific-deep-800` | `pacific-deep-800` | Always-dark inner chrome surfaces — topbar buttons, search input bg, dropdown row bgs. One step lighter than `bg/overlay-dark`. |
| `bg/chrome-hover` | `pacific-deep-700` | `pacific-deep-700` | Hover state for `bg/chrome` controls. Often used with /60 alpha for row-hover patterns. |
| `bg/skeleton` | `pacific-deep-100` | `pacific-deep-700` | Loading skeleton placeholders |
| `bg/control` | `neutral-300` | `pacific-deep-900` | Checkbox, radio, and other small control surface backgrounds |
| `bg/primary` | `strait-blue-600p` | `strait-blue-500` | Primary action surfaces (primary Button, selected tab, active nav item) |
| `bg/primary-hover` | `strait-blue-800` | `strait-blue-700` | Hover state for `bg/primary` |
| `bg/secondary` | `sunset-horizon-400p` | `sunset-horizon-500` | Secondary action surfaces (secondary Button, CTA, brand-primary). Matches legacy `--btn-primary-bg-color`. |
| `bg/secondary-hover` | `sunset-horizon-500` | `sunset-horizon-700` | Hover state for `bg/secondary`. Matches legacy `--btn-primary-bg-hover-color`. |
| `bg/danger` | `red-500` | `red-500` | Destructive action surfaces |
| `bg/success` | `green-500` | `green-500` | Success states, confirmations |
| `bg/warning` | `amber-500` | `amber-500` | Warning states |

### `text/*` — foreground colors

| Token | Light | Dark | Use for |
|---|---|---|---|
| `text/strong` | `pacific-deep-900` | `strait-blue-50` | Headings, emphasized labels, form input text — darker than `text/primary` |
| `text/primary` | `pacific-deep-700` | `strait-blue-50` | Body text, main content |
| `text/secondary` | `strait-blue-700` | `strait-blue-100` | Subheadings, secondary text |
| `text/muted` | `pacific-deep-400` | `pacific-deep-300` | Captions, view counts, metadata |
| `text/subtle` | `neutral-500` | `neutral-400` | Auxiliary text, hints, placeholders |
| `text/disabled` | `pacific-deep-400` | `pacific-deep-400` | Disabled state labels (constant muted, does not invert) |
| `text/inverse` | `white` | `pacific-deep-900` | Text on `bg/surface-inverse` (inverts with the surface) |
| `text/on-primary` | `white` | `white` | Text on `bg/primary` and `bg/secondary` (does not invert) |
| `text/on-chrome` | `strait-blue-50` | `strait-blue-50` | Primary text on always-dark chrome surfaces (`bg/chrome`, `bg/overlay-dark`). Constant. |
| `text/on-chrome-muted` | `pacific-deep-300` | `pacific-deep-300` | Muted/secondary text on chrome (placeholders, hints, captions inside dropdowns/search). Constant. |
| `text/link` | `sunset-horizon-400p` | `sunset-horizon-200` | Inline links, "View all" affordances |
| `text/link-hover` | `sunset-horizon-600` | `sunset-horizon-100` | Hover state for `text/link` |
| `text/accent` | `sunset-horizon-400p` | `sunset-horizon-400p` | Theme-agnostic orange accent (helper text, brand emphasis). Does not invert. |
| `text/danger` | `red-500` | `red-500` | Error messages, destructive labels. Constant. |
| `text/success` | `green-600` | `green-500` | Success messages |
| `text/warning` | `amber-600p` | `amber-500` | Warning messages |

### `border/*` — border and divider colors

| Token | Light | Dark | Use for |
|---|---|---|---|
| `border/default` | `pacific-deep-200` | `pacific-deep-700` | Default card/panel border |
| `border/subtle` | `neutral-200` | `pacific-deep-800` | Hairline dividers, list separators |
| `border/strong` | `pacific-deep-500` | `pacific-deep-400` | Emphasized boundaries |
| `border/strong-constant` | `pacific-deep-500` | `pacific-deep-500` | TextField default border — same shade in both themes |
| `border/chrome` | `pacific-deep-700` | `pacific-deep-700` | Dividers and hairlines on always-dark chrome surfaces (search dropdown section dividers, mobile overlay header border). Constant. |
| `border/input` | `coral-reef-400p` | `sunset-horizon-400p` | TextField focused/active border. Swaps hue per theme intentionally. |
| `border/danger` | `red-500` | `red-500` | Error-state borders |

### `ring/*` — focus ring

| Token | Light | Dark | Use for |
|---|---|---|---|
| `ring/focus` | `sunset-horizon-400p` | `sunset-horizon-400p` | `focus-visible:ring-*` on interactive elements. Same hue in both themes. |

## Usage examples

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
<div className="bg-bg-surface border border-border-default">
  <h2 className="text-text-primary">Title</h2>
  <p className="text-text-muted">Caption</p>
  <a className="text-text-link hover:text-text-link-hover">Read more</a>
</div>
```

The component contains no shade decisions, no `dark:` variants, and no palette references. Theme switching is a CSS cascade concern.

### Buttons

```jsx
<button className="bg-bg-primary hover:bg-bg-primary-hover text-text-on-primary
                   focus-visible:ring-2 focus-visible:ring-ring-focus">
  Primary action
</button>

<button className="bg-bg-secondary hover:bg-bg-secondary-hover text-text-on-primary">
  Secondary action
</button>
```

### Inputs

```jsx
<input
  className="bg-bg-surface text-text-primary placeholder:text-text-subtle
             border border-border-strong focus:border-border-input
             focus-visible:ring-2 focus-visible:ring-ring-focus"
/>
```

## When to use semantic tokens vs raw palette

**Use semantic tokens** for anything that should respond to the theme — i.e. the default case. Most production UI falls here.

**Use raw `--cinemata-*` palette** only when:
- A color is intentionally theme-independent (e.g. a brand badge that must stay the same orange in both themes).
- You need a one-off shade that no semantic role covers, AND the case is unique enough that promoting it to a token would not be reused.

If you find yourself reaching for a raw palette token more than once for the same role, add a semantic token for it instead.

## Relationship to the existing color systems

The modern track now has three layers, in increasing order of specificity:

| Layer | Source of truth | Used by | Theme-aware |
|---|---|---|---|
| 1. Raw palette | `_light_theme.scss` / `_dark_theme.scss` (identical) | Available everywhere; rarely consumed directly | No |
| 2. Legacy semantic vars | `_light_theme.scss` / `_dark_theme.scss` (differ per theme) | Legacy SCSS, legacy components, and the `--color-surface-*`/`--color-content-*`/etc. Tailwind aliases in `tailwind.css` (`@theme inline`) | Yes — via `body.dark_theme` |
| 3. **Modern semantic tokens** | `tailwind.css` `body` + `body.dark_theme` (intermediate vars) + `@theme inline` (Tailwind exposure) | `features/` components | Yes — via `body.dark_theme` |

The legacy `--color-surface-body`, `--color-content-body`, etc. aliases still exist for legacy code and remain valid. New `features/` work should prefer the modern semantic tokens for clarity and to avoid carrying the MediaCMS vocabulary forward.

### `bg-brand-primary` alignment

The legacy `bg-brand-primary` Tailwind utility is redirected to wire through the new `--bg-secondary` (sunset-horizon / orange) — NOT `--bg-primary` (strait-blue / blue). The brand's primary action color in this codebase is historically orange; in the new semantic scheme that color lives under `bg/secondary` (since `bg/primary` was assigned to strait-blue). Wiring brand-primary through bg-secondary keeps the orange UPLOAD MEDIA / CTA buttons stable while moving the legacy token onto the new pipeline. Legacy SCSS that uses `var(--btn-primary-bg-color)` directly is unaffected and still resolves to the original orange value. The `bg-brand-primary-icon` token remains tied to the legacy `--btn-primary-icon-color` since icon-on-button color is unchanged.

## Source files

| Concern | File |
|---|---|
| Token definitions + dark overrides | `frontend/src/static/css/tailwind.css` |
| Raw palette | `frontend/src/static/css/config/_light_theme.scss`, `_dark_theme.scss` |
| Legacy semantic vars | `frontend/src/static/css/config/_light_theme.scss`, `_dark_theme.scss` |
| Theme class wiring | `frontend/src/static/js/stores/ThemeStore.js` (sets `.dark` on `<html>` and `.dark_theme` on `<body>`) |
| Related audits | [`legacy-color-audit.md`](./legacy-color-audit.md), [`modern-track-color-system.md`](./modern-track-color-system.md), [`hardcoded-color-audit.md`](./hardcoded-color-audit.md) |
