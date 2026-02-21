---
status: pending
priority: p2
issue_id: "005"
tags: [code-review, security, pre-existing]
dependencies: []
---

# Clickjacking via X_FRAME_OPTIONS = "ALLOWALL"

## Problem Statement

`X_FRAME_OPTIONS = "ALLOWALL"` disables clickjacking protection. Any external site can embed CinemataCMS pages in an `<iframe>` and overlay transparent UI to trick users into performing unintended actions.

**Pre-existing issue** -- not introduced by the Vite migration.

## Findings

**Source: Security Sentinel (MEDIUM-02)**

- File: `cms/settings.py` line 477
- Attack: External site frames CinemataCMS, overlays invisible buttons to trick clicks on "delete", "like", "upload" actions
- The embed page legitimately needs framing; other pages do not

## Proposed Solutions

### Solution A: DENY with per-view exemption (Recommended)

```python
# In settings.py
X_FRAME_OPTIONS = "DENY"

# In the embed view
from django.views.decorators.clickjacking import xframe_options_exempt

@xframe_options_exempt
def embed_view(request):
    ...
```

- **Effort**: Small
- **Risk**: Low (only embed page needs framing)

## Acceptance Criteria

- [ ] `X_FRAME_OPTIONS = "DENY"` in settings
- [ ] Embed page (`/embed`) still works in iframes
- [ ] Other pages cannot be framed

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review | Found by Security Sentinel agent (pre-existing) |
