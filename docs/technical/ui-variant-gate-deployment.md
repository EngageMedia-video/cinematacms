# UI Variant Gate Deployment Setup

This guide covers deployment for the server-side UI variant gate introduced on the `feat/ui-variant-gate` line and updated in commit `ccd08f2` (`fix: Logic for handling ui variant improved`).

It assumes the current gate behavior is:

- `legacy` is the effective fallback for normal traffic when both variants are allowed
- `revamp` is served only when the page key is present in `UI_VARIANT_REVAMP_PAGES`
- staff users can preview `revamp` with `?ui=revamp`
- non-staff requests cannot force `revamp`

## Relevant Files

- `cms/ui_variant.py`
- `cms/settings.py`
- `tests/test_ui_variant.py`
- `templates/cms/index.html`
- `templates/cms/index_revamp.html`
- `files/views.py`

## Deployment Goal

Ship the gate in a dormant state first, then enable the revamp per page through an allowlist without requiring another code deploy.

## Recommended Production Configuration

Add or override the gate settings in `cms/local_settings.py`:

```python
# UI variant gate
UI_VARIANT_ALLOWED = ["legacy", "revamp"]

# Recommended explicit production fallback even though the resolver already
# treats legacy as authoritative when both tracks are allowed.
UI_VARIANT_DEFAULT = "legacy"

# Start empty for a no-risk deploy. Add page keys only when ready to roll out.
UI_VARIANT_REVAMP_PAGES = []
```

Production should also ensure Vite dev mode is disabled:

```bash
export VITE_DEV_MODE=false
```

or simply leave `VITE_DEV_MODE` unset.

## First-Time Rollout Setup

1. Deploy the branch or commit containing the UI variant gate.
2. Apply the production settings override shown above.
3. Keep `UI_VARIANT_REVAMP_PAGES = []` for the initial release.
4. Build frontend assets so both `index.js` and `index-revamp.js` are present in the Vite manifest.
5. Run the focused UI variant test module before restarting services.

## Build and Deploy Commands

From the project root:

```bash
uv sync
cd frontend && npm ci && cd ..
./scripts/build_frontend.sh
uv run manage.py test tests.test_ui_variant
```

Notes:

- `./scripts/build_frontend.sh` builds the frontend packages, runs the main Vite build, and runs `collectstatic`
- if your deployment pipeline already runs the equivalent steps, keep using that pipeline
- if you prefer Make targets, `make frontend-build` is the closest equivalent

## Service Restart

After a successful build and test pass, restart the app services used in your environment. In deployments based on the checked-in service files, that usually means the web app plus any related worker services:

```bash
sudo systemctl restart mediacms
sudo systemctl restart nginx
```

If your environment uses a different process manager or container runtime, use the platform-native restart step instead.

## Smoke Test Checklist

Run these checks against the deployed environment:

1. Anonymous request to `/` returns the legacy homepage when `UI_VARIANT_REVAMP_PAGES = []`.
2. Staff request to `/?ui=revamp` returns the revamp homepage.
3. Non-staff request to `/?ui=revamp` still returns legacy.
4. Page HTML includes `data-ui-variant="legacy"` for normal traffic.
5. Staff preview HTML includes `data-ui-variant="revamp"`.
6. Browser dev tools show Vite assets loading successfully with no missing manifest or missing entry errors.

Useful quick checks:

```bash
curl -I https://your-domain.example/
curl -s https://your-domain.example/ | rg 'data-ui-variant'
```

Staff preview should be checked from an authenticated browser session because the preview gate depends on `request.user.is_staff`.

## Rollout Procedure

### Phase 1: Safe Deploy

Deploy with:

```python
UI_VARIANT_REVAMP_PAGES = []
```

Result:

- all normal traffic remains on `legacy`
- staff can still preview `revamp` with `?ui=revamp`

### Phase 2: Enable the Pilot Page

When ready, update:

```python
UI_VARIANT_REVAMP_PAGES = ["home"]
```

Then reload the app configuration using your normal deploy or restart path.

Result:

- homepage traffic serves `templates/cms/index_revamp.html`
- other pages remain unchanged unless they are added to the allowlist in future work

### Phase 3: Expand the Allowlist

As additional page keys are implemented in `UI_VARIANT_PAGES`, add them one at a time:

```python
UI_VARIANT_REVAMP_PAGES = ["home", "next_page_key"]
```

Keep rollout increments small so visual or performance regressions are easy to isolate.

## Rollback Procedure

### Fast Rollback

Remove the page key from the allowlist:

```python
UI_VARIANT_REVAMP_PAGES = []
```

Then restart or redeploy config only.

This is the preferred rollback path because it avoids a code revert and immediately returns traffic to `legacy`.

### Full Rollback

If the gate itself must be disabled more broadly:

```python
UI_VARIANT_ALLOWED = ["legacy"]
UI_VARIANT_DEFAULT = "legacy"
UI_VARIANT_REVAMP_PAGES = []
```

This leaves only the legacy track enabled.

## Logging and Monitoring

Watch application logs after deploy for:

- warnings like `UI_VARIANT_DEFAULT='...' not in UI_VARIANT_ALLOWED`
- template asset failures from `django-vite`
- unexpected 500s on `/`

It is also worth watching:

- homepage error rate
- homepage response time
- frontend asset 404s under `/static/assets/`

## Common Failure Modes

### Revamp Template Fails to Load Assets

Cause:

- frontend build did not include `src/entries/index-revamp.js`
- `collectstatic` was skipped
- Vite manifest path is stale or missing

Checks:

```bash
ls frontend/build/production/static/.vite/manifest.json
rg 'index-revamp' frontend/build/production/static/.vite/manifest.json
```

### Revamp Appears for Everyone Unexpectedly

Cause:

- `UI_VARIANT_REVAMP_PAGES` includes `"home"`
- local settings drifted from the recommended production fallback

Checks:

- inspect the final values loaded from `cms/local_settings.py`
- confirm the running release includes the allowlist-aware resolver from `cms/ui_variant.py`

### Staff Preview Does Not Work

Cause:

- authenticated user is not marked `is_staff`
- request is being tested anonymously with `curl`

Check in Django shell:

```bash
uv run manage.py shell
```

```python
from users.models import User
User.objects.filter(username="your-admin-user").values("username", "is_staff")
```

## Verification Command

Use the focused regression suite shipped with the gate:

```bash
uv run manage.py test tests.test_ui_variant
```

This covers:

- legacy default behavior
- allowlisted revamp behavior
- staff preview behavior
- non-staff preview rejection
- invalid default fallback behavior
- hermetic Vite-backed view rendering

