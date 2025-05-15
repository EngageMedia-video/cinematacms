
# Rate Limiting with `django-axes` in CinemataCMS

This guide will help you integrate `django-axes` into your CinemataCMS (Django-based) project to prevent brute-force login attacks through IP-based or user-based rate limiting.

---

## What is django-axes?

[`django-axes`](https://django-axes.readthedocs.io/) (Access Attempt Monitoring) tracks failed login attempts and blocks users or IP addresses after a specified number of failures. It's especially useful to mitigate brute-force attacks.

---

## Installation

Install `django-axes` via pip:

```bash
pip install django-axes
```

Then update your requirements file to include it:

```bash
echo "django-axes" >> requirements.txt
```
---

## Django Settings Configuration

### 1. Add 'axes' to your INSTALLED_APPS in cms/settings.py:

```python
INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    'allauth.mfa',
    # ... your existing apps
    'axes',  # Add this line
]
```

### 2. Add the Axes Middleware
Add the Axes middleware to your MIDDLEWARE list in cms/settings.py. It should be placed after SessionMiddleware but before other middleware:

```python
MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "axes.middleware.AxesMiddleware",  # Add this line
    "django.middleware.common.CommonMiddleware",
    # ... rest of your middleware
]
```

### 3. Configure Authentication Backends
Add the Axes backend to your AUTHENTICATION_BACKENDS. It should be the first backend in the list:

```python
AUTHENTICATION_BACKENDS = (
    "axes.backends.AxesStandaloneBackend",  # Add this line as the first item
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
)
```

### 4. Configure Axes Settings
Add these settings to your cms/settings.py file (you can add them near your other security settings):

```python
# Django Axes Configuration
AXES_FAILURE_LIMIT = 5  # Number of login attempts allowed before lockout
AXES_COOLOFF_TIME = 1  # Lockout time in hours
AXES_LOCK_OUT_BY_COMBINATION_USER_AND_IP = True  # Lock out based on username and IP
AXES_RESET_ON_SUCCESS = True  # Reset failed login attempts on successful login

# Use your existing Redis cache for axes
AXES_CACHE = 'default'

# Track important request attributes
AXES_META_PRECEDENCE_ORDER = [
    'HTTP_X_FORWARDED_FOR',
    'REMOTE_ADDR',
]

# Apply to sensitive paths
AXES_SENSITIVE_PATHS = [
    '/admin/login/',
    '/accounts/login/', 
    '/accounts/signup/',
    '/accounts/password/reset/',
    '/api/auth/token/',  # If you have a token endpoint
]
```

---

## Optional: Create a Custom Lockout Template (Optional)
Create a template file at templates/account/lockout.html:

```html
{% extends "base.html" %}

{% block content %}
<div class="container">
    <div class="alert alert-danger">
        <h2>Account Locked</h2>
        <p>Your account has been temporarily locked due to too many failed login attempts.</p>
        <p>Please try again after one hour or contact support if you believe this is an error.</p>
    </div>
</div>
{% endblock %}
```
Then add this setting to your settings.py:
```
AXES_LOCKOUT_TEMPLATE = 'account/lockout.html'
```
---

## Run Migrations

`django-axes` uses a database to track access attempts. Apply migrations:

```bash
python manage.py migrate
```

---

## Test It

1. Attempt to log in with the wrong password 5 times.
2. On the 6th attempt, the user or IP should be blocked.
3. You should see the lockout message or behavior as configured.

---

## Monitor and Maintain
Add a regular maintenance task to clean up old entries:

```bash
# Add to your crontab or scheduled tasks
python manage.py axes_reset --age=30
```

## Management Commands

- **Reset attempts for all users/IPs:**

```bash
python manage.py axes_reset
```

## Integration with Allauth
If you're using Allauth, you might want to add this setting to cms/settings.py to prevent account enumeration attacks:
```
# Prevent revealing whether a username exists during failed logins
AXES_LOCKOUT_MESSAGE = "Too many failed login attempts. Please try again later."
ACCOUNT_LOGIN_ON_EMAIL_CONFIRMATION = False  # Don't automatically sign in on email confirmation
```

- **List lockouts:**

```bash
python manage.py axes_list
```

- **Remove specific lockout by IP or user:**

```bash
python manage.py axes_reset --ip 192.168.0.1
python manage.py axes_reset --username john_doe
```

---

## Additional Recommendations

- Use in combination with Django’s `LoginView` for admin or custom login pages.
- Consider adding IP whitelisting if you're using a shared office IP.
- Monitor `axes_attempts` table periodically to watch login activity.

---

## References

- Official Documentation: https://django-axes.readthedocs.io/
- Django Security Practices: https://docs.djangoproject.com/en/stable/topics/security/

---

## Contributions

Have ideas for advanced usage or tips? Open a PR to improve this documentation!
