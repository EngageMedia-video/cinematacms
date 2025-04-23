# How to Customize Your Site Branding

This guide shows you how to replace the default logo and tagline with your own branding.

## Changing the Logo

The default logo placeholder is a simple image with the text "Your Logo Here". You should replace it with your own logo in both JPG and SVG formats for better display across different devices.

### Logo Specifications
- **Recommended dimensions**: 240px × 60px
- **File formats needed**: 
  - JPG (for fallback)
  - SVG (for better scaling)
- **Locations**: Create both light and dark theme versions

### Steps to Change the Logo

1. Create your logo in the recommended dimensions
2. Save it in both JPG and SVG formats
3. Create versions optimized for both light and dark backgrounds if needed
4. Place the files in your static directory (e.g., `/static/images/`)
5. Update the file paths in `templates/config/installation/site.html`:

```html
MediaCMS.site = {
    // other settings...
    logo:{
        lightMode:{
            img: "{{FRONTEND_HOST}}/static/images/your-logo-lightbg.jpg",
            svg: "{{FRONTEND_HOST}}/static/images/your-logo-lightbg.svg"
        },
        darkMode:{
            img: "{{FRONTEND_HOST}}/static/images/your-logo-darkbg.jpg",
            svg: "{{FRONTEND_HOST}}/static/images/your-logo-darkbg.svg"
        },
    },
    // other settings...
};
```

## Changing the Tagline

The default tagline "Your Site Tagline" appears next to the logo. Replace it with your own branding message.

### Steps to Change the Tagline

1. Edit the file `templates/config/installation/contents.html`
2. Find the `onLogoRight` property and replace the value with your tagline:

```html
MediaCMS.contents = {
    header: {
        right: null,
        onLogoRight: 'Your Custom Tagline Goes Here',
    },
    // other settings...
};
```

## Testing Your Changes

After making these changes:

1. Run `python manage.py collectstatic` to ensure the static files are properly collected
2. Restart your web server
3. Check your site in both light and dark mode to ensure the logos display correctly

Remember that the tagline should be concise as space in the header is limited.
