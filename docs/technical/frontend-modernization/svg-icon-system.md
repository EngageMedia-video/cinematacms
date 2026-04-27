# Modern SVG Icon System

This document describes the modern-track SVG workflow for CinemataCMS.

## Scope

The SVG component pipeline applies to modern-track work only.

- Use this system for new components under `frontend/src/features/`
- Legacy `MaterialIcon` usage and `frontend/src/static/images/icons/` remain valid for existing non-modern surfaces
- Do not add new light/dark/active duplicate SVG files for modern-track icons

## File Locations

- Semantic icon source SVGs: `frontend/src/features/shared/icons/`
- Shared icon runtime: `frontend/src/features/shared/components/Icon.jsx`
- Registry: `frontend/src/features/shared/components/iconRegistry.js`
- Decorative SVG components should live beside modern-track consumers or under `frontend/src/features/shared/decorations/` when they become shared

## Automatic Registration

Shared semantic icons are auto-registered by Vite.

- Add an SVG file to `frontend/src/features/shared/icons/`
- The registry discovers it automatically during dev/build
- You do not need to edit `iconRegistry.js` for normal additions

Filename rules:

- Use kebab-case filenames
- The runtime converts them to camelCase icon names

Examples:

- `your-icon.svg` -> `yourIcon`
- `notification-bell.svg` -> `notificationBell`
- `user-avatar-fallback.svg` -> `userAvatarFallback`

If two filenames would normalize to the same camelCase key, the build fails so the collision is caught early.

## Figma Export Contract

When exporting icons from Figma for the shared icon registry:

1. Export one SVG per icon concept
2. Preserve the `viewBox`
3. Avoid raster images, embedded scripts, and editor-only metadata
4. Prefer monochrome artwork that can use `currentColor`
5. Use decorative/multitone exports only when the asset is not a semantic UI icon

## Optimization Pipeline

The frontend uses:

- `vite-plugin-svgr` for React component imports
- `frontend/svgo.config.mjs` for SVG cleanup

The shared registry wraps these imports automatically, so most consumers should use `<Icon />` instead of importing the SVG directly.

## Using an Icon in a Modern Component

```jsx
import { Icon } from '../../features/shared/components/Icon.jsx';

export function ExampleButton() {
	return (
		<button type="button" className="text-content-body hover:text-brand-primary">
			<Icon name="yourIcon" label="Open preview" size="md" />
		</button>
	);
}
```

Notes:

- `name` must match the registry key
- `label` makes the icon accessible as an image
- Omit `label` for decorative usage; the icon will render with `aria-hidden="true"`
- `size` accepts `xs`, `sm`, `md`, `lg`, `xl`, or a numeric pixel value
- Color comes from CSS via `currentColor`
