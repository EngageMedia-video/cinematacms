# files/templatetags/custom_tags.py

from django import template
import re
from urllib.parse import urlparse

register = template.Library()

@register.simple_tag
def extract_first_image(html_content):
    """Extract first image from HTML using regex"""
    if not html_content:
        return None
    
    img_pattern = r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>'
    match = re.search(img_pattern, html_content, re.IGNORECASE)
    
    if match:
        src = match.group(1)
        if src.startswith('/'):
            return src
        elif src.startswith('http'):
            parsed = urlparse(src)
            return parsed.path
        else:
            if not src.startswith('/media/'):
                return f"/media/{src}"
            return src
    return None

@register.simple_tag  
def get_social_image_url_for_page(page_object, frontend_host):
    """Get social media image URL for static pages"""
    default_image = f"{frontend_host}/media/userlogos/cinemata_share_banner-01.png"
    
    if hasattr(page_object, 'description') and page_object.description:
        first_image = extract_first_image(page_object.description)
        return f"{frontend_host}{first_image}" if first_image else default_image
    
    return default_image
