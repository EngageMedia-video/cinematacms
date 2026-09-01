---
name: implement
description: Implement a scoped issue, feature specification, or acceptance-criteria list end to end. Use when the user asks to implement a named issue or spec. Do not use for a small direct edit or a diagnosis-only request.
---

# Implement a scoped change

Turn each accepted requirement into verified code, tests, and documentation.
Keep external actions within the authority that the user gave for the task.

## Establish the contract

1. Read the issue, specification, acceptance criteria, and linked decisions.
2. Read `AGENTS.md`, `CODING_STANDARDS.md`, and the documents routed by
   `AGENTS.md` for the affected area.
3. Inspect the current branch and complete worktree. Preserve existing
   user-owned changes.
4. List each requirement and the observable evidence that will prove it.

If a missing decision would change the public behavior, data model, security
boundary, or delivery scope, ask the user before implementation. Make a local,
reversible assumption when it does not alter those outcomes, and record it.

## Implement vertical slices

Work through one observable requirement at a time:

1. Trace the current code path and its tests.
2. Choose the smallest module and public boundary that own the behavior.
3. Use the `tdd` workflow for new behavior and bug fixes.
4. Update the source documentation when the interface, command,
   configuration, contributor rule, or user workflow changes.
5. Re-run the focused test before starting the next requirement.

Keep unrelated cleanup out of the diff. Do not add speculative extension points
or dependencies for requirements that the source does not contain.

## Verify the complete contract

Use the `verify-change` workflow after the focused cycles pass. Map every
requirement to one of these evidence types:

- an automated test;
- a build, lint, migration, or workflow check;
- a manual check when automation cannot observe the behavior;
- an explicit limitation when the environment blocks verification.

Review the final diff against the `code-review` workflow. Fix confirmed findings
inside the implementation scope, then rerun the affected checks.

## Hand off the result

Report the requirement-to-evidence mapping, changed behavior, commands run, and
remaining limitations. Do not create a commit, push a branch, edit a pull
request, or merge unless the user requested that external action.
