---
status: pending
priority: p3
issue_id: "010"
tags: [code-review, simplicity, vite-migration]
dependencies: []
---

# safeDispatch Over-Engineered for Single Call Site

## Problem Statement

`frontend/src/static/js/utils/safeDispatch.js` (24 lines) implements a queue-and-drain mechanism with nested try/catch, but is only used in one place: `_PageActions.js` line 18. This is over-engineering for a single call site.

## Findings

**Source: Code Simplicity Reviewer + Agent-Native Reviewer**

- 41 `Dispatcher.dispatch` call sites in codebase, only 1 uses safeDispatch
- The queue/drain/try-catch mechanism is unnecessary when deferring individual actions
- Inner try/catch silently swallows dispatch errors (dangerous)

## Proposed Solutions

### Solution A: Inline setTimeout in _PageActions.js (Recommended)

```javascript
export function addNotification(notification, notificationId) {
    setTimeout(() => Dispatcher.dispatch({
        type: 'ADD_NOTIFICATION',
        notification,
        notificationId,
    }), 0);
}
```

Delete `safeDispatch.js` entirely. 24 lines removed, 1 file deleted.

- **Effort**: Small
- **Risk**: Low

### Solution B: Keep but simplify

Remove the inner try/catch and reduce to 13 lines. Only if more call sites are expected soon.

## Acceptance Criteria

- [ ] safeDispatch.js removed (or simplified)
- [ ] Notification dispatches still work
- [ ] No "dispatch in the middle of a dispatch" errors

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review | Found by Code Simplicity Reviewer agent |
