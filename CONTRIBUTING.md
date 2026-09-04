# Contributing to CinemataCMS

Use this guide to prepare a change and open a pull request. For a first-time
local setup, follow the [developer onboarding guide](docs/setup/Developer-Onboarding.md).

## Start from `upstream/main`

Fork the repository, clone your fork, add the upstream remote, and create a
focused branch:

```bash
git clone https://github.com/<your-username>/cinematacms.git
cd cinematacms
git remote add upstream https://github.com/EngageMedia-video/cinematacms.git
git fetch upstream
git switch -c fix/private-media-access upstream/main
```

`origin` is your fork and receives every push. `upstream` is the EngageMedia
repository and is only a source to fetch from. You never push to `upstream`.

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

## Follow the coding standards

Read [the coding standards](CODING_STANDARDS.md) before changing code, tests,
dependencies, or user-facing behavior. The standards define the backend and
frontend boundaries, test expectations, accessibility rules, and documentation
requirements.

For frontend build architecture, entry points, and revamp-gated shells, also
read the [frontend workflow](docs/technical/FRONTEND_WORKFLOW.md).

If you use a coding agent, follow the
[shared agentic workflow](docs/technical/agentic-workflow.md). It defines the
task paths, shared skills, verification sequence, and human decision points.

## Verify the change

Run the smallest relevant test while you work. Before you open the pull request,
run the checks that cover every changed area.

Before you implement a new feature or changed operational behavior, follow
[Make new behavior observable](CODING_STANDARDS.md#make-new-behavior-observable).
Map the feature to the existing contract. If the contract does not cover the
feature, extend the coverage matrix and contract tests first.

### Repository checks

```bash
make agent-check
uv run python manage.py makemigrations --check
uv run python manage.py test --noinput --verbosity=2 --exclude-tag=requires-whisper
```

`make agent-check` is the shared baseline for human and agent-authored changes.
It checks staged and unstaged diffs. It runs pre-commit hooks on untracked files
and runs every hook against tracked files. It does not replace the tests for the
area you changed.

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
npm --prefix frontend run lint:legacy
```

To inspect the informational coverage report, run:

```bash
npm --prefix frontend run test:coverage
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

- [Coding standards](CODING_STANDARDS.md)
- [Developer onboarding](docs/setup/Developer-Onboarding.md)
- [Frontend build and entry points](docs/technical/FRONTEND_WORKFLOW.md)
- [AI-assisted contributions and merge controls](docs/technical/engineering-standards-proposal.md)
