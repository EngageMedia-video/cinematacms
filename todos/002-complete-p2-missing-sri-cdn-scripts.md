---
status: pending
priority: p2
issue_id: "002"
tags: [code-review, security, supply-chain]
dependencies: []
---

# Missing Subresource Integrity (SRI) on CDN Scripts

## Problem Statement

Six CDN-loaded resources have no `integrity` or `crossorigin` attributes. If any CDN is compromised (or DNS poisoned, or MITM'd), an attacker could inject arbitrary JavaScript into every page. This is a supply-chain attack vector.

## Findings

**Source: Security Sentinel (HIGH-01)**

Affected files and resources:
1. `templates/root.html` lines 85-86: Video.js CSS + JS from `vjs.zencdn.net`
2. `templates/common/head-links.html` lines 16-17: Material Icons from `fonts.googleapis.com`
3. `templates/cms/add-media.html` lines 11-12: Fine Uploader from `cdnjs.cloudflare.com`
4. `templates/cms/edit_media.html` lines 10-11: Fine Uploader from `cdnjs.cloudflare.com`

`video.min.js` is loaded on **every page** via `root.html`, making it the highest-risk resource.

## Proposed Solutions

### Solution A: Add SRI hashes to all CDN resources (Recommended)

```html
<script src="https://vjs.zencdn.net/7.20.2/video.min.js"
        integrity="sha384-<hash>"
        crossorigin="anonymous"></script>
```

Generate hashes via `openssl dgst -sha384 -binary file.js | openssl base64 -A` or https://www.srihash.org/.

- **Pros**: Prevents supply-chain attacks, industry best practice
- **Cons**: Must update hashes when upgrading library versions
- **Effort**: Small
- **Risk**: Low

Note: Google Fonts cannot use SRI (CSS varies by User-Agent). Consider self-hosting Material Icons (already supported via `LOAD_FROM_CDN=False` path).

### Solution B: Self-host all external resources

Move all CDN resources to `static/lib/` and serve locally.

- **Pros**: Eliminates CDN dependency entirely, no SRI needed
- **Cons**: Loses CDN edge caching, increases server bandwidth
- **Effort**: Medium
- **Risk**: Low

## Recommended Action

<!-- Fill during triage -->

## Technical Details

- **Affected files**: `templates/root.html`, `templates/common/head-links.html`, `templates/cms/add-media.html`, `templates/cms/edit_media.html`

## Acceptance Criteria

- [ ] All CDN `<script>` tags have `integrity` and `crossorigin="anonymous"` attributes
- [ ] All CDN `<link>` tags (where possible) have `integrity` and `crossorigin` attributes
- [ ] Page loads correctly with SRI hashes in place

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review | Found by Security Sentinel agent |

## Resources

- SRI hash generator: https://www.srihash.org/
- MDN SRI docs: https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity
