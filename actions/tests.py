import importlib
import json
from contextlib import contextmanager
from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.apps import apps
from django.contrib.auth.models import Permission
from django.core.checks import Tags, run_checks
from django.core.exceptions import ImproperlyConfigured
from django.core.management import call_command
from django.db import IntegrityError, connection, transaction
from django.db.migrations.recorder import MigrationRecorder
from django.db.models import Case, CharField, F, Value, When
from django.db.models.expressions import RawSQL
from django.db.models.functions import Cast
from django.test import SimpleTestCase, TestCase, TransactionTestCase, override_settings
from django.urls import reverse
from django.utils import timezone

from actions.models import MediaAction
from files.helpers import mask_ip
from files.models import Media
from files.tasks import save_user_action
from files.tests.helpers import create_test_media, create_test_user

media_report_migration = importlib.import_module("actions.migrations.0007_media_report")

MASKED_IP = "b2bf3fb7f6fa9ada2eed90c09545ae95cdc046aea1bffb465e3a8c0c1811d451"


@override_settings(MASK_IPS_FOR_ACTIONS=True, MEDIA_ACTION_IP_HMAC_KEY="action-ip-test-key")
class MediaActionIPTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.media = create_test_media(create_test_user())

    def test_create_masks_the_stored_ip(self):
        action = MediaAction.objects.create(media=self.media, remote_ip="203.0.113.42")

        action.refresh_from_db()

        self.assertEqual(action.remote_ip, MASKED_IP)

    def test_already_masked_ip_survives_repeated_saves(self):
        action = MediaAction.objects.create(media=self.media, remote_ip=MASKED_IP)
        action.refresh_from_db()
        action.save()
        action.refresh_from_db()

        self.assertEqual(action.remote_ip, MASKED_IP)

    def test_save_masks_the_ipv6_64(self):
        action = MediaAction(media=self.media, remote_ip="2001:db8::42")
        action.save()
        action.refresh_from_db()

        # HMAC-SHA256("action-ip-test-key", "2001:db8::/64")
        self.assertEqual(action.remote_ip, "edf4dfb8288c426b4b4be48e2a941e65c8f08b537e996f9c99e5427bb1678464")

    def test_bulk_create_masks_the_stored_ip(self):
        MediaAction.objects.bulk_create([MediaAction(media=self.media, remote_ip="203.0.113.42")])

        self.assertEqual(MediaAction.objects.get().remote_ip, MASKED_IP)

    def test_updates_mask_the_stored_ip(self):
        for writer in ("save", "update", "bulk_update"):
            with self.subTest(writer=writer):
                action = MediaAction.objects.create(media=self.media)
                action.remote_ip = "203.0.113.42"
                if writer == "save":
                    action.save(update_fields=["remote_ip"])
                elif writer == "update":
                    MediaAction.objects.filter(pk=action.pk).update(remote_ip=action.remote_ip)
                else:
                    MediaAction.objects.bulk_update([action], ["remote_ip"])
                action.refresh_from_db()

                self.assertEqual(action.remote_ip, MASKED_IP)

    def test_raw_and_masked_ip_lookups_find_the_same_action(self):
        action = MediaAction.objects.create(media=self.media, remote_ip="203.0.113.42")

        self.assertEqual(MediaAction.objects.get(remote_ip="203.0.113.42"), action)
        self.assertEqual(MediaAction.objects.get(remote_ip=MASKED_IP), action)

    def test_missing_ip_stays_empty(self):
        for ip in (None, ""):
            with self.subTest(ip=ip):
                action = MediaAction.objects.create(media=self.media, remote_ip=ip)
                action.refresh_from_db()

                self.assertEqual(action.remote_ip, ip)

    @override_settings(MASK_IPS_FOR_ACTIONS=False)
    def test_disabled_masking_preserves_raw_ips(self):
        for ip in ("203.0.113.42", "2001:db8::42"):
            with self.subTest(ip=ip):
                action = MediaAction.objects.create(media=self.media, remote_ip=ip)
                action.refresh_from_db()

                self.assertEqual(action.remote_ip, ip)

    def test_anonymous_media_view_stores_a_single_mask(self):
        response = self.client.get("/view", {"m": self.media.friendly_token}, REMOTE_ADDR="203.0.113.42")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(MediaAction.objects.get(action="watch").remote_ip, MASKED_IP)

    def test_inline_reactions_mask_the_stored_ip(self):
        self.client.force_login(self.media.user)
        for action in ("like", "dislike"):
            with self.subTest(action=action):
                response = self.client.post(
                    f"/api/v1/media/{self.media.friendly_token}/actions",
                    data=json.dumps({"type": action}),
                    content_type="application/json",
                    REMOTE_ADDR="203.0.113.42",
                )

                self.assertEqual(response.status_code, 201)
                self.assertEqual(MediaAction.objects.get(action=action).remote_ip, MASKED_IP)

    def test_malformed_remote_addr_records_actions_without_an_ip(self):
        response = self.client.get("/view", {"m": self.media.friendly_token}, REMOTE_ADDR="not-an-ip")
        self.assertEqual(response.status_code, 200)

        self.client.force_login(self.media.user)
        response = self.client.post(
            f"/api/v1/media/{self.media.friendly_token}/actions",
            data=json.dumps({"type": "like"}),
            content_type="application/json",
            REMOTE_ADDR="not-an-ip",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(MediaAction.objects.filter(action__in=("watch", "like"), remote_ip=None).count(), 2)

    @override_settings(MAX_ANONYMOUS_VIEWS_PER_5SEC=1)
    def test_task_masks_raw_ip_and_preserves_rate_limiting(self):
        for session in ("first-visitor", "second-visitor"):
            save_user_action(
                {"user_session": session, "remote_ip_addr": "203.0.113.42"},
                friendly_token=self.media.friendly_token,
            )

        action = MediaAction.objects.get()
        self.assertEqual(action.remote_ip, MASKED_IP)
        self.assertEqual(action.session_key, "first-visitor")
        self.media.refresh_from_db()
        self.assertEqual(self.media.views, 1)

    @override_settings(MAX_ANONYMOUS_VIEWS_PER_5SEC=1)
    def test_rotating_addresses_within_an_ipv6_64_share_the_view_limit(self):
        for session, ip in (("first-visitor", "2001:db8:1:2::1"), ("second-visitor", "2001:db8:1:2::2")):
            save_user_action({"user_session": session, "remote_ip_addr": ip}, friendly_token=self.media.friendly_token)

        self.media.refresh_from_db()
        self.assertEqual(self.media.views, 1)

    @override_settings(MAX_ANONYMOUS_VIEWS_PER_5SEC=1)
    def test_rate_limit_log_does_not_expose_raw_ips(self):
        save_user_action(
            {"user_session": "first-visitor", "remote_ip_addr": "203.0.113.42"},
            friendly_token=self.media.friendly_token,
        )
        with self.assertLogs("files.methods", level="WARNING") as logs:
            save_user_action(
                {"user_session": "second-visitor", "remote_ip_addr": "203.0.113.42"},
                friendly_token=self.media.friendly_token,
            )
        self.assertNotIn("203.0.113.42", " ".join(logs.output))

    def test_expression_cannot_copy_a_raw_ip_into_storage(self):
        action = MediaAction.objects.create(media=self.media, extra_info="203.0.113.42")

        with self.assertRaisesMessage(ValueError, "remote_ip requires literal values"), transaction.atomic():
            MediaAction.objects.filter(pk=action.pk).update(remote_ip=F("extra_info"))

        action.refresh_from_db()
        self.assertIsNone(action.remote_ip)

    def test_literal_case_and_cast_expressions_are_masked(self):
        action = MediaAction.objects.create(media=self.media)
        for expression in (
            Value("203.0.113.42", output_field=CharField()),
            Case(When(pk=action.pk, then=Value("203.0.113.42")), default=None),
            Cast(Value("203.0.113.42"), output_field=CharField()),
            Cast(Value("203.0.113.42"), output_field=CharField(max_length=5)),
        ):
            with self.subTest(expression=type(expression).__name__):
                MediaAction.objects.filter(pk=action.pk).update(remote_ip=expression)
                action.refresh_from_db()
                self.assertEqual(action.remote_ip, MASKED_IP)

    def test_nested_column_and_raw_sql_expressions_are_rejected(self):
        action = MediaAction.objects.create(media=self.media, extra_info="203.0.113.42")
        for expression in (
            Case(When(pk=action.pk, then=F("extra_info")), default=None),
            Case(When(pk=action.pk, then=None), default=F("extra_info")),
            Cast(F("extra_info"), output_field=CharField()),
            RawSQL("%s", ["203.0.113.42"]),
        ):
            with self.subTest(expression=type(expression).__name__):
                with self.assertRaisesMessage(ValueError, "remote_ip requires literal values"), transaction.atomic():
                    MediaAction.objects.filter(pk=action.pk).update(remote_ip=expression)
        action.refresh_from_db()
        self.assertIsNone(action.remote_ip)


class IPMaskKeyTests(SimpleTestCase):
    @override_settings(MEDIA_ACTION_IP_HMAC_KEY="action-ip-test-key", SECRET_KEY="unrelated-django-key")
    def test_mask_uses_the_dedicated_hmac_key(self):
        self.assertEqual(mask_ip("203.0.113.42"), "b2bf3fb7f6fa9ada2eed90c09545ae95cdc046aea1bffb465e3a8c0c1811d451")

    @override_settings(MASK_IPS_FOR_ACTIONS=True, MEDIA_ACTION_IP_HMAC_KEY="")
    def test_system_check_rejects_a_missing_masking_key(self):
        self.assertIn("actions.E001", [error.id for error in run_checks(tags=[Tags.security])])

    @override_settings(MEDIA_ACTION_IP_HMAC_KEY="action-ip-test-key")
    def test_django_secret_rotation_does_not_change_ip_masks(self):
        with override_settings(SECRET_KEY="first-django-key"):
            first = mask_ip("203.0.113.42")
        with override_settings(SECRET_KEY="second-django-key"):
            self.assertEqual(mask_ip("203.0.113.42"), first)

    @override_settings(MEDIA_ACTION_IP_HMAC_KEY="")
    def test_missing_key_fails_without_a_secret_fallback(self):
        with self.assertRaisesMessage(ImproperlyConfigured, "MEDIA_ACTION_IP_HMAC_KEY is required"):
            mask_ip("203.0.113.42")

    @override_settings(MEDIA_ACTION_IP_HMAC_KEY="action-ip-test-key")
    def test_equivalent_ipv6_addresses_share_a_mask(self):
        self.assertEqual(mask_ip("2001:0db8:0000:0000:0000:0000:0000:0042"), mask_ip("2001:db8::42"))

    @override_settings(MEDIA_ACTION_IP_HMAC_KEY="action-ip-test-key")
    def test_ipv6_addresses_share_a_mask_per_64(self):
        self.assertEqual(mask_ip("2001:db8:1:2::1"), mask_ip("2001:db8:1:2:ffff:ffff:ffff:ffff"))
        self.assertNotEqual(mask_ip("2001:db8:1:2::1"), mask_ip("2001:db8:1:3::1"))

    @override_settings(MEDIA_ACTION_IP_HMAC_KEY="action-ip-test-key")
    def test_ipv4_mapped_ipv6_masks_as_ipv4(self):
        self.assertEqual(mask_ip("::ffff:203.0.113.42"), mask_ip("203.0.113.42"))

    def test_short_key_and_reused_django_key_fail_configuration_checks(self):
        for key, error_id in (("short-key", "actions.E002"), ("x" * 40, "actions.E003")):
            with (
                self.subTest(error_id=error_id),
                override_settings(MASK_IPS_FOR_ACTIONS=True, MEDIA_ACTION_IP_HMAC_KEY=key, SECRET_KEY="x" * 40),
            ):
                self.assertIn(error_id, [error.id for error in run_checks(tags=[Tags.security])])

    @override_settings(MASK_IPS_FOR_ACTIONS=False, MEDIA_ACTION_IP_HMAC_KEY="")
    def test_disabled_masking_does_not_require_a_key(self):
        self.assertFalse(any(error.id.startswith("actions.") for error in run_checks(tags=[Tags.security])))


class IPCleanupTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.media = create_test_media(create_test_user())

    def _create_expired_actions(self, count):
        actions = MediaAction.objects.bulk_create(
            [MediaAction(media=self.media, remote_ip=MASKED_IP) for _ in range(count)]
        )
        MediaAction.objects.filter(pk__in=[action.pk for action in actions]).update(
            action_date=timezone.now() - timedelta(days=8)
        )

    @contextmanager
    def _each_update_takes_50_seconds(self):
        clock = [0.0]

        def slow_update(execute, sql, params, many, context):
            if sql.startswith("UPDATE"):
                clock[0] += 50
            return execute(sql, params, many, context)

        with patch("time.monotonic", side_effect=lambda: clock[0]), connection.execute_wrapper(slow_update):
            yield clock

    def test_cleanup_expires_ips_and_sanitizes_legacy_without_changing_history(self):
        now = timezone.now()
        with override_settings(MASK_IPS_FOR_ACTIONS=False):
            recent = MediaAction.objects.create(media=self.media, remote_ip="203.0.113.42")
            expired = MediaAction.objects.create(media=self.media, remote_ip="203.0.113.43")
        MediaAction.objects.filter(pk=expired.pk).update(action_date=now - timedelta(days=8))
        self.media.refresh_from_db()
        views = self.media.views
        output = StringIO()
        with (
            override_settings(MEDIA_ACTION_IP_HMAC_KEY="action-ip-test-key"),
            patch("django.utils.timezone.now", return_value=now),
        ):
            call_command("cleanup_media_action_ips", batch_size=1, stdout=output)

        recent.refresh_from_db()
        expired.refresh_from_db()
        self.assertEqual(recent.remote_ip, MASKED_IP)
        self.assertIsNone(expired.remote_ip)
        self.assertEqual(MediaAction.objects.count(), 2)
        self.media.refresh_from_db()
        self.assertEqual(self.media.views, views)
        self.assertNotIn("203.0.113", output.getvalue())

    def test_scheduled_cleanup_preserves_action_rows(self):
        from actions.tasks import cleanup_media_action_ips

        action = MediaAction.objects.create(media=self.media, remote_ip="203.0.113.42")
        MediaAction.objects.filter(pk=action.pk).update(action_date=timezone.now() - timedelta(days=8))

        result = cleanup_media_action_ips()

        action.refresh_from_db()
        self.assertIsNone(action.remote_ip)
        self.assertEqual(result, {"outcome": "succeeded", "processed": 1, "changed": 1})

    def test_dry_run_and_repeated_execution_are_safe(self):
        with override_settings(MASK_IPS_FOR_ACTIONS=False):
            action = MediaAction.objects.create(media=self.media, remote_ip="203.0.113.42")
        output = StringIO()
        call_command("cleanup_media_action_ips", dry_run=True, stdout=output)
        action.refresh_from_db()
        self.assertEqual(action.remote_ip, "203.0.113.42")
        self.assertIn("1 IP fields would change", output.getvalue())
        call_command("cleanup_media_action_ips", stdout=StringIO())
        output = StringIO()
        call_command("cleanup_media_action_ips", stdout=output)
        self.assertIn("0 IP fields changed", output.getvalue())

    def test_dry_run_counts_an_expired_raw_ip_once(self):
        with override_settings(MASK_IPS_FOR_ACTIONS=False):
            action = MediaAction.objects.create(media=self.media, remote_ip="203.0.113.42")
        MediaAction.objects.filter(pk=action.pk).update(action_date=timezone.now() - timedelta(days=8))
        dry_run = StringIO()
        call_command("cleanup_media_action_ips", dry_run=True, stdout=dry_run)
        run = StringIO()
        call_command("cleanup_media_action_ips", stdout=run)

        self.assertIn("1 IP fields would change: 1 expired, 0 masked", dry_run.getvalue())
        self.assertIn("1 IP fields changed: 1 expired, 0 masked", run.getvalue())

    def test_seven_day_boundary_and_existing_masks(self):
        now = timezone.now()
        boundary = MediaAction.objects.create(media=self.media, remote_ip=MASKED_IP)
        recent = MediaAction.objects.create(media=self.media, remote_ip=MASKED_IP)
        MediaAction.objects.filter(pk=boundary.pk).update(action_date=now - timedelta(days=7))
        MediaAction.objects.filter(pk=recent.pk).update(action_date=now - timedelta(days=7) + timedelta(seconds=1))
        with patch("django.utils.timezone.now", return_value=now):
            call_command("cleanup_media_action_ips", stdout=StringIO())
        boundary.refresh_from_db()
        recent.refresh_from_db()
        self.assertIsNone(boundary.remote_ip)
        self.assertEqual(recent.remote_ip, MASKED_IP)

    def test_interrupted_cleanup_keeps_committed_batches_and_resumes(self):
        with override_settings(MASK_IPS_FOR_ACTIONS=False):
            first = MediaAction.objects.create(media=self.media, remote_ip="203.0.113.42")
            second = MediaAction.objects.create(media=self.media, remote_ip="203.0.113.43")
        with (
            patch("actions.ip_cleanup.mask_ip", side_effect=[MASKED_IP, RuntimeError("worker stopped")]),
            self.assertRaisesMessage(RuntimeError, "worker stopped"),
        ):
            call_command("cleanup_media_action_ips", batch_size=1, stdout=StringIO())
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertEqual(first.remote_ip, MASKED_IP)
        self.assertEqual(second.remote_ip, "203.0.113.43")

        output = StringIO()
        call_command("cleanup_media_action_ips", batch_size=1, stdout=output)

        second.refresh_from_db()
        self.assertEqual(second.remote_ip, mask_ip("203.0.113.43"))
        self.assertIn("1 masked", output.getvalue())

    def test_scheduled_cleanup_cost_grows_per_batch_not_per_row(self):
        expired_date = timezone.now() - timedelta(days=8)
        actions = MediaAction.objects.bulk_create(
            [MediaAction(media=self.media, remote_ip=MASKED_IP) for _ in range(3)]
        )
        MediaAction.objects.filter(pk__in=[action.pk for action in actions]).update(action_date=expired_date)
        from actions.tasks import cleanup_media_action_ips

        # One batch: select, update, then the empty select that ends the loop.
        with self.assertNumQueries(3):
            result = cleanup_media_action_ips()

        self.assertEqual(result["changed"], 3)

    def test_scheduled_cleanup_of_a_backlog_stops_before_the_soft_limit_and_reports_its_work(self):
        from actions.tasks import cleanup_media_action_ips

        self._create_expired_actions(6500)

        with self._each_update_takes_50_seconds() as clock:
            first_run = cleanup_media_action_ips()

        # deploy/celery_short.service gives short_tasks a 300-second soft limit.
        self.assertLess(clock[0], 300)
        # Five 50-second batches of 1000 start inside the four-minute budget.
        self.assertEqual(first_run, {"outcome": "succeeded", "processed": 5000, "changed": 5000})
        self.assertEqual(MediaAction.objects.filter(remote_ip__isnull=False).count(), 1500)

        second_run = cleanup_media_action_ips()

        self.assertEqual(second_run["changed"], 1500)
        self.assertFalse(MediaAction.objects.filter(remote_ip__isnull=False).exists())

    def test_cleanup_command_clears_a_backlog_that_outlasts_the_scheduled_budget(self):
        self._create_expired_actions(6500)
        output = StringIO()

        with self._each_update_takes_50_seconds():
            call_command("cleanup_media_action_ips", stdout=output)

        self.assertFalse(MediaAction.objects.filter(remote_ip__isnull=False).exists())
        self.assertIn("6500 expired", output.getvalue())

    @override_settings(MASK_IPS_FOR_ACTIONS=True)
    def test_scheduled_cleanup_leaves_recent_legacy_ips_to_the_rollout_command(self):
        from actions.tasks import cleanup_media_action_ips

        with override_settings(MASK_IPS_FOR_ACTIONS=False):
            action = MediaAction.objects.create(media=self.media, remote_ip="203.0.113.42")

        result = cleanup_media_action_ips()

        action.refresh_from_db()
        self.assertEqual(action.remote_ip, "203.0.113.42")
        self.assertEqual(result["changed"], 0)

    def test_cleanup_handles_invalid_legacy_values_without_printing_them(self):
        with override_settings(MASK_IPS_FOR_ACTIONS=False):
            action = MediaAction.objects.create(media=self.media, remote_ip="invalid-private-value")
        output = StringIO()
        call_command("cleanup_media_action_ips", stdout=output)
        action.refresh_from_db()
        self.assertIsNone(action.remote_ip)
        self.assertNotIn("invalid-private-value", output.getvalue())
        self.assertIn("1 invalid cleared", output.getvalue())


class MediaReportMigrationTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.media = create_test_media(create_test_user())
        cls.reporter = create_test_user()

    def _allow_duplicate_reports(self):
        # Duplicates from before the migration can no longer be inserted.
        constraint = next(c for c in MediaAction._meta.constraints if c.name == "mediaaction_one_report_per_user")
        with connection.schema_editor() as editor:
            editor.remove_constraint(MediaAction, constraint)

    def _report(self, media, user=None, reason="", session_key=None):
        return MediaAction.objects.create(
            media=media, user=user, session_key=session_key, action="report", extra_info=reason
        )

    def test_dedupe_keeps_each_users_earliest_report_and_every_anonymous_report(self):
        self._allow_duplicate_reports()
        other_reporter = create_test_user()
        earliest = self._report(self.media, self.reporter, "first")
        self._report(self.media, self.reporter, "second")
        self._report(self.media, self.reporter, "third")
        other = self._report(self.media, other_reporter, "other reporter")
        anonymous = [self._report(self.media, session_key=f"session-{n}", reason="anonymous") for n in range(2)]
        likes = [MediaAction.objects.create(media=self.media, user=self.reporter, action="like") for _ in range(2)]

        media_report_migration.delete_duplicate_reports(apps, schema_editor=None)

        remaining = set(MediaAction.objects.values_list("pk", flat=True))
        self.assertEqual(remaining, {earliest.pk, other.pk, *(row.pk for row in anonymous), *(row.pk for row in likes)})

    def test_backfill_fixes_drifted_counters_without_changing_visibility(self):
        private_media = create_test_media(create_test_user(), state="private", reported_times=7)
        public_media = create_test_media(create_test_user(), state="public", reported_times=3)
        self._report(private_media, self.reporter)
        self._report(private_media, session_key="anonymous-session")
        MediaAction.objects.create(media=public_media, user=self.reporter, action="like")
        MediaAction.objects.create(media=public_media, user=self.reporter, action="watch")

        media_report_migration.recount_reported_times(apps, schema_editor=None)

        self.assertEqual(
            {media.pk: (media.reported_times, media.state) for media in Media.objects.all()},
            {
                self.media.pk: (0, "public"),
                private_media.pk: (2, "private"),
                public_media.pk: (0, "public"),
            },
        )


class MediaReportMigrationResumeTests(TransactionTestCase):
    report_index_names = ("mediaaction_report_media_idx", "mediaaction_one_report_per_user")

    def _report_indexes(self):
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT c.relname, pg_get_indexdef(i.indexrelid), i.indisvalid FROM pg_index i "
                "JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relname = ANY(%s)",
                [list(self.report_index_names)],
            )
            return {name: (definition, valid) for name, definition, valid in cursor.fetchall()}

    def _restore_migrated_schema(self):
        if ("actions", "0007_media_report") in MigrationRecorder(connection).applied_migrations():
            return
        with connection.cursor() as cursor:
            for name in self.report_index_names:
                cursor.execute(f'DROP INDEX CONCURRENTLY IF EXISTS "{name}"')
        call_command("migrate", "actions", verbosity=0)

    def test_migration_resumes_after_a_run_that_failed_building_the_unique_index(self):
        migrated_indexes = self._report_indexes()
        call_command("migrate", "actions", "0006", verbosity=0)
        self.addCleanup(self._restore_migrated_schema)
        media = create_test_media(create_test_user())
        reporter = create_test_user()
        for _ in range(2):
            MediaAction.objects.create(media=media, user=reporter, action="report")
        # The earlier run built the first index, then lost a race with a
        # duplicate Report while building the unique one.
        with connection.cursor() as cursor:
            cursor.execute(
                'CREATE INDEX CONCURRENTLY "mediaaction_report_media_idx" '
                'ON "actions_mediaaction" ("media_id") WHERE "action" = \'report\''
            )
            with self.assertRaises(IntegrityError):
                cursor.execute(
                    'CREATE UNIQUE INDEX CONCURRENTLY "mediaaction_one_report_per_user" '
                    'ON "actions_mediaaction" ("media_id", "user_id") '
                    'WHERE ("action" = \'report\' AND "user_id" IS NOT NULL)'
                )
        self.assertFalse(self._report_indexes()["mediaaction_one_report_per_user"][1])

        call_command("migrate", "actions", verbosity=0)

        self.assertEqual(self._report_indexes(), migrated_indexes)
        self.assertEqual(
            {name: valid for name, (_, valid) in migrated_indexes.items()},
            dict.fromkeys(self.report_index_names, True),
        )
        media.refresh_from_db()
        self.assertEqual(media.reported_times, 1)


@override_settings(MFA_REQUIRED_ROLES=[])
class MediaReportAdminTests(TestCase):
    changelist_url = reverse("admin:actions_mediareport_changelist")

    @classmethod
    def setUpTestData(cls):
        cls.superuser = create_test_user(is_superuser=True, is_staff=True)
        cls.media = create_test_media(create_test_user())
        cls.reporter = create_test_user(username="report_admin_reporter")
        cls.report = MediaAction.objects.create(
            media=cls.media,
            user=cls.reporter,
            action="report",
            extra_info="Shows a private address",
            session_key="reportersessionkey0123456789abcd",
            remote_ip="198.51.100.77",
        )
        cls.report.refresh_from_db()
        MediaAction.objects.create(media=cls.media, action="report", extra_info="Anonymous reason", session_key="anon")
        for action in ("like", "dislike", "watch"):
            MediaAction.objects.create(media=cls.media, user=cls.reporter, action=action, extra_info=f"{action} row")

    def _staff_user(self, *permissions):
        user = create_test_user(is_staff=True)
        user.user_permissions.set(
            Permission.objects.filter(content_type__app_label="actions", codename__in=permissions)
        )
        return user

    def test_changelist_lists_reports_and_no_other_action(self):
        self.client.force_login(self.superuser)

        response = self.client.get(self.changelist_url)

        self.assertContains(response, "Shows a private address")
        self.assertContains(response, "Anonymous reason")
        self.assertContains(response, "report_admin_reporter")
        self.assertContains(response, "Anonymous")
        for action in ("like", "dislike", "watch"):
            self.assertNotContains(response, f"{action} row")
        self.assertContains(response, reverse("admin:files_media_change", args=[self.media.pk]))

    def test_report_page_offers_no_add_change_or_delete(self):
        self.client.force_login(self.superuser)
        change_url = reverse("admin:actions_mediareport_change", args=[self.report.pk])

        self.assertNotContains(self.client.get(self.changelist_url), "delete_selected")
        self.assertEqual(self.client.get(reverse("admin:actions_mediareport_add")).status_code, 403)
        self.assertEqual(self.client.post(change_url, {"extra_info": "Edited"}).status_code, 403)
        self.assertEqual(
            self.client.post(reverse("admin:actions_mediareport_delete", args=[self.report.pk])).status_code, 403
        )
        self.report.refresh_from_db()
        self.assertEqual(self.report.extra_info, "Shows a private address")

    def test_view_permission_decides_who_opens_the_page(self):
        self.client.force_login(self._staff_user())
        self.assertEqual(self.client.get(self.changelist_url).status_code, 403)

        self.client.force_login(self._staff_user("view_mediareport"))
        self.assertEqual(self.client.get(self.changelist_url).status_code, 200)

    def test_page_refuses_filtering_by_any_field_it_does_not_offer(self):
        self.client.force_login(self._staff_user("view_mediareport"))
        unoffered_lookups = {
            "session_key__startswith": self.report.session_key[:4],
            "remote_ip__exact": self.report.remote_ip,
            "user__password__startswith": "pbkdf2",
            "user__email__icontains": "@",
            "extra_info__icontains": "private",
            "action": "like",
            "media__title__startswith": "T",
        }

        for lookup, value in unoffered_lookups.items():
            with self.subTest(lookup=lookup):
                self.assertEqual(self.client.get(self.changelist_url, {lookup: value}).status_code, 400)

    def test_page_date_filter_search_and_media_link_still_work(self):
        self.client.force_login(self._staff_user("view_mediareport"))
        changelist = self.client.get(self.changelist_url).context["cl"]
        date_filter_queries = [
            choice["query_string"] for spec in changelist.filter_specs for choice in spec.choices(changelist)
        ]
        page_queries = [*date_filter_queries, f"?q={self.reporter.username}", f"?media__id__exact={self.media.pk}"]

        for query in page_queries:
            with self.subTest(query=query):
                self.assertContains(self.client.get(f"{self.changelist_url}{query}"), "Shows a private address")

    def test_report_page_shows_the_reason_but_not_the_reporters_ip_or_session(self):
        self.client.force_login(self.superuser)

        response = self.client.get(reverse("admin:actions_mediareport_change", args=[self.report.pk]))

        self.assertContains(response, "Shows a private address")
        self.assertNotContains(response, self.report.remote_ip)
        self.assertNotContains(response, self.report.session_key)

    def test_media_admin_links_each_count_to_that_medias_reports(self):
        other_media = create_test_media(create_test_user())
        MediaAction.objects.create(media=other_media, action="report", extra_info="Other film reason", session_key="x")
        self.client.force_login(self.superuser)
        reports_link = f"{self.changelist_url}?media__id__exact={self.media.pk}"

        media_changelist = self.client.get(reverse("admin:files_media_changelist"))
        self.assertContains(media_changelist, f'href="{reports_link}"')
        self.assertContains(media_changelist, "sortable column-reported_times_link")

        response = self.client.get(reports_link)

        self.assertEqual(response.status_code, 200)
        self.assertContains(response, "Shows a private address")
        self.assertNotContains(response, "Other film reason")
