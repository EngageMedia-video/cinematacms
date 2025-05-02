# Guide: How to Customize Social Media Links in the Sidebar

If you want to change the social media links that appear in the sidebar of your Cinemata-based site, you'll need to modify a specific configuration file. This guide will walk you through the process step by step.

## Locating the File to Edit

The social media links are defined in the `templates/config/installation/contents.html` file. This file contains various content configurations for your site, including the sidebar elements.

## Understanding the Current Configuration

The current sidebar social media links are defined in a HTML structure within the `belowNavMenu` property. Here's what it looks like:

```html
belowNavMenu: '<ul class="social-media-links">\
                <li>\
                    <a href="https://mailer.cinemata.org" target="_blank" rel="noreferrer" title="" alt="">\
                        <img src="/static/images/icons/dark-mode/newsletter.png" loading="lazy" alt=""/>\
                    </a>\
                </li>\
                <li>\
                    <a href="http://www.facebook.com/cinematavideo" target="_blank" rel="noreferrer" title="" alt="">\
                        <img src="/static/images/icons/dark-mode/facebook.png" loading="lazy" alt="" />\
                    </a>\
                </li>\
                <li>\
                    <a href="http://twitter.com/cinemata" target="_blank" rel="noreferrer" title="" alt="">\
                        <img src="/static/images/icons/dark-mode/twitter.png" loading="lazy" alt="" />\
                    </a>\
                </li>\
            </ul>',
```

## How to Modify the Social Media Links

1. Open the `templates/config/installation/contents.html` file in your preferred text editor
2. Locate the `belowNavMenu` property in the file
3. Edit the existing links by changing:
   - The `href` attribute to your desired URL
   - The image path if you want to use different icons
   - Add or remove `<li>` elements to add or remove social media links

## Example: Adding an Instagram Link

To add an Instagram link, you would:

1. Create or obtain an Instagram icon image and place it in your static files (e.g., `/static/images/icons/dark-mode/instagram.png`)
2. Add a new `<li>` element in the social media links list:

```html
<li>\
    <a href="https://www.instagram.com/yourprofile" target="_blank" rel="noreferrer" title="Instagram" alt="Instagram">\
        <img src="/static/images/icons/dark-mode/instagram.png" loading="lazy" alt="Instagram" />\
    </a>\
</li>\
```

## Example: Complete Replacement with New Links

If you want to completely replace the existing links with your own set (e.g., Instagram, LinkedIn, and GitHub), here's how the code would look:

```html
belowNavMenu: '<ul class="social-media-links">\
                <li>\
                    <a href="https://www.instagram.com/yourprofile" target="_blank" rel="noreferrer" title="Instagram" alt="Instagram">\
                        <img src="/static/images/icons/dark-mode/instagram.png" loading="lazy" alt="Instagram"/>\
                    </a>\
                </li>\
                <li>\
                    <a href="https://www.linkedin.com/company/yourcompany" target="_blank" rel="noreferrer" title="LinkedIn" alt="LinkedIn">\
                        <img src="/static/images/icons/dark-mode/linkedin.png" loading="lazy" alt="LinkedIn" />\
                    </a>\
                </li>\
                <li>\
                    <a href="https://github.com/yourorganization" target="_blank" rel="noreferrer" title="GitHub" alt="GitHub">\
                        <img src="/static/images/icons/dark-mode/github.png" loading="lazy" alt="GitHub" />\
                    </a>\
                </li>\
            </ul>',
```

## Adding Icons for Dark and Light Mode

If your site supports both dark and light modes, you might want to provide different icons for each mode. You can do this with CSS:

1. Add classes to your images:
```html
<img src="/static/images/icons/dark-mode/facebook.png" class="dark-mode-icon" loading="lazy" alt="Facebook" />
<img src="/static/images/icons/light-mode/facebook.png" class="light-mode-icon" loading="lazy" alt="Facebook" />
```

2. Add CSS to show/hide the icons based on the current theme:
```css
body.light-mode .dark-mode-icon {
    display: none;
}
body.dark-mode .light-mode-icon {
    display: none;
}
```

## After Making Changes

After making changes to the `contents.html` file:

1. Save the file
2. If your site uses a build process, rebuild the site
3. Restart your web server if necessary
4. Clear your browser cache
5. Refresh your site to see the changes

Remember that the paths to your icon images must be correct relative to your static files directory. If you're missing icons, check the file paths and make sure the images exist in the specified locations.