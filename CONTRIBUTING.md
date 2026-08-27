# Contributing to CinemataCMS

Use this guide to prepare a change and open a pull request. For a first-time
local setup, follow the [developer onboarding guide](docs/setup/Developer-Onboarding.md).

## Start from `upstream/main`

Fork the repository, add the upstream remote, and create a focused branch:

```bash
git remote add upstream https://github.com/EngageMedia-video/cinematacms.git
git fetch upstream
git switch -c fix/private-media-access upstream/main
```

Use a short branch type such as `feat`, `fix`, `docs`, `refactor`, `test`, or
`chore`.

Install the Python and frontend dependencies before you edit the code:

```bash
uv sync --all-extras
cd frontend
npm i -g "$(node -p "require('./package.json').packageManager")"
npm ci --no-fund --no-audit
cd ..
```

The frontend requires Node.js 22 and the npm version declared in
`frontend/package.json`. Do not regenerate `frontend/package-lock.json` with
npm 10.

## Keep the change focused

Make one coherent change per pull request. Do not include unrelated formatting,
dependency updates, or refactors.

Add or update tests for changed behavior. Update the documentation when you
change a command, configuration option, contributor rule, or user workflow.

For a model change, commit its Django migration. If you add a route to
`files/urls.py`, place it above the catch-all pattern.

## Choose the frontend track

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

Do not treat `frontend/src/static/js/components/-NEW-/` as modern code. The
directory name came from the original codebase.

ESLint enforces the track boundary. A modern file cannot import `flux` or a
legacy Flux store. A legacy file that imports Zustand or TanStack Query produces
a warning.

### Add a modern frontend page

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
`useFooStore.js`, and use `snake_case` for Django templates.

The application also has a React-owned shell for revamp-gated pages. Read the
[frontend workflow](docs/technical/FRONTEND_WORKFLOW.md) before choosing a shell
or changing an entry point.

### Style a modern frontend change

Use Tailwind utilities and the semantic tokens in
`frontend/src/static/css/tailwind.css`. Use the token that describes the role,
such as `bg-brand-primary`, `bg-surface-body`, or `text-content-error`.

Follow these rules:

- Do not add a new SCSS file for a modern feature.
- Do not hardcode a color when a semantic token exists.
- Do not build Tailwind class names at runtime. Write complete class strings so
  Tailwind can find them.
- Do not import `tailwind.css` into a legacy component.

When `DEBUG=True`, `/modern-demo/` shows the available tokens and their theme
behavior. The `@theme inline` block in `tailwind.css` remains the canonical
token list.

For a UI change, check semantic controls, accessible names, keyboard operation,
visible focus, image dimensions, alternative text, and reduced-motion behavior.
Do not use `transition-all`.

## Verify the change

Run the smallest relevant test while you work. Before you open the pull request,
run the checks that cover every changed area.

### Repository checks

```bash
make lint
uv run python manage.py makemigrations --check
uv run python manage.py test --noinput --verbosity=2 --exclude-tag=requires-whisper
```

The Django test suite requires the PostgreSQL and Redis services described in
the developer onboarding guide.

### Frontend checks

```bash
cd frontend
npm run lint:modern
npm run test:run
cd ..
make frontend-build
```

If you changed legacy frontend code, also run:

```bash
npm run lint:legacy
```

To inspect the informational coverage report, run:

```bash
npm run test:coverage
```

Record the commands and manual checks in the pull request. For a UI change, add
screenshots or a short recording for each affected viewport and theme.

## Write the commit

Use an imperative summary with a conventional type:

```text
fix: preserve private media access checks
```

If generated AI content remains in the commit, add this trailer:

```text
Assisted-by: <tool> <model-version>
```

Do not use `Co-Authored-By:` for an AI tool. Read the
[AI-assisted contribution policy](docs/technical/engineering-standards-proposal.md#contributor-policy)
for the disclosure rules and exempt uses.

## Open the pull request

Before you push, update the branch from `upstream/main` and resolve conflicts:

```bash
git fetch upstream
git rebase upstream/main
git push --force-with-lease origin HEAD
```

Use `--force-with-lease` only on your pull request branch. Never rewrite
`main`.

Complete the pull request template:

- Explain what changed and why.
- Link the issue when one exists.
- List the test and manual verification results.
- Select exactly one AI assistance declaration.
- If you declare substantive AI assistance, name each tool and describe its
  contribution.
- Mark only the checkboxes that apply.

The `AI contribution declaration` workflow validates the declaration and
maintains the `ai-assisted` label. The label does not change the review or
approval requirements.

## Pass review and merge controls

A pull request to `main` needs one maintainer approval and these checks:

- `Frontend Lint & Build`
- `Backend — Migrations Check`
- `Pre-commit (lint & format)`
- `Backend Tests`

Dependency checks also run when a dependency manifest or lockfile changes.
CodeRabbit comments are advisory. A human maintainer decides whether the pull
request is ready.

Push review fixes to the same branch. If you rebase a branch that you own, push
it with `--force-with-lease`.

## Related guides

- [Developer onboarding](docs/setup/Developer-Onboarding.md)
- [Frontend build and entry points](docs/technical/FRONTEND_WORKFLOW.md)
- [AI-assisted contributions and merge controls](docs/technical/engineering-standards-proposal.md)
