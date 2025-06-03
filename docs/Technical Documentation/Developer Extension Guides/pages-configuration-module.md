# ⚙️Pages Configuration Module

The [Pages](../../frontend/src/static/js/mediacms/pages.js) module manages configuration of various special pages (e.g., latest uploads, featured content) within the CinemataCMS platform.

---

## Initialization

`init(settings)`

## Parameters
- `settings` (object): Optional configuration object to override default page settings.

## Default Configuration

```js
PAGES = {
  latest: {
    enabled: false,
    title: 'Recent uploads',
  },
  featured: {
    enabled: false,
    title: 'Featured',
  },
  recommended: {
    enabled: false,
    title: 'Recommended',
  },
  members: {
    enabled: false,
    title: 'Members',
  },
  liked: {
    enabled: false,
    title: 'Liked media',
  },
  history: {
    enabled: false,
    title: 'History',
  },
}
```


## Page Configuration Details

For each page:

- **`enabled`**: Boolean indicating if the page is active and visible.
- **`title`**: String representing the display title of the page.

If a page key exists in the `settings` object, it will be enabled by default unless explicitly set to `false`. Titles are overridden if a non-empty string is provided.

---
## Usage Example

```js
import { init, settings } from './pages.js';

init({
  latest: {
    enabled: true,
    title: 'New Uploads',
  },
  featured: {
    enabled: true,
  },
  history: {
    enabled: false,
  }
});

console.log(settings().latest.enabled); 
console.log(settings().latest.title);  
console.log(settings().history.enabled);

```
## Notes

- If `init()` is not called, all pages are disabled by default.
- Partial overrides are supported; only pages included in `settings` are affected.
- The module facilitates easy toggling and renaming of key CMS pages without modifying core templates.
