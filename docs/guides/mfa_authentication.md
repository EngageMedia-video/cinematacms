# Multi-Factor Authentication
__Implemented by [Jay Cruz](https://github.com/jmcruz14)__ (Philippines)
(Up-to-date as of April 20, 2025)

## Table of Contents
1. [About](#about)
2. [Features](#features)
3. [Methodology](#methodology)
  - [Back-end](#back-end)
  - [Front-end](#front-end)
4. [Suggested improvements](#suggested-improvements)

### About

As part of Cinemata 2.0's roadmap, security and privacy improvements and open-source integration are included as vital targets towards its completion. In order to achieve this, a request to incorporate Multi-Factor Authentication into Cinemata's system is included.

> [!WARNING]
> This guide assumes that the developer has some background about Django fundamentals. If you find yourself unsure about certain steps/logic, you may refer to the documentation [here](https://docs.djangoproject.com/en/5.2/)

### Features

- Multi-factor authentication via QR Code
  - For users with MFA enabled, they are required to input an MFA-appropriate code (This code may be in the form of an authenticator-linked code or one of 10 provided back-up codes upon set-up)
- Accessible endpoints pertaining to MFA configuration
  - Set-up of MFA
  - Activation/reactivation of MFA
  - Viewing, regenerating, and downloading of recovery codes
- Sign-in using code (Magic sign-in) – this is in case a user does not wish to log-in using password (**NOTE**: With MFA enabled, the user is still asked to input an authenticator code)

**As of this writing, the MFA layer is exclusively applied to superusers.** You may skip to [suggested improvements](#suggested-improvements) to learn how to implement this for additional users.

### Methodology

This metholodogy involves two sections, the front-end and back-end implementation. No new, significant libraries were added in the installation process, save for one dependency (`fido2`) required by an existing library (`django-allauth`)

##### Back-end

An existing authentication library, `django-allauth` was extensively used to implement MFA. To include it in the application, the following line was inserted in `cms/settings.py`. 

```Python
INSTALLED_APPS = [
    # ...
    'allauth.mfa',
    # ...
]
```

Given that `allauth.mfa` includes an `Authenticator` model, updating the PostgreSQL DB using Django's migration workflow was also done as part of this installation.

Because the feature request also involved some changes in the Admin view, the following columns are now visible when looking at the Admin via the Django Admin interface:

**Updated Admin View**

```Python
# from users/admin.py

class UserAdmin(admin.ModelAdmin):
    # ...
    list_display = [
        # ...
        "has_mfa_enabled",
        "mfa_created_at"
    ]
    # ...

    def has_mfa_enabled(self, obj):
        return Authenticator.objects.filter(user=obj).exists()

    has_mfa_enabled.boolean = True  # Display as a checkmark/cross icon
    has_mfa_enabled.short_description = 'MFA Enabled'

    def get_queryset(self, request):
        queryset = super().get_queryset(request)
        queryset = queryset.annotate(
            mfa_created=Subquery(
                Authenticator.objects.filter(user=OuterRef('pk'))
                .order_by('created_at')
                .values('created_at')[:1]
            )
        )
        return queryset

    def mfa_created_at(self, obj):
        return obj.mfa_created
```

> [!WARNING]
> Take note that since the Django Admin model cannot have any new columns in the database, these two columns are retrieved from the `Authenticator` model, which is bundled with the MFA portion of the `django-allauth` library.

**Updated Authenticator View**

```Python
# from users/admin.py

# unregister default authenticator model -- NECESSARY TO MODIFY HOW THE AUTHENTICATOR VIEW IS DISPLAYED
admin.site.unregister(Authenticator)

@admin.register(Authenticator)
class CustomAuthenticatorAdmin(admin.ModelAdmin):
  list_display = ('user', 'type', 'auth_description', 'created_at', 'last_used_at')
  list_filter = ('type', 'created_at', 'last_used_at')
  readonly_fields = ('type', 'user', 'data_masked', 'created_at', 'last_used_at')
  exclude = ('data',)  # Hide the raw data field
  
  def get_fields(self, request, obj=None):
      """Ensure 'data' field is not directly editable"""
      fields = super().get_fields(request, obj)
      if 'data' in fields:
          fields.remove('data')
      return fields
  
  def auth_description(self, obj):
      """Display a meaningful name for the authenticator without revealing secrets"""
      if obj.type == obj.Type.WEBAUTHN:
          return f"WebAuthn: {obj.wrap().name}"
      elif obj.type == obj.Type.TOTP:
          return "Authenticator App"
      elif obj.type == obj.Type.RECOVERY_CODES:
          # Show count of unused codes without revealing the codes themselves
          unused_count = len(obj.wrap().get_unused_codes())
          return f"Recovery Codes ({unused_count} remaining)"
      return obj.get_type_display()
  
  auth_description.short_description = "Authentication Method"
  
  def data_masked(self, obj):
      """Display a masked version of the data"""
      if obj.type == obj.Type.WEBAUTHN:
          # For WebAuthn, only show name and creation data
          name = obj.wrap().name
          has_credential = "credential" in obj.data
          return f"Name: {name}, Has credential data: {'Yes' if has_credential else 'No'}"
          
      elif obj.type == obj.Type.TOTP:
          # For TOTP, just indicate secret exists but don't show it
          has_secret = "secret" in obj.data
          return f"TOTP secret: {'[ENCRYPTED]' if has_secret else 'None'}"
          
      elif obj.type == obj.Type.RECOVERY_CODES:
          # For recovery codes, show count and usage status
          used_mask = obj.data.get("used_mask", 0)
          seed = obj.data.get("seed", None)
          unused_count = len(obj.wrap().get_unused_codes())
          total_count = 0
          
          # Try to determine total recovery code count
          from allauth.mfa import app_settings as mfa_settings
          total_count = mfa_settings.RECOVERY_CODE_COUNT
          
          return (
              f"Unused codes: {unused_count}/{total_count}\n"
              f"Seed: {'[ENCRYPTED]' if seed else 'None'}"
          )
      
      # Generic fallback
      data_keys = list(obj.data.keys())
      return f"Keys: {', '.join(data_keys)}"
  
  data_masked.short_description = "Protected Data"
```

Modifying the authenticator view is part of this implementation for security-related reasons (administrators should not be able to see the secrets/seeds associated with an authenticator device, but should at least be able to delete the row if needed.). As with the Admin model, this does not directly modify the columns that are associated with the `Authenticator` model in the back-end, only how they are viewed from the Admin panel.

Additional configurations were added to `cms/settings.py`.

```Python
ACCOUNT_LOGIN_BY_CODE_ENABLED = True

# MFA custom configurations here
MFA_FORMS = {
  'authenticate': 'users.forms.CustomAuthenticateForm',
  'reauthenticate': 'users.forms.CustomReauthenticateTOTPForm',
  'activate_totp': 'users.forms.CustomActivateTOTPForm'
}
MFA_RECOVERY_CODE_COUNT = 10
MFA_RECOVERY_CODE_DIGITS = 12
MFA_TOTP_TOLERANCE = 120
MFA_SUPPORTED_TYPES = ["totp", "recovery_codes"]
MFA_TOTP_ISSUER = "Cinemata"
```

These are specific configurations that follow the [Django-allauth MFA documentation](https://docs.allauth.org/en/dev/mfa/configuration.html), which explain each line in further detail. 

The forms that are linked in the `MFA_FORMS` variable can be seen below via `users/forms.py`:

```Python
class CustomAuthenticateForm(AuthenticateForm):
    """This form is fetched for standard authentication,
    and represents both TOTP authenticator code and recovery codes."""
    
    code = forms.CharField(
        widget=forms.TextInput(
            attrs={
                "placeholder": _(""), 
                "class": "otp-hidden-input",
                "inputmode": "numeric"
            },
        )
    )

class CustomActivateTOTPForm(ActivateTOTPForm):
    """This form is fetched when the user is
    setting up authentication"""

    code = forms.CharField(
        max_length=6,
        widget=forms.TextInput(
            attrs={
                "placeholder": _(""), 
                "autocomplete": "one-time-code",
                "class": "otp-hidden-input",
                "inputmode": "numeric",
                "pattern": "[0-9]{6}"
            },
        ),
    )

class CustomReauthenticateTOTPForm(CustomAuthenticateForm):
    pass
```

These forms are associated with input fields that are found in the corresponding templates that are associated with each view generated when entering specific endpoints. 

The `django-allauth` comes with `adapter` classes which serve as utility functions to aid its internal functionality. The account adapter class has specific utility functions that were overriden for this purpose. The adapter's custom configurations are found in `users/adapter.py`.

```Python
from allauth.mfa.utils import is_mfa_enabled
from utils.security import generate_key, generate_cipher

class MyAccountAdapter(DefaultAccountAdapter):
    def encrypt(self, text: str):
        encrypted_bytes = self.cipher_suite.encrypt(text.encode('utf-8'))
        return encrypted_bytes.decode('utf-8')
    
    def decrypt(self, encrypted_text: str):
        decrypted_bytes = self.cipher_suite.decrypt(encrypted_text.encode('utf-8'))
        return decrypted_bytes.decode('utf-8')

    # ...

    def get_login_redirect_url(self, request):
        if request.user.is_superuser:
            mfa_enabled = is_mfa_enabled(request.user)
            if not mfa_enabled:
                return resolve_url('/accounts/2fa/totp/activate')
            return resolve_url('/')
        return resolve_url('/')

    @property
    def key(self):
        return generate_key()
    
    @property
    def cipher_suite(self):
        return generate_cipher(self.key)
```

The implemention of `get_login_redirect_url()` as of this writing is primarily focused towards superusers, but it can be reworked to include other classes based on future implementation. It should also be noted that additional security functions were created in a separate `utils/` folder to ensure the authenticator's secret/seed associated with a user is encrypted.

**Encryption**: The MFA layer utilizes symmetric encryption with the added bonus of SHA-256 encryption. This is due to the fact that `django-allauth`'s MFA authenticators use SHA-1 encryption by default, so overriding that encryption is key due to serious vulnerabilities linked to SHA-1.

An additional url in the `users/urls.py` is also included. This is relevant with respect to the [front-end](#front-end) portion in the next part of this guide.

```Python
urlpatterns = [
  # ...
    # success-mfa
        re_path(
            r"^accounts/2fa/totp/success",
            views.mfa_success_message,
            name="mfa_success"
        )
]
```

The corresponding view is also added under `users/views.py`.

```Python
@login_required
def mfa_success_message(request):
    user = get_user(request.user)
    if not user or (user != request.user and not is_mediacms_manager(request.user)):
        return HttpResponseRedirect("/")
    return render(request, "mfa/totp/success.html")
```

**Rate-limiting**: Currently, the `django-allauth` library groups MFA log-in attempts with regular log-in attempts. That is to say, the rate limit is for attempting to do regular log-in from a specific IP and/or device is the same rate limit for attempting to finish log-in using TOTP/Recovery codes.


##### Front-end

The front-end implementation of this primarily utilizes the `templates` feature of Django applications. That being: if you have a default template installed in a library, this can be overwritten within your own `templates/` folder as long as it is stored in the same directory pathing as the default template. 

The design and layout of these custom templates follows the wireframes shown in [this issue](https://github.com/EngageMedia-video/cinemata/issues/65).

The following `templates` were created to override default templates associated with the `django-allauth` views.

**Custom Templates** (with a corresponding URL)
| URL      | Template Path `(/templates)` |
| ----------- | ----------- |
| `/accounts/login/code`      | ``       |
| `/accounts/login/code/confirm`   | Text        |
| `/accounts/2fa/`      | `/mfa/index.html`       |
| `/accounts/2fa/authenticate`   | `/mfa/authenticate.html`        |
| `/accounts/reauthenticate/<NEXT-URL-PATH>` | `/account/reauthenticate.html` |
| `/accounts/2fa/reauthenticate/<NEXT-URL-PATH>` | `/mfa/reauthenticate.html` |
| `/accounts/2fa/totp/activate`      | `/mfa/totp/activate_form.html`       |
| `/accounts/2fa/totp/deactivate`   | `/mfa/totp/deactivate_form.html`        |
| `/accounts/2fa/totp/success`   | `/mfa/totp/success.html`        |
| `/accounts/2fa/recovery-codes/`      | `/mfa/recovery_codes/index.html`|
| `/accounts/2fa/recovery-codes/generate/`   | `/mfa/recovery_codes/generate.html`|

> [!NOTE]
> While these are the custom (overriding) templates, there are also custom parent templates that were made to also override default parent templates.

These custom templates utilize their own CSS classes, which have been coded in using the `frontend/` folder's `css/` directory. For this implementation, implementation was done strictly through the `_extra.css` (for new classes) and `styles.scss` (any dark-mode inclusions). 

As for the JS-related functionality, any template file that utilizes TOTP / Recovery Code input has an inserted script tag in the template file which ensures that the frontend behavior follows best UI/UX practices. This can be refactored to be implemented within a separate React component, but wasn't implemented due to developer time purposes.

<hr/>

### Suggested improvements

- Refactoring JS functionality within certain templates

- Creation of additional users which may also utilize MFA

Given that Django's User model structure, it is important to consider that this improvement will also require a brief look into rewriting the database 

- Send recovery code to MFA-verified user (in case the user does not have access to either authenticator app or their recovery codes)

One specific security layer that was left off the initial implementation is something that does not come with the `django-allauth` library: a fail-safe to the fail-safe in the form of a recovery code sent via email.

Implementing this may take significant time as one may need to go deep into the `django-allauth` codebase to ensure that this method of authentication is still consistent with the behavior of other supported authentication methods by the `django-allauth` library.

- Middleware implementation

One discarded, but possible logic that may be reimplemented if needed is shifting from utilizing the adapter's `get_login_redirect_url` method to redirect users towards using Django's Middleware feature to instead redirect the user, if they fit a certain set of conditions, to the MFA setup screen.

The reason middleware was not implemented in this instance is because middleware intercepts the user at every instance of navigating the website. The feature request for this did not specify if the user should be redirected at every step to the MFA setup screen, only that the user should be reminded to setup their MFA.

- Frontend access to `/accounts/2fa` endpoint

This suggestion includes a frontend inclusion, preferably in the user's settings dropdown, that lets the user go to the `/accounts/2fa` endpoint. At the moment, it is accessible if one is aware of the endpoint and can type it into the address bar.
