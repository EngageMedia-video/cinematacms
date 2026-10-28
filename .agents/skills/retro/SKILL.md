---
name: retro
description: Review a coding session for evidence-backed workflow or environment improvements. Report recommendations and apply changes only when requested.
disable-model-invocation: true
---

# Review a coding session

Read `AGENTS.md` and `docs/technical/agentic-workflow.md`. Review the requested
session's failures, repeated investigation, checks, handoffs, and final outcome.
Distinguish an observed recurring problem from a one-off incident or a guess.

For each useful lesson, state the evidence, smallest corrective action, and the
canonical place it belongs. Keep commands in the Makefile or package scripts,
project policy in its source document, task instructions in the relevant skill,
and personal environment configuration local. Read coding standards during both
implementation and review, as routed by `AGENTS.md`.

Prefer a few concrete recommendations to a new process for every incident.
Do not duplicate rules across `AGENTS.md`, `CLAUDE.md`, and skills. Report lessons
by default; apply repository changes only when requested, and verify them through
[verify-change](../verify-change/SKILL.md). A retrospective does not authorize
editing personal memories, global configuration, or external systems.
