---
name: wayfinder
description: Coordinate a large uncertain effort by tracking open questions, accepted decisions, evidence, and dependencies across research, prototypes, and implementation.
disable-model-invocation: true
---

# Find a path through uncertain work

Read `AGENTS.md`, `docs/technical/agentic-workflow.md`, and
`docs/agents/domain.md`. Establish the destination and accepted constraints from
the request. Use this map only when the effort has enough uncertainty or dependent
work to benefit from it; use [implement](../implement/SKILL.md) for a scoped change.

Maintain a compact map of accepted decisions, open questions, evidence pointers,
and blockers. Start from the existing issue or planning artifact. Keep temporary
maps in the conversation or ignored `docs/plans/`; publish or update a tracker map
only when requested, following `docs/agents/issue-tracker.md`.

Select work whose prerequisites are settled. Use [research](../research/SKILL.md)
for external facts, [prototype](../prototype/SKILL.md) for interaction or model
questions, and [grilling](../grilling/SKILL.md) for contributor decisions. Gather
facts from available tools; do not ask the contributor to look up repository facts.
Keep accepted domain decisions in [domain-modeling](../domain-modeling/SKILL.md).

Record each answer and its evidence, then update only affected dependencies.
Reuse prior decisions and continue independent work while a required choice is
pending. Stop planning when the requested questions are answered or the remaining
blocker requires contributor input. Do not force one ticket per session, a special
label scheme, an assignment, or a new branch.

When implementation is requested, hand off accepted slices to
[implement](../implement/SKILL.md) or a dependency set to
[implement-spec](../implement-spec/SKILL.md). Verify repository artifacts through
[verify-change](../verify-change/SKILL.md). Report resolved questions, remaining
blockers, and local versus published state.
