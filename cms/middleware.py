"""
Custom middleware for CinemataCMS
"""
import json
import os
import time
from django.conf import settings
from django.utils.deprecation import MiddlewareMixin


class MaintenanceTimingMiddleware(MiddlewareMixin):
    """
    Middleware to track when maintenance mode was activated
    and calculate remaining time.
    """

    TIMING_FILE = os.path.join(settings.BASE_DIR, 'cms', 'maintenance_timing.json')

    def process_request(self, request):
        """Process the request to add maintenance timing info."""
        # Check if maintenance mode is enabled
        maintenance_mode = getattr(settings, 'MAINTENANCE_MODE', False)

        if maintenance_mode:
            # Get the retry after duration in seconds
            retry_after = getattr(settings, 'MAINTENANCE_MODE_RETRY_AFTER', 3600)

            # Check if we have a stored start time
            start_time = self._get_start_time()

            if start_time is None:
                # First time in maintenance mode, save the start time
                start_time = time.time()
                self._save_start_time(start_time)

            # Calculate remaining time
            elapsed = time.time() - start_time
            remaining = max(0, retry_after - elapsed)

            # Add to request for use in templates
            request.maintenance_remaining = int(remaining)
            request.maintenance_start_time = start_time
            request.maintenance_total_duration = retry_after
        else:
            # Not in maintenance mode, clean up timing file
            self._clear_timing()
            request.maintenance_remaining = 0
            request.maintenance_start_time = None
            request.maintenance_total_duration = 0

    def _get_start_time(self):
        """Get the stored maintenance mode start time."""
        if os.path.exists(self.TIMING_FILE):
            try:
                with open(self.TIMING_FILE, 'r') as f:
                    data = json.load(f)
                    return data.get('start_time')
            except (json.JSONDecodeError, IOError):
                return None
        return None

    def _save_start_time(self, start_time):
        """Save the maintenance mode start time."""
        try:
            with open(self.TIMING_FILE, 'w') as f:
                json.dump({'start_time': start_time}, f)
        except IOError:
            pass  # Fail silently if we can't write the file

    def _clear_timing(self):
        """Clear the timing file when maintenance mode is disabled."""
        if os.path.exists(self.TIMING_FILE):
            try:
                os.remove(self.TIMING_FILE)
            except OSError:
                pass  # Fail silently if we can't remove the file