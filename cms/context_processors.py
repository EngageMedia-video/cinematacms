from django.conf import settings

def ui_settings(request):
    """Add UI settings to template context"""
    return {
        'USE_ROUNDED_CORNERS': getattr(settings, 'USE_ROUNDED_CORNERS', True),
    }