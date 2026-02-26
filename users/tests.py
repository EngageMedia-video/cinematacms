# from allauth.mfa.utils import encrypt, decrypt
import time

from allauth.mfa.totp.internal.auth import (
    TOTP,
    format_hotp_value,
    generate_totp_secret,
    hotp_value,
    validate_totp_code,
    yield_hotp_counters_from_time,
)
from django.test import Client, TestCase, override_settings
from django.urls import reverse

from .models import User


@override_settings(MFA_REQUIRED_ROLES=["superuser", "manager", "curator"])
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
            username=self.superuser_username, email=self.superuser_email, password=self.superuser_password
        )

        # Setup the test client
        self.client = Client()

    def test_successful_login(self):
        """Test that a (regular) user can successfully log in with correct credentials"""
        # Get the login URL
        login_url = reverse("account_login")

        # Attempt to login with correct credentials
        response = self.client.post(
            login_url,
            {
                "login": self.username,  # allauth uses 'login' for username or email
                "password": self.password,
            },
        )

        # Check if the login was successful (should redirect to home page)
        self.assertRedirects(response, "/", fetch_redirect_response=False)

        # Verify the user is authenticated
        self.assertTrue(response.wsgi_request.user.is_authenticated)
        self.assertEqual(response.wsgi_request.user.username, self.username)

    def test_superuser_redirect(self):
        """Test that checks if a new superuser on creation has been redirected to the MFA setup page"""
        login_url = reverse("account_login")
        response = self.client.post(login_url, {"login": self.superuser_username, "password": self.superuser_password})

        # Check if the login was successful (should redirect to home page)
        self.assertRedirects(response, "/accounts/2fa/totp/activate", fetch_redirect_response=False)

        # Verify the user is authenticated
        self.assertTrue(response.wsgi_request.user.is_authenticated)
        self.assertEqual(response.wsgi_request.user.username, self.superuser_username)


@override_settings(MFA_REQUIRED_ROLES=["superuser", "manager", "curator"])
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
            username="superuser", email="super@example.com", password="superpassword123"
        )

        self.editor_user = User.objects.create_user(
            username="editor", email="editor@example.com", password="editorpass123", is_editor=True
        )

        self.manager_user = User.objects.create_user(
            username="manager", email="manager@example.com", password="managerpass123", is_manager=True
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
        login_url = reverse("account_login")
        response = self.client.post(login_url, {"login": self.superuser.username, "password": "superpassword123"})

        # Should redirect to MFA setup
        self.assertRedirects(response, "/accounts/2fa/totp/activate", fetch_redirect_response=False)
        self.assertTrue(response.wsgi_request.user.is_authenticated)

    def test_regular_user_no_mfa_redirect(self):
        """Test that regular users are not forced to set up MFA"""
        login_url = reverse("account_login")
        response = self.client.post(login_url, {"login": self.regular_user.username, "password": "testpassword123"})

        # Should redirect to home page
        self.assertRedirects(response, "/", fetch_redirect_response=False)
        self.assertTrue(response.wsgi_request.user.is_authenticated)

    def test_editor_mfa_redirect(self):
        """Test that editors are not redirected to MFA setup"""
        login_url = reverse("account_login")
        response = self.client.post(login_url, {"login": self.editor_user.username, "password": "editorpass123"})

        # Should redirect to MFA setup
        self.assertRedirects(response, "/", fetch_redirect_response=False)
        self.assertTrue(response.wsgi_request.user.is_authenticated)

    def test_manager_mfa_redirect(self):
        """Test that managers are redirected to MFA setup"""
        login_url = reverse("account_login")
        response = self.client.post(login_url, {"login": self.manager_user.username, "password": "managerpass123"})

        # Should redirect to MFA setup (manager is in MFA_REQUIRED_ROLES)
        self.assertRedirects(response, "/accounts/2fa/totp/activate", fetch_redirect_response=False)
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
        TOTP.activate(self.superuser, secret)

        # Attempt login
        login_url = reverse("account_login")
        response = self.client.post(
            login_url, {"login": self.superuser.username, "password": "superpassword123"}, follow=True
        )

        # Should be redirected to MFA authentication page
        self.assertContains(response, "Two-Factor Authentication")

        # Submit TOTP code
        valid_code = self._generate_valid_totp_code(secret)
        mfa_auth_url = reverse("mfa_authenticate")
        response = self.client.post(mfa_auth_url, {"code": valid_code}, follow=True)

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
        self.client.login(username="superuser", password="superpassword123")

        # Visit success page
        success_url = reverse("mfa_success")
        response = self.client.get(success_url)

        self.assertEqual(response.status_code, 200)
        self.assertTemplateUsed(response, "mfa/totp/success.html")
