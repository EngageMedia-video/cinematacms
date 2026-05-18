from django.core.management import call_command
from django.test import TestCase
from waffle.models import Switch


class SeedWaffleSwitchesCommandTest(TestCase):
    def test_default_mode_creates_missing_switches_from_settings_defaults(self):
        Switch.objects.filter(name="login_allowed").delete()

        call_command("seed_waffle_switches")

        switch = Switch.objects.get(name="login_allowed")

        self.assertTrue(switch.active)
        self.assertEqual(switch.note, "Whether the login button appears")

    def test_default_mode_preserves_existing_switch_values(self):
        Switch.objects.update_or_create(
            name="login_allowed",
            defaults={
                "active": False,
                "note": "Admin changed this switch",
            },
        )

        call_command("seed_waffle_switches")

        switch = Switch.objects.get(name="login_allowed")
        self.assertFalse(switch.active)
        self.assertEqual(switch.note, "Admin changed this switch")

    def test_force_mode_overwrites_existing_switch_values_from_settings_defaults(self):
        Switch.objects.update_or_create(
            name="login_allowed",
            defaults={
                "active": False,
                "note": "Admin changed this switch",
            },
        )

        call_command("seed_waffle_switches", "--force")

        switch = Switch.objects.get(name="login_allowed")
        self.assertTrue(switch.active)
        self.assertEqual(switch.note, "Whether the login button appears")
