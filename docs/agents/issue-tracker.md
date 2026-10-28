# CinemataCMS issue tracker

The project tracker is GitHub Issues in `EngageMedia-video/cinematacms`. Pass
`--repo EngageMedia-video/cinematacms` to tracker and upstream PR commands so the
local contributor fork is not selected by accident. For a specifically requested
fork issue or PR, target that repository explicitly.

Read issues and comments with `gh issue view`; read PRs and diffs with `gh pr view`
and `gh pr diff`. Use supplied specifications and accepted issue discussions as
the work contract. Inspect existing labels before changing them; see
[triage conventions](triage-labels.md).

## Drafts and publication

Specifications, ticket breakdowns, triage findings, and decision maps are local
drafts unless the requested operation includes publication. Keep temporary notes
in the conversation or ignored `docs/plans/`. Reuse an existing project issue or
maintained document when the task requires a durable shared artifact.

For authorized multiline issue or PR text, write a temporary file and pass
`--body-file`. Comments, assignments, labels, dependencies, closure, and edits
must stay within the requested tracker operation. A planning or implementation
request does not itself authorize those writes. Reuse authorization already given
in the session.

Follow `AGENTS.md`, `CONTRIBUTING.md`, the repository PR template, and the
engineering standards for delivery. Push contributor branches to the fork on
`origin`; `upstream` is fetch-only. The PR target is upstream `main` unless the
contributor explicitly requested another target.

## Dependencies and progress

For local implementation, a blocker is satisfied when its changes are verified
and integrated into the local result. Continue dependent work using that evidence
and report local progress separately from GitHub issue state. Closing a tracker
issue is a separate authorized operation.

For published ticket sets, keep the parent and blocking references visible in
issue bodies. Use native sub-issue or dependency relationships when the requested
operation needs them and GitHub supports them; otherwise linked task lists and
`Blocked by` references suffice. Do not require new labels or a tracker migration
to implement an accepted contract.
