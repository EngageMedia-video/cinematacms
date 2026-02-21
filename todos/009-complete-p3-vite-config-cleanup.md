---
status: pending
priority: p3
issue_id: "009"
tags: [code-review, simplicity, vite-migration]
dependencies: []
---

# Vite Config and Code Cleanup (~40 LOC)

## Problem Statement

Several small simplification opportunities were identified across the migration codebase. Individually minor, they collectively reduce ~40 lines of unnecessary code.

## Findings

**Source: Code Simplicity Reviewer**

1. **`sourcemap: false` in vite.config.js line 54**: This is the Vite default. Explicitly setting it communicates nothing. Remove it.

2. **Dead code in `_helpers.js` lines 5, 11**: Two commented-out lines referencing a non-existent `PageFooter` (wrong import path anyway). Remove.

3. **`void 0 !== x` patterns in `_helpers.js` lines 13, 25**: Webpack-era pattern to avoid `undefined` redefinition. In modern ESM, just use `undefined` or truthy checks.

4. **Redundant rounded corners CSS in `root.html` lines 56-68**: The `{% if not USE_ROUNDED_CORNERS %}` block sets `border-radius: 0` which is already the browser default. Remove entirely. (Pre-existing, not migration-related.)

5. **Orphaned `browserslist` in `package.json`**: Vite ignores browserslist for JS transpilation. Either remove or add comment that it only affects CSS autoprefixer.

## Proposed Solutions

Apply all cleanups in a single commit.

- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] `sourcemap: false` removed
- [ ] Dead comments removed from _helpers.js
- [ ] `void 0 !==` replaced with standard checks
- [ ] Redundant rounded corners CSS removed
- [ ] browserslist annotated or removed
- [ ] Build succeeds, E2E tests pass

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review | Found by Code Simplicity Reviewer agent |
