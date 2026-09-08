from getpass import getpass

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_email

from email_delivery.service import recipient_reference_candidates


class Command(BaseCommand):
    help = "Convert an email address into privacy-safe recipient_ref values for incident lookup."

    def handle(self, *args, **options):
        address = getpass("Email address (input hidden): ").strip().lower()
        try:
            validate_email(address)
            candidates = recipient_reference_candidates(address)
        except ValidationError as error:
            raise CommandError("Enter a valid email address and verify the recipient HMAC configuration.") from error

        self.stdout.write("Search restricted logs for each recipient_ref:")
        for candidate in candidates:
            self.stdout.write(candidate)
