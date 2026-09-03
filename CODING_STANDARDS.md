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

- Put a new `files/urls.py` route above the catch-all slug pattern.

## Protect Django request boundaries

Follow the [Django 5.2 security guidance](https://docs.djangoproject.com/en/5.2/topics/security/).

- Enforce authentication, authorization, and object access on the server. A
  hidden frontend control is not an access check.
- Validate request data with a Django form or a Django REST Framework serializer
  before the data reaches a model, task, or service.
- Keep CSRF protection enabled for browser requests. Add `csrf_exempt` only for
  a documented non-browser integration with its own authentication check.
- Keep Django template autoescaping enabled. Sanitize untrusted HTML before
  using `mark_safe` or the `safe` template filter.
- Use the ORM or parameterized raw SQL. Never interpolate untrusted data into an
  SQL string.
- Pass subprocess arguments as a list. Do not interpolate untrusted data into a
  shell command.
- Validate data before sending it to storage or an external service.
- Keep credentials and private service details in local settings or environment
  variables. Do not add them to source, fixtures, logs, or screenshots.

## Preserve Django data integrity

Use the database to enforce an invariant when Django can express the invariant
as a field option, `UniqueConstraint`, or `CheckConstraint`.

- Wrap writes that form one operation in `transaction.atomic()`.
- Catch `DatabaseError` and `IntegrityError` outside the `atomic()` block that
  can fail.
- Keep transactions short. Do not perform slow network or file operations inside
  a transaction.
- Schedule a Celery task, email, cache update, or other post-write side effect
  with `transaction.on_commit()` when it depends on a successful commit.
- Test both the successful commit and the rollback path for a transactional
  operation.

Read the [Django transaction documentation](https://docs.djangoproject.com/en/5.2/topics/db/transactions/)
before changing a transaction boundary.

## Keep Django queries deliberate

- Treat a `QuerySet` as lazy. Know where iteration, serialization, template
  rendering, `list()`, `len()`, or a boolean check evaluates it.
- Do not issue one related-object query per row. Use `select_related()` for
  single-valued relations and `prefetch_related()` for multi-valued relations
  when the caller uses those relations.
- Fetch only the rows and fields that the operation needs. Do not add `only()` or
  `defer()` without measuring the result.
- Profile a query before and after an optimization. Use `QuerySet.explain()`,
  Django Debug Toolbar, or database query metrics.
- Add `assertNumQueries()` coverage when a query count is part of a regression or
  a performance-sensitive contract.

The [Django database optimization guide](https://docs.djangoproject.com/en/5.2/topics/db/optimization/)
defines the ORM behavior behind these rules.

## Write safe Django migrations

- Commit a migration for every model change.
- Do not edit a migration that has run in a shared environment. Add a new
  migration.
- In a data migration, load historical models with `apps.get_model()`. Do not
  import the current model class.
- Add a reverse operation when the data transformation has a safe inverse.
- For a large table, assess locks, transaction duration, and deployment order.
  Process data in bounded batches when one transaction would be unsafe.
- Test the forward migration. Test the reverse migration when it is supported.

Use the [Django migration guidance](https://docs.djangoproject.com/en/5.2/howto/writing-migrations/)
for data migrations, non-atomic migrations, and migration ordering.

## Test observable behavior

- Test through the public boundary used by a caller or user.
- Add a regression test that fails before a bug fix and passes after it.
- Prefer the real Django test database and repository components. Mock an
  external service, time, randomness, or another true system boundary.
- Keep a focused test deterministic. Fix or isolate a flaky dependency before
  treating the result as evidence.
- Do not weaken, skip, or delete a valid test to make a change pass.

Use the `tdd` repository skill when the work requires a test-first cycle.

## Make new behavior observable

Before implementation, map the feature to the existing
[application observability contract](docs/technical/observability-contract.md)
and its machine-readable source of truth,
[`config/observability/coverage.json`](config/observability/coverage.json). If
the contract already covers the feature's operation, outcomes, dependencies,
and operator workflow, use the existing application-owned telemetry.

If the contract does not cover the feature, extend the coverage matrix and its
contract tests first. Register each new HTTP route and supported method in
`cms.http_telemetry.ROUTE_OPERATION_REGISTRY`. Define the bounded labels,
privacy constraints, diagnostic events, implementation point, and operator
query. Then implement the feature through the owned HTTP, database, cache,
Redis, authentication, Celery, scheduled-job, and domain-outcome interfaces.

Never put raw URLs, SQL, parameters, cache keys, credentials, tokens,
identifiers, IP addresses, hostnames, exception messages, or unrestricted task
names in telemetry.

Run the contract checks with the feature tests:

```bash
uv run python scripts/validate_observability_coverage.py
uv run python manage.py test cms.tests.test_observability_coverage
make agent-check
```

### Tautological tests are harmful

A tautological test derives its expected result with the same rules as the code
under test. The test passes when both copies contain the same mistake, so it
does not provide independent evidence.

- Take expected values from the requirement, a worked example, a fixed fixture,
  or another independent source of truth.
- Do not repeat the implementation algorithm in the assertion.
- Do not assert a constant against itself or verify only that a mock returns its
  configured value.
- Confirm that the test fails when the behavior it specifies is absent or wrong.

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

## Write predictable React components

The modern track follows the [Rules of React](https://react.dev/reference/rules).

- Keep rendering pure and idempotent. Run side effects outside render.
- Treat props, state, context values, and Hook arguments as immutable snapshots.
- Call Hooks at the top level of a React component or a custom Hook. Do not call
  Hooks after a conditional return, inside a loop, or from a regular function.
- Let React call component functions. Render a component with JSX instead of
  calling it as a regular function.
- Use a stable identifier from the data as a list key. Use an array index only
  for a static list that cannot reorder, insert, or delete items.

Keep each piece of client state with its closest owner:

1. Calculate a value during render when props or existing state determine it.
2. Use local component state for information one component owns.
3. Lift state to the closest common owner when a small subtree coordinates it.
4. Use context for data that many descendants need when passing props obscures
   ownership.
5. Use Zustand when components in distant branches must update the same client
   state, or non-React code must read or update that state.

Do not store redundant, duplicated, contradictory, or deeply nested state. Read
[Choosing the State Structure](https://react.dev/learn/choosing-the-state-structure)
when a component needs multiple related state values.

`eslint-plugin-react-hooks` enforces Hook call order in the modern track and
reports incomplete Effect dependency lists.

## Use Effects only for external synchronization

- Handle an action caused by a user event in that event's handler.
- Calculate derived render data during render. Do not copy it into state with an
  Effect.
- Use an Effect to synchronize with a browser API, subscription, timer, network
  connection, or another system outside React.
- Return cleanup for subscriptions, timers, object URLs, and asynchronous work
  that can outlive the Effect.
- Include every reactive dependency. If a dependency causes a loop, fix the
  state ownership or value identity instead of omitting the dependency.
- Use TanStack Query for remote data instead of a manual fetch Effect.

Read [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
before adding an Effect that only updates React state.

## Add a modern frontend page

For a new page:

1. Create `frontend/src/features/<feature-name>/`.
2. Choose the state owner with the React state rules in this document.
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

## Color a modern component with semantic tokens

Modern code names the role, not the color. A semantic token already carries the
light and dark value, so a component that uses one needs no `dark:` variant.

Choose the first layer that covers the case:

1. A modern semantic token utility, such as `bg-bg-page`, `text-text-strong`,
   `border-border-default`, or `ring-ring-focus`. This is the default.
2. A raw `--cinemata-*` palette utility, such as `bg-cinemata-neutral-200`, when
   the color must stay the same in both themes and no semantic role covers it.
3. A legacy alias, such as `bg-brand-primary` or `text-content-body`, when the
   component must match a legacy SCSS rule.

- Do not write a raw CSS custom property into a modern component, either as an
  arbitrary utility such as `bg-[var(--body-bg-color)]` or as an inline
  `style` value. `docs/modern-track-color-system.md` lists the few bridges that
  keep one on purpose; extend that list in the same change if you add one.
- Do not write a hex, `rgb()`, or `hsl()` literal for a themed color.
- Add a semantic token instead of reaching for the same raw palette step a
  second time for the same role.

`frontend/eslint.config.mjs` fails a modern file that puts a raw CSS variable
or a color literal in a utility class or an inline `style` color. Test files
and the sidebar bridge are the configured exceptions.

The `@theme inline` blocks in `frontend/src/static/css/tailwind.css` hold the
canonical token list, and `docs/modern-track-color-system.md` explains the
palette, the token layers, and the deliberate exceptions. When `DEBUG=True`,
`/modern-demo/` shows the tokens and their theme behavior.

## Keep styling in Tailwind and controls accessible

- Do not add an SCSS file for a modern feature.
- Write complete Tailwind class strings. Do not build class names at runtime.
- Do not import `tailwind.css` into a legacy component.
- Do not use `transition-all`.

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

## Keep comments short

- State only a non-obvious reason, invariant, constraint, or trade-off.
- Delete any claim that a reader can derive from the code.
- Keep the comment next to the code that gives it meaning.
- Update or delete the comment when the underlying behavior changes.
- Delete commented-out code. Git keeps the previous version.

## Write durable documentation

- Document public behavior, setup requirements, and operational constraints.
- Use repository-relative paths and commands that work at the current commit.
- Pin a count or baseline to a commit and include the command that reproduces
  it.

## Verify the applicable standards

Run the commands in `CONTRIBUTING.md` that cover every changed area. Use the
`verify-change` repository skill to map a mixed diff to the relevant checks.
Record passed, failed, blocked, and unrun checks accurately in the pull request.
