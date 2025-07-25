from django import template
import re
from urllib.parse import urlparse
import os

register = template.Library()

@register.simple_tag
def extract_first_image(html_content):
    """
    Extract first image from HTML using regex (no dependencies needed)
    Works with TinyMCE uploaded images
    """
    if not html_content:
        return None
    
    # Find first img tag with src attribute
    img_pattern = r'<img[^>]+src=["\']([^"\']+)["\'][^>]*>'
    match = re.search(img_pattern, html_content, re.IGNORECASE)
    
    if match:
        src = match.group(1)
        
        # Clean up the URL and handle relative paths
        if src.startswith('http'):
            # Full URL - extract path if it's from same domain
            parsed = urlparse(src)
            src = parsed.path
        
        # Normalize the path to remove ../ and other relative path issues
        src = os.path.normpath(src)
        
        # Ensure it starts with /
        if not src.startswith('/'):
            src = '/' + src
            
        # If it's already a proper media path, return it
        if src.startswith('/media/'):
            return src
        
        # If it's a relative path to media, fix it
        if 'tinymce_media/' in src or 'userlogos/' in src:
            # Extract just the media part
            if 'tinymce_media/' in src:
                media_part = src[src.find('tinymce_media/'):]
                return f"/media/{media_part}"
            elif 'userlogos/' in src:
                media_part = src[src.find('userlogos/'):]
                return f"/media/{media_part}"
        
        # Default: assume it's a file that should be in /media/
        if not src.startswith('/media/'):
            return f"/media/{src.lstrip('/')}"
        
        return src
    
    return None

@register.simple_tag  
def get_social_image_url(media_object, frontend_host):
    """
    Get complete social media image URL for any media type
    """
    default_image = f"{frontend_host}/media/userlogos/cinemata_share_banner-01.png"
    
    if media_object.media_type == 'text':
        first_image = extract_first_image(media_object.description)
        return f"{frontend_host}{first_image}" if first_image else default_image
    elif media_object.media_type in ['video', 'audio']:
        return f"{frontend_host}{media_object.poster_url}" if media_object.poster_url else default_image
    elif media_object.media_type == 'image':
        return f"{frontend_host}{media_object.original_media_url}" if media_object.original_media_url else default_image
    else:
        return default_image

@register.simple_tag  
def get_social_image_url_for_page(page_object, frontend_host):
    """
    Get complete social media image URL for static pages
    """
    default_image = f"{frontend_host}/media/userlogos/cinemata_share_banner-01.png"
    
    if hasattr(page_object, 'description') and page_object.description:
        first_image = extract_first_image(page_object.description)
        return f"{frontend_host}{first_image}" if first_image else default_image
    
    return default_image