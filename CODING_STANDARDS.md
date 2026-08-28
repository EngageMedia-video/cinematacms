# CinemataCMS coding standards

These standards apply to production code, tests, migrations, build
configuration, and user-facing documentation. `CONTRIBUTING.md` defines the
contribution workflow. This file defines the rules for the change itself.

## Keep each change coherent

- Make one coherent change per pull request.
- Keep unrelated formatting, dependency updates, and refactors out of the diff.
- Follow the existing application boundary unless the change explicitly alters
  the architecture.
- Add or update tests when behavior changes.
- Update the source documentation when a command, configuration option, public
  interface, contributor rule, or user workflow changes.

## Follow the Python and Django configuration

Treat `pyproject.toml` and `.pre-commit-config.yaml` as the sources for Python
formatting, lint, import ordering, and Django upgrade rules. Run
`make agent-check` instead of reproducing those rules by hand.

Apply these project rules:

- Commit the Django migration for every model change.
- Put a new `files/urls.py` route above the catch-all slug pattern.
- Enforce authentication, authorization, and object access on the server. A
  hidden frontend control is not an access check.
- Validate untrusted request data before it reaches storage, a template, a
  subprocess, or an external service.
- Keep credentials and private service details in local settings or environment
  variables. Do not add them to source, fixtures, logs, or screenshots.

## Test observable behavior

- Test through the public boundary used by a caller or user.
- Add a regression test that fails before a bug fix and passes after it.
- Use an independent expected value from the requirement or a worked example.
  Do not repeat the implementation algorithm in the assertion.
- Prefer the real Django test database and repository components. Mock an
  external service, time, randomness, or another true system boundary.
- Keep a focused test deterministic. Fix or isolate a flaky dependency before
  treating the result as evidence.
- Do not weaken, skip, or delete a valid test to make a change pass.

Use the `tdd` repository skill when the work requires a test-first cycle.

## Choose the frontend track by directory

CinemataCMS keeps existing frontend code stable while new features use the
modern frontend. The directory determines which rules apply.

| Rule | Modern frontend | Legacy frontend |
|---|---|---|
| Use for | New features and new pages | Fixes and small changes to existing features |
| Source | `frontend/src/features/<feature-name>/` | `frontend/src/static/js/pages/` and `frontend/src/static/js/components/` |
| Client state | React state or Zustand | Flux stores and `EventEmitter` |
| Server state | TanStack Query | Existing request and store patterns |
| Styling | Tailwind CSS utilities | Existing SCSS |
| React context | `useContext(SomeContext)` | Existing access patterns, including `_currentValue` |

`frontend/src/static/js/components/-NEW-/` belongs to the legacy track despite
its directory name.

`frontend/eslint.config.mjs` enforces the track boundary. Modern code cannot
import Flux or a legacy store. A legacy file that imports Zustand or TanStack
Query produces a warning.

## Add a modern frontend page

For a new page:

1. Create `frontend/src/features/<feature-name>/`.
2. Use React state for local component state. Add a Zustand store only when
   several components share client state.
3. Use TanStack Query for remote state. Put `QueryClientProvider` at the page or
   feature root, not inside a reusable leaf component.
4. Add `frontend/src/entries/<feature-name>.js`.
5. Add the entry to `rollupOptions.input` in `frontend/vite.config.js`.
6. Add the Django template, view, and URL pattern.
7. Use `PageLayout` from `frontend/src/static/js/pages/page.js` when the page
   uses the existing application shell.

Use `kebab-case` for feature directories and entry files. Name a Zustand store
`useFooStore.js`. Use `snake_case` for Django templates.

Read `docs/technical/FRONTEND_WORKFLOW.md` before choosing an application shell
or changing a frontend entry point.

## Use semantic styles and accessible controls

Use Tailwind utilities and the semantic tokens in
`frontend/src/static/css/tailwind.css` for modern code. Pick the token that
describes the role, such as `bg-brand-primary`, `bg-surface-body`, or
`text-content-error`.

- Do not add an SCSS file for a modern feature.
- Do not hardcode a color when a semantic token exists.
- Write complete Tailwind class strings. Do not build class names at runtime.
- Do not import `tailwind.css` into a legacy component.
- Do not use `transition-all`.

When `DEBUG=True`, `/modern-demo/` shows the available tokens and their theme
behavior. The `@theme inline` block in `tailwind.css` is the canonical token
list.

For a UI change, verify semantic controls, accessible names, keyboard
operation, visible focus, image dimensions, alternative text, and
reduced-motion behavior. Check each affected viewport and theme.

## Keep dependency changes reproducible

- Change a dependency declaration and its lockfile in the same change.
- Use the package manager and version declared by the repository.
- Do not regenerate `frontend/package-lock.json` with npm 10. The frontend uses
  the npm version declared in `frontend/package.json`.
- Explain why a new production dependency is necessary.
- Keep dependency-only updates separate from feature work unless the feature
  requires the update.

## Write durable documentation

- Document public behavior, setup requirements, and operational constraints.
- Use comments to explain a non-obvious reason or invariant. Do not narrate code
  that already states the operation.
- Use repository-relative paths and commands that work at the current commit.
- Pin a count or baseline to a commit and include the command that reproduces
  it.

## Verify the applicable standards

Run the commands in `CONTRIBUTING.md` that cover every changed area. Use the
`verify-change` repository skill to map a mixed diff to the relevant checks.
Record passed, failed, blocked, and unrun checks accurately in the pull request.
