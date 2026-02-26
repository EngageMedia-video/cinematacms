# Contributing to CinemataCMS

## Dual-Track Architecture

CinemataCMS uses a **dual-track** frontend architecture:

### Legacy Track (existing code)

- **Components**: `frontend/src/static/js/pages/`, `frontend/src/static/js/components/`
- **State management**: Flux stores (`FooStore.js` — PascalCase, class-based with EventEmitter)
- **Styling**: SCSS files in `frontend/src/static/css/`
- **Context access**: Legacy code uses `SomeContext._currentValue` (avoid in new code)

Bug fixes and minor changes to existing features should follow legacy patterns.

### Modern Track (new features)

- **Components**: `frontend/src/features/<feature-name>/`
- **State management**: Zustand stores (`useFooStore.js` — `use` prefix, hook-based)
- **Server state**: TanStack Query (`useQuery`, `useMutation`)
- **Styling**: Tailwind CSS utilities (import `tailwind.css` — no new SCSS files)
- **Context access**: `useContext(SomeContext)` (proper React subscriptions)
- **Layout**: Use `PageLayout` from `pages/page.js` (wraps with sidebar, notifications)

> **Note:** `PageLayout` is shared infrastructure that bridges both tracks. It internally uses legacy patterns (`LayoutStore`) for sidebar management. This is intentional and will be modernized in a future milestone.

All new features must use modern track patterns.

## Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| Django templates | `snake_case` | `modern_demo.html` |
| JS entry files | `kebab-case` | `modern-demo.js` |
| Modern stores | `useFooStore.js` | `useDemoStore.js` |
| Legacy stores | `FooStore.js` | `LayoutStore.js` |
| Feature directories | `kebab-case` | `features/modern-demo/` |

**Note**: The `-NEW-` directory under `components/` is a historical naming convention from the original codebase. It is **not** the "modern track". New features go in `features/`.

## Development Workflow

### New Feature Checklist

1. Create a directory under `src/features/<feature-name>/`
2. Create a Zustand store if client state is needed (`useFooStore.js`)
3. Use `useQuery`/`useMutation` for API calls (wrap in a scoped `QueryClientProvider`)
4. Style with Tailwind utilities — import `../../static/css/tailwind.css`. Use semantic tokens like `text-brand-theme`, `bg-surface-body`, `text-content-success`. Per-deployment customizations (`_extra.css`) flow through automatically via CSS vars.
5. Create an entry file in `src/entries/<feature-name>.js`
6. Add the entry to `rollupOptions.input` in `vite.config.js`
7. Create a Django template extending `base.html`
8. Add URL route in `files/urls.py` **above the catch-all pattern**
9. Add a view function in `files/views.py`

### Running Locally

```bash
# Install dependencies
cd frontend && npm install

# Start Vite dev server
npm run dev

# Start Django (in another terminal)
uv run python manage.py runserver

# Build for production
npm run build

# Lint modern track files
npm run lint
```

### Track Boundary Rules

ESLint enforces the boundary between tracks:

- **Modern track** (`features/`): Importing `flux` or legacy Flux stores is an **error**.
- **Legacy track** (`pages/`, `components/`): Importing `zustand` or `@tanstack/react-query` is a **warning**.

Run `npm run lint` to check modern track files.

## Styling with Tailwind CSS

### How It Works

Modern-track components use **Tailwind CSS v4** with semantic design tokens that bridge the existing SCSS theme system:

```
_light_theme.scss / _dark_theme.scss
  ↓  define CSS custom properties (e.g. --btn-primary-bg-color)
tailwind.css  @theme inline
  ↓  maps them to Tailwind tokens (e.g. --color-brand-primary)
Tailwind utility classes
  ↓  used in JSX (e.g. bg-brand-primary)
```

- **Dark/light auto-switch** — tokens read CSS vars that change when the body class toggles between `body.dark_theme` and `body.light_theme`. No extra work needed.
- **`_extra.css` overrides** — per-deployment customizations flow through automatically because CSS vars resolve at runtime.
- **`@theme inline`** — this keyword tells Tailwind v4 to emit `var(--btn-primary-bg-color)` directly in generated utilities, so theme switching works. Without it, Tailwind would create an intermediate variable that resolves at the wrong scope.

### Token Naming Pattern

Tokens follow `{group}-{variant}` naming. The Tailwind utility prefix comes from usage:

| Tailwind Class | Token | CSS Variable | Use For |
|---|---|---|---|
| `bg-brand-primary` | `brand-primary` | `--btn-primary-bg-color` | Primary button/action backgrounds |
| `bg-brand-primary-hover` | `brand-primary-hover` | `--btn-primary-bg-hover-color` | Primary button hover state |
| `text-btn-text` | `btn-text` | `--btn-color` | Text on primary buttons |
| `bg-surface-body` | `surface-body` | `--body-bg-color` | Page background |
| `bg-surface-popup` | `surface-popup` | `--popup-bg-color` | Modal/popup backgrounds |
| `text-content-body` | `content-body` | `--body-text-color` | Main body text |
| `text-content-link` | `content-link` | `--links-color` | Hyperlinks |
| `text-content-error` | `content-error` | `--error-text-color` | Error messages |
| `text-content-success` | `content-success` | `--success-color` | Success indicators |
| `border-border-input` | `border-input` | `--input-border-color` | Form input borders |

### Finding Tokens

1. **Live reference** — visit `/modern-demo/` (available when `DEBUG=True`). It shows all 220+ tokens with live color swatches, usage recipes, and a dark-mode toggle.
2. **Canonical source** — `frontend/src/static/css/tailwind.css` defines every token in the `@theme inline` block.
3. **Reading the bridge** — each line maps a Tailwind token to a CSS var:
   ```css
   --color-brand-primary: var(--btn-primary-bg-color);
   ```
   This means `bg-brand-primary` gives you the primary button color. The `--color-` prefix is how Tailwind v4 registers color tokens; you drop it when writing classes.

### Common Patterns

**Primary & secondary buttons:**
```jsx
<button className="bg-brand-primary text-btn-text px-4 py-2 rounded hover:bg-brand-primary-hover">
  Save
</button>
<button className="bg-brand-secondary text-btn-secondary-text px-4 py-2 rounded border border-brand-secondary-border hover:bg-brand-secondary-hover">
  Cancel
</button>
```

**Card / surface with text:**
```jsx
<div className="bg-surface-body text-content-body p-4 rounded border border-border-input">
  <h3 className="font-heading text-lg">Title</h3>
  <p className="text-item-meta text-sm">Subtitle or metadata</p>
</div>
```

**Status badge:**
```jsx
<span className="text-content-success text-sm font-medium">Published</span>
<span className="text-content-warning text-sm font-medium">Pending</span>
<span className="text-content-danger text-sm font-medium">Rejected</span>
```

**Form input:**
```jsx
<input
  className="bg-surface-input text-content-input border border-border-input rounded px-3 py-2 placeholder:text-content-body/50"
  placeholder="Enter value..."
/>
```

### What NOT to Do

- **Don't hardcode hex colors** — use tokens. `bg-brand-primary` not `bg-[#ED7C30]`.
- **Don't construct dynamic class names** — `` `bg-${color}` `` breaks Tailwind v4's static analysis. Use complete class strings.
- **Don't create new SCSS files** — modern-track features use Tailwind only.
- **Don't import `tailwind.css` in legacy components** — it is scoped to the modern track. Legacy components use SCSS.

### Demo Page Reference

| | |
|---|---|
| **URL** | `/modern-demo/` (requires `DEBUG=True`) |
| **What it shows** | All 220+ tokens, live color swatches, copy-paste usage recipes, architecture comparison |
| **How to use it** | Browse tokens, copy class names, toggle dark mode to see theme switches |
| **Source** | `frontend/src/features/modern-demo/ModernDemoPage.js` |

## Pull Request Guidelines

When submitting a PR:

- [ ] I have not imported `flux` in a new component
- [ ] If adding a new feature, I used Modern Track patterns (Zustand, TanStack Query, Tailwind)
- [ ] New features do not create new SCSS files (use Tailwind instead)
- [ ] `QueryClientProvider` is scoped to the feature page, not in shared components
- [ ] Modern-track components use `useContext()`, not `_currentValue`
- [ ] URL routes are placed above the catch-all pattern in `files/urls.py`
