import re
from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth import get_user_model

from allauth.mfa.models import Authenticator
from allauth.mfa.totp.internal.auth import (
    generate_totp_secret, 
    validate_totp_code, 
    format_hotp_value, 
    hotp_value,
    yield_hotp_counters_from_time,
    TOTP
)
# from allauth.mfa.utils import encrypt, decrypt
import time

from .models import User
from .validators import is_internal_url, sanitize_html, validate_internal_html
from django.core.exceptions import ValidationError

class LoginTestCase(TestCase):
  """Test cases for user authentication"""
  
  def setUp(self):
      # Create a test user
      self.username = "testuser"
      self.password = "securepassword123"
      self.email = "test@example.com"

      # Superuser creds
      self.superuser_username = "test_superuser"
      self.superuser_password = "superuser123"
      self.superuser_email = "superuser@example.com"
      
      self.user = User.objects.create_user(
          username=self.username,
          email=self.email,
          password=self.password,
      )

      self.superuser = User.objects.create_superuser(
          username=self.superuser_username,
          email=self.superuser_email,
          password=self.superuser_password
      )
      
      # Setup the test client
      self.client = Client()
  
  def test_successful_login(self):
      """Test that a (regular) user can successfully log in with correct credentials"""
      # Get the login URL
      login_url = reverse('account_login')
      
      # Attempt to login with correct credentials
      response = self.client.post(login_url, {
          'login': self.username,  # allauth uses 'login' for username or email
          'password': self.password,
      })

      # Check if the login was successful (should redirect to home page)
      self.assertRedirects(response, '/', fetch_redirect_response=False)
      
      # Verify the user is authenticated
      self.assertTrue(response.wsgi_request.user.is_authenticated)
      self.assertEqual(response.wsgi_request.user.username, self.username)

  def test_superuser_redirect(self):
      """Test that checks if a new superuser on creation has been redirected to the MFA setup page"""
      login_url = reverse('account_login')
      response = self.client.post(login_url, {
          'login': self.superuser_username,
          'password': self.superuser_password
      })

      # Check if the login was successful (should redirect to home page)
      self.assertRedirects(response, '/accounts/2fa/totp/activate', fetch_redirect_response=False)
      
      # Verify the user is authenticated
      self.assertTrue(response.wsgi_request.user.is_authenticated)
      self.assertEqual(response.wsgi_request.user.username, self.superuser_username)

class MFATestCase(TestCase):
  """Comprehensive test cases for MFA functionality"""
  
  def setUp(self):
    # Create test users
    self.regular_user = User.objects.create_user(
        username="regularuser",
        email="regular@example.com",
        password="testpassword123",
    )
    
    self.superuser = User.objects.create_superuser(
        username="superuser",
        email="super@example.com",
        password="superpassword123"
    )
    
    self.editor_user = User.objects.create_user(
        username="editor",
        email="editor@example.com",
        password="editorpass123",
        is_editor=True
    )
    
    self.manager_user = User.objects.create_user(
        username="manager",
        email="manager@example.com",
        password="managerpass123",
        is_manager=True
    )
    
    self.client = Client()
  
  def _generate_valid_totp_code(self, secret):
      """Helper method to generate a valid TOTP code"""
      counters = yield_hotp_counters_from_time()
      counter = next(counters)  # Use current counter
      value = hotp_value(secret, counter)
      return format_hotp_value(value)
  
  def test_superuser_mfa_redirect_on_first_login(self):
      """Test that superusers are redirected to MFA setup on first login"""
      login_url = reverse('account_login')
      response = self.client.post(login_url, {
          'login': self.superuser.username,
          'password': 'superpassword123'
      })
      
      # Should redirect to MFA setup
      self.assertRedirects(response, '/accounts/2fa/totp/activate', fetch_redirect_response=False)
      self.assertTrue(response.wsgi_request.user.is_authenticated)
  
  def test_regular_user_no_mfa_redirect(self):
      """Test that regular users are not forced to set up MFA"""
      login_url = reverse('account_login')
      response = self.client.post(login_url, {
          'login': self.regular_user.username,
          'password': 'testpassword123'
      })
      
      # Should redirect to home page
      self.assertRedirects(response, '/', fetch_redirect_response=False)
      self.assertTrue(response.wsgi_request.user.is_authenticated)
  
  def test_editor_mfa_redirect(self):
    """Test that editors are not redirected to MFA setup"""
    login_url = reverse('account_login')
    response = self.client.post(login_url, {
        'login': self.editor_user.username,
        'password': 'editorpass123'
    })
    
    # Should redirect to MFA setup
    self.assertRedirects(response, '/', fetch_redirect_response=False)
    self.assertTrue(response.wsgi_request.user.is_authenticated)
  
  def test_manager_mfa_redirect(self):
    """Test that managers are redirected to MFA setup"""
    login_url = reverse('account_login')
    response = self.client.post(login_url, {
        'login': self.manager_user.username,
        'password': 'managerpass123'
    })
    
    # Should redirect to MFA setup
    self.assertRedirects(response, '/', fetch_redirect_response=False)
    self.assertTrue(response.wsgi_request.user.is_authenticated)
  
  # def test_mfa_setup_flow(self):
  #   """Test the complete MFA setup flow"""
  #   # Login as superuser
  #   self.client.login(username='superuser', password='superpassword123')
    
  #   # Visit MFA setup page
  #   setup_url = reverse('mfa_activate_totp')
  #   response = self.client.get(setup_url)
  #   self.assertEqual(response.status_code, 200)
    
  #   # The secret should be stored in session
  #   session = self.client.session
  #   secret = session.get('mfa.totp.secret')
  #   self.assertIsNotNone(secret)
    
  #   # Generate valid TOTP code
  #   valid_code = self._generate_valid_totp_code(secret)
    
  #   # Submit TOTP code
  #   response = self.client.post(setup_url, {
  #       'code': valid_code,
  #   }, follow=True)
    
  #   # Check if MFA was set up successfully
  #   self.assertTrue(Authenticator.objects.filter(user=self.superuser).exists())
  
  def test_login_with_mfa(self):
    """Test login flow with MFA enabled"""
    # First, set up MFA for the user
    secret = generate_totp_secret()
    totp = TOTP.activate(self.superuser, secret)
    
    # Attempt login
    login_url = reverse('account_login')
    response = self.client.post(login_url, {
        'login': self.superuser.username,
        'password': 'superpassword123'
    }, follow=True)
    
    # Should be redirected to MFA authentication page
    self.assertContains(response, 'Two-Factor Authentication')
    
    # Submit TOTP code
    valid_code = self._generate_valid_totp_code(secret)
    mfa_auth_url = reverse('mfa_authenticate')
    response = self.client.post(mfa_auth_url, {
        'code': valid_code
    }, follow=True)
    
    # Should be successfully logged in
    self.assertTrue(response.wsgi_request.user.is_authenticated)
  
  # def test_invalid_totp_code(self):
  #   """Test login with invalid TOTP code"""
  #   # Set up MFA
  #   secret = generate_totp_secret()
  #   totp = TOTP.activate(self.superuser, secret)
    
  #   # Login with username/password
  #   self.client.post(reverse('account_login'), {
  #       'login': self.superuser.username,
  #       'password': 'superpassword123'
  #   })
    
  #   # Submit invalid TOTP code
  #   response = self.client.post(reverse('mfa_authenticate'), {
  #       'code': '000000'  # Invalid code
  #   })
    
  #   # Should show error
  #   self.assertFormError(response, 'form', 'code', 'Incorrect code.')
  
  def test_totp_code_reuse_prevention(self):
    """Test that TOTP codes cannot be reused"""
    # Set up MFA
    secret = generate_totp_secret()
    totp = TOTP.activate(self.superuser, secret)
    
    # Generate valid code
    valid_code = self._generate_valid_totp_code(secret)
    
    # Use the code once
    self.assertTrue(totp.validate_code(valid_code))
    
    # Try to use the same code again
    self.assertFalse(totp.validate_code(valid_code))
  
  def test_totp_tolerance_window(self):
    """Test TOTP tolerance window for clock skew"""
    secret = generate_totp_secret()
    
    # Test that validate_totp_code works with counters within tolerance
    current_counter = int(time.time()) // 30  # Assuming 30-second period
    
    # Generate code for current time
    current_value = hotp_value(secret, current_counter)
    current_code = format_hotp_value(current_value)
    
    # Should validate successfully
    self.assertTrue(validate_totp_code(secret, current_code))
  
  # def test_mfa_deactivation(self):
  #     """Test MFA deactivation flow"""
  #     # Set up MFA
  #     secret = generate_totp_secret()
  #     totp = TOTP.activate(self.superuser, secret)
      
  #     # Login with MFA
  #     self.client.login(username='superuser', password='superpassword123')
      
  #     # Generate valid code for deactivation confirmation
  #     valid_code = self._generate_valid_totp_code(secret)
      
  #     # Visit MFA management page
  #     deactivate_url = reverse('mfa_deactivate_totp')
  #     response = self.client.get(deactivate_url)
  #     self.assertEqual(response.status_code, 200)
      
  #     # Deactivate MFA (may require code confirmation)
  #     response = self.client.post(deactivate_url, {
  #         'code': valid_code  # Some configurations require code to deactivate
  #     }, follow=True)
      
  #     # MFA should be deactivated
  #     self.assertFalse(Authenticator.objects.filter(user=self.superuser).exists())
  
  def test_mfa_success_page(self):
    """Test MFA success page after setup"""
    # Login as superuser
    self.client.login(username='superuser', password='superpassword123')

    # Visit success page
    success_url = reverse('mfa_success')
    response = self.client.get(success_url)

    self.assertEqual(response.status_code, 200)
    self.assertTemplateUsed(response, 'mfa/totp/success.html')


class URLValidationTestCase(TestCase):
    """Comprehensive test cases for is_internal_url security validation"""

    def test_valid_internal_paths(self):
        """Test that valid internal paths are accepted"""
        valid_urls = [
            '/about',
            '/blog',
            '/user/profile',
            '/media/video/123',
            '/',
            '/path/to/resource',
        ]
        for url in valid_urls:
            with self.subTest(url=url):
                self.assertTrue(is_internal_url(url), f"Should accept valid internal path: {url}")

    def test_valid_fragments(self):
        """Test that fragment-only URLs are accepted"""
        valid_fragments = [
            '#section',
            '#top',
            '#',
            '#anchor-point',
        ]
        for url in valid_fragments:
            with self.subTest(url=url):
                self.assertTrue(is_internal_url(url), f"Should accept valid fragment: {url}")

    def test_reject_protocol_relative_urls(self):
        """Test that protocol-relative URLs are rejected"""
        dangerous_urls = [
            '//evil.com/page',
            '//attacker.com',
            '//example.com/malicious',
            '//localhost/fake',
        ]
        for url in dangerous_urls:
            with self.subTest(url=url):
                self.assertFalse(is_internal_url(url), f"Should reject protocol-relative URL: {url}")

    def test_reject_javascript_protocol(self):
        """Test that javascript: protocol is rejected"""
        dangerous_urls = [
            'javascript:alert(1)',
            'javascript:alert("XSS")',
            'javascript:void(0)',
            'JavaScript:alert(1)',  # Case variation
            'JAVASCRIPT:alert(1)',  # Uppercase
            'JaVaScRiPt:alert(1)',  # Mixed case
            ' javascript:alert(1)',  # With whitespace
            '%6A%61%76%61%73%63%72%69%70%74:alert(1)',  # URL encoded
        ]
        for url in dangerous_urls:
            with self.subTest(url=url):
                self.assertFalse(is_internal_url(url), f"Should reject javascript: URL: {url}")

    def test_reject_data_protocol(self):
        """Test that data: protocol is rejected"""
        dangerous_urls = [
            'data:text/html,<script>alert(1)</script>',
            'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
            'DATA:text/html,<script>alert(1)</script>',  # Case variation
            'dAtA:text/html,<script>alert(1)</script>',  # Mixed case
        ]
        for url in dangerous_urls:
            with self.subTest(url=url):
                self.assertFalse(is_internal_url(url), f"Should reject data: URL: {url}")

    def test_reject_vbscript_protocol(self):
        """Test that vbscript: protocol is rejected"""
        dangerous_urls = [
            'vbscript:msgbox(1)',
            'VBScript:msgbox(1)',
            'VBSCRIPT:msgbox(1)',
        ]
        for url in dangerous_urls:
            with self.subTest(url=url):
                self.assertFalse(is_internal_url(url), f"Should reject vbscript: URL: {url}")

    def test_reject_file_protocol(self):
        """Test that file: protocol is rejected"""
        dangerous_urls = [
            'file:///etc/passwd',
            'file://C:/Windows/System32',
            'FILE:///etc/passwd',
        ]
        for url in dangerous_urls:
            with self.subTest(url=url):
                self.assertFalse(is_internal_url(url), f"Should reject file: URL: {url}")

    def test_reject_blob_and_about_protocols(self):
        """Test that blob: and about: protocols are rejected"""
        dangerous_urls = [
            'blob:https://example.com/uuid',
            'about:blank',
            'BLOB:https://example.com/uuid',
            'ABOUT:blank',
        ]
        for url in dangerous_urls:
            with self.subTest(url=url):
                self.assertFalse(is_internal_url(url), f"Should reject blob:/about: URL: {url}")

    def test_reject_url_encoded_attacks(self):
        """Test that URL-encoded attack vectors are rejected"""
        dangerous_urls = [
            '%6A%61%76%61%73%63%72%69%70%74:alert(1)',  # javascript: encoded
            '%2F%2Fevil.com',  # //evil.com encoded
            'java%09script:alert(1)',  # Tab character
            'java%0Ascript:alert(1)',  # Newline character
            'java%0Dscript:alert(1)',  # Carriage return
        ]
        for url in dangerous_urls:
            with self.subTest(url=url):
                self.assertFalse(is_internal_url(url), f"Should reject URL-encoded attack: {url}")

    def test_reject_mixed_content_attacks(self):
        """Test that mixed content attacks are rejected"""
        dangerous_urls = [
            '/javascript:alert(1)',  # Path with javascript:
            '/#javascript:alert(1)',  # Fragment with javascript:
        ]
        for url in dangerous_urls:
            with self.subTest(url=url):
                # These might be rejected depending on implementation
                # They contain dangerous protocols even if starting with / or #
                result = is_internal_url(url)
                # Should be False due to colon check
                self.assertFalse(result, f"Should reject mixed content attack: {url}")

    def test_reject_empty_and_whitespace(self):
        """Test that empty and whitespace-only URLs are rejected"""
        invalid_urls = [
            '',
            '   ',
            '\t',
            '\n',
            None,
        ]
        for url in invalid_urls:
            with self.subTest(url=url):
                self.assertFalse(is_internal_url(url), f"Should reject empty/whitespace URL: {url}")

    def test_reject_external_absolute_urls(self):
        """Test that external absolute URLs are rejected"""
        external_urls = [
            'http://evil.com/page',
            'https://attacker.com/malicious',
            'http://example.com',
            'https://google.com',
        ]
        for url in external_urls:
            with self.subTest(url=url):
                # These should be rejected unless the domain is in ALLOWED_HOSTS
                # For testing purposes, we assume they're not in ALLOWED_HOSTS
                self.assertFalse(is_internal_url(url), f"Should reject external absolute URL: {url}")


class HTMLSanitizationTestCase(TestCase):
    """Comprehensive test cases for sanitize_html XSS protection"""

    def test_allow_safe_html(self):
        """Test that safe HTML is preserved"""
        safe_html = '<p>Hello <strong>world</strong></p><a href="/about">About</a>'
        allowed_tags = ['a', 'strong', 'em', 'p', 'br']
        allowed_attrs = {'a': ['href', 'title']}

        result = sanitize_html(safe_html, allowed_tags, allowed_attrs)
        self.assertIn('<strong>world</strong>', result)
        self.assertIn('href="/about"', result)

    def test_remove_onclick_handler(self):
        """Test that onclick event handlers are removed"""
        malicious_html = '<a href="/page" onclick="alert(1)">Click me</a>'
        allowed_tags = ['a']
        allowed_attrs = {'a': ['href']}

        result = sanitize_html(malicious_html, allowed_tags, allowed_attrs)
        self.assertNotIn('onclick', result)
        self.assertNotIn('alert(1)', result)
        self.assertIn('href="/page"', result)

    def test_remove_all_event_handlers(self):
        """Test that all event handlers are removed"""
        event_handlers = [
            'onload', 'onerror', 'onmouseover', 'onmouseout',
            'onfocus', 'onblur', 'onchange', 'onsubmit',
            'onkeypress', 'onkeydown', 'onkeyup',
        ]
        allowed_tags = ['a', 'img', 'input']
        allowed_attrs = {'a': ['href'], 'img': ['src'], 'input': ['type']}

        for handler in event_handlers:
            with self.subTest(handler=handler):
                malicious_html = f'<a href="/page" {handler}="alert(1)">Link</a>'
                result = sanitize_html(malicious_html, allowed_tags, allowed_attrs)
                self.assertNotIn(handler, result, f"Should remove {handler}")
                self.assertNotIn('alert(1)', result)

    def test_remove_style_attribute(self):
        """Test that style attributes are removed"""
        malicious_html = '<p style="background: url(javascript:alert(1))">Text</p>'
        allowed_tags = ['p']
        allowed_attrs = {'p': []}

        result = sanitize_html(malicious_html, allowed_tags, allowed_attrs)
        self.assertNotIn('style', result)
        self.assertNotIn('javascript', result)

    def test_remove_srcset_attribute(self):
        """Test that srcset attributes are removed"""
        malicious_html = '<img src="/image.jpg" srcset="//evil.com/track.jpg 2x">'
        allowed_tags = ['img']
        allowed_attrs = {'img': ['src']}

        result = sanitize_html(malicious_html, allowed_tags, allowed_attrs)
        self.assertNotIn('srcset', result)
        self.assertNotIn('evil.com', result)

    def test_remove_data_attributes(self):
        """Test that data-* attributes are removed"""
        malicious_html = '<a href="/page" data-evil="malicious">Link</a>'
        allowed_tags = ['a']
        allowed_attrs = {'a': ['href']}

        result = sanitize_html(malicious_html, allowed_tags, allowed_attrs)
        self.assertNotIn('data-evil', result)
        self.assertNotIn('data-', result.split('href')[0])  # No data- before href

    def test_remove_formaction_attribute(self):
        """Test that formaction attributes are removed"""
        malicious_html = '<button formaction="//evil.com/steal">Submit</button>'
        allowed_tags = ['button']
        allowed_attrs = {'button': ['type']}

        result = sanitize_html(malicious_html, allowed_tags, allowed_attrs)
        self.assertNotIn('formaction', result)

    def test_reject_javascript_in_href(self):
        """Test that javascript: URLs in href are rejected"""
        malicious_html = '<a href="javascript:alert(1)">Click</a>'
        allowed_tags = ['a']
        allowed_attrs = {'a': ['href']}

        result = sanitize_html(malicious_html, allowed_tags, allowed_attrs)
        # The tag should be unwrapped (removed but content preserved)
        self.assertNotIn('href', result)
        self.assertNotIn('javascript:', result)
        self.assertIn('Click', result)

    def test_reject_protocol_relative_in_href(self):
        """Test that protocol-relative URLs in href are rejected"""
        malicious_html = '<a href="//evil.com/page">External Link</a>'
        allowed_tags = ['a']
        allowed_attrs = {'a': ['href']}

        result = sanitize_html(malicious_html, allowed_tags, allowed_attrs)
        # The tag should be unwrapped
        self.assertNotIn('//evil.com', result)
        self.assertIn('External Link', result)

    def test_reject_data_uri_in_href(self):
        """Test that data: URIs in href are rejected"""
        malicious_html = '<a href="data:text/html,<script>alert(1)</script>">Click</a>'
        allowed_tags = ['a']
        allowed_attrs = {'a': ['href']}

        result = sanitize_html(malicious_html, allowed_tags, allowed_attrs)
        self.assertNotIn('data:', result)
        self.assertNotIn('script', result)

    def test_preserve_valid_internal_links(self):
        """Test that valid internal links are preserved"""
        safe_html = '<a href="/about">About</a><a href="#top">Top</a>'
        allowed_tags = ['a']
        allowed_attrs = {'a': ['href']}

        result = sanitize_html(safe_html, allowed_tags, allowed_attrs)
        self.assertIn('href="/about"', result)
        self.assertIn('href="#top"', result)
        self.assertIn('About', result)
        self.assertIn('Top', result)

    def test_complex_xss_attack(self):
        """Test defense against complex XSS attack"""
        malicious_html = '''
        <a href="javascript:alert(1)" onclick="alert(2)" style="background:url(javascript:alert(3))">
            <img src="x" onerror="alert(4)" onload="alert(5)">
        </a>
        '''
        allowed_tags = ['a', 'img']
        allowed_attrs = {'a': ['href'], 'img': ['src']}

        result = sanitize_html(malicious_html, allowed_tags, allowed_attrs)
        # Should not contain any javascript or event handlers
        self.assertNotIn('javascript:', result)
        self.assertNotIn('onclick', result)
        self.assertNotIn('onerror', result)
        self.assertNotIn('onload', result)
        self.assertNotIn('style', result)
        self.assertNotIn('alert', result)

    def test_validate_internal_html_function(self):
        """Test the validate_internal_html wrapper function"""
        # Valid HTML should pass
        safe_html = '<p>Safe content with <a href="/internal">internal link</a></p>'
        result = validate_internal_html(safe_html)
        self.assertIn('internal link', result)

        # External link should raise ValidationError
        with self.assertRaises(ValidationError):
            validate_internal_html('<a href="http://evil.com">External</a>')

        # JavaScript link should raise ValidationError
        with self.assertRaises(ValidationError):
            validate_internal_html('<a href="javascript:alert(1)">XSS</a>')

        # Disallowed tag should raise ValidationError
        with self.assertRaises(ValidationError):
            validate_internal_html('<script>alert(1)</script>')
