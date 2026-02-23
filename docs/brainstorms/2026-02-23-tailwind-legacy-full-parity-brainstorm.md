# Tailwind Full Parity with Legacy CSS

**Date:** 2026-02-23
**Status:** Brainstorm
**Branch:** feature/frontend-modernization

## What We're Building

Achieve full parity between the Tailwind (modern track) and legacy CSS theming systems so that new features built with Tailwind look identical to existing pages without needing a new design. Tailwind handles positioning, padding, and layout; legacy CSS variables provide all colors, typography, and theming.

### Goals

1. **Zero arbitrary values** — Modern track components should never need `text-[var(--something)]`; every legacy token has a Tailwind class
2. **Automatic theme switching** — Dark mode, light mode, and per-site `_extra.css` overrides flow through without extra work
3. **Unified build pipeline** — Bring `_extra.css` into Vite so there's one build step
4. **Font consistency** — Tailwind classes output the same fonts as legacy (Amulya body, Facultad headings)

### Non-Goals

- Creating a new design system (we're mirroring the existing one)
- Changing the legacy track's behavior or CSS
- Bridging the legacy heading scale (h1–h6 em sizes) — modern track uses standard Tailwind text sizes
- Overriding Tailwind's default breakpoints

## Why This Approach

There is no new design yet, but new features need to ship with the existing look and feel. Rather than writing raw CSS or using arbitrary Tailwind values, we bridge every legacy token into Tailwind's theme so that:

- Developers only write Tailwind classes — no context-switching between CSS variable names and class names
- Theme switching (dark/light) and per-deployment customization via `_extra.css` work automatically
- When a new design system arrives, we replace the token values in one place (the Tailwind bridge) rather than hunting through components

## Key Decisions

### 1. Scope: Full parity with legacy CSS
Bridge ALL ~180 CSS custom properties, plus typography and status colors. The ~160 already-bridged tokens stay as-is; we fill every gap.

### 2. Typography: Bridge fonts, not heading scale
- Map legacy font families into Tailwind: `font-sans` → Amulya, `font-heading` → Facultad
- Do NOT bridge the legacy heading scale (h1=2.13em, etc.) — modern track uses standard Tailwind text-* sizes (text-2xl, text-lg, etc.)
- **Rationale:** Font consistency matters for visual coherence; heading sizes should be flexible for new features and easier to replace when a design system arrives

### 3. Breakpoints: Keep Tailwind defaults
- Use standard Tailwind breakpoints (sm:640, md:768, lg:1024, xl:1280)
- Do NOT override with legacy breakpoints (480, 639, 640, 768, 1024, 1220px)
- **Rationale:** Avoids coupling modern track to legacy layout decisions; follows community convention

### 4. _extra.css: Bring into Vite
- Move `_extra.css` from Django static (`static/css/_extra.css`) into the Vite build pipeline
- Site-specific customizations will require a Vite rebuild (acceptable — deployment already has a build step)
- **Rationale:** One unified build pipeline; enables processing alongside everything else

### 5. Naming convention: Keep current semantic tiers
- Continue the existing pattern: `brand-*`, `surface-*`, `content-*`, `border-*`, plus component-specific prefixes
- New tokens follow the same convention (e.g. `text-content-success`, `bg-brand-theme`)
- No global prefix (like `cm-*`)

## What Needs to Be Bridged (Gap Analysis)

### Currently Missing from Tailwind Bridge

| Category | Legacy Variable(s) | Proposed Tailwind Token |
|----------|-------------------|------------------------|
| Theme color | `--default-theme-color` | `brand-theme` |
| Brand color | `--default-brand-color` | `brand-accent` |
| Links | `--links-color` | `content-link` |
| Status: success | `--success-color` | `content-success` |
| Status: warning | `--warning-color` | `content-warning` |
| Status: danger | `--danger-color` | `content-danger` |
| Font: body | Amulya, Arial, sans-serif | `--font-sans` override |
| Font: heading | Facultad, Arial, sans-serif | `--font-heading` (new) |
| Layout: item width | `--default-item-width` | `--spacing-item-width` |
| Layout: logo height | `--default-logo-height` | `--spacing-logo-height` |

**Note:** `--default-max-row-items` is a count, not a visual token — it stays as a raw CSS var, not a Tailwind theme value.

*Any remaining component-specific vars will be enumerated during planning by diffing the bridge against the theme files.*

### _extra.css Migration

- Move `static/css/_extra.css` → `frontend/src/static/css/_extra.css`
- Import it AFTER the theme defaults (after `config/index.scss`) so overrides win by source order
- Remove the Django `<link>` tag from `templates/common/head-links.html`
- **Cascade risk:** `_extra.css` uses `!important` on CSS custom property overrides. Since Vite bundles CSS into a single file, source order determines precedence. Import order must be: normalize → theme defaults → _extra.css → Tailwind layers
- **Assumption:** All Django-rendered pages go through the Vite pipeline. If any pages load CSS without Vite (e.g. admin, error pages), they would lose `_extra.css` overrides — verify during planning

## Open Questions

1. **Are there Django pages that load CSS without Vite?** (e.g. admin, 500 error pages) — if so, those would lose `_extra.css` overrides after migration. Need to verify during planning.
