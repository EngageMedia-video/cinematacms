# Frontend Post-Migration Metrics (Vite)

**Date**: 2026-02-24
**Branch**: `feature/frontend-modernization` at PR #438
**React**: 19.2.4
**Build system**: Vite 7.3.1
**Tailwind CSS**: 4.2.1

---

## Build Time

| Run | Wall clock |
|-----|-----------|
| 1   | 2.52s     |
| 2   | 2.67s     |

**Comparison**: ~14s (Webpack) → ~2.6s (Vite) = **5.4x faster**

## Output File Counts

| Type | Webpack | Vite (initial) | Vite (current) | Notes |
|------|---------|----------------|----------------|-------|
| JS files | 27 | 50 | 49 | Code splitting |
| CSS files | 14 (incl. `_extra.css`) | 20 | 19 | `_extra.css` now inside Vite build |

Vite's Rollup-based code splitting produces more granular chunks. This increases HTTP request count per page (4-8 JS files vs 2 under Webpack) but is mitigated by HTTP/2 multiplexing and `<link rel="modulepreload">`.

## Total Bundle Sizes

| Metric | Webpack | Vite (current) | Change |
|--------|---------|----------------|--------|
| JS raw | 1,462,812 B (1,428.5 kB) | 799,649 B (780.9 kB) | **-45.3%** |
| CSS raw | 551,532 B (538.6 kB)¹ | 678,756 B (662.8 kB)² | +23.1% |

¹ Webpack CSS totals included `_extra.css` (70,189 B raw).
² Vite CSS now includes `_extra.css` inside the build pipeline plus Tailwind CSS utilities for the modern demo page (~16 kB).

**JS size drop explained**: video.js was marked as external (eliminating ~615 kB of double-loaded code). The `MediaDurationInfo` shared chunk dropped from 700 kB to 68 kB.

**CSS size increase explained**:
- **`_extra.css` migrated into Vite** — previously served as a separate `{% static %}` file, now imported by `styles.scss` and merged into the chunk graph. This adds ~70 kB to the Vite total but eliminates a separate HTTP request.
- **Tailwind CSS utilities** — the modern demo page's `tailwind.css` generates on-demand utility classes (~16 kB CSS chunk).
- **postcss-custom-properties removed** — Webpack's `preserve: false` replaced `var(--x)` with static values. Vite preserves native CSS custom properties (necessary for runtime theme switching).

## Per-Entry JS Bundle Sizes

| Entry/Chunk | Raw (kB) | Gzip (kB) |
|-------------|----------|-----------|
| _helpers (shared) | 289.01 | 92.22 |
| media | 78.76 | 19.86 |
| MediaDurationInfo (shared) | 68.11 | 16.38 |
| playlist | 46.31 | 15.63 |
| modern-demo | 44.52 | 10.05 |
| modern-track-vendor (Zustand, TanStack Query) | 42.17 | 13.21 |
| ItemList (shared) | 38.71 | 11.30 |
| index (React entry) | 32.05 | 9.01 |
| ManageItemList (shared) | 27.91 | 6.20 |
| actions (shared) | 16.69 | 3.96 |
| index (layout) | 14.87 | 4.32 |
| members | 13.43 | 3.59 |
| search | 12.01 | 3.22 |
| index (home) | 11.89 | 3.84 |
| PlaylistCreationForm (shared) | 7.39 | 2.55 |
| manage-media | 6.06 | 1.90 |
| profile-about | 5.61 | 1.91 |
| manage-users | 4.04 | 1.55 |
| ItemListAsync (shared) | 3.52 | 1.54 |
| ItemsInlineSlider (shared) | 2.97 | 0.61 |
| history | 2.71 | 1.05 |
| liked | 2.70 | 1.06 |
| manage-comments | 2.44 | 0.98 |
| _Page (shared) | 1.98 | 0.85 |
| error | 1.79 | 0.75 |
| 24 smaller chunks (< 1.7 kB each) | 21.93 | 11.41 |

## Per-Entry CSS Bundle Sizes

| Entry/Chunk | Raw (kB) | Gzip (kB) |
|-------------|----------|-----------|
| _helpers (shared) | 260.28 | 48.75 |
| MediaDurationInfo (shared) | 125.75 | 28.89 |
| media | 80.44 | 14.35 |
| ItemList (shared) | 42.00 | 6.46 |
| ManageItemList (shared) | 41.74 | 5.63 |
| MediaListWrapper (shared) | 32.56 | 4.42 |
| FiltersToggleButton (shared) | 28.27 | 4.07 |
| playlist | 17.11 | 2.54 |
| modern-demo (Tailwind utilities) | 16.24 | 3.41 |
| index (layout) | 14.89 | 2.53 |
| add-media | 9.36 | 2.08 |
| error | 3.19 | 0.75 |
| PlaylistCreationForm (shared) | 3.14 | 0.76 |
| Notifications (shared) | 1.26 | 0.50 |
| PendingItemsList (shared) | 0.88 | 0.38 |
| _Page (shared) | 0.82 | 0.36 |
| members | 0.64 | 0.26 |
| embed | 0.14 | 0.12 |
| index (home) | 0.05 | 0.07 |

## npm audit

20 vulnerabilities (1 low, 1 moderate, 18 high)

**Comparison**: 24 (Webpack) → 20 (Vite) = **4 fewer vulnerabilities**

Removed vulnerabilities were from `grunt`/`load-grunt-tasks`/`multimatch` chain (Webpack build deps). Remaining vulnerabilities are in `@mediacms/media-player` transitive dependencies (media-player retains its own Webpack build internally).

All vulnerabilities remain in dev/build dependencies, not shipped to production.

## npm Package Count

~1,745 packages in dependency tree (up from ~1,551 initial Vite migration due to Tailwind CSS, TanStack Query, Zustand, and ESLint additions; still down from ~1,926 Webpack baseline)

## Configuration Complexity

| Metric | Webpack | Vite |
|--------|---------|------|
| Config LOC | ~760 | ~80 |
| Config files | 20+ | 1 (`vite.config.js`) |
| Custom CLI | Yes (`cli.js`) | No |
| Custom plugins | 3 (virtual modules, manifest, EJS) | 1 (JSX-in-.js) |

## Developer Experience

| Metric | Webpack | Vite |
|--------|---------|------|
| Dev server cold start | 15-30s | <500ms |
| HMR latency | 2-5s | <100ms (native ESM) |
| Dev browsing | Two servers (8088 + 8000) | Single server (8000) |
| Dev server protocol | Bundled JS | Native ES modules |

## `_extra.css` Migration

`_extra.css` is now part of the Vite build pipeline:
- **Before**: Served via `{% static 'css/_extra.css' %}` with query-string cache busting (`?v={{ EXTRA_CSS_VERSION }}`)
- **After**: Located at `frontend/src/static/css/_extra.css`, imported by `styles.scss` after `config/index.scss`
- **Benefit**: Content-hashed filename for automatic cache busting, no separate HTTP request, CSS custom property overrides flow through the theme system correctly
- **Dead code removed**: `EXTRA_CSS_VERSION` context processor and setting

## Modern Track Additions

The following are new outputs from the modern track (Milestone 3+), not present in the initial Vite migration:

| Entry/Chunk | JS (kB) | CSS (kB) | Purpose |
|-------------|---------|----------|---------|
| modern-demo | 44.52 | 16.24 | Token reference page (DEBUG only) |
| modern-track-vendor | 42.17 | — | Zustand, TanStack Query, React Query |

These are only loaded on modern-track pages and do not affect legacy page bundle sizes. Tailwind CSS v4 generates utilities on-demand, so only classes actually used in components appear in the output CSS.

## Notes

- Sub-packages (`media-player`, `vjs-plugin`, `vjs-plugin-font-icons`) retain their own build tools. Only the main frontend app was migrated.
- The `_helpers` shared chunk (289 kB JS / 260 kB CSS) is the largest chunk. It contains shared React components and the full SCSS stylesheet. This is a candidate for future optimization (component-level code splitting).
- video.js is loaded from CDN with SRI hash, not bundled by Vite (marked as external).
