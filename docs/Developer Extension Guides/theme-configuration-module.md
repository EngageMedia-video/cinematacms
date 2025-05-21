# ⚙️Theme Configuration Module

This module provides customizable theme settings for the application, including light/dark mode, toggle switch settings, and theme-specific logos.

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
    lightMode: {
      img: '',
      svg: ''
    },
    darkMode: {
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

Configure different logos for light and dark modes.

#### `logo.lightMode`

- **`img`**: `string` Image URL for light mode logo.  
- **`svg`**: `string` Inline SVG markup or file path for light mode.

#### `logo.darkMode`

- **`img`**: `string` Image URL for dark mode logo.  
- **`svg`**: `string` Inline SVG markup or file path for dark mode.

---

## Notes

- Any unrecognized `mode` or `switch.position` values default to `'light'` and `'header'`, respectively.  
- Empty string values are permitted for logos if no logo is required.  
- Use `.trim()` on input strings to sanitize user input.
