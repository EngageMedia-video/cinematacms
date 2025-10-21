"""
Custom middleware for CinemataCMS
"""
import json
import os
import time
from django.conf import settings
from django.core.cache import cache
from django.utils.deprecation import MiddlewareMixin


class MaintenanceTimingMiddleware(MiddlewareMixin):
    """
    Middleware to track when maintenance mode was activated
    and calculate remaining time.

    Uses Django's cache backend for atomic operations to prevent race conditions.
    Falls back to file storage if cache is unavailable.
    """

    CACHE_KEY = 'maintenance_mode_start_time'
    CACHE_TIMEOUT = 86400  # 24 hours (longer than any reasonable maintenance)
    TIMING_FILE = os.path.join(settings.BASE_DIR, 'cms', 'maintenance_timing.json')

    def process_request(self, request):
        """Process the request to add maintenance timing info."""
        # Check if maintenance mode is enabled
        maintenance_mode = getattr(settings, 'MAINTENANCE_MODE', False)

        if maintenance_mode:
            # Get the retry after duration in seconds
            retry_after = getattr(settings, 'MAINTENANCE_MODE_RETRY_AFTER', 3600)

            # Get or set the start time atomically
            start_time = self._get_or_set_start_time()

            # Calculate remaining time
            elapsed = time.time() - start_time
            remaining = max(0, retry_after - elapsed)

            # Add to request for use in templates
            request.maintenance_remaining = int(remaining)
            request.maintenance_start_time = start_time
            request.maintenance_total_duration = retry_after
        else:
            # Not in maintenance mode, clean up
            self._clear_timing()
            request.maintenance_remaining = 0
            request.maintenance_start_time = None
            request.maintenance_total_duration = 0

    def _get_or_set_start_time(self):
        """
        Get or atomically set the maintenance mode start time.
        Uses cache for atomic operations, falls back to file if needed.
        """
        # Try to get from cache first
        start_time = cache.get(self.CACHE_KEY)

        if start_time is not None:
            return start_time

        # Not in cache, try to set it atomically
        current_time = time.time()

        # cache.add() is atomic - returns True only if key didn't exist
        if cache.add(self.CACHE_KEY, current_time, self.CACHE_TIMEOUT):
            # We successfully set it, also save to file as backup
            self._save_to_file(current_time)
            return current_time

        # Another request beat us to it, get the value they set
        start_time = cache.get(self.CACHE_KEY)
        if start_time is not None:
            return start_time

        # Cache might be unavailable, fall back to file
        return self._get_or_set_from_file()

    def _get_or_set_from_file(self):
        """
        Fallback method using file storage with basic locking.
        Uses a lock file to prevent concurrent writes.
        """
        lock_file = self.TIMING_FILE + '.lock'
        max_wait = 5  # Maximum seconds to wait for lock
        wait_interval = 0.01  # 10ms between checks

        start_wait = time.time()

        # Simple spin lock with timeout
        while os.path.exists(lock_file):
            if time.time() - start_wait > max_wait:
                # Lock held too long, break it
                try:
                    os.remove(lock_file)
                except OSError:
                    pass
                break
            time.sleep(wait_interval)

        try:
            # Create lock file
            with open(lock_file, 'w') as f:
                f.write(str(os.getpid()))

            # Re-check if timing file exists now that we have the lock
            if os.path.exists(self.TIMING_FILE):
                try:
                    with open(self.TIMING_FILE, 'r') as f:
                        data = json.load(f)
                        start_time = data.get('start_time')
                        if start_time is not None:
                            # Also populate cache for next time
                            cache.set(self.CACHE_KEY, start_time, self.CACHE_TIMEOUT)
                            return start_time
                except (json.JSONDecodeError, IOError):
                    pass

            # Still no valid time, create it
            current_time = time.time()
            self._save_to_file(current_time)

            # Also try to populate cache
            cache.set(self.CACHE_KEY, current_time, self.CACHE_TIMEOUT)

            return current_time

        finally:
            # Always clean up lock file
            try:
                os.remove(lock_file)
            except OSError:
                pass

    def _save_to_file(self, start_time):
        """Save the start time to file as backup."""
        try:
            os.makedirs(os.path.dirname(self.TIMING_FILE), exist_ok=True)
            with open(self.TIMING_FILE, 'w') as f:
                json.dump({'start_time': start_time}, f)
        except IOError:
            pass  # Fail silently if we can't write the file

    def _clear_timing(self):
        """Clear the timing data when maintenance mode is disabled."""
        # Clear from cache
        cache.delete(self.CACHE_KEY)

        # Clear file
        if os.path.exists(self.TIMING_FILE):
            try:
                os.remove(self.TIMING_FILE)
            except OSError:
                pass

        # Clean up any stale lock file
        lock_file = self.TIMING_FILE + '.lock'
        if os.path.exists(lock_file):
            try:
                os.remove(lock_file)
            except OSError:
                pass