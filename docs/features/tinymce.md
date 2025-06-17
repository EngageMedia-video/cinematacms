# TinyMCE Editor Configuration

This document describes how TinyMCE is configured in Cinemata CMS and how to manage its updates.

## Current Configuration

Cinemata CMS uses `django-tinymce` version 4.1.0, which is currently installed from a specific Git commit to ensure stability. **Note: This should be upgraded to use the PyPI version once it's stable.**

The configuration is defined in `cms/settings.py` under the `TINYMCE_DEFAULT_CONFIG` setting.

### Key Features

- Media upload support for both images and other media files
- Custom upload handlers that store files in the `TinyMCEMedia` model
- Automatic file management through Django Admin
- User tracking for uploaded files

### Configuration Details

The current TinyMCE configuration includes:

```python
TINYMCE_DEFAULT_CONFIG = {
    "theme": "silver",
    "height": 500,
    "menubar": True,
    "plugins": "advlist,autolink,autosave,lists,link,image,charmap,print,preview,anchor,"
    "searchreplace,visualblocks,code,fullscreen,insertdatetime,media,table,paste,directionality,"
    "code,help,wordcount,emoticons,file,image,media",
    "toolbar": "undo redo | code preview |  "
    "bold italic | alignleft aligncenter "
    "alignright alignjustify ltr rtl | bullist numlist outdent indent | "
    "removeformat | restoredraft help | image media",
    "branding": False,
    "promotion": False,
    "images_upload_url": "/tinymce/upload/",
    "images_upload_handler": "tinymce.views.upload_image",
    "media_upload_url": "/tinymce/upload/",
    "media_upload_handler": "tinymce.views.upload_media",
    "automatic_uploads": True,
    "file_picker_types": "image media",
    "images_reuse_filename": True,
    "media_reuse_filename": True,
    "paste_data_images": True,
    "paste_as_text": False,
    "paste_enable_default_filters": True,
    "paste_word_valid_elements": "b,strong,i,em,h1,h2,h3,h4,h5,h6,p,br,a,ul,ol,li",
    "paste_retain_style_properties": "all",
    "paste_remove_styles": False,
    "paste_remove_styles_if_webkit": False,
    "paste_strip_class_attributes": False,
    "paste_merge_formats": True,
    "paste_auto_cleanup_on_paste": False,
    "paste_convert_headers_to_strong": False,
    "paste_convert_middot_lists": False,
    "paste_unindented_list_class": "unindentedList",
    "paste_indent": True,
    "paste_convert_word_fake_lists": False,
}
```

## Using TinyMCE Features

### Text Formatting
- **Basic Formatting**: Use the toolbar buttons for bold, italic, and text alignment
- **Lists**: Create bulleted and numbered lists using the list buttons
- **Indentation**: Use the indent/outdent buttons to adjust text hierarchy
- **Text Direction**: Switch between LTR and RTL text direction for multilingual content

### Media Management
1. **Inserting Images**:
   - Click the image button in the toolbar
   - Choose to upload a new image or select from existing ones
   - Set image properties (size, alignment, alt text)
   - Click "Insert" to add to content

2. **Inserting Media**:
   - Click the media button in the toolbar
   - Upload a new media file or select from existing ones
   - Configure media properties
   - Click "Insert" to add to content

3. **Managing Uploaded Files**:
   - All uploaded files are accessible through Django Admin
   - Navigate to "TinyMCE Media" section
   - View, search, and manage all uploaded files
   - Track upload dates and user information

### Advanced Features
- **Code View**: Click the "code" button to edit HTML directly
- **Preview**: Use the preview button to see how content will appear
- **Fullscreen**: Toggle fullscreen mode for better editing experience
- **Undo/Redo**: Use the undo/redo buttons to manage changes
- **Search/Replace**: Find and replace text within the editor

## Media Upload Handling

Files uploaded through TinyMCE are stored in the `TinyMCEMedia` model, which provides:

- File storage in the `tinymce_media/` directory
- Tracking of file type (image/media)
- Original filename preservation
- Upload timestamp
- User association (if authenticated)
- Admin interface integration

## Upgrading django-tinymce

**Important**: The current installation uses a specific Git commit. The goal is to upgrade to the PyPI version once it's stable. When upgrading, follow these steps:

1. **Check PyPI Version**
   - Visit [django-tinymce on PyPI](https://pypi.org/project/django-tinymce/)
   - Verify the latest stable version
   - Review release notes for breaking changes

2. **Update Dependencies**
   - Remove the Git source from `pyproject.toml` and `requirements.txt`:
   ```toml
   # Remove this section
   [tool.uv.sources]
   django-tinymce = { git = "https://github.com/jazzband/django-tinymce.git", rev = "685236d36af37afbb8e069099879b3489bbe8216" }
   ```
   In `requirements.txt`, remove this section:
   ```
   ...
   django-tinymce @ git+https://github.com/jazzband/django-tinymce.git@685236d36af37afbb8e069099879b3489bbe8216
   ...
   ```
   - Add the PyPI version:
   In `pyproject.toml`, update the dependencies section:
   ```toml
   dependencies = [
       "django-tinymce==NEW_VERSION",  # Replace with latest stable version
   ]
   ```
   In `requirements.txt`, remove the Git source:
   ```txt
   ...
   django-tinymce==NEW_VERSION
   ...
   ```

3. **Configuration Updates**
   - Review the new version's configuration options
   - Update `TINYMCE_DEFAULT_CONFIG` if needed
   - Test all editor features after configuration changes

4. **Migration Steps**
   - Create a new branch for the upgrade
   - Update the package
   - Run tests
   - Update documentation
   - Deploy to staging
   - Verify functionality
   - Deploy to production
## Customizing TinyMCE

### Adding New Plugins

1. Add the plugin name to the `plugins` list in `TINYMCE_DEFAULT_CONFIG`
2. Add the plugin's toolbar buttons to the `toolbar` configuration
3. Configure any plugin-specific settings

### Modifying Upload Behavior

The upload handlers are defined in `files/tinymce_handlers.py`. To modify upload behavior:

1. Update the handler functions
2. Modify the `TinyMCEMedia` model if needed
3. Update the admin interface configuration

### Styling and UI Customization

TinyMCE's appearance can be customized through:

1. CSS overrides in your templates
2. Theme modifications
3. Custom toolbar configurations

## Troubleshooting

### Common Issues

1. **Upload Failures**
   - TinyMCE only allows images to be uploaded. Make sure that you are only uploading images.
   - Check if you have write permissions for `media/tinymce_media` using
   ```bash
   ls -la media/tinymce_media
   ```
   If the directory does not exist, create it with the following command:
   ```bash
   mkdir -p media/tinymce_media
   ```

2. **Editor Not Loading**
   - Verify static files are served correctly. You can run the following commands to ensure that static files are served correctly:
   ```python
   python manage.py collectstatic --noinput
   ```
   or
   ```python
   uv run manage.py collectstatic --noinput
   ```
   
### Getting Help

- [django-tinymce Documentation](https://django-tinymce.readthedocs.io/)
- [TinyMCE Documentation](https://www.tiny.cloud/docs/)
- [GitHub Issues](https://github.com/jazzband/django-tinymce/issues) 