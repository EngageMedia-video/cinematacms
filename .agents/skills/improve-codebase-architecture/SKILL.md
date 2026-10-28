---
name: improve-codebase-architecture
description: Assess concrete module-deepening opportunities and compare their interfaces, caller impact, and tests. Use for a requested architecture assessment.
disable-model-invocation: true
---

# Assess architecture improvements

Read `AGENTS.md`, `CODING_STANDARDS.md`, `docs/technical/agentic-workflow.md`, and
`docs/agents/domain.md`. Use the repository
[codebase-design](../codebase-design/SKILL.md) vocabulary and design process.

Trace the requested area's interfaces, callers, dependencies, and tests. Recommend
only changes supported by concrete coupling, duplicated policy, or a difficult
behavioral test boundary. Keeping the current design is a valid recommendation.

For each worthwhile candidate, show the current problem, proposed interface,
caller changes, behavior to preserve, and verification strategy. Use
[deepening guidance](references/deepening.md) when assessing dependencies and
[interface alternatives](references/design-it-twice.md) when comparison would
resolve a real trade-off. Prefer a concise report with code pointers or a Mermaid
diagram; generate an HTML artifact only when requested.

End with a recommended next step. An assessment does not authorize a refactor,
new tracker issues, or additional dependencies. Record accepted durable decisions
through [domain-modeling](../domain-modeling/SKILL.md); implement an accepted
refactor through [implement](../implement/SKILL.md).
