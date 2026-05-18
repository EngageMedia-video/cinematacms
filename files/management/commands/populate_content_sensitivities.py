from django.core.management.base import BaseCommand
from django.db import transaction

from files.models import ContentSensitivity

CONTENT_SENSITIVITIES = [
    "Child Endangerment",
    "Cultural Sensitivity",
    "Drug Use",
    "Flashing Lights",
    "Graphic Violence",
    "Human Rights Violations",
    "Nudity",
    "Political Sensitivity",
    "Religious Sensitivity",
    "Sexual Content",
    "State Violence",
    "Strong Language",
    "Suicide / Self-Harm",
    "Torture",
    "War & Conflict",
]


class Command(BaseCommand):
    help = "Populate ContentSensitivity table with default values"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Show what would be created without making changes",
        )

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write("Starting ContentSensitivity population...")

        created_count = 0
        existing_count = 0

        for title in CONTENT_SENSITIVITIES:
            if options["dry_run"]:
                exists = ContentSensitivity.objects.filter(title=title).exists()
                if exists:
                    self.stdout.write(f"Already exists: {title}")
                else:
                    self.stdout.write(f"Would create: {title}")
            else:
                _, created = ContentSensitivity.objects.get_or_create(title=title)
                if created:
                    created_count += 1
                    self.stdout.write(self.style.SUCCESS(f"Created: {title}"))
                else:
                    existing_count += 1
                    self.stdout.write(f"Already exists: {title}")

        if not options["dry_run"]:
            self.stdout.write(
                self.style.SUCCESS(
                    f"\nContent Sensitivities - Created: {created_count}, Already existed: {existing_count}"
                )
            )
        else:
            self.stdout.write("\nDry run completed - no changes made")
