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

- **Components**: `frontend/src/static/js/features/<feature-name>/`
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

1. Create a directory under `features/<feature-name>/`
2. Create a Zustand store if client state is needed (`useFooStore.js`)
3. Use `useQuery`/`useMutation` for API calls (wrap in a scoped `QueryClientProvider`)
4. Style with Tailwind utilities — import `../../../css/tailwind.css`
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

## Pull Request Guidelines

When submitting a PR:

- [ ] I have not imported `flux` in a new component
- [ ] If adding a new feature, I used Modern Track patterns (Zustand, TanStack Query, Tailwind)
- [ ] New features do not create new SCSS files (use Tailwind instead)
- [ ] `QueryClientProvider` is scoped to the feature page, not in shared components
- [ ] Modern-track components use `useContext()`, not `_currentValue`
- [ ] URL routes are placed above the catch-all pattern in `files/urls.py`
