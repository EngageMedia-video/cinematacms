---
status: pending
priority: p2
issue_id: "008"
tags: [code-review, architecture, dead-code, vite-migration]
dependencies: []
---

# Remove Dead Demo Entry Point

## Problem Statement

`src/entries/demo.js` is defined in `vite.config.js` as a build input (line 83), but no Django template references it. This is dead code that increases build output and chunk graph complexity.

## Findings

**Source: Architecture Strategist**

- Grep confirms no template contains `{% vite_asset 'src/entries/demo.js' %}`
- The entry adds an unnecessary chunk to the manifest
- If intended for development, it should be documented or excluded from production builds

## Proposed Solutions

### Solution A: Remove from vite.config.js inputs (Recommended)

Delete the `demo` entry from `rollupOptions.input`.

- **Effort**: Small (1 line)
- **Risk**: None

## Acceptance Criteria

- [ ] `demo` removed from vite.config.js input
- [ ] Build succeeds
- [ ] No template references demo entry

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review | Found by Architecture Strategist agent |
