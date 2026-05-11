---
title: "feat: Modern home page (Most Popular hero, Featured by Curators, category rows)"
type: feat
status: completed
created: 2026-05-11
depth: standard
---

# feat: Modern home page (Most Popular hero, Featured by Curators, category rows)

## Summary

Replace the placeholder modern-track home page (`frontend/src/features/home/components/HomePage.jsx`) with the design-driven layout: a "Most Popular" hero (inline playable video + description card), a "Featured by Curators" carousel, and a reusable category-section component used N times. Wire only existing list endpoints (`?show=featured`, `?show=recommended`); category-source decisions and category-filtered listings remain deferred. Add SSR-style first-paint via Django-injected initial JSON, hydrated into a TanStack Query cache. Reuse `frontend/packages/media-player`, `frontend/src/features/shared/components/MovieItem`, `Badge`, and `Icon`. Carousel behavior matches the legacy `InlineSliderItemList`: manual arrow + dot navigation, no auto-rotation, no URL deep-linking.

---

## Problem Frame

The modern-track home page (`frontend/src/features/home/`) currently renders a placeholder with hard-coded `MovieItem` instances and lorem-ipsum text. The legacy home page (`frontend/src/static/js/pages/HomePage.js`) is the only working implementation, but it is built on Flux + SCSS + the `-NEW-` component library, and the project's dual-track convention requires new feature work in `features/<name>/` with Tailwind, TanStack Query, and Zustand-where-warranted.

The supplied design (see `docs/plans/2026-05-11-001-feat-modern-home-page-plan.md` reference image) defines the visual target: a wide hero region with an inline player on the left and a description card on the right; below it, a stack of horizontally-paged rows where each row shows four cards, dot/arrow pagination, a colored category badge, an expandable description, and a `VIEW ALL` link. The page is dark-themed and full-bleed on wide viewports.

The Django side already routes `home` to `cms/index_revamp.html` via `cms/ui_variant.py`, which loads `src/entries/index-revamp.js`, which renders `<HomePage />` into `#page-home`. No new Django route or template file is required; the existing template is the integration point.

The plan honors the deferred work explicitly: category-source resolution (admin-curated vs. dynamic vs. hard-coded) and category-filtered listing endpoints are out of scope. The category-row component must be **shape-correct and data-ready** so the deferred work can wire data without touching layout code.

---

## Requirements

- **R1 — Hero "Most Popular"**: Render an inline-playable hero binding to `/api/v1/media?show=featured` (first item is the scheduled featured video). The right column shows title, author, country, view count, and an expandable description.
- **R2 — Featured by Curators row**: Render a category-styled row binding to `/api/v1/media?show=recommended`. Behaves identically to category rows below it.
- **R3 — Category-section component**: One reusable component that renders badge label + expandable description + 4-up carousel + `VIEW ALL`. Accepts data and metadata as props; no opinion about data source. Used for "Featured by Curators" and (later) per-category rows.
- **R4 — Carousel behavior**: Show 4 cards visible at once. Manual paging via clickable left/right arrow buttons and clickable dots. No auto-rotation. No URL state. Page index lives in component-local state. Arrow and dot buttons are focusable with visible focus rings and ARIA labels.
- **R5 — Read-more expand/collapse**: Section descriptions and the hero description support expand/collapse. Truncate to a configured line count; toggle reveals the full text. State is component-local.
- **R6 — First-paint prefetch**: Featured and recommended payloads are serialized server-side into the page using Django's `json_script` template tag. The entry script hydrates this data into the TanStack Query cache before first render. No blank-state flash for the hero or the curators row.
- **R7 — Empty rows hidden**: Rows whose data resolves to an empty list hide themselves entirely (no badge, no description, no carousel). Mirrors legacy `visibleFeatured` / `visibleRecommended` / `visibleLatest` behavior.
- **R8 — Security**:
  - Server-injected JSON uses `json_script` (auto-escapes `<`, `>`, `&`); never `{{ data|safe }}` or template-string interpolation into a `<script>` body.
  - The frontend reads it via `JSON.parse(document.getElementById('home-initial-data').textContent)`.
  - `MediaSerializer.description` is rendered as **plain text** in the modern home (no `dangerouslySetInnerHTML`), even though the backend sanitizes HTML. Markup-bearing descriptions are deferred to a follow-up that introduces a single sanitization boundary.
  - All anchor tags pointing to non-internal URLs use `rel="noopener noreferrer"`.
  - The hero player loads sources only from `MediaSerializer`-supplied URLs; no source URL is constructed from query params or other untrusted input on the client.
- **R9 — Accessibility baseline**: Section headings are `<h2>` (under page `<h1>`). Carousel arrows have `aria-label="Previous page"` / `"Next page"`. Dot buttons have `aria-label="Go to page N"` and `aria-current="true"` on the active page. The hero description toggle is a `<button>` with `aria-expanded`. The hero `<video>` element has captions if subtitles exist on the media object.

---

## Output Structure

```
frontend/src/features/home/
├── components/
│   ├── HomePage.jsx               # composition root (replaces placeholder)
│   ├── HeroSection.jsx            # Most Popular: inline player + description card
│   ├── HeroSection.test.jsx
│   ├── SectionRow.jsx             # reusable row: badge + description + carousel + view-all
│   ├── SectionRow.test.jsx
│   ├── Carousel.jsx               # 4-up paged carousel with arrows + dots
│   ├── Carousel.test.jsx
│   └── ExpandableText.jsx         # read-more / read-less toggle
├── hooks/
│   ├── useFeaturedMedia.js        # TanStack Query: ?show=featured
│   ├── useRecommendedMedia.js     # TanStack Query: ?show=recommended
│   └── useCategoryMedia.js        # placeholder hook returning [] until data wiring lands
├── queryClient.js                 # shared QueryClient + dehydrate-from-DOM helper
├── initialData.js                 # readInitialDataFromDom() → seeds the cache
├── index.js                       # exports HomePage
└── README.md                      # short orientation for follow-up work

files/
├── views.py                       # MODIFY: index_page() injects featured + recommended
└── (no new files)

templates/cms/
└── index_revamp.html              # MODIFY: emit json_script blocks before entry
```

---

## High-Level Technical Design

```mermaid
sequenceDiagram
  participant Django as Django (index_revamp.html)
  participant Browser
  participant Entry as src/entries/index-revamp.js
  participant QC as TanStack QueryClient
  participant API as /api/v1/media

  Django->>Browser: HTML + json_script(featured) + json_script(recommended)
  Browser->>Entry: load entry bundle
  Entry->>Entry: read #home-initial-data-featured, parse
  Entry->>QC: queryClient.setQueryData(['home','featured'], data)
  Entry->>QC: queryClient.setQueryData(['home','recommended'], data)
  Entry->>Browser: render <HomePage /> (hero + curators paint immediately)
  Note over QC,API: useQuery hooks see cached data, mark fresh; no fetch on first paint
  QC-->>API: refetch on staleTime expiry / window focus (per query config)
```

This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.

The category rows in the mockup (Gender & Sexuality, Film, Webinar, etc.) use the same `SectionRow` component as Featured by Curators. In this plan, their data hooks return a stable empty array, which causes `SectionRow` to render nothing (R7). The deferred follow-up replaces those hooks with real data fetchers without touching `SectionRow` or `HomePage` layout.

---

## Key Technical Decisions

- **Why `json_script` for SSR data, not a plain `<script>` body**: `json_script` escapes `<`, `>`, and `&` so a malicious title or description cannot break out of the script tag. Plain interpolation (`<script>window.__INIT__ = {{ data|safe }};</script>`) is a known XSS sink; `json_script` plus `JSON.parse(textContent)` is the standard hardened pattern. (R8)
- **Why hydrate via `setQueryData`, not TanStack's `<HydrationBoundary>`**: We are not running React on the server. We are seeding the cache before first render with already-shaped data. `setQueryData` keeps the implementation small and avoids pulling in `dehydrate`/`hydrate` machinery designed for full SSR.
- **Why component-local state for carousel index, not Zustand**: Page index is purely UI state, scoped to a single row, and never observed by another component. Zustand would be premature.
- **Why a shared `homeQueryClient`, not a feature-wide global**: Mirrors the existing pattern in `frontend/src/features/notifications/queryClient.js` — feature-scoped clients keep query keys, defaults, and DevTools mounting boundaries clean.
- **Why render description as plain text in this iteration**: Rendering `MediaSerializer.description` as HTML requires a single sanitization boundary on the client. Introducing that boundary in this PR widens scope and review surface; deferring it keeps this PR focused on layout and data-flow correctness. The legacy track already handles HTML descriptions; the modern track will gain that capability in a follow-up. (R8)
- **Why the category hooks ship as stubs in this PR**: Locks the data interface (`{ data, isLoading, isError }`) so the deferred category-source work only changes hook bodies, not call sites. Avoids re-wiring `HomePage` later.
- **Why compound components for `SectionRow` and `Carousel`, not boolean props**: A flat `<SectionRow badgeLabel description viewAllHref items isLoading isError showHeader showDescription showViewAll />` API balloons fast as the design grows. A compound API (`<SectionRow><SectionRow.Header /><SectionRow.Description /><SectionRow.Carousel /></SectionRow>`) lets each consumer pick which slots to render and lets `SectionRow` itself stay agnostic about layout permutations. Hero composition follows the same shape (`<HeroSection><HeroSection.Player /><HeroSection.Card /></HeroSection>`). This applies the composition skill's `architecture-compound-components` and `architecture-avoid-boolean-props` rules.
- **Why lazy-load `MediaPlayer` (videojs) instead of importing eagerly**: video.js + plugins are a multi-hundred-KB chunk. The home page paints meaningful content (hero card, curators row, category headers) before the player needs to be interactive. Splitting `MediaPlayer` behind `React.lazy` + `<Suspense>` keeps the home page's main bundle small and defers player JS until after first paint. (Vercel rule: `bundle-dynamic-imports`.)
- **Why React 19 `use()` over `useContext()` for compound-component context**: The repo runs React 19 (per `CLAUDE.md`). `use()` allows reading context conditionally inside the children of a compound component (handy when a slot is absent), and the React 19 guide explicitly directs against `forwardRef` for new components — refs are passed as plain props.

---

## React Architecture Conventions

These conventions apply to every implementation unit below. They are not optional sequencing — they are the shape of the code reviewers should expect.

**Composition (from the React composition-patterns skill):**
- **No boolean-mode props.** No `featuredHeroPlayer`-style switches. If two visual modes are genuinely different, ship two components (`<HeroSection>` vs. `<HeroCard>` if ever needed); if they share a shell with optional slots, use compound components.
- **Compound components with React 19 `use()`.** `SectionRow` and `Carousel` expose a parent component that creates a context, plus subcomponents that read it via `use(SomeContext)`. No `forwardRef`; refs pass as plain `ref` props (`react19-no-forwardref`).
- **Children over render-props.** Slots accept `children`, not `renderHeader` / `renderFooter` callbacks (`patterns-children-over-render-props`).
- **Controlled / uncontrolled both supported.** `Carousel` accepts optional `currentPage` + `onPageChange`. When omitted, the provider owns state internally. This keeps the door open for URL-coupled or coordinated carousels later without a rewrite (`state-decouple-implementation`, `state-lift-state`).

**Re-render discipline (from the Vercel React-best-practices skill):**
- **No inline component definitions.** The provisional category list constant in `HomePage.jsx` is declared at module scope, never inside the function body (`rerender-no-inline-components`).
- **Derive state during render.** `pageCount` in `Carousel` is computed each render from `items.length`; never stashed in a `useEffect`-driven `useState` (`rerender-derived-state-no-effect`).
- **Functional `setState` for paging callbacks.** `goNext` / `goPrev` close over `setCurrentPage(prev => …)` so the paging callbacks remain referentially stable and don't depend on the latest `currentPage` value (`rerender-functional-setstate`).
- **Ternary for empty/error rendering.** `isError || items.length === 0 ? null : <Row />`, not `&&` (`rendering-conditional-render`).
- **Hoist static JSX and config.** Badge color tokens, dot-count thresholds, clamp defaults all sit at module scope (`rendering-hoist-jsx`).

**Bundle discipline:**
- **Direct imports only.** Components are imported by file path, not via a feature-level barrel `index.js`, to keep tree-shaking effective (`bundle-barrel-imports`). The home feature's `index.js` exports `HomePage` only — internal components are imported by their direct paths inside the feature.
- **Lazy-load the heavy player.** `MediaPlayer` from `frontend/packages/media-player` loads via `React.lazy` + `<Suspense>` in `HeroSection.Player` (`bundle-dynamic-imports`).

**Hydration:**
- **No hydration flicker.** Hero and curators row mount with cache-seeded data so they render their final content on first paint (`rendering-hydration-no-flicker`). The `<Suspense>` fallback for `MediaPlayer` is the *poster image*, not a spinner — the player swaps in over the same poster so the user sees no jump.

---

## Implementation Units

### U1. TanStack Query layer and initial-data hydration

**Goal**: Establish the data layer (query client, hooks, hydration helper) that the visual components consume.

**Requirements**: R1, R2, R3, R6

**Dependencies**: none

**Files**:
- `frontend/src/features/home/queryClient.js` (create)
- `frontend/src/features/home/initialData.js` (create)
- `frontend/src/features/home/hooks/useFeaturedMedia.js` (create)
- `frontend/src/features/home/hooks/useRecommendedMedia.js` (create)
- `frontend/src/features/home/hooks/useCategoryMedia.js` (create — stub returning `{ data: [], isLoading: false, isError: false }`)
- `frontend/src/features/home/hooks/useFeaturedMedia.test.jsx` (create)

**Approach**:
- `queryClient.js` exports a `QueryClient` instance with `staleTime: 60_000` and `refetchOnWindowFocus: false` for home data (the page is mostly read-once-per-visit; aggressive refetch is wasted bandwidth).
- `initialData.js` exports `readInitialDataFromDom()` which looks up the two `json_script` elements by id, `JSON.parse`s their `textContent`, and returns `{ featured, recommended }` or `null` if either is absent. Errors during parse are caught and surfaced as `null` so the app degrades to a normal client-side fetch instead of crashing.
- The two real hooks (`useFeaturedMedia`, `useRecommendedMedia`) call `useQuery` against `/api/v1/media?show=<key>`. The query key shape is `['home', 'featured']` and `['home', 'recommended']` so seeding via `setQueryData` lines up exactly.
- `useCategoryMedia.js` is a stub. It accepts `(categoryId)` and returns the same shape as the real hooks, with `data: []`. Documented inline that the deferred category-source work replaces this body.

**Patterns to follow**:
- `frontend/src/features/notifications/queryClient.js` for client construction
- `frontend/src/features/notifications/hooks/useNotifications.js` for hook shape (URL building, error throw on `!ok`)

**Test scenarios**:
- `readInitialDataFromDom` returns `null` when the script tags are absent
- `readInitialDataFromDom` returns `null` when `JSON.parse` throws (malformed JSON)
- `readInitialDataFromDom` returns `{ featured, recommended }` when both script tags contain valid JSON arrays
- `useFeaturedMedia` returns the seeded data without firing a network request when the query cache was pre-populated via `setQueryData`
- `useFeaturedMedia` performs a fetch and surfaces the response when no seed exists
- `useFeaturedMedia` surfaces `isError: true` when the response status is non-2xx
- `useCategoryMedia('any-id')` returns `{ data: [], isLoading: false, isError: false }` synchronously with no network call

**Verification**: New hooks compile and pass tests. No production code path imports the stub `useCategoryMedia` from outside the home feature.

---

### U2. Server-side initial-data injection

**Goal**: Make Django serialize the featured and recommended payloads into the rendered page using the safe `json_script` pattern.

**Requirements**: R6, R8

**Dependencies**: U1 (so the hydration helper exists to consume what we inject)

**Files**:
- `files/views.py` (modify the view that renders `cms/index_revamp.html` — locate by following `cms/ui_variant.py`'s `home` mapping to its caller)
- `templates/cms/index_revamp.html` (modify)
- `files/tests/test_index_revamp_initial_data.py` (create)

**Approach**:
- In the home view, build two small lists: the same querysets `MediaList` would return for `?show=featured` and `?show=recommended`, capped at the max number of items the carousel ever displays (e.g. 20). Serialize them with the existing `MediaSerializer` so the frontend cache shape matches a real API response exactly. Pass them to the template context as `home_initial_featured` and `home_initial_recommended`.
- In `templates/cms/index_revamp.html`, before the entry script tag, emit:
  - `{{ home_initial_featured|json_script:"home-initial-data-featured" }}`
  - `{{ home_initial_recommended|json_script:"home-initial-data-recommended" }}`
- Reuse the cache helpers (`get_cached_result` / `set_cached_result`) the existing `MediaList` view uses, so SSR data is sourced from the same cache the API serves. Per-request DB hits should not regress.
- For anonymous users (the common home-page case), the cache key matches `MediaList`'s anonymous key. Authenticated cases use the user-scoped key per existing convention.

**Patterns to follow**:
- `files/views.py` `MediaList.get()` — copy the querying and caching shape; do not duplicate the listing logic, factor a small helper if needed
- `MediaSerializer` usage in `files/views.py` — pass `context={"request": request}` so absolute URLs resolve

**Execution note**: Add the test file first to lock the JSON shape and the `json_script` element ids.

**Test scenarios**:
- The home page response contains `<script id="home-initial-data-featured" type="application/json">` and `<script id="home-initial-data-recommended" type="application/json">`
- Each script body parses as valid JSON
- The featured payload's first item matches the currently scheduled featured video when one exists
- A title containing `</script><script>alert(1)</script>` is rendered safely (the closing tag is escaped; the script does not execute) — verify by asserting the literal escaped form appears in the response and the unescaped form does not
- A title containing `<` is escaped as `<` (or equivalent safe form) per `json_script`'s contract
- Anonymous users hit the same cache key as `/api/v1/media?show=featured` (no extra DB query when the cache is warm)
- Authenticated users do not see leakage of another user's restricted data (queryset uses `state="public", is_reviewed=True` like the API)

**Verification**: The home page renders with the two script tags present; their parsed JSON matches the shape returned by the corresponding API endpoint; the XSS test scenario asserts the escaping contract.

---

### U3. Hero section ("Most Popular") as compound component

**Goal**: Render the hero region as a compound component — `<HeroSection>` parent with `Player` and `Card` slot subcomponents — with the heavy video player lazy-loaded.

**Requirements**: R1, R5, R8, R9

**Dependencies**: U1

**Files**:
- `frontend/src/features/home/components/HeroSection.jsx` (create)
- `frontend/src/features/home/components/HeroSection.test.jsx` (create)
- `frontend/src/features/home/components/ExpandableText.jsx` (create)
- `frontend/src/features/home/components/ExpandableText.test.jsx` (create)

**Approach**:
- `HeroSection` is a compound component:
  - `HeroSection` (parent): reads `useFeaturedMedia()`, picks the first item, builds a context value `{ media }`, and exposes it via a `HeroContext.Provider`. Renders `null` when items is empty (R7) using a ternary, not `&&`.
  - `HeroSection.Player`: reads the context with React 19 `use(HeroContext)`. Renders the player area. Lazy-imports `MediaPlayer` via `const MediaPlayer = React.lazy(() => import('@cinemata/media-player'))` (or the workspace-relative path). Wraps it in `<Suspense fallback={<HeroPosterFallback src={media.thumbnail_url} />}>` so the user sees the poster while videojs loads. Autoplay is **off**; preload is `metadata`.
  - `HeroSection.Card`: reads context, renders title (`<h2>`), author + country line, `<ExpandableText>` for description, and a small metadata row.
- `HomePage` composes them: `<HeroSection><HeroSection.Player /><HeroSection.Card /></HeroSection>`. A future variant that swaps in a different card shape composes its own children.
- `ExpandableText` is a small leaf component. Props: `text`, `clampLines` (default 6 for hero, 2 for section descriptions). Renders a `<p>` with Tailwind `line-clamp-N` toggled via component-local `useState(false)`, and a `<button aria-expanded={expanded}>` for the `READ MORE` / `READ LESS` toggle. `text` renders as plain text, never through `dangerouslySetInnerHTML` (R8).
- Layout: `flex` on wide viewports (player ~2/3, card ~1/3); stacks below the player on narrow viewports. Layout classes are hoisted as module-level constants.
- Resource hint: `HeroSection` calls `ReactDOM.preload(media.thumbnail_url, { as: 'image' })` so the poster paints fast even on cold cache (`rendering-resource-hints`).

**Patterns to follow**:
- `frontend/src/features/shared/components/MovieItem/MovieItem.jsx` for Tailwind token usage and `joinClasses` helper
- `frontend/packages/media-player/src/MediaPlayer.js` for player initialization
- React 19 compound-component shape: parent owns context, children read via `use()`

**Test scenarios**:
- `<HeroSection>` renders `null` (no `<h2>`, no `<video>`) when `useFeaturedMedia` returns an empty array
- `<HeroSection><HeroSection.Card /></HeroSection>` renders only the card when the consumer omits `<HeroSection.Player />` (compound-component slot independence)
- `<HeroSection.Player />` mounts a `<Suspense>` boundary and shows the poster image as fallback before the lazy chunk resolves
- After the lazy chunk resolves, the player is **not** auto-playing (assert no `autoplay` attribute and no `play()` call before user interaction)
- Title appears as `<h2>` with the media title
- Description renders as text content; passing a description containing `<img onerror=alert(1)>` produces that string as visible text, no `<img>` element exists in the DOM
- Clicking the expand toggle changes `aria-expanded` from `false` to `true` and removes the line-clamp class
- Clicking again collapses
- External anchor links (if any) carry `rel="noopener noreferrer"`
- The `MediaPlayer` import is **dynamic**: assert via Vite's import-analysis or by inspecting the bundle that `MediaPlayer` is in a separate chunk from the home entry

**Verification**: Hero paints poster + card synchronously on first load; player chunk arrives in a separate bundle; description toggles correctly; XSS string in description does not execute.

---

### U4. Compound `SectionRow` and compound `Carousel`

**Goal**: Build the row used by Featured by Curators and (later) every category section as a compound component, with `Carousel` itself a compound component supporting controlled and uncontrolled state.

**Requirements**: R3, R4, R5, R7, R9

**Dependencies**: U1, U3 (reuses `ExpandableText`)

**Files**:
- `frontend/src/features/home/components/SectionRow.jsx` (create)
- `frontend/src/features/home/components/SectionRow.test.jsx` (create)
- `frontend/src/features/home/components/Carousel.jsx` (create)
- `frontend/src/features/home/components/Carousel.test.jsx` (create)

**Approach**:

**`SectionRow` as compound component:**
- `SectionRow` (parent) accepts `{ items, isLoading, isError, children }`. It builds a context value `{ items, isLoading, isError }` and exposes it via `SectionRowContext.Provider`. Renders `null` (via ternary, not `&&`) when `isError || (!isLoading && items.length === 0)`. Renders skeleton placeholders when `isLoading`.
- `SectionRow.Header`: accepts `{ badgeLabel, badgeColor, viewAllHref }`. Reads context only to gate visibility. Renders `<Badge>` + `<a>VIEW ALL</a>`. The `VIEW ALL` link carries `rel="noopener noreferrer"` when `viewAllHref` is non-internal.
- `SectionRow.Description`: accepts `{ text }`. Renders an `<ExpandableText clampLines={2}>`. No knowledge of the row's data.
- `SectionRow.Carousel`: reads `items` from context and forwards to the standalone `<Carousel>` compound below.
- Consumers compose explicitly:
  ```
  <SectionRow items={items} isLoading={...} isError={...}>
    <SectionRow.Header badgeLabel="GENDER & SEXUALITY" badgeColor="#A855F7" viewAllHref="/search?c=Gender" />
    <SectionRow.Description text="Stories exploring identity, expression, ..." />
    <SectionRow.Carousel />
  </SectionRow>
  ```
- A consumer that wants only the carousel (no badge/description) simply omits those subcomponents — the parent has no `showHeader` / `showDescription` boolean to pass.

**`Carousel` as compound component, controlled or uncontrolled:**
- `Carousel` (parent) accepts `{ items, visibleCount = 4, currentPage, onPageChange, defaultPage = 0, children }`. State strategy:
  - If `currentPage` is provided → controlled mode; provider relays `currentPage` and calls `onPageChange(next)` for paging.
  - Otherwise → uncontrolled; provider owns `useState(defaultPage)` and updates with functional setState (`setPage(p => clamp(p + 1, 0, pageCount - 1))`).
- Provider exposes `{ items, visibleCount, pageCount, currentPage, goPrev, goNext, goToPage, atStart, atEnd }`. `pageCount` is computed during render from `items.length` and `visibleCount` (no effect-driven derived state).
- `Carousel.Track`: reads context, slices `items[currentPage * visibleCount : (currentPage + 1) * visibleCount]`, renders each as `<VerticalMovieItem>`. Card list uses item ids as `key`.
- `Carousel.Arrows`: renders `<button type="button">` for prev/next with `aria-label="Previous page"` / `"Next page"`. `disabled={atStart}` and `disabled={atEnd}`. Click handlers are `goPrev` / `goNext` from context.
- `Carousel.Dots`: renders one `<button>` per page with `aria-label="Go to page N"` and `aria-current="true"` on the active dot.
- A default-shape consumer (`<Carousel items={items} />`) does not need to compose subcomponents — `Carousel` falls through to a default body of `<Carousel.Track /><Carousel.Arrows /><Carousel.Dots />` when `children` is omitted. Specialized consumers (e.g., a grid that wants dots above the track) pass children explicitly.
- No autoplay timer. No URL coupling. No keyboard arrow listener (matching legacy `InlineSliderItemList`).

**Re-render discipline:**
- `goPrev`, `goNext`, `goToPage` are wrapped via `useCallback` and use functional setState so referential identity stays stable across renders (`rerender-functional-setstate`).
- `pageCount` and `atStart`/`atEnd` are derived during render, never via effect (`rerender-derived-state-no-effect`).
- The dots array (`Array.from({ length: pageCount }, ...)`) is computed inline; no `useMemo` for cheap arithmetic (`rerender-simple-expression-in-memo` — don't memo trivial expressions).

**Patterns to follow**:
- `frontend/src/static/js/components/-NEW-/InlineSliderItemList.js` for arrow visual treatment and disabled-state semantics (do not import; mirror the UX)
- `frontend/src/features/shared/components/MovieItem/MovieItem.jsx` for card rendering and Tailwind tokens
- React 19 compound-component shape with `use(Context)` in subcomponents

**Test scenarios**:

`SectionRow`:
- Renders `null` (no badge, no description, no carousel) when `items` is empty and `isLoading` is `false`
- Renders `null` when `isError` is true regardless of items
- Renders skeleton placeholders when `isLoading` is true
- A consumer that omits `<SectionRow.Header>` renders just description + carousel (slot independence)
- A consumer that omits `<SectionRow.Description>` renders just header + carousel
- Badge renders with the supplied label and color when `<SectionRow.Header>` is present
- `VIEW ALL` link points to `viewAllHref` and carries `rel="noopener noreferrer"` when the href is non-internal

`Carousel` (default shape):
- With 8 items and `visibleCount=4`, shows items 0–3 initially
- Clicking right arrow advances to items 4–7
- Right arrow has `disabled` on the last page
- Left arrow has `disabled` on the first page
- Clicking dot N jumps to page N
- The active dot has `aria-current="true"`

`Carousel` (compound shape):
- A consumer composing `<Carousel><Carousel.Dots /><Carousel.Track /></Carousel>` (dots above track) renders both, and dots stay in sync with track paging
- A consumer omitting `<Carousel.Arrows>` renders track + dots only; paging via dots still works

`Carousel` (controlled mode):
- Passing `currentPage={2}` and no `onPageChange` keeps the carousel pinned to page 2 even when arrows are clicked
- Passing `currentPage={2}` and `onPageChange={fn}` calls `fn(3)` when right arrow is clicked
- Switching `currentPage` from `2` to `0` via re-render moves the visible slice without remounting children (assert by checking that `<VerticalMovieItem>` instances retain their `data-test-id` keys)

`Carousel` (re-render discipline):
- `goNext` reference is stable across re-renders triggered by parent updates (assert via `useEffect` instrumentation in a test wrapper)
- No `setInterval` or `setTimeout` is installed for auto-rotation (assert by spying on `window.setInterval` / `setTimeout` during mount)
- No reads from or writes to `window.history` / `window.location`

**Verification**: SectionRow and Carousel render in both compound and default shapes; controlled mode works; paging works without timers or URL side effects; re-render discipline holds.

---

### U5. HomePage composition + entry hydration

**Goal**: Replace the placeholder, wire hydration, and assemble the page.

**Requirements**: R1, R2, R3, R6, R7, R9

**Dependencies**: U1, U2, U3, U4

**Files**:
- `frontend/src/features/home/components/HomePage.jsx` (replace contents)
- `frontend/src/features/home/index.js` (no change expected; verify export)
- `frontend/src/entries/index-revamp.js` (modify — wrap render with hydration step)
- `frontend/src/features/home/components/HomePage.test.jsx` (create)
- `frontend/src/features/home/README.md` (create — short orientation: where data comes from, where the deferred category work plugs in)

**Approach**:
- `HomePage` composes the page using compound shapes:
  ```
  <h1>Most Popular</h1>
  <HeroSection>
    <HeroSection.Player />
    <HeroSection.Card />
  </HeroSection>
  <FeaturedByCuratorsRow />     // small wrapper around <SectionRow> for clarity
  {PROVISIONAL_CATEGORIES.map(category => (
    <CategorySectionRow key={category.id} category={category} />
  ))}
  ```
- `PROVISIONAL_CATEGORIES` is declared at **module scope** (top of file, outside the `HomePage` function) — never inline (`rerender-no-inline-components`). Inline comment explains the list is provisional and tracks the deferred category-source decision.
- `FeaturedByCuratorsRow` and `CategorySectionRow` are explicit variant components (`patterns-explicit-variants`), each calling its respective hook (`useRecommendedMedia`, `useCategoryMedia(id)`) and composing `<SectionRow>` with the appropriate `<SectionRow.Header>` / `<SectionRow.Description>` / `<SectionRow.Carousel>` children. Two thin variants are clearer than one row component with a `variant="curators" | "category"` boolean.
- `index-revamp.js`:
  1. Import `homeQueryClient` and `readInitialDataFromDom` directly (not via barrel).
  2. Read initial data; for each present key, `homeQueryClient.setQueryData(['home', key], data)`.
  3. Wrap `<HomePage />` in `<QueryClientProvider client={homeQueryClient}>` and call `renderPage('page-home', ...)`.
- The page wrapper supplies `data-modern-track` and the page-level Tailwind layout container, mirroring the existing placeholder.

**Patterns to follow**:
- `frontend/src/entries/index-revamp.js` (current shape)
- `frontend/src/features/notifications/components/NotificationDialog.stories.jsx` for `<QueryClientProvider>` wrapping pattern

**Test scenarios**:
- With both initial-data scripts present in the document, `<HomePage />` mounts, `<HeroSection>` shows the first featured item synchronously (assert via `getByRole('heading', { level: 2 })` for the title before any `await`)
- Without initial-data scripts, `<HomePage />` shows hero poster fallback while data resolves, then transitions to data state
- `FeaturedByCuratorsRow` renders when recommended data is present (badge + description + carousel)
- `CategorySectionRow` instances render `null` (no badge, no description, no carousel) because `useCategoryMedia` returns empty arrays — the compound parent's empty-state ternary handles it
- `PROVISIONAL_CATEGORIES` is declared at module scope (assert by snapshotting that the constant is referentially identical across two consecutive renders of `HomePage`)
- The page has exactly one `<h1>` and uses `<h2>` for section headings (a11y baseline)
- No console errors in mount → unmount cycle
- No `forwardRef` is used in any component under `frontend/src/features/home/` (assert via grep in CI or a contract test that walks the source files)

**Verification**: Manual smoke test in dev (`make dev-server` + `cd frontend && npm run dev`): home page paints hero and curators row immediately; category rows are absent; no console warnings; carousel paging works; expand/collapse works.

---

### U6. Security, accessibility, and architecture-contract coverage

**Goal**: Lock the security, a11y, and React-architecture guarantees with focused tests so future refactors cannot quietly regress them.

**Requirements**: R8, R9 (plus the React Architecture Conventions section)

**Dependencies**: U2, U3, U4, U5

**Files**:
- `files/tests/test_index_revamp_security.py` (create — backend XSS contract)
- `frontend/src/features/home/components/HomePage.security.test.jsx` (create — frontend rendering trust contract)
- `frontend/src/features/home/contract.test.jsx` (create — architecture contract: no `forwardRef`, no inline component definitions, lazy-loaded player chunk, no boolean-mode props on `SectionRow` / `Carousel`)

**Approach**:
- Backend test: create a `Media` with title `'</script><script>alert("xss")</script>'`, mark it as the scheduled featured video, request the home page, assert the raw HTML response **contains** the escaped form and **does not contain** the unescaped form. Repeat for description.
- Frontend test: render `<HomePage />` with seeded data whose description contains `<img src=x onerror=alert(1)>`. Assert no `<img>` tag is present in the DOM under the hero card and the literal text is visible (proves text-not-HTML rendering).
- Frontend test: render `<HomePage />` and assert that no element under the page wrapper carries `dangerouslySetInnerHTML` (walk the React tree via `react-test-renderer` JSON or assert structural absence via DOM inspection).
- A11y test: render and assert one `<h1>`, multiple `<h2>`s under it, all interactive elements (`button`, `a`) reachable via tab order, focus styles present (assert the focus-visible class on a programmatic focus).
- Architecture-contract test (`contract.test.jsx`):
  - Static-source check: grep all files under `frontend/src/features/home/` for `forwardRef` and `React.forwardRef`; assert zero matches.
  - Static-source check: grep for inline component definitions (a regex flagging `function [A-Z][A-Za-z]+\(` or `const [A-Z][A-Za-z]+ =` declared inside another component body) — at minimum, assert `HomePage.jsx` does not declare `Provisional` or `CategoryRow` inside the `HomePage` function. (Pragmatic check: assert `PROVISIONAL_CATEGORIES` is exported or referenced at module scope.)
  - Bundle check: assert that `MediaPlayer` is reachable only via a dynamic import in `HeroSection.jsx` (search the file for the literal `React.lazy(() => import(`).
  - API-shape check: assert `<SectionRow>` and `<Carousel>` props (read via TypeScript types if/when available, or runtime PropTypes if used, or a simple shape assertion in the test) do **not** include any boolean prop ending in `show*`, `hide*`, `is*Mode`, or `as*` — boolean-mode antipattern guard.

**Test scenarios**: enumerated in Approach above.

**Verification**: All security, a11y, and architecture-contract tests pass. Any future change that switches to `dangerouslySetInnerHTML`, removes the `json_script` wrapper, eagerly imports `MediaPlayer`, introduces `forwardRef`, or adds boolean-mode props to the row/carousel API fails these tests.

---

## Scope Boundaries

### In scope (this plan)
- Modern-track home page layout matching the supplied design
- Hero with inline player binding to `?show=featured`
- Featured by Curators row binding to `?show=recommended`
- Reusable `SectionRow` + `Carousel` + `ExpandableText` components
- Server-side prefetch via `json_script` and TanStack Query cache seeding
- Empty-row hiding behavior matching legacy
- Security guarantees: `json_script` escaping contract, plain-text description rendering, no `dangerouslySetInnerHTML`
- A11y baseline: heading order, focus rings, ARIA labels on carousel controls and expand toggles

### Deferred to Follow-Up Work
- Category-source decision (admin-curated vs. dynamic vs. hard-coded) and the data wiring that depends on it. Today's `useCategoryMedia` stub locks the call-site interface so this follow-up only changes hook bodies.
- Adding `?category=` to `/api/v1/media`. Today the existing `/api/v1/search?c=<title>` endpoint (`files/views.py:1473`) is the documented fallback; the follow-up may use it directly or introduce a dedicated parameter.
- A single sanitization boundary on the client for HTML descriptions (currently rendered as text). When this lands, the hero and section description renderers gain an `as="html"` mode with DOMPurify or equivalent.
- Replacing the legacy `templates/cms/index.html` home or changing the UI variant switch. The modern home is reachable today via `cms/ui_variant.py`'s existing routing; flipping the default for all users is its own decision.

### Outside this product's identity (not planned)
- Auto-rotating carousels — the legacy slider does not auto-rotate; this product has consistently treated carousels as user-driven.
- Deep-linking carousel page state to the URL — never been a behavior here; would conflict with home being a "front door" landing page where back/forward should target real navigation, not row pagination.
- Full server-side React rendering — Django remains the templating boundary; React stays client-only. Only data prefetch flows server-side.
- Analytics/tracking instrumentation on the home page — not part of this work item.

---

## Risks and Mitigations

- **Risk**: Server-injected JSON shape diverges from API response shape, causing the cache seed to look "wrong" to the hooks and triggering an immediate refetch.
  - **Mitigation**: U2 reuses `MediaSerializer` with `context={"request": request}`, the same shape `/api/v1/media` returns. Add a contract test that asserts a JSON-injected payload matches a parallel API response payload field-by-field.

- **Risk**: Description sanitization regression — someone later replaces the plain-text `<p>` with `dangerouslySetInnerHTML` because "the legacy track does it that way".
  - **Mitigation**: U6's frontend test asserts structural absence of `dangerouslySetInnerHTML` under the home wrapper. The plan documents this as an explicit decision (Key Technical Decisions) so reviewers know the deviation from legacy is intentional.

- **Risk**: Cache-key collision with `MediaList` — if SSR uses a different cache key than the API, anonymous users get two distinct cache entries that drift.
  - **Mitigation**: U2 reuses the existing `get_media_list_cache_key` helper directly. Test scenario asserts identical key derivation.

- **Risk**: Hero player initializes too early (before initial data lands) and shows a black box.
  - **Mitigation**: `HeroSection` returns `null` until `useFeaturedMedia` reports data. With SSR seeding (U2), data is present synchronously, so this is rare in practice.

- **Risk**: Carousel paging on viewport resize gets confused (page index points past `pageCount`).
  - **Mitigation**: Clamp `currentPage` to `[0, pageCount - 1]` on each render; covered in U4 test scenarios.

- **Risk**: A future contributor "simplifies" `<SectionRow>` back to a flat boolean-prop API (`showHeader`, `showDescription`) because compound usage feels verbose for the common case.
  - **Mitigation**: U6's architecture-contract test fails on any new `show*` / `hide*` / `is*Mode` boolean prop. Key Technical Decisions section explicitly justifies the compound shape.

- **Risk**: `React.lazy` chunk for `MediaPlayer` fails to load (network error, deploy mismatch) and the hero collapses.
  - **Mitigation**: `<Suspense fallback>` is the poster image, not a spinner; the user sees a static hero even if the player chunk never resolves. Add an `<ErrorBoundary>` around `<HeroSection.Player>` so a chunk error degrades to the poster instead of taking down the whole page.

- **Risk**: Bundle size regression — `MediaPlayer` is imported eagerly somewhere in the home feature by accident, defeating the lazy split.
  - **Mitigation**: U6's bundle check asserts `MediaPlayer` is only referenced inside a `React.lazy(() => import(...))` call. Any direct top-level import fails CI.

---

## Verification

The plan is complete when:

1. The home page route (`/`) renders the design's visual structure: hero on top, Featured by Curators row below, no category rows visible (because their data hooks return empty arrays).
2. View-source on the home page contains two `<script type="application/json">` blocks with escaped content; an XSS payload in a featured video's title appears as escaped text and does not execute.
3. `useFeaturedMedia` does not fire a network request on first paint when SSR seeding is present (verified via the Network panel and the U1 test).
4. Carousel arrows and dots paginate correctly; arrows disable at boundaries; dots reflect active page; no auto-rotation occurs (verified by leaving the page idle for 60s).
5. Description expand/collapse works on the hero and on each section row; `aria-expanded` updates correctly.
6. All new tests pass (`uv run python manage.py test files.tests.test_index_revamp_initial_data files.tests.test_index_revamp_security` for backend; `cd frontend && npm test -- features/home` for frontend).
7. No new console errors or warnings on dev-server load.
8. Lighthouse a11y score on the home page does not regress relative to current legacy home.
9. The Vite build emits a separate chunk for `media-player`; the home entry's main chunk does not contain video.js. Verified via `make frontend-build` and inspecting the manifest / chunk names.
10. Architecture contract tests pass: no `forwardRef`, no eager `MediaPlayer` import, no boolean-mode props on `SectionRow` / `Carousel`, `PROVISIONAL_CATEGORIES` declared at module scope.
