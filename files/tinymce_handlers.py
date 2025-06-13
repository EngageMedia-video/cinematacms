import os
from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.utils import timezone

@csrf_exempt
def upload_image(request):
    if request.method == "POST":
        file_obj = request.FILES.get('file')
        if file_obj:
            # Create a unique filename
            timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
            filename = f"tinymce_images/{timestamp}_{file_obj.name}"
            
            # Save the file
            path = default_storage.save(filename, ContentFile(file_obj.read()))
            url = default_storage.url(path)
            
            return JsonResponse({
                'location': url
            })
    return JsonResponse({'error': 'Invalid request'}, status=400)

@csrf_exempt
def upload_media(request):
    if request.method == "POST":
        file_obj = request.FILES.get('file')
        if file_obj:
            # Create a unique filename
            timestamp = timezone.now().strftime('%Y%m%d_%H%M%S')
            filename = f"tinymce_media/{timestamp}_{file_obj.name}"
            
            # Save the file
            path = default_storage.save(filename, ContentFile(file_obj.read()))
            url = default_storage.url(path)
            
            return JsonResponse({
                'location': url
            })
    return JsonResponse({'error': 'Invalid request'}, status=400) 