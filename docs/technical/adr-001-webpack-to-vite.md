# ADR-001: Migrate from Webpack 5 to Vite

**Date**: 2026-02-21
**Status**: Accepted
**Deciders**: Engineering team

## Context

CinemataCMS used Webpack 5 with a custom build system (~760 LOC of configuration across `frontend/config/`, `frontend/scripts/`, `frontend/cli.js`). The system included:

- Custom CLI (`cli.js`) wrapping Webpack
- EJS template rendering for standalone HTML pages
- Virtual modules for injecting page configurations
- PostCSS with `postcss-custom-properties` (IE 11 fallback)
- Custom manifest plugin + Django template tag for cache busting
- Custom Django storage backend (`WebpackHashedFilesStorage`)

Pain points:

- **Build time**: ~14s production builds
- **Dev server startup**: 15-30s cold start
- **HMR latency**: 2-5s for CSS/JS changes
- **Configuration complexity**: 760+ LOC across 20+ config files
- **Separate dev servers**: Webpack dev server (port 8088) for React pages, Django (port 8000) for template pages — confusing developer experience

## Decision

Migrate to **Vite** with **django-vite** for Django integration. The migration was executed in 3 incremental PRs:

1. **PR 2A**: Add Vite alongside Webpack (parallel build, low risk)
2. **PR 2B**: Switch Django templates from Webpack to Vite tags
3. **PR 2C**: Remove Webpack entirely (point of no return)

Key choices:

- **`StaticFilesStorage`** instead of `ManifestStaticFilesStorage` — avoids double-hashing Vite's already-hashed output and breaking font URL rewriting
- **Remove `postcss-custom-properties`** entirely — IE 11 fallback unnecessary; all modern browsers support CSS custom properties natively
- **`VITE_DEV_MODE` env var** instead of tying to `DEBUG` — prevents accidental Vite dev mode in production
- **One entry point per page** — matches existing Webpack page structure, each Django template loads exactly one Vite entry

## Consequences

### Positive

- **Build time**: ~2.6s (down from ~14s, 5.4x faster)
- **Dev server cold start**: <500ms (down from 15-30s)
- **HMR**: Instant CSS/JS updates via native ES modules
- **Configuration**: ~80 LOC (`vite.config.js`) down from ~760 LOC
- **Unified dev experience**: All pages served by Django on port 8000, Vite only handles HMR
- **Fewer dependencies**: 375 npm packages removed
- **Smaller CSS output**: postcss-custom-properties removal avoids static fallback inflation
- **Vulnerability reduction**: 20 vulnerabilities (down from 24 baseline)

### Negative

- **Code splitting produces more HTTP requests** (4-8 JS files per page vs 2 under Webpack). Mitigated by HTTP/2 and `<link rel="modulepreload">`.
- **IE 11 dropped** — Vite's esbuild does not support IE 11. Documented as intentional.
- **`file:` package references** (`@mediacms/media-player`) require careful handling — Vite resolves these differently than Webpack.
- **Rollback from PR 2C requires restoring from backup branch** — point of no return.

### Neutral

- Sub-packages (`media-player`, `vjs-plugin`) retain their own build tools (Webpack internally). Only the main frontend app uses Vite.
- `_extra.css` continues to be served as a non-hashed static file via `{% static %}`.

## Alternatives Considered

1. **Keep Webpack, upgrade config** — Rejected. Doesn't solve fundamental dev experience issues (cold start, HMR latency).
2. **Turbopack** — Too early/unstable for production use at time of decision.
3. **esbuild directly** — Lacks dev server, HMR, and CSS handling that Vite provides.
4. **Rspack** — Webpack-compatible but doesn't solve configuration complexity since we'd keep the same config structure.

## References

- [Baseline Metrics](frontend-modernization/baseline-metrics.md)
- [Post-Migration Metrics](frontend-modernization/post-migration-metrics.md)
