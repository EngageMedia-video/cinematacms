---
status: pending
priority: p2
issue_id: "004"
tags: [code-review, security, pre-existing]
dependencies: []
---

# CORS Wildcard Origin (CORS_ORIGIN_ALLOW_ALL = True)

## Problem Statement

`CORS_ORIGIN_ALLOW_ALL = True` responds with `Access-Control-Allow-Origin: *` on every response. This allows any domain to read API responses (media metadata, user profiles, search results) and exposes internal API structures for reconnaissance.

**Pre-existing issue** -- not introduced by the Vite migration.

## Findings

**Source: Security Sentinel (HIGH-02)**

- File: `cms/settings.py` line 15 and `cms/local_settings.py` line 80
- Any domain can read unauthenticated API responses
- If `Access-Control-Allow-Credentials: true` is ever added, becomes full auth bypass

## Proposed Solutions

### Solution A: Explicit origin allowlist in production

```python
CORS_ORIGIN_ALLOW_ALL = False
CORS_ALLOWED_ORIGINS = [
    "https://cinemata.org",
    "https://www.cinemata.org",
]
```

- **Effort**: Small
- **Risk**: Low (may break legitimate cross-origin consumers if any exist)

## Acceptance Criteria

- [ ] `CORS_ORIGIN_ALLOW_ALL = False` in production settings
- [ ] `CORS_ALLOWED_ORIGINS` lists only authorized domains
- [ ] Embed functionality still works cross-origin

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review | Found by Security Sentinel agent (pre-existing) |
