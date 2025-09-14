import subprocess
import sys
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = 'Build all frontend packages and collect static files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--skip-packages',
            action='store_true',
            help='Skip building frontend packages (vjs-plugin, etc.)',
        )
        parser.add_argument(
            '--skip-main',
            action='store_true',
            help='Skip building main frontend application',
        )
        parser.add_argument(
            '--skip-collect',
            action='store_true',
            help='Skip Django collectstatic',
        )
        parser.add_argument(
            '--verbose',
            action='store_true',
            help='Show detailed output',
        )

    def handle(self, *args, **options):
        base_dir = Path(settings.BASE_DIR)
        frontend_dir = base_dir / 'frontend'
        packages_dir = frontend_dir / 'packages'

        skip_packages = options.get('skip_packages', False)
        skip_main = options.get('skip_main', False)
        skip_collect = options.get('skip_collect', False)
        verbose = options.get('verbose', False)

        self.stdout.write(self.style.SUCCESS('Starting frontend build process...'))

        # Build frontend packages
        if not skip_packages:
            packages = [
                'vjs-plugin-font-icons',
                'vjs-plugin',
                'media-player',
            ]

            for package in packages:
                package_path = packages_dir / package
                if package_path.exists():
                    self.build_package(package_path, package, verbose)
                else:
                    self.stdout.write(
                        self.style.WARNING(f'Package {package} not found at {package_path}')
                    )

        # Build main frontend application
        if not skip_main:
            self.stdout.write(self.style.SUCCESS('Building main frontend application...'))
            # Always install dependencies to ensure consistency
            self.stdout.write('Installing frontend dependencies...')
            self.run_npm_command(frontend_dir, 'install', verbose)
            self.run_npm_command(frontend_dir, 'run build', verbose)
            self.stdout.write(self.style.SUCCESS('✓ Main frontend built successfully'))

        # Run collectstatic
        if not skip_collect:
            self.stdout.write(self.style.SUCCESS('Running collectstatic...'))
            call_command('collectstatic', '--noinput', verbosity=2 if verbose else 1)
            self.stdout.write(
                self.style.SUCCESS(f'✓ Static files collected to {settings.STATIC_ROOT}')
            )

        self.stdout.write(
            self.style.SUCCESS('✅ Frontend build and deployment complete!')
        )

    def build_package(self, package_path, package_name, verbose=False):
        self.stdout.write(self.style.SUCCESS(f'Building {package_name}...'))

        # Check if package.json exists
        if not (package_path / 'package.json').exists():
            self.stdout.write(
                self.style.WARNING(f'package.json not found in {package_path}')
            )
            return False

        # Always install dependencies to ensure consistency
        self.stdout.write(f'Installing dependencies for {package_name}...')
        self.run_npm_command(package_path, 'install', verbose)

        # Run build
        self.run_npm_command(package_path, 'run build', verbose)
        self.stdout.write(self.style.SUCCESS(f'✓ {package_name} built successfully'))
        return True

    def run_npm_command(self, working_dir, command, verbose=False):
        cmd = f'npm {command}'
        try:
            result = subprocess.run(
                cmd,
                shell=True,
                cwd=working_dir,
                capture_output=not verbose,
                text=True,
                check=True,
            )
            if verbose and result.stdout:
                self.stdout.write(result.stdout)
            return True
        except subprocess.CalledProcessError as e:
            self.stdout.write(
                self.style.ERROR(f'Error running npm {command} in {working_dir}')
            )
            if e.stderr:
                self.stdout.write(self.style.ERROR(e.stderr))
            if e.stdout:
                self.stdout.write(e.stdout)
            sys.exit(1)