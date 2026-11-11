"""Media rows loaded with deferred fields (#1105)."""

from unittest.mock import patch

from django.db import OperationalError, connection
from django.test import TestCase

from files.models import Media
from files.tests.helpers import create_test_media, create_test_user
from files.token_utils import generate_token, invalidate_media_tokens, validate_token


class MediaDeferredLoadingTest(TestCase):
    def setUp(self):
        self.media = create_test_media(create_test_user())
        Media.objects.filter(pk=self.media.pk).update(title="Stored title")

    def test_only_loads_media_in_one_query(self):
        with self.assertNumQueries(1):
            media = Media.objects.only("id", "title").get(pk=self.media.pk)

        self.assertEqual(media.title, "Stored title")

    def test_reading_a_deferred_field_loads_it_in_one_query(self):
        media = Media.objects.defer("title").get(pk=self.media.pk)

        with self.assertNumQueries(1):
            self.assertEqual(media.title, "Stored title")

    def test_refresh_from_db_with_fields_reloads_a_fully_loaded_media(self):
        media = Media.objects.get(pk=self.media.pk)
        Media.objects.filter(pk=self.media.pk).update(title="Renamed elsewhere")

        with self.assertNumQueries(1):
            media.refresh_from_db(fields=["title"])

        self.assertEqual(media.title, "Renamed elsewhere")


class MediaDeferredSaveTest(TestCase):
    def setUp(self):
        self.user = create_test_user()

    def test_publishing_a_media_loaded_with_only_notifies_users(self):
        stored = create_test_media(self.user, state="private")
        media = Media.objects.only("id", "title").get(pk=stored.pk)

        media.state = "public"
        with patch("files.methods.notify_users") as notify_users:
            media.save()

        self.assertEqual(Media.objects.get(pk=stored.pk).state, "public")
        notify_users.assert_any_call(friendly_token=stored.friendly_token, action="media_published")

    def test_retrying_a_save_after_the_originals_lookup_fails_still_notifies_users(self):
        stored = create_test_media(self.user, state="private")
        media = Media.objects.only("id", "title").get(pk=stored.pk)
        media.state = "public"
        failed_sql = []

        def fail_first_query(execute, sql, params, many, context):
            if not failed_sql:
                failed_sql.append(sql)
                raise OperationalError("database unavailable")
            return execute(sql, params, many, context)

        with connection.execute_wrapper(fail_first_query), self.assertRaises(OperationalError):
            media.save()
        self.assertIn('"files_media"."state"', failed_sql[0])

        with patch("files.methods.notify_users") as notify_users:
            media.save()

        notify_users.assert_any_call(friendly_token=stored.friendly_token, action="media_published")

    def test_editing_the_title_of_a_media_loaded_with_only_keeps_viewer_access(self):
        stored = create_test_media(self.user, state="restricted", password="viewer-secret")
        token = generate_token(stored.uid_hex)
        self.addCleanup(invalidate_media_tokens, stored.uid_hex)
        media = Media.objects.only("id", "title").get(pk=stored.pk)

        media.title = "Edited title"
        media.save()

        self.assertEqual(Media.objects.get(pk=stored.pk).title, "Edited title")
        self.assertTrue(validate_token(token, stored.uid_hex))
