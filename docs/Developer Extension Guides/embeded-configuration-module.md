
# Embedded Video Configuration Module

The `Embedded` module manages configuration of embedded video display settings within the CinemataCMS platform.

---

## Initialization

`init(embeddedVideo)`

## Parameters
- `embeddedVideo` (object): Optional configuration object to override default embedded video settings.

## Default Configuration

```js
EMBEDDED = {
  video: {
    dimensions: {
      width: 560,
      widthUnit: 'px',   
      height: 315,
      heightUnit: 'px', 
    },
  }
}
```

## Dimensions Configuration Details

- **`width`**: Numeric width of the embedded video. Defaults to `560`.
- **`widthUnit`**: Unit for width; either `'px'` or `'percent'`. Defaults to `'px'`.
- **`height`**: Numeric height of the embedded video. Defaults to `315`.
- **`heightUnit`**: Unit for height; either `'px'` or `'percent'`. Defaults to `'px'`.

Settings passed to `init()` will override defaults only if they meet type and value criteria.

---

## Usage Example

```js
import { init, settings } from './embedded.js';

init({
  initialDimensions: {
    width: 800,
    widthUnit: 'percent',
    height: 450,
    heightUnit: 'px',
  }
});

console.log(settings().video.dimensions.width);
console.log(settings().video.dimensions.widthUnit)
```

---

## Notes

- If `init()` is not called, the embedded video configuration remains uninitialized (`null`).
- Units are restricted to `'px'` or `'percent'`.
- This module supports flexible sizing options for embedded video content, facilitating responsive design.

---
