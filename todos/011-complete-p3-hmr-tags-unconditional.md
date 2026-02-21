---
status: pending
priority: p3
issue_id: "011"
tags: [code-review, security, vite-migration]
dependencies: []
---

# Vite HMR Tags Unconditionally in Production Templates

## Problem Statement

`{% vite_react_refresh %}` and `{% vite_hmr_client %}` in `root.html` lines 23-24 are unconditionally rendered. While `django_vite` outputs empty strings when `dev_mode=False`, accidental `VITE_DEV_MODE=True` in production would inject WebSocket connections to localhost:5173.

## Findings

**Source: Security Sentinel (MEDIUM-01)**

- `dev_mode` controlled by env var `VITE_DEV_MODE` (good)
- But no template-level guard as defense-in-depth
- Accidental activation would cause WebSocket connection attempts

## Proposed Solutions

Wrap HMR tags in template conditional:

```html
{% if VITE_DEV_MODE %}
    {% vite_react_refresh %}
    {% vite_hmr_client %}
{% endif %}
```

Pass `VITE_DEV_MODE` through context processor.

- **Effort**: Small
- **Risk**: None

## Acceptance Criteria

- [ ] HMR tags wrapped in conditional
- [ ] Dev mode still works with `VITE_DEV_MODE=True`
- [ ] Production has no HMR-related output

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review | Found by Security Sentinel agent |
