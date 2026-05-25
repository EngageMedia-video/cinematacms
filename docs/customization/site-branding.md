# How to Customize Your Site Branding

This guide shows you how to replace the default logo and tagline with your own branding.

## Changing the Logo

The default logo is a "Your Logo Here" placeholder. Replace it with your own
files — one for desktop, one for mobile. Both SVG (preferred) and JPG fallback
are supported. The topbar background is the same in light and dark theme, so
a single file per breakpoint is enough.

### Logo Specifications

| Breakpoint | Used at        | Recommended dimensions | Notes                                  |
| ---------- | -------------- | ---------------------- | -------------------------------------- |
| Desktop    | `sm:` and up   | 240px × 60px (4:1)     | Combined mark + wordmark works well.   |
| Mobile     | below `sm:`    | 60px × 60px (1:1)      | Mark-only works best in the tight row. |

The same desktop file is also rendered on the 503 maintenance page.

### Steps to Change the Logo

1. Create your logo files (one desktop, one mobile).
2. Save each in both SVG and JPG formats if you want a fallback.
3. Place the files in your static directory (e.g., `/static/images/`).
4. Update the file paths in `templates/config/installation/site.html`:

```html
MediaCMS.site = {
    // other settings...
    logo:{
        desktop:{
            img: "{{FRONTEND_HOST}}/static/images/your-logo-desktop.jpg",
            svg: "{{FRONTEND_HOST}}/static/images/your-logo-desktop.svg"
        },
        mobile:{
            img: "{{FRONTEND_HOST}}/static/images/your-logo-mobile.jpg",
            svg: "{{FRONTEND_HOST}}/static/images/your-logo-mobile.svg"
        },
    },
    // other settings...
};
```

If `mobile` is omitted the topbar falls back to the `desktop` file.

The legacy `{ lightMode, darkMode }` shape is still accepted for backward
compatibility — when present, both entries collapse to a single desktop logo —
but new deployments should use the `desktop` / `mobile` shape above.

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

1. Run `python manage.py collectstatic` to ensure the static files are properly collected.
2. Restart your web server.
3. Check your site at desktop and mobile viewports to ensure both logos display correctly.

Remember that the tagline should be concise as space in the header is limited.
