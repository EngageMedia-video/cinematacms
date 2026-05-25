# ⚙️Theme Configuration Module

by [Mico Balina](https://github.com/Micokoko) (Philippines)

The [Theme](../../frontend/src/static/js/mediacms/theme.js) module provides customizable theme settings for the application, including light/dark mode, toggle switch settings, and per-breakpoint logos.

---

## Initialization

Use the `init(theme, logo)` function to initialize theme settings.

---

## Default Structure

```js
THEME = {
  mode: 'light', // 'light' or 'dark'
  switch: {
    enabled: true,
    position: 'header'
  },
  logo: {
    desktop: {
      img: '',
      svg: ''
    },
    mobile: {
      img: '',
      svg: ''
    }
  }
};
```

## Configuration Options

### Theme Mode

- **Key:** `mode`  
- **Type:** `string`  
- **Values:** `'light'` (default), `'dark'`  
- **Description:** Determines the color mode of the application.

---

### Theme Switch

#### `switch.enabled`

- **Type:** `boolean`  
- **Default:** `true`  
- **Description:** Controls visibility of the light/dark mode toggle switch.

#### `switch.position`

- **Type:** `string`  
- **Values:** `'header'` (default), `'sidebar'`  
- **Description:** Determines the location of the theme switch.

---

### Logo Configuration

Configure a logo file per breakpoint. The topbar background is the same in
light and dark theme, so no per-mode variant is needed.

#### `logo.desktop`

- **`img`**: `string` Image URL for the desktop logo (`sm:` and up).
- **`svg`**: `string` SVG URL for the desktop logo. Used in preference to `img`
  when the browser supports inline SVG.

#### `logo.mobile`

- **`img`**: `string` Image URL for the mobile logo (below `sm:`).
- **`svg`**: `string` SVG URL for the mobile logo.

If `mobile` is omitted or both fields are empty, the topbar reuses the
`desktop` URL on the mobile breakpoint.

The legacy `{ lightMode, darkMode }` shape is still accepted for backward
compatibility — both entries collapse to a single desktop logo — but new
deployments should use the `desktop` / `mobile` shape above.

---

## Notes

- Any unrecognized `mode` or `switch.position` values default to `'light'` and `'header'`, respectively.
- Empty string values are permitted for logos if no logo is required.
- Use `.trim()` on input strings to sanitize user input.
