# Cinemata extension Architecture and Hookpoints

## Overview

Cinemata is designed with an expandable architecture that allows developers to enhance and customize core functionality without modifying the original codebase. Extensions provide modular ways to add new features, override default behaviors, or hook into key lifecycle events.

---

## Extension Architecture

### 1. Base Configuration and Settings

- Cinemata maintains core configuration objects for major features such as [pages](pages-configuration-module.md), [themes](theme-configuration-module.md), [taxonomies](taxonomies-confirguration-module.md), **playlists**, and [embedded videos](embeded-configuration-module.md).
- These core configs are initialized with sensible defaults.
- Extensions can **merge or override** these configurations during the initialization phase.

### 2. Extensions as Modular Objects

- Extensions are structured as **modular objects or functions** that:
  - Define additional settings or UI components.
  - Modify existing configuration keys.
  - Register hooks or event listeners.

### 3. Extension Registration

- Extensions are typically registered by passing extension objects to an `init()` function or a dedicated extension manager.
- The system merges extension settings with the base configuration while preserving defaults.
- Invalid or unsupported extension keys are ignored to maintain system integrity.

---

## Hookpoints

Cinemata exposes multiple hookpoints where extensions can interact with core processes:

### 1. Initialization Hook

- **When:** During the system or module initialization.
- **Purpose:** Extensions can modify initial settings or add new configuration parameters.
- **Usage Example:**

```js
import { init as initPages } from './pages.js';

const extensionSettings = {
  latest: { enabled: true, title: 'New Uploads' },
  recommended: { enabled: true },
};

initPages(extensionSettings);
```

## 2. Configuration Merge Hook

- **When:** When base configs merge with extension configs.

- **Purpose:** Allows extensions to selectively override or add keys.

- **Implementation:** Internal to `init()` functions that carefully check for provided values.

---

## 3. Event Hookpoints (Conceptual)

While not explicitly coded in core config modules, Cinematas supports the concept of:

- **Lifecycle events** (e.g., `onPageLoad`, `onThemeChange`).

- **UI hooks** to inject components or alter layout.

Extensions can register callbacks here to extend dynamic behaviors.

---

## Best Practices for Developing Extensions

- Do **not** modify core files directly. Use the provided `init()` functions or extension APIs.

- Validate all inputs before merging with core settings.

- Respect existing keys and avoid overriding unless intentional.

- Document your extension’s configuration keys and effects.


## Example Extension Structure


```js
const myExtension = {
  latest: { enabled: true, title: 'Latest Videos' },
  theme: {
    mode: 'dark',
    switch: { enabled: true, position: 'sidebar' },
  },
  playlists: {
    mediaTypes: ['video'],
  },
};

// Register or initialize extensions
initPages(myExtension);
initTheme(myExtension.theme);
initPlaylists(myExtension.playlists);

```

## Summary

The Cinemata extension architecture empowers developers to:

- Extend or override configurations cleanly.
- Hook into system initialization for customization.
- Maintain modular, maintainable codebases through extensions.