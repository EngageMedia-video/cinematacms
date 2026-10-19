# Configure Content Security Policy

CinemataCMS uses `django-csp==4.0` with a strict policy in **report-only mode**
by default. Browsers show violations without blocking resources. Enforcement
is an operator decision after testing the deployment's required flows.

## Configure deployment sources

Install the locked dependencies with `uv sync --frozen`. Configure the policy
through the application's environment before restarting web workers:

| Variable | Default | Purpose |
| --- | --- | --- |
| `CSP_REPORT_ONLY` | `true` | Set to `false` to enforce the policy |
| `CSP_REPORT_URI` | Empty | Optional CSP report collector URL |
| `CSP_SCRIPT_SRC` | Empty | Additional script sources |
| `CSP_STYLE_SRC` | Empty | Additional stylesheet sources |
| `CSP_IMG_SRC` | Empty | Additional image sources |
| `CSP_FONT_SRC` | Empty | Additional font sources |
| `CSP_MEDIA_SRC` | Empty | Additional audio/video sources |
| `CSP_CONNECT_SRC` | Empty | Additional fetch, upload, and WebSocket sources |
| `CSP_FRAME_SRC` | Empty | Additional iframe sources |
| `CSP_WORKER_SRC` | Empty | Additional worker sources |

Each source variable accepts a comma-separated list and **extends** the
built-in sources. Add only the origins or paths the deployment needs. For
example, an installation with external images and a separate upload service:

```dotenv
CSP_IMG_SRC=https://images.example.org
CSP_CONNECT_SRC=https://uploads.example.org
```

`cms/csp.py` builds the policy from `STATIC_URL`, `MEDIA_URL`, `UPLOAD_HOST`,
the enabled `ANALYTICS_URL`, and the configured Vite development server.
`UPLOAD_HOST` defaults to `FRONTEND_HOST` for policy construction. Vite HTTP
and WebSocket sources appear only when Vite development mode is enabled.

The policy permits the CMS's existing optional integrations: the pinned
Video.js and FineUploader CDN files, Material Icons fonts, and Google
reCAPTCHA. The configured analytics script path and connection origin are
allowed only when analytics is enabled. No installation-specific analytics,
media, upload, or production hostname is included in the CSP defaults.

The application converts these environment variables into django-csp 4's
`CONTENT_SECURITY_POLICY` and `CONTENT_SECURITY_POLICY_REPORT_ONLY` dictionaries.
The similarly named legacy django-csp 3.x settings do not configure version 4.

## Check report-only behavior

1. Keep `CSP_REPORT_ONLY=true` and restart web workers.
2. Inspect a page response. Expect `Content-Security-Policy-Report-Only` and
   no enforced CSP header.
3. Check home, search, profiles, playlists, login, signup, MFA, contact CAPTCHA,
   uploads, replacement uploads, metadata/subtitle editing, MP4/HLS playback,
   captions, embeds, maintenance pages, and the admin editor. Check both themes
   and both states of the `load_from_cdn` Waffle switch.
4. Inspect browser console and network logs for violations and failed resources.
   Correct required resources before enabling enforcement.

Report collection is optional. Without `CSP_REPORT_URI`, use browser developer
tools. The CMS does not add a public report-ingestion endpoint. Operators own
the collector, rate limits, retention, and rollout observation period. Browser
reports can contain private page URLs, media tokens, and script content; use a
collector that redacts these fields. Do not enable `report-sample`.

Some legacy HTML style attributes, rich text, and third-party editors may still
report violations. Nonces authorize `<style>` elements, not style attributes.
Move required static styles into stylesheets. For trusted dynamic DOM styling,
assign individual CSSOM properties rather than a complete `style` attribute.
Do not add `unsafe-inline` or `unsafe-eval` to bypass failures.

## Maintain trusted inline code

The policy denies unknown sources, objects, and base URLs. Trusted inline
scripts and styles use a fresh request nonce:

```django
<script nonce="{{ request.csp_nonce }}">
    // Trusted application code.
</script>
<style nonce="{{ request.csp_nonce }}">
    /* Trusted application CSS. */
</style>
```

Never add nonces to user-authored content or rewrite arbitrary response HTML
to grant it trust. Use native links or `addEventListener` instead of inline
event handlers. The CAPTCHA callback uses an external same-origin file.

The root template publishes a `csp-nonce` meta tag before React starts.
styled-jsx and trusted React style elements use that nonce. Vite's React
refresh script receives it through the template tag. Video.js runs in its
supported `VIDEOJS_NO_DYNAMIC_STYLE` mode; application CSS supplies the player
dimensions. Embedded Video.js icons require `data:` fonts; upload previews and
playback use the scoped `data:` and `blob:` sources.

Responses that generate a nonce receive `Cache-Control: private, no-store`.
Configure reverse proxies and CDNs to bypass HTML caching. Never reuse a
rendered nonce or cache the body independently of its CSP header. Responses
that do not generate a nonce retain their existing cache policy.

Normal pages permit same-origin framing. Both embed views remove only
`frame-ancestors` and retain their existing X-Frame-Options exemptions and
authorization checks.

## Enable enforcement

After required flows pass with no critical violations, set
`CSP_REPORT_ONLY=false` and restart web workers. The same policy now appears
in `Content-Security-Policy`. Repeat the deployment checks. Roll back blocking
by setting `CSP_REPORT_ONLY=true` and restarting workers.

## Verify changes

```bash
make test TEST_ARGS="cms.tests.test_csp --noinput"
make agent-check
```

See [django-csp 4 configuration](https://django-csp.readthedocs.io/en/latest/configuration.html)
and [nonce behavior](https://django-csp.readthedocs.io/en/latest/nonce.html).
