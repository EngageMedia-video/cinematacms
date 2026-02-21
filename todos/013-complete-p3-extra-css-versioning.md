---
status: pending
priority: p3
issue_id: "013"
tags: [code-review, architecture, vite-migration]
dependencies: []
---

# Manual _extra.css Cache Versioning

## Problem Statement

`_extra.css` uses manual query-string versioning (`?v={{ EXTRA_CSS_VERSION }}`) with `EXTRA_CSS_VERSION = "1"` in settings. Developers must remember to bump this value when `_extra.css` changes. Query-string cache busting is also unreliable with some CDNs/proxies.

## Findings

**Source: Architecture Strategist + Code Simplicity Reviewer + Learnings Researcher**

- `templates/common/head-links.html` line 29-30
- `EXTRA_CSS_VERSION` in `cms/settings.py`
- Context processor at `cms/context_processors.py` line 22
- No CI check or git hook enforcing version bump

## Proposed Solutions

### Solution A: Auto-compute hash at startup

```python
import hashlib
EXTRA_CSS_VERSION = hashlib.md5(
    open(os.path.join(BASE_DIR, "static", "css", "_extra.css"), "rb").read()
).hexdigest()[:8]
```

### Solution B: Import _extra.css into Vite build

Add as side-effect import in `base.js` for automatic content hashing.

## Acceptance Criteria

- [ ] _extra.css changes automatically bust cache
- [ ] No manual version bumping required

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review | Found by Architecture Strategist + Simplicity Reviewer |
