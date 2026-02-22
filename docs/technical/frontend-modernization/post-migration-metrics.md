# Frontend Post-Migration Metrics (Vite)

**Date**: 2026-02-21
**Branch**: `feat/vite-migration` at PR #432
**React**: 19.0.0
**Build system**: Vite 7.3.1

---

## Build Time

| Run | Wall clock |
|-----|-----------|
| 1   | 2.57s     |
| 2   | 2.76s     |

**Comparison**: ~14s (Webpack) → ~2.6s (Vite) = **5.4x faster**

## Output File Counts

| Type | Webpack | Vite | Change |
|------|---------|------|--------|
| JS files | 27 | 50 | +23 (code splitting) |
| CSS files | 14 (incl. `_extra.css`) | 20 | +6 (code splitting) |

Vite's Rollup-based code splitting produces more granular chunks. This increases HTTP request count per page (4-8 JS files vs 2 under Webpack) but is mitigated by HTTP/2 multiplexing and `<link rel="modulepreload">`.

## Total Bundle Sizes

| Metric | Webpack | Vite | Change |
|--------|---------|------|--------|
| JS raw | 1,462,812 B (1,428.5 kB) | 1,392,435 B (1,359.8 kB) | -4.8% |
| JS gzip | ~429,678 B (419.6 kB) | 413,818 B (404.1 kB) | -3.7% |
| CSS raw | 551,532 B (538.6 kB)¹ | 535,357 B (522.8 kB) | -2.9% |
| CSS gzip | ~87,945 B (85.9 kB)¹ | 94,259 B (92.0 kB) | +7.2% |

¹ Webpack CSS totals included `_extra.css` (70,189 B raw / 9,660 B gzip) which is not part of the Vite build. Excluding `_extra.css`, the apples-to-apples comparison is:

| Metric | Webpack (excl. _extra) | Vite | Change |
|--------|----------------------|------|--------|
| CSS raw | 481,343 B (470.1 kB) | 535,357 B (522.8 kB) | +11.2% |
| CSS gzip | ~78,285 B (76.4 kB) | 94,259 B (92.0 kB) | +20.4% |

The CSS size increase is expected:
- **postcss-custom-properties removed**: Webpack's `preserve: false` replaced `var(--x)` with static values and removed the `var()` calls. Vite preserves native CSS custom properties (which are necessary for runtime theme switching).
- **Code splitting overhead**: More CSS files = more per-chunk boilerplate.
- **Different minifier**: Vite uses esbuild for CSS minification vs Webpack's cssnano. The functional CSS is identical.

## Per-Entry JS Bundle Sizes

| Entry/Chunk | Raw (kB) | Gzip (kB) |
|-------------|----------|-----------|
| MediaDurationInfo (shared) | 700.30 | 199.45 |
| _helpers (shared) | 234.43 | 71.93 |
| vendor (React, axios, flux) | 101.00 | 36.34 |
| ViewerInfoVideo (shared) | 67.11 | 17.21 |
| ItemList (shared) | 37.65 | 10.71 |
| index (React entry) | 32.00 | 8.98 |
| ManageItemList (shared) | 27.82 | 6.18 |
| actions (shared) | 16.65 | 3.93 |
| index (layout) | 14.86 | 4.31 |
| members | 13.40 | 3.57 |
| search | 11.97 | 3.20 |
| media | 11.97 | 3.32 |
| index (home) | 11.85 | 3.82 |
| playlist | 9.26 | 2.95 |
| PlaylistCreationForm (shared) | 7.46 | 2.58 |
| demo | 6.97 | 2.65 |
| manage-media | 6.05 | 1.88 |
| profile-about | 5.57 | 1.89 |
| manage-users | 4.03 | 1.53 |
| ItemListAsync (shared) | 3.48 | 1.51 |
| ItemsInlineSlider (shared) | 2.97 | 0.61 |
| history | 2.68 | 1.03 |
| liked | 2.67 | 1.04 |
| manage-comments | 2.42 | 0.96 |
| _Page (shared) | 1.93 | 0.81 |
| error | 1.77 | 0.73 |
| 24 smaller chunks (< 1.6 kB each) | 21.53 | 11.00 |

## Per-Entry CSS Bundle Sizes

| Entry/Chunk | Raw (kB) | Gzip (kB) |
|-------------|----------|-----------|
| MediaDurationInfo (shared) | 132.69 | 29.50 |
| _helpers (shared) | 101.30 | 15.41 |
| media | 60.09 | 11.26 |
| ItemList (shared) | 43.14 | 6.53 |
| ManageItemList (shared) | 41.33 | 5.54 |
| MediaListWrapper (shared) | 34.74 | 4.38 |
| FiltersToggleButton (shared) | 27.53 | 3.94 |
| ViewerInfoVideo (shared) | 23.03 | 3.98 |
| playlist | 17.25 | 2.56 |
| index (layout) | 16.95 | 2.65 |
| add-media | 9.95 | 2.18 |
| error | 4.00 | 0.86 |
| PlaylistCreationForm (shared) | 3.45 | 0.78 |
| demo | 1.85 | 0.61 |
| PendingItemsList (shared) | 1.75 | 0.44 |
| Notifications (shared) | 1.66 | 0.57 |
| _Page (shared) | 1.19 | 0.40 |
| members | 0.72 | 0.27 |
| embed | 0.14 | 0.12 |
| index (home) | 0.05 | 0.07 |

## npm audit

20 vulnerabilities (1 low, 1 moderate, 18 high)

**Comparison**: 24 (Webpack) → 20 (Vite) = **4 fewer vulnerabilities**

Removed vulnerabilities were from `grunt`/`load-grunt-tasks`/`multimatch` chain (Webpack build deps). Remaining vulnerabilities are in `@mediacms/media-player` transitive dependencies (media-player retains its own Webpack build internally).

All vulnerabilities remain in dev/build dependencies, not shipped to production.

## npm Package Count

~1,551 packages in dependency tree (down from ~1,926 baseline, ~375 packages removed)

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

## Notes

- `_extra.css` continues to be served as a non-hashed static file via `{% static %}`, outside the Vite build.
- Sub-packages (`media-player`, `vjs-plugin`, `vjs-plugin-font-icons`) retain their own build tools. Only the main frontend app was migrated.
- The `MediaDurationInfo` chunk (700.30 kB) is flagged by Vite's chunk size warning. It contains the `@mediacms/media-player` bundle including Video.js. This is a candidate for future optimization (lazy loading or dynamic import).
