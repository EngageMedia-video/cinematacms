---
name: to-spec
description: Synthesize an accepted conversation or plan into a concise specification with scope, observable acceptance criteria, and verification decisions.
disable-model-invocation: true
---

# Turn accepted decisions into a specification

Read `AGENTS.md`, `docs/technical/agentic-workflow.md`, and
`docs/agents/domain.md`. Use the agreed conversation, supplied plan, or linked
issue as the source. Inspect the relevant code and tests to ground the spec.

Synthesize existing decisions rather than starting another interview. Separate
accepted decisions, reasonable assumptions, and unresolved choices. Do not invent
requirements to make the document exhaustive.

Include the problem, desired behavior, scope and exclusions, observable acceptance
criteria, relevant interfaces or migrations, and verification strategy. Reuse
existing test boundaries and repository patterns. Identify public behavior,
security, data-model, or delivery decisions that still block implementation.

Return the specification in the conversation or the requested local document.
Use ignored `docs/plans/` for temporary planning notes when a local file is useful;
update a maintained source document only when the task calls for it. Publish to
GitHub only when requested, following `docs/agents/issue-tracker.md` and existing
label conventions. A spec does not require OpenSpec, new labels, or a ticket graph.

Hand off accepted scoped work to [implement](../implement/SKILL.md), or a genuine
multi-slice dependency set to [to-tickets](../to-tickets/SKILL.md) when requested.
Verify repository documentation changes with
[verify-change](../verify-change/SKILL.md).
