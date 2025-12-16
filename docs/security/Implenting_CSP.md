# Implementing Content Security Policy (CSP) in CinemataCMS

## Understanding the Risk

Without a Content Security Policy, browsers assume all content is safe and will execute it without question. This creates a critical vulnerability: if an attacker injects malicious code—through a compromised comment section, third-party library, or other vector—the browser executes it immediately, potentially compromising user data and platform security.

A CSP acts as an allowlist that explicitly defines which sources the browser should trust. For example: "Only load scripts from cinemata.org and analytics.google.com. Block everything else." This dramatically reduces the attack surface for cross-site scripting (XSS) and other injection attacks.

## Implementation Guide Using django-csp

This guide uses the `django-csp` package to implement CSP following the Principle of Least Privilege, with nonce-based script authorization for enhanced security.

### 1. Installation

Install the django-csp package in your development environment:

```bash
pip install django-csp
```

### 2. Middleware Configuration

Add the CSP middleware to your `settings.py`. Position matters: place it near the top of the `MIDDLEWARE` list to ensure headers are applied early in the response cycle, but after `SessionMiddleware` if using nonces.

```python
MIDDLEWARE = [
    # ... existing middleware ...
    'django.contrib.sessions.middleware.SessionMiddleware',
    'csp.middleware.CSPMiddleware',  # Add CSP middleware here
    # ... remaining middleware ...
]
```

### 3. Define the Security Policy

Add the following configuration to `settings.py`. This implements a strict, deny-by-default policy that only permits explicitly authorized sources:

```python
# Default: Deny everything unless explicitly allowed
CSP_DEFAULT_SRC = ("'none'",)

# Images: Allow from own domain and data URIs (for base64-encoded images)
CSP_IMG_SRC = ("'self'", "data:")

# Stylesheets: Allow from own domain only
CSP_STYLE_SRC = ("'self'",)

# Scripts: Allow from own domain only
CSP_SCRIPT_SRC = ("'self'",)

# Enable nonces for inline scripts (random tokens per request)
CSP_INCLUDE_NONCE_IN = ['script-src']
```

### 4. Using Nonces in Templates

Nonces (numbers used once) are cryptographically random tokens generated for each page load. They prevent attackers from injecting unauthorized `<script>` tags because they cannot predict the current request's nonce value.

To use nonces in your Django templates, load the CSP template tags and add the nonce attribute to any inline scripts:

```django
{% load csp %}

<script nonce="{{ request.csp_nonce }}">
    console.log("This is a safe, authorized script.");
    // Your inline JavaScript here
</script>
```

## Additional Configuration Options

As you develop CinemataCMS features, you may need to expand the CSP policy. Here are common additions:

```python
# External fonts (if using Google Fonts or similar)
CSP_FONT_SRC = ("'self'", "fonts.gstatic.com")

# External analytics or CDN scripts
CSP_SCRIPT_SRC = ("'self'", "analytics.google.com", "cdn.jsdelivr.net")

# Media files (video/audio)
CSP_MEDIA_SRC = ("'self'", "*.cinemata.org")

# Frames (if embedding content)
CSP_FRAME_SRC = ("'self'",)

# Connect sources (for AJAX/fetch requests)
CSP_CONNECT_SRC = ("'self'", "api.cinemata.org")
```

## Testing and Monitoring

### Report-Only Mode

Before enforcing the policy, test it in report-only mode to identify violations without blocking content:

```python
CSP_REPORT_ONLY = True
CSP_REPORT_URI = '/csp-report/'  # Endpoint to receive violation reports
```

### Monitoring Violations

Create a view to log CSP violations and monitor them during development:

```python
import json
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse

@csrf_exempt
def csp_report(request):
    if request.method == 'POST':
        report = json.loads(request.body.decode('utf-8'))
        # Log the violation for review
        logger.warning(f"CSP Violation: {report}")
    return HttpResponse(status=204)
```

## Best Practices for CinemataCMS

1. **Start strict**: Begin with `CSP_DEFAULT_SRC = ("'none'",)` and add permissions only as needed
2. **Avoid `'unsafe-inline'` and `'unsafe-eval'`**: These bypass CSP protections; use nonces instead
3. **Use nonces for all inline scripts**: Never hardcode scripts without nonces
4. **Test thoroughly**: Use report-only mode before enforcement
5. **Document exceptions**: When adding sources to the allowlist, document why they're needed
6. **Regular audits**: Periodically review and tighten the CSP as the codebase evolves

## Troubleshooting Common Issues

**Scripts not loading**: Check browser console for CSP violations and add legitimate sources to `CSP_SCRIPT_SRC`

**Styles broken**: Ensure external stylesheets are listed in `CSP_STYLE_SRC`, or use nonces for inline styles

**Images not displaying**: Verify image sources are included in `CSP_IMG_SRC` (including `data:` for base64 images)

**Third-party integrations failing**: Add their domains to the appropriate CSP directive (scripts, styles, frames, etc.)

## Resources

- [MDN CSP Documentation](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [django-csp Documentation](https://django-csp.readthedocs.io/)
- [CSP Evaluator Tool](https://csp-evaluator.withgoogle.com/)

---

*This documentation is part of the CinemataCMS security implementation guide. For questions or issues, consult the development team or open an issue on GitHub.*
