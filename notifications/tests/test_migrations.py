from django.db import connection, transaction
from django.test import TestCase

from files.tests.helpers import create_test_user
from notifications.services import NotificationService


class FilterColumnTransitionTest(TestCase):
    """Issue #1145: processes from the previous release read these columns until they restart."""

    def test_columns_stay_and_rows_from_this_release_get_an_empty_filter(self):
        preferences = NotificationService.get_or_create_preferences(create_test_user())

        for column in ("filter_topics", "filter_categories"):
            with self.subTest(column=column), transaction.atomic(), connection.cursor() as cursor:
                cursor.execute(
                    f"SELECT {column}::text FROM notifications_notificationpreference WHERE id = %s",  # noqa: S608
                    [preferences.pk],
                )
                self.assertEqual(cursor.fetchone(), ("[]",))
