"""
Tests for data migrations to ensure data integrity during schema changes.
"""

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase

from files.models import Media
from files.tests.helpers import create_test_media, create_test_user

User = get_user_model()


class TestMediaStateMigration(TestCase):
    """
    Test the migration logic that converts 'private_verified' state to 'private'.

    Uses create_test_media helper (which patches media_init) then sets
    invalid state via raw SQL UPDATE to simulate pre-migration data.
    """

    def setUp(self):
        self.user = create_test_user()

    def _set_state_raw(self, media_id, state):
        with connection.cursor() as cursor:
            cursor.execute("UPDATE files_media SET state = %s WHERE id = %s", [state, media_id])

    def _get_state_raw(self, media_id):
        with connection.cursor() as cursor:
            cursor.execute("SELECT state FROM files_media WHERE id = %s", [media_id])
            return cursor.fetchone()[0]

    def _run_state_migration(self):
        """Run the fix_invalid_state_values migration logic."""
        return Media.objects.filter(state="private_verified").update(state="private")

    def test_private_verified_state_migration(self):
        """Test that 'private_verified' state is migrated to 'private'."""
        media = create_test_media(self.user, state="public")
        self._set_state_raw(media.id, "private_verified")
        self.assertEqual(self._get_state_raw(media.id), "private_verified")

        updated = self._run_state_migration()
        self.assertEqual(updated, 1)
        self.assertEqual(self._get_state_raw(media.id), "private")

    def test_existing_private_state_unchanged(self):
        """Test that records already in 'private' state remain unchanged."""
        media = create_test_media(self.user, state="private")
        self._run_state_migration()
        self.assertEqual(self._get_state_raw(media.id), "private")

    def test_other_states_unchanged(self):
        """Test that records with other valid states remain unchanged."""
        states_to_test = ["public", "unlisted", "restricted"]
        media_list = [(create_test_media(self.user, state=s), s) for s in states_to_test]

        self._run_state_migration()

        for media, expected_state in media_list:
            self.assertEqual(
                self._get_state_raw(media.id),
                expected_state,
                f"State for media {media.id} should remain {expected_state}",
            )

    def test_migration_count_reporting(self):
        """Test that the migration correctly updates multiple records."""
        media_list = [create_test_media(self.user, state="public") for _ in range(5)]

        for media in media_list[:3]:
            self._set_state_raw(media.id, "private_verified")

        updated = self._run_state_migration()
        self.assertEqual(updated, 3)

        for media in media_list[:3]:
            self.assertEqual(self._get_state_raw(media.id), "private")

        for media in media_list[3:]:
            self.assertEqual(self._get_state_raw(media.id), "public")


class TestMediaStateFieldConstraints(TestCase):
    """
    Test that the Media.state field has correct constraints after migration.
    """

    def test_state_field_default_is_valid(self):
        """Test that the default value for state field is a valid choice."""
        user = create_test_user()
        media = Media(title="Test Media", summary="Test summary", user=user)

        valid_states = ["private", "public", "unlisted", "restricted"]
        self.assertIn(
            media.state, valid_states, f"Default state '{media.state}' is not in valid choices: {valid_states}"
        )

    def test_invalid_state_raises_validation_error(self):
        """Test that 'private_verified' state is rejected by validation."""
        from django.core.exceptions import ValidationError

        user = create_test_user()
        media = Media(title="Test Media Invalid", summary="Test summary", user=user, state="private_verified")

        with self.assertRaises(ValidationError) as context:
            media.full_clean()

        self.assertIn("state", context.exception.message_dict)
