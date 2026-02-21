---
status: pending
priority: p3
issue_id: "014"
tags: [code-review, architecture, tech-debt]
dependencies: []
---

# Modernize videojs-markers UMD Wrapper + Consolidate Sub-Packages

## Problem Statement

`videojs-markers.js` uses a legacy UMD wrapper format that will become increasingly fragile under Vite. Additionally, the `@mediacms/media-player` and `vjs-plugin` sub-packages maintain independent Rollup/Babel toolchains separate from Vite, creating a two-build-system maintenance burden.

## Findings

**Source: Architecture Strategist**

1. `frontend/src/static/js/components/videojs-marker/videojs-markers.js` uses UMD (`typeof define === "function" && define.amd`)
2. Works under Vite because pre-bundler converts to ESM, but is legacy
3. `frontend/packages/media-player/` has its own Rollup build (acknowledged in ADR-001)
4. `frontend/packages/vjs-plugin/` has independent build

## Proposed Solutions

Track as tech debt. Convert videojs-markers to ESM and plan sub-package consolidation into Vite build.

- **Effort**: Large
- **Risk**: Medium

## Acceptance Criteria

- [ ] videojs-markers.js converted to ESM format
- [ ] Sub-package builds evaluated for Vite consolidation

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review | Found by Architecture Strategist agent |
