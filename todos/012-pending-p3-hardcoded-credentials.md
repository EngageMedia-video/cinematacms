---
status: pending
priority: p3
issue_id: "012"
tags: [code-review, security, pre-existing]
dependencies: []
---

# Hardcoded Credentials in local_settings.py

## Problem Statement

`cms/local_settings.py` contains a hardcoded fallback `SECRET_KEY` (line 11) and Gmail SMTP credentials (lines 152-153). If production falls back to the default SECRET_KEY, session cookies and CSRF tokens become predictable.

**Pre-existing issue** -- not introduced by the Vite migration.

## Findings

**Source: Security Sentinel (LOW-01 + LOW-02)**

1. `SECRET_KEY = os.getenv("SECRET_KEY", "ma!s3^b-cw!...")` -- deterministic fallback
2. `EMAIL_HOST_PASSWORD = "iwitjnxdpotphmri"` -- Gmail app password in source
3. `EMAIL_HOST_USER = "dev.mfakhrulrozi@gmail.com"` -- committed to version control

## Proposed Solutions

1. Remove SECRET_KEY fallback: `SECRET_KEY = os.environ["SECRET_KEY"]` (fail hard if missing)
2. Move email credentials to env vars
3. Rotate the Gmail app password immediately

- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] No hardcoded SECRET_KEY fallback
- [ ] No hardcoded email credentials
- [ ] App password rotated

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-02-21 | Created from code review | Found by Security Sentinel agent (pre-existing) |
