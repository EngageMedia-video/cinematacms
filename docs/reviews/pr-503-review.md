# PR #503 Review: feat(files): harden password-restricted video mechanism

- **PR**: https://github.com/EngageMedia-video/cinematacms/pull/503
- **Author**: @adryanev
- **Branch**: `feature/harden-password-restricted-video` → `main`
- **Size**: +2515 / -475 across 25 files (18 commits)
- **Reviewer**: local senior staff review (not posted to GitHub)

---

## Risk summary

This is a security-critical replacement of the password-restricted video mechanism: plaintext-at-rest → hashed; `?password=` URL params → opaque Redis-backed `?token=` tokens with 4h TTL; HLS manifest rewriting on the server; brute-force rate limiting; embed auth. The change-shape is appropriate for the problem and the test coverage is solid: the added test files contain 77 test methods.

Blast radius on production is non-trivial: every active viewer of restricted media will be re-prompted for the password on deploy, and any monitoring or runbook that watched the old `?password=` paths needs updating. The change is reversible only in the sense that the password column is widened to 256 chars (the migration is forward-compatible), but the `hash_media_passwords` management command is destructive — once run, plaintexts cannot be recovered. Backup discipline is the user's responsibility and is called out in the PR body.

I'd ship this once the rate-limit-IP behavior is either made proxy-aware or explicitly verified against the real production request path. Everything else is consider-tier.

## Top concerns

1. **Rate limiter uses `REMOTE_ADDR` directly** — this is true in `files/views.py`. The earlier claim that production nginx always makes this `127.0.0.1` is not proven by the repo: `deploy/uwsgi_params` passes nginx `$remote_addr` through as `REMOTE_ADDR`. The risk is still real if production has nginx behind a load balancer, CDN, or another reverse proxy without real-IP normalization, because the lockout can collapse to the proxy IP. See finding F1 below.
2. **Tokens in URL query strings** have known leak paths, especially nginx access logs and tokenized embed/direct URLs. The earlier claim that the whitepaper does not call out nginx log leakage is false: it already lists "No NGINX log scrubbing" as an accepted residual risk. The remaining useful action is operational: decide whether token-bearing requests should have query strings scrubbed or logging disabled. See finding F2.

## Inline findings (consolidated)

Backend (5):
- F1 `[should-fix / verify]` `files/views.py` — rate-limit IP source
- F2 `[consider, partially stale]` `files/secure_media_views.py` / ops docs — token-in-URL log leakage
- F3 `[consider]` `files/models.py` — defense-in-depth `save()` guard interaction with `set_password`
- F4 `[mostly addressed]` `files/secure_media_views.py` — permission-cache invalidation across token variants
- F5 `[question]` `files/secure_media_views.py` — `_calculate_access_permission` private-state fall-through

Frontend (1):
- F6 `[consider]` `frontend/src/static/js/components/MediaViewer/VideoViewer/index.js` — Prettier-style reformatting bundled with security logic changes

Other (1):
- F7 `[nit]` `files/views.py` `embed_media` — 401 response lacks `Cache-Control: no-store`

**Recommendation**: approve-with-fixes. F1 should be addressed before merge, or production topology should be verified and documented if `REMOTE_ADDR` is already the real client IP. F2 is already covered in the whitepaper for nginx logs, but may still need an operational logging/runbook decision. F3-F7 are non-blocking.

---

## Findings

### F1. `[should-fix / verify]` Rate limiter uses proxy-sensitive `REMOTE_ADDR`

**File**: `files/views.py` (the post-rebase line will differ; in the diff this is the new block in `view_media`, around the rate-limit handling for restricted media)

```python
ip = request.META.get("REMOTE_ADDR", "")
...
if not check_rate_limit(ip, media.friendly_token):
    rate_limited = True
```

Fact: the new password-submission rate limiter uses `request.META["REMOTE_ADDR"]` directly. The rate-limit key is built from that IP and the media friendly token, with defaults of 5 failed attempts in a 15-minute window.

The original review overstated the deployment fact. The repo's nginx/uWSGI config passes nginx `$remote_addr` through as `REMOTE_ADDR`, so if nginx is directly receiving client traffic, Django will see the client IP, not necessarily `127.0.0.1`. The global-lockout failure mode becomes real when production nginx sits behind a load balancer, CDN, or another reverse proxy and nginx is not configured to normalize the real client IP.

The codebase does already contain a proxy-aware pattern in `cms/urls.py:14-18`:

```python
# Primary access control: nginx should restrict /metrics to localhost.
# This Django check is defense-in-depth using the real client IP
# (X-Forwarded-For set by nginx) rather than REMOTE_ADDR which is
# always 127.0.0.1 behind a reverse proxy.
client_ip = request.META.get("HTTP_X_FORWARDED_FOR", "").split(",")[0].strip()
if not client_ip:
    client_ip = request.META.get("REMOTE_ADDR", "")
```

Potential effect if `REMOTE_ADDR` is the proxy address: the rate-limit key collapses to something like `cinemata_media_token:pw_attempts:<proxy-ip>:<friendly_token>` for many or all clients. Five wrong password attempts from one visitor could then lock out other visitors of that media for 15 minutes. This is a denial-of-service risk against legitimate users and weakens the brute-force protection it's meant to provide.

Suggested fix — extract the same helper used at `cms/urls.py:14-18` into a small util (e.g., `cms.permissions.get_client_ip(request)`) and reuse it both there and in the new rate-limit code. Add a setting like `TRUSTED_PROXIES`, or document that only nginx can reach Django, so `X-Forwarded-For` is not blindly trusted from direct clients.

```python
# Suggestion: replace
ip = request.META.get("REMOTE_ADDR", "")

# with
from cms.permissions import get_client_ip  # new helper consolidated from cms/urls.py
ip = get_client_ip(request)
```

If you don't want to refactor right now, inlining the same X-Forwarded-For-then-REMOTE_ADDR fallback used in `cms/urls.py` is acceptable and consistent with current convention, provided the deployment boundary that makes `X-Forwarded-For` trustworthy is clear.

Tests `test_token_utils.py` exercise `check_rate_limit` and `record_failed_attempt` with explicit IP strings, so the unit tests still pass without a real proxy. Worth adding a view-level test that simulates the chosen proxy header behavior, plus a short deployment note describing whether production expects `REMOTE_ADDR` or `X-Forwarded-For` to be canonical.

---

### F2. `[consider, partially stale]` Tokens in URL query strings: log leakage

**Files**: `files/secure_media_views.py` (manifest rewriting), `docs/security/whitepaper-harden-password-restricted-video.md`

The PR moves from `?password=<plaintext>` to `?token=<opaque>`. That eliminates the worst leak (a stolen URL no longer reveals the password), but tokens still ride in URL query strings for `.m3u8`, `.ts` segments, and the API. That means tokens appear in:

- nginx access logs (default `combined` format includes the full query string)
- Local proxies / corporate logging
- Browser history/bookmarks only when the user opens or shares a tokenized top-level URL, such as an embed/direct/API URL. Normal HLS segment subrequests are not normally browser-history entries.

The `Referrer-Policy: same-origin` change closes third-party referer leakage — that part is good.

Correction to the original review: the whitepaper already calls out nginx access-log leakage as an accepted residual risk in "No NGINX log scrubbing." So this is not a missing whitepaper threat-model item.

If you want to go further (probably out of scope for this PR), API/fetch calls could use a normal custom auth header and reserve URL tokens for native media/HLS paths that cannot reliably send application headers. The earlier suggestion of a `Sec-Fetch-Dest`-style auth header was wrong: `Sec-Fetch-*` headers are browser-controlled request metadata, not an application authentication channel.

For this PR: no whitepaper change is required for nginx log risk. The remaining optional action is adding a one-line nginx/log-shipping recommendation to operational notes: scrub query params for token-bearing paths, or disable access logging where practical.

---

### F3. `[consider]` `Media.save()` defense-in-depth guard interaction

**File**: `files/models.py:404-415`

```python
# Defense-in-depth: hash plaintext passwords that bypassed set_password()
if self.password:
    from django.contrib.auth.hashers import identify_hasher

    try:
        identify_hasher(self.password)
    except ValueError:
        # Password is plaintext — hash it
        from django.contrib.auth.hashers import make_password

        self.password = make_password(self.password)
```

The intent is correct: catch any code path that sets `password = "plaintext"` directly on the instance and bypasses `set_password()` or the form. `identify_hasher` is the right primitive.

One subtle thing worth confirming with a test: `identify_hasher` parses the prefix of the string (e.g., `pbkdf2_sha256$...`). A user who submits a string starting with `pbkdf2_sha256$<garbage>` as their literal password through *any* code path that bypasses `MediaForm.clean()` would have that string passed through unhashed by this guard. The form's `clean()` short-circuits this by always calling `make_password()` for new passwords (which is correct), and the management command also uses `identify_hasher` for idempotency.

The risk surface is small (admin shell, programmatic create, future code paths), but if you want belt-and-suspenders here, add a test that creates a Media with `password="pbkdf2_sha256$attacker_supplied"` directly via `Media.objects.create(...)` and asserts that a subsequent `check_password("attacker_supplied", media.password)` is False. If that test fails, document the constraint in `set_password`'s docstring: "All callers must use set_password() or the form; direct assignment is not safe even with the save() guard."

Not a blocker; the realistic exploit path requires admin-shell access, in which case the attacker has bigger options.

---

### F4. `[mostly addressed]` Permission cache invalidation across token variants

**File**: `files/secure_media_views.py` `check_media_access_permission`

```python
if media.state == "restricted":
    query_token = request.GET.get("token")
    session_token = request.session.get(f"media_token_{media.friendly_token}")
    token_material = query_token or session_token or "no_token"
    token_hash = hashlib.blake2b(token_material.encode("utf-8"), digest_size=6).hexdigest()
    additional_data = f"restricted:{token_hash}"

cache_key = get_permission_cache_key(user_id, media.uid, additional_data)
```

The Django permission cache is effectively keyed by `(user_id, media_uid, token-derived hash)`. For a popular restricted video with thousands of viewers, this can fragment into thousands of cache entries.

When a password changes:
1. `invalidate_media_tokens` deletes the Redis tokens (good).
2. `_invalidate_permission_cache` calls `clear_media_permission_cache(self.uid)`.

Correction to the original review: `clear_media_permission_cache` has now been checked. For all-user invalidation it uses the pattern `cinemata_media_permission:media_permission:*:<media_uid>*` when `django-redis` exposes `delete_pattern`, which should cover all restricted token variants because the actual restricted key shape is `media_permission:{user_id}:{media_uid}:{data_hash}`. It is not keyed as the literal string `restricted:<token_hash>`; that token material is hashed before it reaches the cache key.

The real caveat is the fallback path: if `delete_pattern` is unavailable, restricted variants cannot be enumerated and may live until `RESTRICTED_MEDIA_CACHE_TIMEOUT` (currently 60s). Production settings use `django_redis.cache.RedisCache`, so this is mostly addressed for the expected deployment.

Optional action: add an integration test that asserts password change invalidates an already-cached restricted-token permission on the next call, not after cache TTL. If the test passes, this finding is moot.

---

### F5. `[question]` `_calculate_access_permission` shape

**File**: `files/secure_media_views.py:51-79`

```python
def _calculate_access_permission(request, media: Media) -> bool:
    user = request.user

    if user.is_authenticated and user_has_elevated_access(user, media):
        return True

    if media.state == "restricted":
        # ... token check
        return ...

    if not user.is_authenticated:
        return False

    if media.state == "private":
        return False

    return False
```

The function is only ever called with `media.state in ("restricted", "private")` because `check_media_access_permission` short-circuits public/unlisted at line 87. The trailing `if not user.is_authenticated: return False` and `if media.state == "private": return False` blocks both end up at `return False` for any non-elevated user, which is what we want — but reading it, the structure suggests the function might be called with arbitrary states. Two clarifications welcome:

- Is the intent that this function should also handle `unlisted`/`public` if a future refactor calls it directly, or is the public/unlisted fast-path part of the contract?
- Could the body collapse to:

  ```python
  if user.is_authenticated and user_has_elevated_access(user, media):
      return True
  if media.state == "restricted":
      # token check
      ...
  return False
  ```

  ...without behavior change? If so, that's both shorter and clearer about the assumption.

Not a correctness concern; just a readability question.

---

### F6. `[consider]` Logic + reformatting in the same diff

**File**: `frontend/src/static/js/components/MediaViewer/VideoViewer/index.js`

The core security change in this file is small: three call sites swapped `MediaCMS.provided_password` for `MediaCMS.access_token`. The diff is much larger because formatting and other non-whitespace edits are mixed in with that change. A whitespace-insensitive diff still shows real churn, so the original "just reformatting" framing was overstated, but the reviewability concern remains valid.

Same applies to `VideoPlayerByPageLink.js` and `EmbedPage.js` to a lesser extent.

For future security-sensitive work: if the file needs reformatting, do it as a separate prep commit (or PR) with a clear message like `style: format frontend per Prettier`, then the security commits show only the real changes. No action needed for this PR — just a process note. The commits in this branch already separate concerns reasonably (`feat(frontend): replace password with token across all components` is one commit), so a future reviewer can `git show <sha>` per commit.

---

### F7. `[nit]` Embed 401 missing cache header

**File**: `files/views.py` `embed_media`

```python
if media.state == "restricted":
    # ...
    if token and validate_token(token, media_uid):
        context["media_access_token"] = token
    else:
        return HttpResponse("Unauthorized", status=401)
```

The success path (when token validates) sets `Cache-Control: no-store` on the rendered response. The 401 path doesn't. A 401 with no `Cache-Control` is unlikely to be cached by a reasonable browser, but for consistency:

```python
else:
    resp = HttpResponse("Unauthorized", status=401)
    resp["Cache-Control"] = "no-store"
    return resp
```

Pure nit; defer or skip if you're rebasing for the F1 fix.

---

## Notable strengths (folded in for context, not standalone praise)

- Lua script for atomic token invalidation (`_INVALIDATE_LUA`) is the right primitive — eliminates a real race between SMEMBERS-then-DEL and concurrent token generation. Good call.
- Server-side `.m3u8` rewriting is necessary for Safari/iOS native HLS, and the `_append_token_to_uri` correctly skips absolute URIs to avoid leaking the token to third-party hosts in the manifest.
- `hmac.compare_digest` for the media-id binding inside `validate_token` prevents timing-leak comparison.
- The `MediaForm.clean()` change to call `make_password()` at the form layer (not waiting for the model save) is cleaner — closes the `identify_hasher` prefix-spoofing gap inside the form's own contract.
- Extracting `_calculate_access_permission` to module-level so `MediaKeyView` inherits token-based auth automatically is a nice integration design.

---

## Verification checklist before merge

- [ ] F1 fixed or verified: rate-limit uses the real client IP for the actual production proxy topology
- [ ] F2 ops decision made: nginx/log shipping either scrubs token query params or accepts the documented residual risk
- [ ] DB backup run before `python manage.py hash_media_passwords` (called out in PR body, just confirming)
- [ ] Smoke-test on staging: Safari + iOS HLS playback, Chrome desktop, embed iframe with token in URL
- [ ] Optional: add a regression test that password change clears cached restricted-token permission variants (F4)
