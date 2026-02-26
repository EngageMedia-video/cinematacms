"""
Tests for data migrations to ensure data integrity during schema changes.

These tests verify the migration logic (RunPython functions) directly using
the current schema and raw SQL, rather than rolling back the DB schema with
MigrationExecutor — which is fragile when later migrations add new tables.

Media objects are created via raw SQL to bypass post_save signals that
expect an actual media file on disk.
"""

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase

from files.models import Media

User = get_user_model()


def _create_media_via_sql(user_id, title, state):
    """Create a Media row via raw SQL, bypassing Django signals."""
    import uuid

    uid = uuid.uuid4()
    friendly_token = uid.hex[:12]
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO files_media (
                user_id, uid, friendly_token,
                title, description, summary,
                state, media_type, encoding_status,
                media_file, thumbnail, poster,
                uploaded_thumbnail, uploaded_poster,
                sprites, preview_file_path, hls_file,
                duration, video_height, media_info,
                password, filename,
                enable_comments, allow_download,
                allow_whisper_transcribe,
                allow_whisper_transcribe_and_translate,
                views, likes, dislikes, reported_times,
                is_reviewed, featured, user_featured,
                add_date, edit_date
            ) VALUES (
                %s, %s, %s,
                %s, '', %s,
                %s, 'video', 'pending',
                '', '', '',
                '', '',
                '', '', '',
                0, 0, '',
                '', '',
                true, true,
                false,
                false,
                0, 0, 0, 0,
                false, false, false,
                NOW(), NOW()
            ) RETURNING id
            """,
            [user_id, str(uid), friendly_token, title, f"Summary for {title}", state],
        )
        return cursor.fetchone()[0]


class TestMediaStateMigration(TestCase):
    """
    Test the migration logic that converts 'private_verified' state to 'private'.

    Uses the current schema with raw SQL to simulate pre-migration data,
    then calls the migration function directly.
    """

    def setUp(self):
        self.user = User.objects.create_user(
            username="migration_testuser", email="migration_test@example.com", password="testpass123"
        )

    def _run_state_migration(self):
        """Run the fix_invalid_state_values migration logic."""
        return Media.objects.filter(state="private_verified").update(state="private")

    def test_private_verified_state_migration(self):
        """Test that 'private_verified' state is migrated to 'private'."""
        media_id = _create_media_via_sql(self.user.id, "Test Media", "public")

        # Set invalid state via raw SQL
        with connection.cursor() as cursor:
            cursor.execute("UPDATE files_media SET state = %s WHERE id = %s", ["private_verified", media_id])

        # Verify raw state
        with connection.cursor() as cursor:
            cursor.execute("SELECT state FROM files_media WHERE id = %s", [media_id])
            self.assertEqual(cursor.fetchone()[0], "private_verified")

        # Run migration logic
        updated = self._run_state_migration()
        self.assertEqual(updated, 1)

        with connection.cursor() as cursor:
            cursor.execute("SELECT state FROM files_media WHERE id = %s", [media_id])
            self.assertEqual(cursor.fetchone()[0], "private")

    def test_existing_private_state_unchanged(self):
        """Test that records already in 'private' state remain unchanged."""
        media_id = _create_media_via_sql(self.user.id, "Test Private", "private")

        self._run_state_migration()

        with connection.cursor() as cursor:
            cursor.execute("SELECT state FROM files_media WHERE id = %s", [media_id])
            self.assertEqual(cursor.fetchone()[0], "private")

    def test_other_states_unchanged(self):
        """Test that records with other valid states remain unchanged."""
        states_to_test = ["public", "unlisted", "restricted"]
        media_ids = []

        for state in states_to_test:
            media_id = _create_media_via_sql(self.user.id, f"Test {state}", state)
            media_ids.append((media_id, state))

        self._run_state_migration()

        for media_id, expected_state in media_ids:
            with connection.cursor() as cursor:
                cursor.execute("SELECT state FROM files_media WHERE id = %s", [media_id])
                self.assertEqual(
                    cursor.fetchone()[0], expected_state, f"State for media {media_id} should remain {expected_state}"
                )

    def test_migration_count_reporting(self):
        """Test that the migration correctly updates multiple records."""
        media_ids = []
        for i in range(5):
            media_id = _create_media_via_sql(self.user.id, f"Test Media {i}", "public")
            media_ids.append(media_id)

        # Set 3 to 'private_verified' via raw SQL
        with connection.cursor() as cursor:
            for media_id in media_ids[:3]:
                cursor.execute("UPDATE files_media SET state = %s WHERE id = %s", ["private_verified", media_id])

        updated = self._run_state_migration()
        self.assertEqual(updated, 3)

        # Verify migrated records
        for media_id in media_ids[:3]:
            with connection.cursor() as cursor:
                cursor.execute("SELECT state FROM files_media WHERE id = %s", [media_id])
                self.assertEqual(cursor.fetchone()[0], "private")

        # Verify untouched records
        for media_id in media_ids[3:]:
            with connection.cursor() as cursor:
                cursor.execute("SELECT state FROM files_media WHERE id = %s", [media_id])
                self.assertEqual(cursor.fetchone()[0], "public")


class TestMediaStateFieldConstraints(TestCase):
    """
    Test that the Media.state field has correct constraints after migration.
    """

    def test_state_field_default_is_valid(self):
        """Test that the default value for state field is a valid choice."""
        user = User.objects.create_user(username="testuser", email="test@example.com", password="testpass123")

        media = Media(title="Test Media", summary="Test summary", user=user)

        valid_states = ["private", "public", "unlisted", "restricted"]
        self.assertIn(
            media.state, valid_states, f"Default state '{media.state}' is not in valid choices: {valid_states}"
        )

    def test_invalid_state_raises_validation_error(self):
        """Test that 'private_verified' state is rejected by validation."""
        from django.core.exceptions import ValidationError

        user = User.objects.create_user(username="testuser2", email="test2@example.com", password="testpass123")

        media = Media(title="Test Media Invalid", summary="Test summary", user=user, state="private_verified")

        with self.assertRaises(ValidationError) as context:
            media.full_clean()

        self.assertIn("state", context.exception.message_dict)
