from django.conf import settings

def ui_settings(request):
    """Add UI settings to template context"""
    return {
        'USE_ROUNDED_CORNERS': getattr(settings, 'USE_ROUNDED_CORNERS', True),
        'MAINTENANCE_MODE_RETRY_AFTER': getattr(settings, 'MAINTENANCE_MODE_RETRY_AFTER', 900),  # Default 15 minutes
        'DEFAULT_FROM_EMAIL': getattr(settings, 'DEFAULT_FROM_EMAIL', 'support@example.com'),
    }