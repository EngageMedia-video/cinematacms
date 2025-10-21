from django.conf import settings

def ui_settings(request):
    """Add UI settings to template context"""
    # Get maintenance timing from middleware
    maintenance_remaining = getattr(request, 'maintenance_remaining', 0)
    maintenance_total = getattr(request, 'maintenance_total_duration',
                                getattr(settings, 'MAINTENANCE_MODE_RETRY_AFTER', 3600))

    return {
        'USE_ROUNDED_CORNERS': getattr(settings, 'USE_ROUNDED_CORNERS', True),
        'MAINTENANCE_MODE_RETRY_AFTER': getattr(settings, 'MAINTENANCE_MODE_RETRY_AFTER', 3600),  # Default 1 hour
        'MAINTENANCE_MODE_REMAINING': maintenance_remaining,  # Actual remaining seconds
        'MAINTENANCE_MODE_TOTAL': maintenance_total,  # Total duration for progress calculation
        'DEFAULT_FROM_EMAIL': getattr(settings, 'DEFAULT_FROM_EMAIL', 'support@example.com'),
    }