---
name: prototype
description: Build a local prototype that answers a specific interaction, UI, or state-model question using CinemataCMS conventions.
---

# Prototype a design question

Read `AGENTS.md` and `docs/technical/agentic-workflow.md`. State the question and
what observation will answer it. Reuse accepted constraints and existing patterns.

- For appearance or interaction, read [UI.md](UI.md), `CODING_STANDARDS.md`, and
  `docs/technical/FRONTEND_WORKFLOW.md`.
- For a state model or logic question, read [LOGIC.md](LOGIC.md).

Build the smallest runnable demonstration. Use local fixtures or in-memory data;
preserve authentication, privacy, and accessibility boundaries. Avoid production
mutations and new dependencies unless they are necessary to answer the question
and within the accepted scope.

Run the demo and check the relevant interactions. Use
[verify-change](../verify-change/SKILL.md) for repository changes, including
`make agent-check`. Report the launch command or artifact path, observations,
limitations, and the decision the demo supports. A prototype is evidence for a
design decision, not proof that a production feature is complete.

Keep the prototype local unless delivery is authorized. Record an accepted durable
decision through [domain-modeling](../domain-modeling/SKILL.md) when needed.
Production integration uses [implement](../implement/SKILL.md) only when requested;
preserve the demo until the contributor's work and evidence are safely retained.
