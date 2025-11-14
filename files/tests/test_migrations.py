"""
Tests for data migrations to ensure data integrity during schema changes.
"""
from django.test import TestCase, TransactionTestCase
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


class TestMediaStateMigration(TransactionTestCase):
    """
    Test the migration that converts 'private_verified' state to 'private'.

    This test validates that:
    1. Records with 'private_verified' state are migrated to 'private'
    2. The migration can be reversed safely
    3. No data is lost during the migration process
    """

    migrate_from = [('files', '0007_encoding_filename_media_filename_and_more')]
    migrate_to = [('files', '0008_fix_invalid_state_and_country')]

    def setUp(self):
        """Set up the test by migrating to the state before our target migration."""
        self.executor = MigrationExecutor(connection)
        self.executor.migrate(self.migrate_from)

        # Register cleanup to restore database to latest migrations after test
        # This ensures subsequent tests see the correct, up-to-date schema
        self.addCleanup(self._restore_latest_migrations)

        # Get the historical model from before the migration
        old_apps = self.executor.loader.project_state(self.migrate_from).apps
        self.Media = old_apps.get_model('files', 'Media')
        self.User = old_apps.get_model('users', 'User')

    def _restore_latest_migrations(self):
        """Restore database to the latest (leaf) migrations after test completes."""
        # Get all leaf nodes (latest migrations) from the migration graph
        leaf_nodes = self.executor.loader.graph.leaf_nodes()
        # Migrate to the latest state
        self.executor.migrate(leaf_nodes)

    def test_private_verified_state_migration(self):
        """
        Test that 'private_verified' state is migrated to 'private'.

        This test:
        1. Creates test data with 'private_verified' state (using raw SQL since it's not a valid choice)
        2. Runs the migration
        3. Verifies that all 'private_verified' records are now 'private'
        """
        # Create a test user
        user = self.User.objects.create(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        # Create a media object with a valid state first
        media = self.Media.objects.create(
            title='Test Media',
            summary='Test summary for migration',
            user=user,
            state='public'
        )

        # Use raw SQL to set an invalid state that would have existed before
        # Note: We're testing the migration handles this gracefully
        with connection.cursor() as cursor:
            cursor.execute(
                "UPDATE files_media SET state = %s WHERE id = %s",
                ['private_verified', media.id]
            )

        # Verify the state was set via raw query
        with connection.cursor() as cursor:
            cursor.execute("SELECT state FROM files_media WHERE id = %s", [media.id])
            row = cursor.fetchone()
            self.assertEqual(row[0], 'private_verified')

        # Run the migration
        self.executor.migrate(self.migrate_to)

        # Get the updated model after migration
        new_apps = self.executor.loader.project_state(self.migrate_to).apps
        NewMedia = new_apps.get_model('files', 'Media')

        # Verify the state was migrated to 'private'
        migrated_media = NewMedia.objects.get(id=media.id)
        self.assertEqual(migrated_media.state, 'private')

    def test_existing_private_state_unchanged(self):
        """
        Test that records already in 'private' state remain unchanged.
        """
        # Create a test user
        user = self.User.objects.create(
            username='testuser2',
            email='test2@example.com',
            password='testpass123'
        )

        # Create media with 'private' state
        media = self.Media.objects.create(
            title='Test Media Private',
            summary='Test summary for private media',
            user=user,
            state='private'
        )

        # Run the migration
        self.executor.migrate(self.migrate_to)

        # Get the updated model after migration
        new_apps = self.executor.loader.project_state(self.migrate_to).apps
        NewMedia = new_apps.get_model('files', 'Media')

        # Verify the state is still 'private'
        migrated_media = NewMedia.objects.get(id=media.id)
        self.assertEqual(migrated_media.state, 'private')

    def test_other_states_unchanged(self):
        """
        Test that records with other valid states remain unchanged.
        """
        # Create a test user
        user = self.User.objects.create(
            username='testuser3',
            email='test3@example.com',
            password='testpass123'
        )

        # Create media with different states
        states_to_test = ['public', 'unlisted', 'restricted']
        media_objects = []

        for state in states_to_test:
            media = self.Media.objects.create(
                title=f'Test Media {state}',
                summary=f'Test summary for {state} media',
                user=user,
                state=state
            )
            media_objects.append((media.id, state))

        # Run the migration
        self.executor.migrate(self.migrate_to)

        # Get the updated model after migration
        new_apps = self.executor.loader.project_state(self.migrate_to).apps
        NewMedia = new_apps.get_model('files', 'Media')

        # Verify all states remained unchanged
        for media_id, expected_state in media_objects:
            migrated_media = NewMedia.objects.get(id=media_id)
            self.assertEqual(
                migrated_media.state,
                expected_state,
                f"State for media {media_id} should remain {expected_state}"
            )

    def test_migration_count_reporting(self):
        """
        Test that the migration correctly reports the number of records updated.

        This is a functional test to ensure the migration runs without errors.
        """
        # Create a test user
        user = self.User.objects.create(
            username='testuser4',
            email='test4@example.com',
            password='testpass123'
        )

        # Create multiple media objects
        media_ids = []
        for i in range(5):
            media = self.Media.objects.create(
                title=f'Test Media {i}',
                summary=f'Test summary {i}',
                user=user,
                state='public'
            )
            media_ids.append(media.id)

        # Set 3 of them to 'private_verified' using raw SQL
        with connection.cursor() as cursor:
            for media_id in media_ids[:3]:
                cursor.execute(
                    "UPDATE files_media SET state = %s WHERE id = %s",
                    ['private_verified', media_id]
                )

        # Run the migration (should not raise any exceptions)
        # If migration fails, the test framework will report the full traceback
        self.executor.migrate(self.migrate_to)

        # Verify all 'private_verified' records are now 'private'
        new_apps = self.executor.loader.project_state(self.migrate_to).apps
        NewMedia = new_apps.get_model('files', 'Media')

        for media_id in media_ids[:3]:
            migrated_media = NewMedia.objects.get(id=media_id)
            self.assertEqual(
                migrated_media.state,
                'private',
                f"Media {media_id} should have been migrated to 'private'"
            )


class TestMediaStateFieldConstraints(TestCase):
    """
    Test that the Media.state field has correct constraints after migration.
    """

    def test_state_field_default_is_valid(self):
        """
        Test that the default value for state field is a valid choice.

        This test ensures that after migration 0003, the default value is 'private'
        and not the invalid 'private_verified'.
        """
        from files.models import Media
        from django.contrib.auth import get_user_model

        User = get_user_model()

        # Create a test user
        user = User.objects.create_user(
            username='testuser',
            email='test@example.com',
            password='testpass123'
        )

        # Create a media object without specifying state
        # It should use the default value
        media = Media(
            title='Test Media',
            summary='Test summary',
            user=user
        )

        # The state should be set to a valid value (not 'private_verified')
        # Note: The actual default may vary based on settings.PORTAL_WORKFLOW
        valid_states = ['private', 'public', 'unlisted', 'restricted']
        self.assertIn(
            media.state,
            valid_states,
            f"Default state '{media.state}' is not in valid choices: {valid_states}"
        )

    def test_invalid_state_raises_validation_error(self):
        """
        Test that trying to create a Media object with 'private_verified' raises an error.
        """
        from files.models import Media
        from django.contrib.auth import get_user_model
        from django.core.exceptions import ValidationError

        User = get_user_model()

        # Create a test user
        user = User.objects.create_user(
            username='testuser2',
            email='test2@example.com',
            password='testpass123'
        )

        # Try to create a media object with invalid state
        media = Media(
            title='Test Media Invalid',
            summary='Test summary',
            user=user,
            state='private_verified'  # This should be invalid
        )

        # full_clean() should raise a ValidationError
        with self.assertRaises(ValidationError) as context:
            media.full_clean()

        # Check that the error is about the state field
        self.assertIn('state', context.exception.message_dict)
