---
status: pending
priority: p2
issue_id: "007"
tags: [code-review, architecture, simplicity, vite-migration]
dependencies: []
---

# Remove manualChunks Vendor Bundle (Premature Optimization)

## Problem Statement

The `manualChunks` config in `vite.config.js` (lines 86-97) manually forces 8 libraries into a single `vendor` chunk. Vite's Rollup-based code splitting already deduplicates shared dependencies automatically. This manual configuration is premature optimization that may actually worsen per-page chunk granularity.

## Findings

**Source: Code Simplicity Reviewer + Architecture Strategist**

- Vite automatically extracts shared chunks across 27 entry points
- Manual vendor bundle forces all 8 libraries into one chunk even for pages using only a subset
- 13 lines of unnecessary configuration
- No measured data showing default chunking is insufficient

## Proposed Solutions

### Solution A: Remove manualChunks entirely (Recommended)

Delete lines 86-97 from `frontend/vite.config.js`. The `rollupOptions` block becomes just `input: { ... }`.

- **Effort**: Small (delete 13 lines)
- **Risk**: Low -- Vite handles this automatically

## Acceptance Criteria

- [ ] `manualChunks` removed from vite.config.js
- [ ] Build succeeds
- [ ] No regression in page load performance

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review | Found by Code Simplicity Reviewer + Architecture Strategist |
