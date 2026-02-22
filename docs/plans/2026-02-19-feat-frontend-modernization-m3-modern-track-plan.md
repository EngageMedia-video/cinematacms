---
title: "M3: Modern Track Foundation"
type: feat
status: completed
date: 2026-02-19
parent: 2026-02-19-feat-frontend-modernization-react19-vite-modern-track-plan.md
milestone: M3
---

# M3: Modern Track Foundation (2 PRs)

**Prerequisites**: M2 (Vite Migration) complete and stable for 48h
**Total Effort**: ~7 hours across 2 PRs

> **Simplicity note (from code simplicity review):** M3 is a forward-looking foundation. If there are no immediate features to build with the modern track, consider deferring M3 until the first real feature needs it. The Vite migration (M2) delivers the primary DX improvements. However, having the demo page serves as documentation and proof that the dual-track architecture works.

## Overview

Establish the Modern Track for new features using TanStack Query (server state), Zustand (client state), and Tailwind CSS (styling via theme bridging to existing CSS custom properties). No existing features are rewritten — this is additive only.

**Dual-track approach:**
- **Legacy track** — All existing components, Flux stores, and SCSS stay as-is. Bug fixes follow current patterns.
- **Modern track** — New features use React 19 hooks, TanStack Query, Zustand, and Tailwind CSS.

Source documents:
- [Parent Plan](./2026-02-19-feat-frontend-modernization-react19-vite-modern-track-plan.md)
- [Action Plan](../technical/frontend-modernization/action-plan.md)
- [Technical Breakdown](../technical/frontend-modernization/technical-breakdown.md)

---

## PR 3A: Modern track dependencies and configuration

**Branch**: `feat/modern-track-setup`
**Effort**: ~3 hours

1. **Install dependencies**:
   ```bash
   cd frontend && npm install @tanstack/react-query zustand
   npm install --save-dev tailwindcss @tailwindcss/vite
   ```

2. **Create `frontend/tailwind.config.js`** with theme bridging:

   > **From pattern recognition review:** Structure colors in semantic tiers to match the existing CSS property hierarchy. Flat names like `primary` lose the `btn-` specificity and `bg-primary` in Tailwind reads ambiguously.

   ```js
   export default {
     content: [
       './src/static/js/features/**/*.{js,jsx}',
       './src/static/js/pages/ModernDemoPage.js',
     ],
     corePlugins: {
       preflight: false,  // don't stomp normalize.css
     },
     theme: {
       extend: {
         colors: {
           brand: {
             primary: 'var(--btn-primary-bg-color)',
             'primary-hover': 'var(--btn-primary-bg-hover-color)',
             secondary: 'var(--btn-secondary-bg-color)',
           },
           surface: {
             body: 'var(--body-bg-color)',
             sidebar: 'var(--sidebar-bg-color)',
             header: 'var(--header-bg-color)',
             input: 'var(--input-bg-color)',
             popup: 'var(--popup-bg-color)',
           },
           content: {
             body: 'var(--body-text-color)',
           },
           border: {
             input: 'var(--input-border-color)',
           },
         },
       },
     },
   }
   ```

   Full list of CSS custom properties in `frontend/src/static/css/config/_light_theme.scss`.

   > **Tailwind v4 note (from architecture review):** Verify whether Tailwind v4 uses CSS-first configuration (`@config` directive) instead of `tailwind.config.js`. If so, adapt the config format accordingly.

3. **Add Tailwind plugin to `vite.config.js`**: Import `tailwindcss` from `@tailwindcss/vite` and add to `plugins` array.

4. **Add ESLint rules to enforce track boundary** (promoted from "Future Considerations"):

   > **From pattern recognition review:** The dual-track boundary is currently convention-only. Add machine-enforceable rules:

   ```js
   // .eslintrc or equivalent
   {
     "overrides": [
       {
         "files": ["src/static/js/features/**/*.{js,jsx}"],
         "rules": {
           "no-restricted-imports": ["error", {
             "paths": ["flux"],
             "patterns": ["**/stores/LayoutStore", "**/stores/ThemeStore", "**/_PageStore"]
           }]
         }
       },
       {
         "files": ["src/static/js/pages/**/*.{js,jsx}", "src/static/js/components/**/*.{js,jsx}"],
         "rules": {
           "no-restricted-imports": ["warn", {
             "paths": ["zustand", "@tanstack/react-query"]
           }]
         }
       }
     ]
   }
   ```

5. **Gate modern-track imports at build time** (from performance review): Prevent `@tanstack/react-query` and `zustand` from being accidentally imported in shared components. Without this gate, a single errant import pulls ~15KB gzipped into every page's bundle.

6. **Verify**: Create throwaway test file with Tailwind classes, build, inspect output CSS → utilities reference correct CSS custom properties. Delete test file. Existing build still passes.

**Done when:** Dependencies install cleanly. Tailwind generates correct utilities referencing existing theme variables. Vite build passes. ESLint rules prevent cross-track imports.

---

## PR 3B: Demo page and contributor docs

**Branch**: `feat/modern-track-demo`
**Effort**: ~4 hours

1. **Create Zustand store** — `frontend/src/static/js/features/modern-demo/useDemoStore.js` (~15 lines: `viewMode`, `searchQuery` with setters). Compare to `LayoutStore.js` (124 lines with EventEmitter + Dispatcher).

   > **From pattern recognition review:** Place the store in `features/modern-demo/` (not `pages/stores/`). Use `useDemoStore.js` naming (the `use` prefix signals hook-based store and distinguishes from PascalCase Flux stores).

2. **Create `ModernDemoPage.js`** at `frontend/src/static/js/features/modern-demo/ModernDemoPage.js`:
   - Wrap in `QueryClientProvider` (scoped to this page — **must NOT be in shared components or _helpers.js**)
   - `useQuery` to fetch from `/api/v1/media/` via `ApiUrlContext`
   - Grid/list toggle from Zustand store
   - Search filter from Zustand store
   - Styled entirely with Tailwind utilities — no SCSS
   - Inline comparison panel: Legacy pattern vs Modern pattern
   - Consumes existing contexts via `useContext()` (**NOT** `_currentValue` pattern)

   > **From frontend races review:** The `_currentValue` context access pattern used throughout the legacy codebase bypasses React's subscription mechanism. Modern-track components MUST use `useContext()` for all context access. Document this explicitly.

   > **From performance review:** Ensure `QueryClientProvider` is scoped inside `ModernDemoPage.js`, not in any shared component. If it leaks into the shared tree, TanStack Query's runtime gets included in ALL page bundles.

3. **Wire up plumbing**:
   - Entry file: `frontend/src/entries/modern-demo.js` (3 lines)
   - Vite config: Add `'modern-demo': 'src/entries/modern-demo.js'` to `rollupOptions.input`
   - Django template: `templates/cms/modern_demo.html` extending `base.html`
   - URL route: `path('modern-demo', views.modern_demo_page, name='modern_demo')` in `files/urls.py`

   > **CRITICAL (from Python/Django review):** The URL route must be placed **above** the catch-all pattern at `files/urls.py:138` (`re_path("^(?P<slug>[\w.-]*)$", ...)`), which will swallow `/modern-demo` if it comes first.

   - View: `modern_demo_page(request)` in `files/views.py` — requires authentication (staff-only for now)

4. **Verify theme bridging**: Toggle light/dark mode on demo page. Tailwind-styled elements must respond to theme change.

5. **Update `CONTRIBUTING.md`**: Dual-track section, dev workflow, Flux vs Zustand rule, SCSS vs Tailwind rule, PR checklist.

   > **From pattern recognition review:** Document that:
   > - Django templates use `snake_case`, JS entries use `kebab-case` (pre-existing convention)
   > - `-NEW-` is a historical directory name, not "modern track"
   > - Modern pages should use `PageLayout` from `page.js` (which wraps with `LayoutProvider`)
   > - Modern stores use `useFooStore.js` naming (hook-based); legacy stores use `FooStore.js` (PascalCase class)

6. **Create `.github/PULL_REQUEST_TEMPLATE.md`**:
   ```markdown
   - [ ] I have not imported `flux` in a new component
   - [ ] If adding a new feature, I used Modern Track patterns
   - [ ] New features do not create new SCSS files (use Tailwind instead)
   ```

**Done when:**
- `/modern-demo` renders, fetches data, responds to theme toggle
- Existing `/demo` page still works unchanged
- A new contributor can understand the dual-track approach from docs alone

---

## Acceptance Criteria (M3-specific)

- [x] `/modern-demo` page renders, fetches API data, and supports theme toggle
- [x] `/modern-demo` URL route placed above catch-all pattern in `files/urls.py`
- [x] Existing `/demo` page unchanged
- [x] Dark/light theme toggle works on both legacy and modern-track pages
- [x] `QueryClientProvider` scoped inside `ModernDemoPage.js` (not shared)
- [x] Modern-track components use `useContext()` (not `_currentValue`)
- [x] ESLint rules enforce track boundary (no-restricted-imports)
- [x] Tailwind generates correct utilities referencing existing CSS custom properties
- [x] `CONTRIBUTING.md` updated with dual-track docs
- [x] PR template created with modern-track checklist
- [x] Vite build passes with no new warnings

## Risk Analysis (M3-specific)

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Catch-all URL swallows `/modern-demo` | **Certain** if unordered | Medium — 404 on demo page | Place route above catch-all in `files/urls.py` |
| `QueryClientProvider` leaks into shared tree | Medium | Medium — ~15KB gzipped added to every page | ESLint no-restricted-imports + code review |
| Tailwind v4 config format differs from v3 | Medium | Low — config needs adaptation | Verify at install time |
| M3 is premature (no features to build) | Medium | Low — wasted effort | Can defer until first real feature needs it |

## Rollback Strategy

| PR | Rollback |
|----|----------|
| **PR 3A** | Remove config files + uninstall 3 packages. Vite build still works. |
| **PR 3B** | Delete demo page files. Nothing else affected. |

## Deployment

- **Minimum wait after M2**: 48 hours of stable production
- **Deploy window**: Any time (additive only)
- **Staff**: 1 engineer

## Documentation Plan (M3-specific)

| Document | Action | When |
|----------|--------|------|
| `CONTRIBUTING.md` | Add dual-track section, dev workflow, PR checklist, naming conventions | PR 3B |
| `.github/PULL_REQUEST_TEMPLATE.md` | Create with modern-track checklist | PR 3B |

## Key Files

- Tailwind config: `frontend/tailwind.config.js` (new)
- Demo store: `frontend/src/static/js/features/modern-demo/useDemoStore.js` (new)
- Demo page: `frontend/src/static/js/features/modern-demo/ModernDemoPage.js` (new)
- Entry file: `frontend/src/entries/modern-demo.js` (new)
- Django template: `templates/cms/modern_demo.html` (new)
- URL route: `files/urls.py` (modify — add above catch-all at line 138)
- View: `files/views.py` (modify — add `modern_demo_page`)
- Light theme variables: `frontend/src/static/css/config/_light_theme.scss:1-380`
- Catch-all URL: `files/urls.py:138`

## Future Considerations

- **TypeScript**: Separate initiative after build is stable. Don't combine with migration (two variables when debugging).
- **Automated testing**: Add Vitest for new modern-track features. Existing code relies on manual QA.
- **React Compiler**: React 19 supports automatic memoization — evaluate after migration is stable.
- **Server Components**: Optional future optimization for content-heavy pages. Not in scope.
- **Flux removal timeline**: Set a deadline for migrating remaining Flux stores to Zustand. Flux is archived and receives no security patches.
