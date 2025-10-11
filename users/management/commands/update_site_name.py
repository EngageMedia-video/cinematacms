"""
Management command to configure Django Site from settings.
Creates the site if it doesn't exist, or updates it if it does.
This ensures the site with SITE_ID exists and has the correct name and domain.
"""
from django.core.management.base import BaseCommand
from django.contrib.sites.models import Site
from django.conf import settings
import sys


class Command(BaseCommand):
    help = 'Configure Django Site with name from settings.PORTAL_NAME and optionally update domain'

    def add_arguments(self, parser):
        parser.add_argument(
            '--name',
            type=str,
            help='Site name to set (defaults to settings.PORTAL_NAME)',
        )
        parser.add_argument(
            '--domain',
            type=str,
            help='Optionally set/update the domain',
        )

    def handle(self, *args, **options):
        try:
            # Get site name from options or fall back to settings.PORTAL_NAME
            if options.get('name'):
                portal_name = options.get('name')
            else:
                # Check if PORTAL_NAME exists in settings
                portal_name = getattr(settings, 'PORTAL_NAME', None)
                if portal_name is None:
                    self.stdout.write(
                        self.style.WARNING(
                            'PORTAL_NAME not found in settings. Using default "CinemataCMS"'
                        )
                    )
                    portal_name = 'CinemataCMS'

            site_id = getattr(settings, 'SITE_ID', 1)

            # Get domain from options
            domain = options.get('domain')

            # Get or create the site
            if domain:
                site, created = Site.objects.get_or_create(
                    pk=site_id,
                    defaults={'name': portal_name, 'domain': domain}
                )
            else:
                # If no domain provided, just get or create with name
                site, created = Site.objects.get_or_create(
                    pk=site_id,
                    defaults={'name': portal_name, 'domain': 'example.com'}
                )

            if created:
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Created Django Site with ID {site_id}:\n'
                        f'  Name: {site.name}\n'
                        f'  Domain: {site.domain}'
                    )
                )
            else:
                # Update existing site
                old_name = site.name
                old_domain = site.domain

                site.name = portal_name
                if domain:
                    site.domain = domain

                site.save()

                self.stdout.write(
                    self.style.SUCCESS(
                        f'Updated Django Site with ID {site_id}:\n'
                        f'  Name: "{old_name}" → "{site.name}"\n'
                        f'  Domain: "{old_domain}"' + (f' → "{site.domain}"' if domain else ' (unchanged)')
                    )
                )

            # Return success
            return

        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error configuring site: {str(e)}')
            )
            # Exit with error code to signal failure to the shell
            sys.exit(1)