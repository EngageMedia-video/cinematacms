"""
Management command to update Django Site name from settings.PORTAL_NAME
This is useful for fixing existing installations where the site name might be empty or incorrect.
"""
from django.core.management.base import BaseCommand
from django.contrib.sites.models import Site
from django.conf import settings


class Command(BaseCommand):
    help = 'Updates the Django Site name from settings.PORTAL_NAME'

    def add_arguments(self, parser):
        parser.add_argument(
            '--domain',
            type=str,
            help='Optionally update the domain as well',
        )

    def handle(self, *args, **options):
        try:
            # Get the site with SITE_ID from settings
            site = Site.objects.get(pk=settings.SITE_ID)
            old_name = site.name
            old_domain = site.domain

            # Update the site name with PORTAL_NAME from settings
            portal_name = getattr(settings, 'PORTAL_NAME', 'CinemataCMS')
            site.name = portal_name

            # Optionally update domain if provided
            if options['domain']:
                site.domain = options['domain']

            site.save()

            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully updated site configuration:\n'
                    f'  Name: "{old_name}" → "{site.name}"\n'
                    f'  Domain: {old_domain}' + (f' → {site.domain}' if options['domain'] else ' (unchanged)')
                )
            )

        except Site.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(
                    f'Site with ID {settings.SITE_ID} does not exist. '
                    'Please run migrations first:\n'
                    '  python manage.py migrate sites'
                )
            )
        except AttributeError:
            self.stdout.write(
                self.style.WARNING(
                    'PORTAL_NAME not found in settings. Using default "CinemataCMS"'
                )
            )
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error updating site: {str(e)}')
            )