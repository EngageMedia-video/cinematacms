---
name: to-tickets
description: Break an accepted specification or plan into verifiable implementation slices with explicit acceptance criteria and genuine dependencies.
disable-model-invocation: true
---

# Break a plan into verifiable slices

Read `AGENTS.md`, `docs/technical/agentic-workflow.md`, and
`docs/agents/domain.md`. Read the supplied contract and any linked accepted
decisions; fetch tracker references using `docs/agents/issue-tracker.md`.

Draft the smallest useful set of slices. Each slice delivers observable behavior
and identifies its acceptance criteria, verification, and genuine blockers.
Touch only the layers that behavior requires. Include refactoring only when it
is necessary for the requested change. For a wide compatibility change, sequence
expand, migrate, and contract while preserving a verifiable integration result.

Show titles, delivered behavior, acceptance criteria, and dependencies in a
numbered checklist or the requested format. Check that dependencies have no cycles
and every accepted requirement has coverage. Reuse decisions already approved;
ask only about unresolved choices that materially alter scope or behavior.

Keep the breakdown in the conversation or an ignored local plan under
`docs/plans/` unless the contributor requested publication. For authorized GitHub
issues, create blockers first and link the parent and dependencies using existing
tracker conventions. Read `docs/agents/triage-labels.md`; do not assume new label
names exist or modify the parent issue beyond the requested action.

Planning ends with the breakdown. When implementation is also requested, use
[implement-spec](../implement-spec/SKILL.md), which runs the existing repository
implementation and verification workflow for each slice. Verify repository
planning-document changes with [verify-change](../verify-change/SKILL.md).
