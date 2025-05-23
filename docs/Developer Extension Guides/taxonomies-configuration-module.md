# ⚙️Taxonomies Configuration Module

The [Taxonomies](../../frontend/src/static/js/mediacms/taxonomies.js) module manages the configuration of various taxonomy types (such as tags, categories, topics) used in the CinemataCMS platform.

---

## Initialization

`init(settings)`

## Parameters
- `settings` (object): Optional configuration object to enable/disable taxonomies and customize their titles.

## Default Configuration

```js
TAXONOMIES = {
  tags: {
    enabled: false,
    title: 'Tags',
  },
  categories: {
    enabled: false,
    title: 'Categories',
  },
  topics: {
    enabled: false,
    title: 'Topics',
  },
  languages: {
    enabled: false,
    title: 'Languages',
  },
  countries: {
    enabled: false,
    title: 'Countries',
  },
}
```


## Taxonomy Configuration Details

For each taxonomy:

- **enabled**: Boolean indicating if the taxonomy is active and visible.
- **title**: String representing the display title of the taxonomy.

If a taxonomy key exists in the `settings` object, it will be enabled by default unless explicitly set to `false`. Titles are overridden if a non-empty string is provided.

---

## Notes

- If `init()` is not called, all taxonomies are disabled by default.
- Partial overrides are supported; only taxonomies included in `settings` are affected.
- This module allows toggling and renaming key taxonomy types without modifying core templates.
