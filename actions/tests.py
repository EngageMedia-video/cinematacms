import json
from datetime import timedelta
from io import StringIO
from unittest.mock import patch

from django.core.checks import Tags, run_checks
from django.core.exceptions import ImproperlyConfigured
from django.core.management import call_command
from django.db import transaction
from django.db.models import Case, CharField, F, Value, When
from django.db.models.expressions import RawSQL
from django.db.models.functions import Cast
from django.test import SimpleTestCase, TestCase, override_settings
from django.utils import timezone

from actions.models import MediaAction
from files.helpers import mask_ip
from files.tasks import save_user_action
from files.tests.helpers import create_test_media, create_test_user

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

    def test_save_masks_ipv6(self):
        action = MediaAction(media=self.media, remote_ip="2001:db8::42")
        action.save()
        action.refresh_from_db()

        self.assertEqual(action.remote_ip, "cc377c98e0db3be6cb8d119e707e3a3bf859c1efb4bfc4d2c6ff615a8cabf42e")

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

    def test_cleanup_handles_invalid_legacy_values_without_printing_them(self):
        with override_settings(MASK_IPS_FOR_ACTIONS=False):
            action = MediaAction.objects.create(media=self.media, remote_ip="invalid-private-value")
        output = StringIO()
        call_command("cleanup_media_action_ips", stdout=output)
        action.refresh_from_db()
        self.assertIsNone(action.remote_ip)
        self.assertNotIn("invalid-private-value", output.getvalue())
        self.assertIn("1 invalid cleared", output.getvalue())
