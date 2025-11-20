What is the Risk?
Without a CSP, the browser assumes all content is safe. If an attacker injects a malicious script (e.g., via a comment section or a compromised third-party library), the browser will execute it without hesitation.

A CSP acts as an Allowlist. For example, It tells the browser: "Only load scripts from cinemata.org and analytics.google.com. Block everything else."

Implementation Guide: Using django-csp

Since the report recommends the 3rd-party package django-csp, here is how to implement it to satisfy the "Principle of Least Privilege" and use nonces for added security.

Installation

First, install the library in your environment:
pip install django-csp
Middleware Configuration
Add the middleware to your settings.py. Important: It should be placed near the top of the MIDDLEWARE list to ensure headers are applied to responses early, but after SessionMiddleware if you are using nonces.

MIDDLEWARE = [
    # ... other middleware ...
    'django.contrib.sessions.middleware.SessionMiddleware',
    'csp.middleware.CSPMiddleware', # Add this here
    # ... other middleware ...
]

Define the Policy (settings.py)

Below is a strict, secure configuration. It blocks everything by default and only opens specific channels. Use as you need them.
on settings.py-

1. Default: Deny everything unless explicitly allowed
CSP_DEFAULT_SRC = ("'none'",)

2. Allow images/styles from self (your own domain)
CSP_IMG_SRC = ("'self'", "data:") # data: allows base64 images
CSP_STYLE_SRC = ("'self'",)

3. Scripts: Allow self, and use a Nonce for inline scripts
CSP_SCRIPT_SRC = ("'self'",) 

4. Enable Nonces (Random tokens for every request)
CSP_INCLUDE_NONCE_IN = ['script-src']

Using Nonces in Templates

The report mentions using a nonce (number used once). This prevents attackers from injecting <script> tags because they won't know the random number generated for that specific page load.
In your Django templates, you must add the nonce to any inline script:

{% load csp %}

<script nonce="{{ request.csp_nonce }}">
  console.log("This is a safe, authorized script.");
</script>


