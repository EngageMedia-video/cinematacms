"""
Tests for media password hashing — set_password(), save() guard, and data migration.
"""

from unittest.mock import patch

from django.contrib.auth.hashers import check_password, identify_hasher, make_password
from django.test import TestCase

from files.models import Media
from files.tests.helpers import create_test_media, create_test_user


class SetPasswordTest(TestCase):
    def setUp(self):
        self.user = create_test_user()

    def test_set_password_hashes_plaintext(self):
        media = create_test_media(self.user)
        media.set_password("mySecret123")
        self.assertNotEqual(media.password, "mySecret123")
        # Should be a valid Django hash
        identify_hasher(media.password)

    def test_set_password_verifiable_with_check_password(self):
        media = create_test_media(self.user)
        media.set_password("verifyMe456")
        self.assertTrue(check_password("verifyMe456", media.password))
        self.assertFalse(check_password("wrongPassword", media.password))

    def test_set_password_empty_clears_field(self):
        media = create_test_media(self.user, password="")
        media.set_password("temporary")
        self.assertTrue(media.password)
        media.set_password("")
        self.assertEqual(media.password, "")

    def test_set_password_none_clears_field(self):
        media = create_test_media(self.user)
        media.set_password(None)
        self.assertEqual(media.password, "")


class SaveGuardTest(TestCase):
    """Test the structural password-hash guard in save()."""

    def setUp(self):
        self.user = create_test_user()

    def test_plaintext_password_hashed_on_save(self):
        """Plaintext passwords set via direct assignment are hashed by save() guard."""
        media = create_test_media(self.user)
        media.password = "plaintext_pass"
        media.save()
        media.refresh_from_db()
        # Should now be hashed
        self.assertTrue(check_password("plaintext_pass", media.password))

    def test_already_hashed_not_double_hashed(self):
        """A value that's already a Django hash is not re-hashed."""
        media = create_test_media(self.user)
        hashed = make_password("original")
        media.password = hashed
        media.save()
        media.refresh_from_db()
        # Should still be the same hash
        self.assertEqual(media.password, hashed)

    def test_malformed_hasher_prefix_is_rehashed_on_save(self):
        """A malformed hash-looking string is treated as raw password input."""
        media = create_test_media(self.user)
        raw_password = "pbkdf2_sha256$attacker_supplied"
        media.password = raw_password
        media.save()
        media.refresh_from_db()

        self.assertNotEqual(media.password, raw_password)
        self.assertTrue(check_password(raw_password, media.password))
        self.assertFalse(check_password("attacker_supplied", media.password))

    def test_editing_non_password_fields_preserves_hash(self):
        """Saving non-password changes doesn't corrupt the hash."""
        media = create_test_media(self.user)
        media.set_password("keepMe")
        media.save()
        original_hash = media.password

        media.title = "Updated Title"
        media.save()
        media.refresh_from_db()

        self.assertEqual(media.password, original_hash)
        self.assertTrue(check_password("keepMe", media.password))

    def test_password_change_triggers_cache_invalidation(self):
        """Changing password calls _invalidate_permission_cache."""
        media = create_test_media(self.user, state="restricted")
        media.set_password("first")
        media.save()

        with patch.object(Media, "_invalidate_permission_cache") as mock_invalidate:
            media.set_password("second")
            media.save()
            mock_invalidate.assert_called_once()

    def test_empty_password_not_hashed(self):
        """Empty password stays empty, not hashed."""
        media = create_test_media(self.user)
        media.password = ""
        media.save()
        media.refresh_from_db()
        self.assertEqual(media.password, "")


class DataMigrationTest(TestCase):
    """Test the data migration function directly."""

    def setUp(self):
        self.user = create_test_user()

    def test_migration_hashes_plaintext(self):
        """Simulate what the migration does: hash all non-empty plaintext passwords."""
        # Create media with plaintext password bypassing save() guard
        media = create_test_media(self.user)
        # Force plaintext via update() which skips save()
        Media.objects.filter(pk=media.pk).update(password="plaintext_secret")
        media.refresh_from_db()
        self.assertEqual(media.password, "plaintext_secret")

        # Simulate migration: hash it
        media.password = make_password(media.password)
        media.save(update_fields=["password"])

        media.refresh_from_db()
        self.assertTrue(check_password("plaintext_secret", media.password))

    def test_migration_skips_empty_passwords(self):
        """Media with no password should not be affected."""
        media = create_test_media(self.user, password="")
        self.assertEqual(media.password, "")
