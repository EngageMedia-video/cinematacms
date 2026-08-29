---
name: verify-change
description: Select and run the repository checks that cover a local diff or pull request. Use before a commit, push, pull request, or completion claim, and when the user asks whether a change is verified.
---

# Verify a change

Verify the complete change, including committed, staged, unstaged, and untracked
files that belong to the task. Do not commit, push, or edit the pull request
unless the user requested those actions.

## Map the diff to checks

Inspect the changed paths and select every applicable group:

- For every change, run `make agent-check`.
- For backend code or models, run the narrowest relevant Django tests. Run
  `uv run python manage.py makemigrations --check` for model or migration work.
- For broad backend changes, run
  `uv run python manage.py test --noinput --verbosity=2 --exclude-tag=requires-whisper`.
- For modern frontend code, run `npm run lint:modern` and `npm run test:run`
  from `frontend/`. Run `make frontend-build` when entries, packages, assets,
  templates, or build configuration change.
- For legacy frontend code, also run `npm run lint:legacy` from `frontend/`.
- For `.github/scripts/`, run its Node test files. For workflow changes, inspect
  event permissions, untrusted checkout behavior, and exact status-check names.
- For documentation-only changes, verify referenced paths, commands, links, and
  claims against the repository sources of truth.

Add a narrower check when the changed component defines one. Do not replace a
targeted test with a broad command that cannot run in the current environment.

## Report evidence

For each selected check, report the exact command and one of these results:

- passed;
- failed because of the change;
- blocked by an environment requirement;
- not run, with the reason.

Include existing warnings only when they affect the result or may hide a new
failure. Never report an unrun check as passing. End with the remaining merge or
release risks.
