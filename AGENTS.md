# Repository instructions for coding agents

## Scope

These instructions apply to the entire repository. A nested `AGENTS.md` can add
or replace instructions for its directory.

## Load the relevant context

Read the source that matches the task before you edit files:

- For code, tests, CI, or contributor documentation, read `CONTRIBUTING.md`.
- For a first-time local environment or service failure, read
  `docs/setup/Developer-Onboarding.md`.
- For frontend entry points, packages, shells, assets, or builds, read
  `docs/technical/FRONTEND_WORKFLOW.md`.
- For AI disclosure, commit attribution, pull request rules, coverage policy, or
  merge controls, read
  `docs/technical/engineering-standards-proposal.md`.
- For agent adapters or shared agent setup, read
  `docs/technical/agentic-workflow.md`.

Keep each rule in its source document. Link to that source instead of copying a
second version into another file.

## Work in this order

1. Inspect the current branch, worktree, and relevant diff. Treat existing
   changes as user-owned work.
2. Trace the affected code and its tests before choosing the edit location.
3. Make the smallest coherent change that satisfies the request. Keep unrelated
   cleanup out of the diff.
4. Add or update tests for changed behavior. Preserve a failing test when it
   exposes a real defect.
5. Update the source documentation when a command, configuration option,
   contributor rule, or user workflow changes.
6. Run the checks that cover every changed area. Inspect the resulting diff
   before reporting completion.

## Use repository sources of truth

- Use `pyproject.toml`, `uv.lock`, `frontend/package.json`, and the package
  lockfiles for dependency facts.
- Use `Makefile` and `frontend/package.json` for current command names.
- Use `.github/workflows/` for CI behavior and status-check names.
- Use the code and migrations for schema behavior. Do not infer current behavior
  from an old issue or pull request.

When documentation includes a count or baseline, pin it to a commit and include
the command that reproduces it.

## Protect credentials and pull requests

Keep secrets out of source, fixtures, logs, screenshots, and pull request text.
Use the ignored local configuration files described in the onboarding guide.

For a `pull_request_target` workflow, run only code from the base branch. Give
the workflow the smallest permissions that support its job. Never execute or
source the pull request head in that security context.

## Record AI assistance

Agent-produced content that remains in a contribution is substantive AI
assistance. Before creating a commit or editing a pull request, follow the
engineering standards document.

For a commit that contains agent-produced content, add:

```text
Assisted-by: <tool> <model-version>
```

Use the substantive-assistance declaration in the pull request and describe the
tool's contribution. Reserve `Co-Authored-By:` for human authors.

## Finish with evidence

Work is complete when all of these conditions hold:

- The task diff contains only the intended changes. Existing user-owned changes
  remain untouched.
- `make agent-check` passes.
- Relevant backend, frontend, migration, build, and workflow checks pass.
- When the task includes a pull request, the pull request records the commands,
  manual checks, limits, and AI declaration that apply.

If an environment problem blocks a check, record the command, the exact failure,
and the evidence from checks that did run. Do not describe an unrun check as
passing.

Create commits, push branches, or open pull requests only when the user asks for
those actions. Do not merge a pull request unless the user asks for the merge.
