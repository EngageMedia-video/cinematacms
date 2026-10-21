from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from actions.ip_cleanup import LegacyIPCleanup, expire_action_ips, mask_legacy_action_ips


class Command(BaseCommand):
    help = "Clear media activity IPs after 7 days and mask recent legacy raw IPs without deleting actions"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--batch-size", type=int, default=1000)

    def handle(self, *args, **options):
        if options["batch_size"] < 1:
            raise CommandError("--batch-size must be positive")
        batch_options = {"batch_size": options["batch_size"], "dry_run": options["dry_run"]}
        expired = expire_action_ips(**batch_options)
        if settings.MASK_IPS_FOR_ACTIONS:
            legacy = mask_legacy_action_ips(**batch_options)
        else:
            legacy = LegacyIPCleanup(masked=0, invalid=0)
        verb = "would change" if options["dry_run"] else "changed"
        self.stdout.write(
            f"{expired + legacy.masked + legacy.invalid} IP fields {verb}: "
            f"{expired} expired, {legacy.masked} masked, {legacy.invalid} invalid cleared"
        )
