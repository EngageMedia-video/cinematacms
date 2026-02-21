---
status: pending
priority: p1
issue_id: "001"
tags: [code-review, performance, architecture, vite-migration]
dependencies: []
---

# Video.js Double-Loading (~1.2MB Wasted Per Page)

## Problem Statement

Video.js is loaded **twice** on every page: once via CDN `<script>` tag in `root.html` (567KB) and again bundled inside the `MediaDurationInfo` Vite chunk (684KB). This wastes ~700KB of bandwidth per page load and introduces a **version mismatch** (CDN loads 7.20.2, npm bundle resolves to 7.21.7).

This is the single most impactful performance issue introduced by the Vite migration.

## Findings

**Source: Architecture Strategist + Performance Oracle**

1. `templates/root.html` lines 85-90 load `video.min.js` via CDN or static fallback (7.20.2)
2. `frontend/src/static/js/components/-NEW-/VideoPlayer.js` line 4 does `import videojs from 'video.js'` which Vite resolves and **bundles** into the output
3. The `MediaDurationInfo-BeK0O3iQ.js` chunk is 684KB raw and contains 117 `registerComponent` and 12 `registerPlugin` calls from video.js core
4. This chunk loads on **every page** that shows media items (essentially all 27 entries)
5. Version skew: CDN=7.20.2, npm=7.21.7, vendored fallback=7.20.2
6. Total duplication: ~1.2MB raw JS, ~350KB gzipped

## Proposed Solutions

### Solution A: Mark video.js as external in Vite config (Recommended)

In `frontend/vite.config.js`, add to `build.rollupOptions`:

```javascript
external: ['video.js'],
output: {
    globals: { 'video.js': 'videojs' },
}
```

This makes `import videojs from 'video.js'` resolve to `window.videojs` at runtime.

- **Pros**: Eliminates duplication entirely, MediaDurationInfo chunk shrinks from 684KB to ~100KB, zero code changes needed in components
- **Cons**: Tight coupling to CDN global; if CDN fails, bundled code also breaks
- **Effort**: Small (1 file, 3 lines)
- **Risk**: Low -- video.js was always loaded as a global before the Vite migration

### Solution B: Remove CDN script tag, keep bundled video.js

Remove the `<script>` tag from `root.html` and let Vite's bundled video.js be the single source.

- **Pros**: Single source of truth, modern ESM loading
- **Cons**: Larger initial bundle (684KB), loses CDN caching benefit, requires testing all pages
- **Effort**: Small
- **Risk**: Medium -- must verify no code depends on `window.videojs` global

### Solution C: Lazy-load video.js only on media pages

Use dynamic `import()` for video.js so it only loads on pages that actually need the player.

- **Pros**: Pages without video (categories, tags, members) don't load video.js at all
- **Cons**: Higher complexity, loading spinner needed, requires refactoring VideoPlayer component
- **Effort**: Large
- **Risk**: Medium

## Recommended Action

Solution A -- mark as external. This is the lowest-risk, highest-impact fix.

Also reconcile versions: pin CDN, npm, and vendored copy to the same version (7.20.2 or 7.21.7).

## Technical Details

- **Affected files**: `frontend/vite.config.js`, `package.json` (version pinning)
- **Affected components**: All pages loading MediaDurationInfo chunk
- **Database changes**: None

## Acceptance Criteria

- [ ] `MediaDurationInfo` chunk size < 150KB (currently 684KB)
- [ ] Video playback works on media pages
- [ ] No `window.videojs` version mismatch warnings in console
- [ ] CDN version matches npm version matches vendored fallback version
- [ ] Build succeeds with `npm run build`
- [ ] E2E tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review | Found by Performance Oracle + Architecture Strategist agents |

## Resources

- Architecture Strategist review: Section 2.3 "Video.js: CDN Global vs. Vite ES Modules"
- Performance Oracle analysis: Index page resource loading (22 HTTP requests from Vite + 7 from root.html)
- Vite rollupOptions.external docs: https://vitejs.dev/config/build-options#build-rollupoptions
