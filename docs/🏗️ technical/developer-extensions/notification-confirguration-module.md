
# Notification Configuration Module

by [Mico Balina](https://github.com/Micokoko) (Philippines)

The [Notification](../../frontend/src/static/js/mediacms/notifications.js) module manages customizable notification messages for user interactions such as liking or disliking media in the CinemataCMS platform.

---

## Initialization

`init(settings)`

## Parameters
- `settings` (object): Optional configuration object to override default notification messages.

## Default Configuration

```js
NOTIFICATIONS = {
    messages: {
        addToLiked: 'Added to liked media',
        removeFromLiked: 'Removed from liked media',
        addToDisliked: 'Added to disliked media',
        removeFromDisliked: 'Removed from disliked media',
    },
}
```

## Message Configuration Details

- **`addToLiked`**: Message shown when media is added to liked list.
- **`removeFromLiked`**: Message shown when media is removed from liked list.
- **`addToDisliked`**: Message shown when media is added to disliked list.
- **`removeFromDisliked`**: Message shown when media is removed from disliked list.

Settings passed to `init()` will override default messages only if they are strings and correspond to valid keys under `messages`.

---

## Usage Example

```js
import { init, settings } from './notifications.js';

init({
  messages: {
    addToLiked: 'You liked this media!',
    removeFromLiked: 'You unliked this media.',
  }
});

console.log(settings().messages.addToLiked); // Outputs: 'You liked this media!'
```

---

## Notes

- If `init()` is not called, notifications will remain uninitialized (`null`).
- The module supports partial overrides; unspecified messages remain default.
- This modular approach allows easy localization or customization of notification texts without modifying core logic.

---
