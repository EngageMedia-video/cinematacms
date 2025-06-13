import os
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.utils import timezone
from .models import TinyMCEMedia

@csrf_exempt
def upload_image(request):
    if request.method == "POST":
        file_obj = request.FILES.get('file')
        if file_obj:
            # Create a new TinyMCEMedia instance for the image
            media = TinyMCEMedia(
                file=file_obj,
                file_type='image',
                original_filename=file_obj.name,
                user=request.user if request.user.is_authenticated else None
            )
            media.save()
            
            return JsonResponse({
                'location': media.url
            })
    return JsonResponse({'error': 'Invalid request'}, status=400)

@csrf_exempt
def upload_media(request):
    if request.method == "POST":
        file_obj = request.FILES.get('file')
        if file_obj:
            # Create a new TinyMCEMedia instance for the media file
            media = TinyMCEMedia(
                file=file_obj,
                file_type='media',
                original_filename=file_obj.name,
                user=request.user if request.user.is_authenticated else None
            )
            media.save()
            
            return JsonResponse({
                'location': media.url
            })
    return JsonResponse({'error': 'Invalid request'}, status=400) 