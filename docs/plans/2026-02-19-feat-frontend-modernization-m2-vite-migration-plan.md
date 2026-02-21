---
title: "M2: Vite Migration"
type: feat
status: completed
date: 2026-02-19
parent: 2026-02-19-feat-frontend-modernization-react19-vite-modern-track-plan.md
milestone: M2
---

# M2: Vite Migration (3 PRs)

**Prerequisites**: M1 (React 19 Upgrade) complete and stable for 24h
**Total Effort**: ~9 hours across 3 PRs

## Overview

Replace the Webpack 5 build system (~760 LOC config) with Vite (~80 LOC config). This is done in 3 incremental PRs to allow rollback at each stage:

1. **PR 2A**: Add Vite alongside Webpack (low risk, parallel build)
2. **PR 2B**: Switch Django templates to use Vite assets (riskiest step)
3. **PR 2C**: Remove Webpack entirely (point of no return)

Source documents:
- [Parent Plan](./2026-02-19-feat-frontend-modernization-react19-vite-modern-track-plan.md)
- [Action Plan](../technical/frontend-modernization/action-plan.md)
- [Whitepaper](../technical/frontend-modernization/frontend-modernization-whitepaper.md)
- [Technical Breakdown](../technical/frontend-modernization/technical-breakdown.md)

### Architecture

```
Django template (HTML shell + mount point)
  → Vite-bundled JS entry (3-line file in src/entries/)
    → renderPage() from _helpers.js
      → createRoot() on mount element
        → React component tree
```

Django-Vite integration:
- **Dev mode**: Django on :8000, Vite dev server on :5173. `{% vite_hmr_client %}` in `<head>` injects HMR WebSocket client. `{% vite_asset %}` points script tags at :5173.
- **Production**: `npm run build` outputs hashed assets + `.vite/manifest.json`. `{% vite_asset %}` reads manifest to resolve hashed filenames. No runtime dependency on Vite.

---

## PR 2A: Add Vite alongside Webpack

**Branch**: `feat/vite-setup`
**Effort**: ~2 hours

1. **Install dependencies**
   - Frontend: `npm install --save-dev vite @vitejs/plugin-react`
   - Backend: `uv add django-vite`

2. **Create `frontend/vite.config.js`** with all 27 entry points in `rollupOptions.input`. Full config in whitepaper Appendix D. Key settings: `base: '/static/'`, `server.origin: 'http://localhost:5173'`, `build.outDir: 'build/production/static'`, `manifest: true`.

   > **CRITICAL (from performance review):** Add explicit `manualChunks` to prevent cache invalidation churn:
   > ```js
   > build: {
   >   rollupOptions: {
   >     output: {
   >       manualChunks: {
   >         vendor: ['react', 'react-dom', 'axios', 'flux', 'events', 'sortablejs', 'timeago.js', 'url-parse'],
   >       },
   >     },
   >   },
   >   sourcemap: false, // Security: don't expose source code in production
   > }
   > ```
   > Without `manualChunks`, Rollup will shift chunk boundaries on unrelated code changes, invalidating caches for returning visitors.

   > **Security (from security review):** Set `build: { sourcemap: false }` to prevent exposing full source code via source maps. Never change `envPrefix` from the default `VITE_`.

3. **Create 27 entry files** in `frontend/src/entries/`. Each is 3 lines importing `renderPage` from `../static/js/_helpers.js` (which already exists at `frontend/src/static/js/_helpers.js:1-33`). Full list in technical breakdown.

   Key entries:
   | Entry | Component | Notes |
   |-------|-----------|-------|
   | `base.js` | *(none)* | `renderPage()` with no args — layout only |
   | `index.js` | `HomeSingleFeaturedPage` | Home page |
   | `media.js` | `MediaPage` | Subdirectory import |
   | `embed.js` | `EmbedPage` | Uses `renderEmbedPage` (no header/sidebar) |
   | ... | ... | 27 total — see technical breakdown |

4. **Configure django-vite** in `cms/settings.py`:
   - Add `django_vite` to `INSTALLED_APPS` **before** `django.contrib.staticfiles`
   - Add `DJANGO_VITE` config block:
     ```python
     DJANGO_VITE = {
         "default": {
             "dev_mode": os.getenv("VITE_DEV_MODE", "False") == "True",  # NOT tied to DEBUG!
             "manifest_path": os.path.join(BASE_DIR, "static_collected", ".vite", "manifest.json"),
             "static_url": STATIC_URL,
         },
     }
     ```

   > **CRITICAL (from security review):** Do NOT use `"dev_mode": DEBUG`. If `DEBUG=True` reaches production (which `dev_settings.py` and `local_settings.py` show has happened), the entire site breaks or is vulnerable to script injection via port 5173. Use a dedicated `VITE_DEV_MODE` environment variable that requires explicit opt-in.

5. **Move PostCSS config** to `frontend/postcss.config.js` (Vite auto-discovers it at the project root, not in a `config/` subdirectory).

6. **Verify local `file:` package refs**: Test that `@mediacms/media-player` (uses `"file:packages/media-player"`) resolves correctly under Vite's dependency resolver. This is higher risk than the plan originally stated — verify video playback works with Vite's build output.

7. **Add HMR guards for singletons**:
   Add `import.meta.hot.decline()` to the following files to prevent confusing partial HMR updates:
   - `frontend/src/static/js/classes_instances/dispatcher.js`
   - `frontend/src/static/js/classes_instances/components-renderer.js`
   - `frontend/src/static/js/pages/_PageStore.js`
   - `frontend/src/static/js/stores/LayoutStore.js`
   - `frontend/src/static/js/stores/ThemeStore.js`

   > **From frontend races review:** Module-level singletons (dispatcher, stores, component renderer) are constructed once at import time. HMR replacement creates new instances while existing components hold references to old ones. `import.meta.hot.decline()` forces a full page reload when these files change, which is honest and avoids ghost state.

8. **Verify**: `npx vite build` produces `.vite/manifest.json` with 27 entries. `npm run build` (Webpack) still works. `manage.py check` passes.

**Done when:** `npx vite build` succeeds with 27 entries. Webpack build still works. `manage.py check` passes. Video player works with Vite's build output.

---

## PR 2B: Switch Django templates to Vite

**Branch**: `feat/vite-templates`
**Effort**: ~4 hours — **riskiest step**

1. **Update `templates/root.html`**: Add `{% load django_vite %}` and `{% vite_hmr_client %}` to `<head>`. Preserve Matomo analytics script (lines 92-106) and Video.js loading (lines 80-84).

   > **From frontend races review:** The inline `<script>` in `config/index.html` (which sets `window.MediaCMS`) must remain a synchronous classic script. It must NOT become a module. ES modules are deferred; the inline config script must execute before any module code. This is preserved by the current template ordering.

2. **Update `templates/common/head-links.html`**: Remove `{% load webpack_manifest %}`, `_commons.css` preload/stylesheet, `_commons.js` preload. **Keep `_extra.css` loaded via `{% static 'css/_extra.css' %}`**.

   > **From deployment verification:** There is a cache-busting gap: `_extra.css` served via `{% static %}` with the current `WebpackHashedFilesStorage` (which does no post-processing) has no hash. This is acceptable if PR 2B and PR 2C deploy close together (same day). If they don't, temporarily add a query-string version: `{% static 'css/_extra.css' %}?v=2b`.

3. **Update `templates/common/body-scripts.html`**: Remove `{% load webpack_manifest %}` and `_commons.js` script tag.

4. **Update all 28 page templates**: Replace `{% load webpack_manifest %}` → `{% load django_vite %}` and `{% hashed_static "js/X.js" %}` → `{% vite_asset 'src/entries/X.js' %}`. Remove explicit CSS `<link>` tags for CSS files imported by JS entries.

   Complete list (30 files):
   | Template | Entry | CSS to remove |
   |----------|-------|---------------|
   | `templates/base.html` | `src/entries/base.js` | — |
   | `templates/404.html` | `src/entries/error.js` | `css/error.css` |
   | `templates/cms/index.html` | `src/entries/index.js` | — |
   | `templates/cms/media.html` | `src/entries/media.js` | `css/media.css` |
   | `templates/cms/embed.html` | `src/entries/embed.js` | `css/embed.css` |
   | ... | ... | See technical breakdown for full list |

5. **Post-migration verification**:
   ```bash
   grep -r "webpack_manifest\|hashed_static" templates/
   ```
   Must return zero results. Spot-check entry filenames against actual files in `src/entries/`.

6. **Verify dev workflow**: Django on :8000, Vite on :5173. All pages load. HMR works (edit a component, change appears without full reload). WebSocket connection visible in Network tab.

7. **Verify production workflow**: `npm run build`, `collectstatic`, `DEBUG=False`. All pages load with hashed filenames. No 404s.

   > **From deployment verification:** Verify non-JS/CSS assets (images, favicons, lib/ with Video.js, Material Icons, fonts) are still present in `static_collected/`:
   > ```bash
   > ls static_collected/lib/video-js/7.20.2/video.min.js
   > ls static_collected/lib/material-icons/material-icons.css
   > ls static_collected/favicons/favicon.ico
   > ```

**Done when:** Every page loads in both dev (HMR) and production (hashed assets). Zero `webpack_manifest` references remain in templates.

**Watch out for:** A typo like `{% vite_asset 'src/entries/idnex.js' %}` produces a Django template error only when that page is visited.

<details>
<summary>PR 2B Deployment Checklist (from deployment verification agent)</summary>

**Pre-deploy:**
- [ ] Every template file converted — `grep -r "webpack_manifest\|hashed_static" templates/` returns zero
- [ ] Every `{% vite_asset %}` path matches an actual entry file in `frontend/src/entries/`
- [ ] `head-links.html`: webpack_manifest removed, _commons removed, _extra.css switched
- [ ] `body-scripts.html`: webpack_manifest removed, _commons.js removed
- [ ] `root.html` has `{% vite_hmr_client %}` in `<head>`
- [ ] Production build produces 27+ manifest entries
- [ ] `collectstatic` succeeds, `.vite/manifest.json` in `static_collected/`
- [ ] All 20 page types tested in local production mode (DEBUG=False, VITE_DEV_MODE=False)
- [ ] Non-Vite assets verified (lib/, images/, favicons/ present)

**Deploy sequence (chain steps 6-8 to minimize gap):**
1. Backup: `cp -a static_collected/ static_collected.bak/`
2. `git pull origin main`
3. `uv sync`
4. `cd frontend && npm install && npm run build`
5. `cd .. && python manage.py collectstatic --noinput && sudo systemctl restart mediacms`
6. Immediate: open home page, check console

**Post-deploy (within 5 minutes):**
- [ ] No TemplateSyntaxError in uWSGI log
- [ ] No 404s for static assets in NGINX log
- [ ] Asset paths show Vite format (`/static/assets/X-hash.js`)
- [ ] `_extra.css` loads (HTTP 200)
- [ ] CSS visually correct (light theme, dark theme toggle)
- [ ] Embed page works
- [ ] Video player works

**Rollback (Webpack still exists):**
1. `git checkout <PR-2A-sha>`
2. `cd frontend && npm run build`
3. `mv static_collected.bak/ static_collected/`
4. `sudo systemctl restart mediacms`
Estimated: 5-10 minutes

**GATE: Do NOT proceed to PR 2C until 24h of stable production.**

</details>

---

## PR 2C: Remove Webpack and document

**Branch**: `chore/remove-webpack`
**Effort**: ~3 hours

> **This is the point of no return.** Rolling back from here requires restoring from the `legacy/webpack-backup` branch — a 15-30 minute operation. Ensure PR 2B has been stable for at least 24 hours.

1. **Delete Webpack build infrastructure**:
   - `frontend/config/templates/` — EJS render templates
   - `frontend/config/__default/` and `frontend/config/cinemata/` — page configs and mocks
   - `frontend/config/cinemata.config.js` and `frontend/config/__default.config.js`
   - `frontend/scripts/` — build.js, start.js, rmrf.js, all utils
   - `frontend/cli.js`
   - `frontend/.babelrc`
   - `frontend/packages/ejs-compiled-loader/` — Webpack-specific custom loader (dead code after migration)

2. **Delete Django-side Webpack code**:
   - `files/templatetags/webpack_manifest.py` — replaced by django-vite (delete in same PR as template removal was completed)
   - `cms/storage.py` — `WebpackHashedFilesStorage` no longer needed
   - In `cms/settings.py`: change `STORAGES.staticfiles.BACKEND` to `django.contrib.staticfiles.storage.StaticFilesStorage`

   > **CRITICAL (from Python/Django review + performance review + architecture review):** Do NOT use `ManifestStaticFilesStorage`. It will:
   > - Double-hash Vite's already-hashed files (`index-da29887f.abc123.js`)
   > - Break font URL rewriting in CSS files (the original reason `WebpackHashedFilesStorage` was created — see `cms/storage.py` docstring)
   > - Slow down `collectstatic` by 10-30 seconds
   >
   > Use plain `StaticFilesStorage` instead. For `_extra.css` cache-busting, use query-string versioning in the template:
   > ```html
   > <link href="{% static 'css/_extra.css' %}?v={{ EXTRA_CSS_VERSION }}" rel="stylesheet">
   > ```
   > With `EXTRA_CSS_VERSION` set in a context processor or settings.

3. **Uninstall Webpack npm packages** (~20 packages):
   ```
   webpack, webpack-dev-server, webpack-format-messages, webpack-manifest-plugin,
   webpack-virtual-modules, html-webpack-plugin, ejs-compiled-loader, ejs,
   copy-webpack-plugin, css-url-relative-plugin, progress-bar-webpack-plugin,
   mini-css-extract-plugin, css-minimizer-webpack-plugin, dotenv-webpack,
   cross-spawn, lodash.merge, html-prettify, rimraf, install,
   babel-loader, @babel/core, @babel/preset-env, @babel/preset-react,
   sass-loader, css-loader, postcss-loader
   ```
   **Keep**: `sass` (Vite has built-in Sass support but needs the `sass` package), `autoprefixer`, `core-js`, `dotenv`, `prop-types`.

4. **Remove `postcss-custom-properties` entirely** (not just change to `preserve: true`):

   > **From performance review:** The plugin exists to provide IE 11 fallbacks via static value compilation. Since Vite drops IE 11 support and all modern browsers natively support CSS custom properties, the plugin is unnecessary. Removing it:
   > - Avoids the 30-50% CSS size inflation from `preserve: true` (which outputs both static fallback AND `var()`)
   > - Is simpler than configuring `preserve: true`
   > - Actually *reduces* CSS output vs baseline
   > - Theme toggling via body class + CSS custom properties still works (it relies on native browser support, not PostCSS)
   >
   > **Verify after removal:** Open browser DevTools → Elements → select `<body>` → Computed styles → confirm `--body-bg-color`, `--btn-primary-bg-color` etc. are present. Toggle theme — colors change.

5. **Update `frontend/package.json`**:
   ```json
   {
     "scripts": {
       "dev": "vite",
       "build": "vite build",
       "preview": "vite preview"
     }
   }
   ```
   Remove `"bin"` and `"main"` fields.

6. **Update Makefile**: `frontend-dev` → `cd frontend && npm run dev`, `quick-build` → `cd frontend && npm run build && python manage.py collectstatic --noinput`.

7. **Update `scripts/build_frontend.sh`**: Replace `node cli.js build --config=...` with `npm run build`. Verify sub-package builds (vjs-plugin, media-player) still work independently.

8. **Update setup guides**: `docs/setup/Developer-Onboarding.md`, `docs/setup/mac-setup-docker.md`.

9. **Write ADR**: `docs/technical/adr-001-webpack-to-vite.md`.

10. **Record post-migration metrics** and compare against M1 baselines. Include per-page gzipped transfer sizes.

11. **Audit `process.env` usage in frontend code**: Webpack's `dotenv-webpack` injects all env vars. Vite only exposes `VITE_`-prefixed variables. Current grep shows zero `process.env` usage in `frontend/src/` — verify packages too.

    > **SECURITY (from security review):** Create a `frontend/.env.example` that exclusively uses the `VITE_` prefix. Add `frontend/.env` to `.gitignore` (it's currently tracked!). Add a CI check that greps `frontend/.env*` for patterns matching `SECRET`, `PASSWORD`, `KEY`, `TOKEN`, `ADMIN` and fails if found. Never change Vite's `envPrefix` from the default `VITE_`.

12. **Verify browserslist target**: Current `package.json` has `"browserslist": ["cover 99.5%"]` (extremely broad, includes IE 11). Vite uses esbuild which does not support IE 11. Document the new browser support policy.

13. **Verify HTTP/2 on production NGINX**: Vite's code splitting produces 4-8 JS requests per page instead of 2. On HTTP/1.1 this would be a performance regression. On HTTP/2 it's neutral to positive.

**Done when:**
- Zero Webpack references remain in the codebase (`grep -r "webpack" frontend/ --include="*.js" --include="*.json"`)
- `npm run build` and `npm ls` are both clean
- Dev server starts in under 500ms
- Post-migration metrics documented
- `postcss-custom-properties` removed from dependencies
- CSS custom properties confirmed present at runtime

<details>
<summary>PR 2C Deployment Checklist (from deployment verification agent)</summary>

**Pre-deploy (24h gate after PR 2B):**
- [ ] PR 2B stable in production for 24+ hours
- [ ] `backup/pre-webpack-removal` branch created and pushed
- [ ] Zero webpack references in active code
- [ ] `npm ls` clean
- [ ] `postcss-custom-properties` removed from dependencies
- [ ] `STORAGES` backend changed to `StaticFilesStorage`
- [ ] `scripts/build_frontend.sh` updated
- [ ] Sub-packages build independently
- [ ] Makefile updated
- [ ] `collectstatic` succeeds without errors
- [ ] Full smoke test in local production mode

**Deploy (same sequence as PR 2B):**
1. Full static backup
2. Pull, install, build, collectstatic, restart

**Post-deploy:**
- [ ] All PR 2B checks pass
- [ ] CSS custom properties present at runtime
- [ ] Theme toggle works (proves PostCSS plugin removal is safe)
- [ ] Font files load (Material Icons, Amulya, Facultad)
- [ ] `_extra.css` loads with version query string

**Monitoring: 48 hours (extended for point of no return)**

**Rollback:**
- Quick (5-10 min): `git checkout backup/pre-webpack-removal`, npm install, build, restore backup
- Full (15-30 min): `git checkout legacy/webpack-backup`, full reinstall

</details>

---

## Acceptance Criteria (M2-specific)

- [x] Vite production build succeeds with 27+ entries in `.vite/manifest.json`
- [x] `{% vite_hmr_client %}` renders HMR client in dev, nothing in production
- [x] `_extra.css` loads correctly via `{% static %}` with query-string cache-busting
- [x] All 30+ page types load without console errors in both dev and production
- [x] Dark/light theme toggle works on all pages
- [x] Zero Webpack references remaining in codebase (grep verification)
- [x] CSS custom properties preserved at runtime (PostCSS plugin removed entirely)
- [x] No source maps in production build
- [x] `VITE_DEV_MODE` env var controls dev mode (not `DEBUG`)
- [x] Dev server cold start < 500ms (baseline: 15-30s)
- [x] HMR latency < 500ms (baseline: 2-5s)
- [x] `npm audit` does not introduce new vulnerabilities vs baseline
- [x] `npm ls` clean (no orphaned or missing dependencies)
- [x] `manage.py check` passes
- [x] `postcss-custom-properties` removed from dependencies
- [x] Post-migration metrics recorded and compared to baseline
- [x] ADR written (`docs/technical/adr-001-webpack-to-vite.md`)
- [x] `frontend/.env` added to `.gitignore`

## Risk Analysis (M2-specific)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `ManifestStaticFilesStorage` double-hashes Vite assets | **Certain** if used | High — broken font URLs, double-hashed filenames | Use `StaticFilesStorage` instead + query-string versioning |
| `dev_mode` tied to `DEBUG` reaches production | Medium | **Critical** — site fully broken or XSS via port 5173 | Use dedicated `VITE_DEV_MODE` env var |
| Template tag typo silently breaks page | Medium | Medium — single page broken until visited | Post-migration grep + manual smoke test of all pages |
| `_extra.css` served without cache-busting | Medium | Medium — stale styles after deployment | Query-string versioning: `?v={{ EXTRA_CSS_VERSION }}` |
| `process.env` usage breaks under Vite | Medium | Medium — env vars undefined at runtime | Audit before PR 2C; current grep shows zero usage in `src/` |
| SCSS compilation differences between Webpack and Vite | Low | High — widespread styling breaks | Verify all SCSS compiles under Vite's built-in Sass support |
| Environment variable leakage via `VITE_` prefix | Medium | **Critical** if secrets exposed | Guardrails: `.gitignore`, CI check, documentation |
| Local `file:` package refs (`media-player`) incompatible with Vite | Medium | Medium — video player breaks | Verify in PR 2A before switching templates |
| HMR confuses developers when editing singletons | Medium | Low — wasted debugging time | `import.meta.hot.decline()` on store/dispatcher files |
| Code splitting changes affect cache efficiency | Medium | Medium — cache invalidation churn | `manualChunks` configuration in Vite config (day-one) |

## Rollback Strategy

| PR | Rollback |
|----|----------|
| **PR 2A** | Delete Vite config + entry files, remove `django-vite`. Webpack is still active. |
| **PR 2B** | Revert the template PR. Webpack files still present. |
| **PR 2C** | Restore from `legacy/webpack-backup` branch (create from commit **just before PR 2C**, not before M1, so React 19 + template changes are preserved). Also create `backup/pre-webpack-removal` from just before PR 2C. |

## Deployment Sequencing

| Deployment | Minimum Wait After Previous | Deploy Window | Staff |
|------------|----------------------------|---------------|-------|
| PR 2A (Vite alongside) | 24h after M1 | Any time (low risk) | 1 engineer |
| PR 2B (Template switch) | Immediately after 2A | **Lowest traffic window** | 1 engineer + 1 tester |
| PR 2C (Webpack removal) | **24h minimum** after PR 2B | Low-traffic period | 1 engineer |
| NGINX cache changes | 24h after PR 2C | Any time | 1 engineer |

## NGINX Recommendations (Post-Migration)

After PR 2C is stable, add cache headers to distinguish hashed vs non-hashed assets:

```nginx
location /static/ {
    alias /home/cinemata/cinematacms/static_collected/;

    # Hashed assets (Vite output) — cache aggressively
    location ~* /static/assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Block Vite manifest from public access
    location /static/.vite/ {
        deny all;
        return 404;
    }

    # Non-hashed assets — moderate cache
    expires 7d;
    add_header Cache-Control "public";
}
```

Apply AFTER PR 2B is verified, not during. Don't mix infrastructure changes with application changes.

## Key Files

- Webpack config factory: `frontend/scripts/utils/webpack-config/webpack.configuration.js:1-372`
- Page configs (virtual modules): `frontend/config/cinemata/cinemata.mediacms.pages.config.js:1-247`
- Template tag (to delete): `files/templatetags/webpack_manifest.py:1-147`
- Custom storage (to delete): `cms/storage.py:1-38`
- PostCSS config: `frontend/config/postcss.config.js:12` (`preserve: false`)
- Helper functions: `frontend/src/static/js/_helpers.js:1-33`
- Django settings: `cms/settings.py:204-230` (static files config)
