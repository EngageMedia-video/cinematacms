from django.conf import settings

def ui_settings(request):
    """Add UI settings to template context"""
    # Get maintenance timing from middleware
    maintenance_remaining = getattr(request, 'maintenance_remaining', 0)
    maintenance_total = getattr(request, 'maintenance_total_duration',
                                getattr(settings, 'MAINTENANCE_MODE_RETRY_AFTER', 3600))
    maintenance_is_extended = getattr(request, 'maintenance_is_extended', False)
    maintenance_extension_time = getattr(request, 'maintenance_extension_time', 0)
    maintenance_elapsed_time = getattr(request, 'maintenance_elapsed_time', 0)

    return {
        'USE_ROUNDED_CORNERS': getattr(settings, 'USE_ROUNDED_CORNERS', True),
        'MAINTENANCE_MODE_RETRY_AFTER': getattr(settings, 'MAINTENANCE_MODE_RETRY_AFTER', 3600),  # Default 1 hour
        'MAINTENANCE_MODE_REMAINING': maintenance_remaining,  # Actual remaining seconds
        'MAINTENANCE_MODE_TOTAL': maintenance_total,  # Total duration for progress calculation
        'MAINTENANCE_MODE_IS_EXTENDED': maintenance_is_extended,  # Whether maintenance exceeded initial estimate
        'MAINTENANCE_MODE_EXTENSION_TIME': maintenance_extension_time,  # Seconds beyond initial estimate
        'MAINTENANCE_MODE_ELAPSED_TIME': maintenance_elapsed_time,  # Total seconds since start
        'DEFAULT_FROM_EMAIL': getattr(settings, 'DEFAULT_FROM_EMAIL', 'support@example.com'),
        'EXTRA_CSS_VERSION': getattr(settings, 'EXTRA_CSS_VERSION', '1'),
    }