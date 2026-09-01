---
name: code-review
description: Review a branch, pull request, commit range, or worktree for defects and requirement gaps. Use when the user asks for a code review or asks whether a change is ready. Do not use for implementing fixes.
---

# Review a change

Review the change without editing files, committing, pushing, or changing the
pull request.

## Pin the review scope

1. Inspect the current branch, worktree, staged changes, and untracked files.
2. Use the fixed point that the user supplied. Otherwise, use the pull request
   base, `upstream/main`, or `main`, in that order when each source is available.
3. Compare committed changes against the merge base. Include staged and
   unstaged changes. Enumerate untracked files with
   `git ls-files --others --exclude-standard` and read the task files directly.
4. Stop if the fixed point does not resolve. Stop for an empty review only when
   the committed, staged, unstaged, and untracked scopes are all empty.

## Load the review sources

Read `AGENTS.md`, `CODING_STANDARDS.md`, `CONTRIBUTING.md`, and the documents
that `AGENTS.md` routes to for the changed area. Find the originating issue,
specification, or pull request description when one exists.

Use repository configuration and code as the source for current behavior. Use
the issue or specification as the source for intended behavior.

## Find actionable defects

Review every changed hunk for:

- incorrect behavior and unhandled boundary cases;
- missing, partial, or extra requirements;
- security and permission regressions;
- data loss, race conditions, and unsafe migrations;
- tests that do not exercise the changed behavior;
- documentation that no longer matches the interface or workflow.

Ignore formatting that automated tools enforce. Do not report a preference as
a defect unless a repository source requires it.

Before reporting a finding, identify the input or state that triggers it. Trace
the relevant call path far enough to rule out nearby guards. Cite the file and
line, explain the impact, and suggest the smallest correction direction.

## Report findings first

Order findings by severity. Use `critical`, `high`, `medium`, or `low`. Keep
requirement gaps separate from repository-standard violations when both apply.

If the review has no findings, state that directly. Then list residual risks,
tests that were not run, and missing specification context. Do not claim that a
change is correct only because its checks pass.
