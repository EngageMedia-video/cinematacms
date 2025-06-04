
# Enabling HSTS and Security Best Practices in CinemataCMS

This guide helps you configure HTTP Strict Transport Security (HSTS) and other essential security features for your CinemataCMS deployment.

---

## Prerequisites

Before enabling these settings, ensure:

- Your site is served over HTTPS with a valid SSL/TLS certificate.
- Django is running with `DEBUG = False`.
- If you're using a reverse proxy (like Nginx or Apache), it is forwarding the correct headers.

> [!WARNING]
>Warning: enabling this only in production site as it requires a valid ssl certificate and without that your site might not behave properly.
---

## `cms/settings.py` Configuration 

```python
# HSTS Settings
SECURE_HSTS_SECONDS = 31536000
# Instructs browsers to only use HTTPS for your site for the next 31536000 seconds (1 year).

SECURE_HSTS_INCLUDE_SUBDOMAINS = True
# Applies HSTS to all subdomains, e.g., sub.yourdomain.com.

SECURE_HSTS_PRELOAD = True
# Enables your site to be added to the HSTS preload list used by browsers.

# Secure Cookie Settings
CSRF_COOKIE_SECURE = True
# Ensures the CSRF cookie is only sent over HTTPS connections.

SESSION_COOKIE_SECURE = True
# Ensures the session cookie is only sent over HTTPS connections.

CSRF_COOKIE_HTTPONLY = True
# Prevents JavaScript from accessing the CSRF cookie, reducing XSS attack surface.

SESSION_COOKIE_HTTPONLY = True
# Prevents JavaScript from accessing the session cookie.

# Browser Security Headers
SECURE_BROWSER_XSS_FILTER = True
# Enables the browser's XSS filter to prevent reflected XSS attacks (mostly legacy support).

SECURE_CONTENT_TYPE_NOSNIFF = True
# Prevents the browser from guessing the content type and enforces declared types.

# HTTPS Redirection
SECURE_SSL_REDIRECT = True
# Automatically redirects all HTTP requests to HTTPS.

# Proxy Header Handling (needed behind reverse proxy)
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
# Tells Django to trust the X-Forwarded-Proto header to determine whether a request is secure.
```

---

## Nginx Configuration (If using a reverse proxy)

```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com;

    ssl_certificate /etc/ssl/certs/your_cert.pem;
    ssl_certificate_key /etc/ssl/private/your_key.pem;

    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

---

## Test Your Configuration

### Check HSTS Header

```bash
curl -I https://yourdomain.com
```

You should see a header like:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

### Use Online Tools

- https://securityheaders.com
- https://hstspreload.org

---

## Enable HSTS Preload (Optional but Recommended)

If you want browsers to enforce HTTPS by default:

1. Confirm this header is served:

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

2. Submit your site to: https://hstspreload.org

**Warning:** Removal from the preload list is difficult. Only preload if you're certain.

---

## References

- Django Security Documentation: https://docs.djangoproject.com/en/stable/topics/security/
- Mozilla Observatory: https://observatory.mozilla.org
- HSTS Preload Submission: https://hstspreload.org

---

## Contributions

Feel free to open a pull request to improve this guide or contribute examples for other web servers.

