---
status: pending
priority: p2
issue_id: "006"
tags: [code-review, security, pre-existing]
dependencies: []
---

# No Content Security Policy (CSP) Configured

## Problem Statement

No `Content-Security-Policy` header is configured. The Vite migration changes the script loading model to ES modules (`<script type="module">`), making CSP implementation both more important and more feasible. Without CSP, there is no browser-side XSS mitigation, and 15+ `dangerouslySetInnerHTML` usages in React components are unprotected.

## Findings

**Source: Security Sentinel (MEDIUM-03)**

- No CSP middleware or headers found in Django settings
- Multiple `dangerouslySetInnerHTML` usages (Comments, SearchField, SidebarBottom, ProfilePage, ViewerInfoContent)
- Inline `<script>` blocks exist (Matomo tracker, CSRF handlers, config injection)
- ES modules require `script-src` to allow the static domain

## Proposed Solutions

### Solution A: Implement django-csp in report-only first (Recommended)

```python
# Start with report-only mode
CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = ("'self'", "https://vjs.zencdn.net", "https://cdnjs.cloudflare.com", "https://matomo.engagemedia.org")
CSP_STYLE_SRC = ("'self'", "'unsafe-inline'", "https://fonts.googleapis.com")
CSP_FONT_SRC = ("'self'", "https://fonts.gstatic.com")
CSP_IMG_SRC = ("'self'", "data:", "https:")
CSP_CONNECT_SRC = ("'self'", "https://matomo.engagemedia.org")
```

- **Effort**: Medium
- **Risk**: Low in report-only mode; medium when enforcing

## Acceptance Criteria

- [ ] `Content-Security-Policy-Report-Only` header present on responses
- [ ] No CSP violations in console for normal page operations
- [ ] Matomo, Video.js, and Material Icons load correctly under CSP

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review | Found by Security Sentinel agent |
