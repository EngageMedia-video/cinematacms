# ⚙️MEDIA Configuration Module

by [Mico Balina](https://github.com/Micokoko) (Philippines)

The [MEDIA](../../frontend/src/static/js/mediacms/media.js) module is responsible for configuring the display of media items and share options within the Cinematas platform.

---

## Initialization

`init(item, shareOptions)`

## Parameters
- item (object): Configuration for media item display settings.
- shareOptions (array): List of enabled share platforms.

## Default Configuration

```js
MEDIA = {
  item: {
    size: 'small',               // 'small' | 'medium' | 'large'
    displayAuthor: true,         
    displayViews: true,         
    displayPublishDate: true,    
    displayCategories: false,   
  },
  share: {
    options: [],    
  }
}

```

## Item Configuration Details


- **`size`**:  Sets the media item size.  Accepts: `'small'`, `'medium'`, `'large'`.   Defaults to `'small'` if invalid or not provided.
- **`hideAuthor`**:  If `true`, hides the author display.
- **`hideViews`**: If `true`, hides the views display.
- **`hideDate`**: If `true`, hides the publish date display.
- **`hideCategories`**:  If `false`, enables the display of categories.

---

### Share Options

The following share platforms are supported:

- `embed`
- `fb` (Facebook)
- `tw` (Twitter / X)
- `whatsapp`
- `telegram`
- `reddit`
- `tumblr`
- `vk`
- `pinterest`
- `mix`
- `linkedin`
- `email`

Only **valid share options** will be pushed into `MEDIA.share.options`.

---