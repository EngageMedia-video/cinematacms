---
name: implement-spec
description: Implement an accepted specification or dependent ticket set through the existing CinemataCMS implement, tdd, verification, and review workflow.
disable-model-invocation: true
---

# Implement a specification or ticket set

Read `AGENTS.md` and `docs/technical/agentic-workflow.md`. Use the supplied spec,
issue, acceptance criteria, or agreed conversation as the contract. This workflow
does not require OpenSpec or prior use of `to-spec` and `to-tickets`.

## Establish scope and dependencies

Inspect the branch, worktree, diff, affected code, and tests. Preserve user-owned
work. Map requirements to verifiable slices and record only genuine blockers.
For a single scoped change, use [implement](../implement/SKILL.md) directly.
Do not create a ticket graph or integration branch just to run this skill.

For tracker references, read `docs/agents/issue-tracker.md`. Reconcile the ticket
body, accepted discussion, and linked decisions; surface contradictory contracts
before implementing dependent behavior.

## Complete unblocked slices

Use the repository [implement](../implement/SKILL.md) skill for each slice,
including [tdd](../tdd/SKILL.md) for changed behavior. Continue through the accepted
scope until every requirement has evidence or a concrete blocker is reported.

Work sequentially by default. Use separate worktrees only when isolation helps;
use subagents only when delegation is authorized and available. Give each worker
a bounded contract, file ownership, and required verification. Integrate completed
changes without overwriting existing work, then test dependent slices against the
integrated result. Do not reset or discard a worktree to correct its base.

A local blocker is satisfied when its changes are verified and available to the
dependent slice. An open GitHub issue does not block already verified local work.
Track local completion separately from tracker state.

## Verify and hand off

Run [verify-change](../verify-change/SKILL.md) over the complete result, including
`make agent-check`, and use [code-review](../code-review/SKILL.md) against the
accepted contract. Fix confirmed findings and rerun the affected checks.

Report requirement-to-evidence coverage, remaining blockers, and local versus
published delivery state. Commit, push, open or update a PR, change tracker state,
or merge only within the authorization in `AGENTS.md`. Reuse authorization already
given in the session. Remove temporary worktrees only when their work is safely
retained and they contain no user-owned changes.
