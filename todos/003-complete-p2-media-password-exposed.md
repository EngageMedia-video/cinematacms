---
status: pending
priority: p2
issue_id: "003"
tags: [code-review, security, pre-existing]
dependencies: []
---

# Media Restriction Password Exposed in Page Source

## Problem Statement

When a user is authorized to view restricted media, the media's plaintext password is directly interpolated into a `<script>` block in the HTML source. Any XSS vulnerability, browser extension, or View Source inspection can read it. Passwords containing quotes/backslashes create an XSS injection point.

**Pre-existing issue** -- not introduced by the Vite migration, but surfaced during security audit.

## Findings

**Source: Security Sentinel (CRITICAL-01)**

File: `templates/cms/media.html`, lines 134-138:
```javascript
let password = "{{media_object.password}}"
MediaCMS.provided_password = password
```

Risks:
1. Password visible in View Source / DevTools
2. Any XSS can exfiltrate the password
3. Browser extensions and network proxies can capture it
4. Password like `"; alert(1);//` would break out of the string (XSS injection)

## Proposed Solutions

### Solution A: Use Django's json_script filter (Recommended)

```html
{{ media_object.password|json_script:"media-password" }}
<script>
  MediaCMS.provided_password = JSON.parse(
    document.getElementById('media-password').textContent
  );
</script>
```

- **Pros**: Auto-escapes for JS context (prevents XSS), minimal change
- **Cons**: Password still in DOM (in a `<script type="application/json">` tag)
- **Effort**: Small
- **Risk**: Low

### Solution B: Server-side session variable

Store password in Django session, deliver via API call instead of page source.

- **Pros**: Password never appears in HTML source at all
- **Cons**: Requires API endpoint changes, more complex
- **Effort**: Medium
- **Risk**: Low

## Recommended Action

<!-- Fill during triage -->

## Technical Details

- **Affected files**: `templates/cms/media.html`
- **Components**: Media viewing page

## Acceptance Criteria

- [ ] Password not visible in raw HTML source
- [ ] Password containing `"`, `'`, `\`, `<script>` does not cause XSS
- [ ] Restricted media access still works correctly

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review | Found by Security Sentinel agent (pre-existing) |
