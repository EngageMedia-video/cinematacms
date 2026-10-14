from django.core.management.base import BaseCommand, CommandError

from actions.ip_cleanup import cleanup_action_ips


class Command(BaseCommand):
    help = "Clear media activity IPs after 7 days and mask recent legacy raw IPs without deleting actions"

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")
        parser.add_argument("--batch-size", type=int, default=1000)

    def handle(self, *args, **options):
        if options["batch_size"] < 1:
            raise CommandError("--batch-size must be positive")
        result = cleanup_action_ips(batch_size=options["batch_size"], dry_run=options["dry_run"])
        verb = "would change" if options["dry_run"] else "changed"
        self.stdout.write(
            f"{sum(result.values())} IP fields {verb}: "
            f"{result['expired']} expired, {result['masked']} masked, {result['invalid']} invalid cleared"
        )
