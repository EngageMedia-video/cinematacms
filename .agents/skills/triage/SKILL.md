---
name: triage
description: Assess requested tracker issues against current code and accepted project decisions, identify missing information, and draft an implementation brief or disposition.
disable-model-invocation: true
---

# Assess tracker requests

Read `AGENTS.md`, `docs/technical/agentic-workflow.md`,
`docs/agents/issue-tracker.md`, `docs/agents/triage-labels.md`, and
`docs/agents/domain.md`. Fetch the requested issues and relevant discussion.
Limit the assessment to the requested set; review a PR as a PR when requested.

Check each claim against current code, tests, existing decisions, and related
issues. Distinguish confirmed behavior from an inferred reproduction. For a bug,
use [diagnosing-bugs](../diagnosing-bugs/SKILL.md) to investigate without silently
starting a fix. For a feature, identify accepted scope and unresolved decisions.

Recommend whether the request is actionable, needs information, is duplicated,
is already satisfied, or conflicts with an accepted project decision. Supply
links and evidence. A new brief supplements the accepted issue contract; it does
not override maintainer decisions. Include desired behavior, acceptance criteria,
exclusions, dependencies, and verification when an implementation brief is useful.

Return findings and proposed tracker text by default. Comment, assign, label,
close, or rewrite an issue only within the contributor's requested operation.
Use existing label names and do not force an upstream state machine. Keep durable
project decisions in the repository's domain documentation rather than creating
a separate rejection knowledge base. Report local assessment and actual tracker
changes separately.
