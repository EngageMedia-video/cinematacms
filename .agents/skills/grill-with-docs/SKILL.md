---
name: grill-with-docs
description: Resolve design questions and record accepted domain terms or architectural decisions using the CinemataCMS domain layout.
disable-model-invocation: true
---

# Resolve and record a design

Read `AGENTS.md`, `docs/technical/agentic-workflow.md`, and
`docs/agents/domain.md`.

Use [grilling](../grilling/SKILL.md) to resolve the requested decisions. Use
[domain-modeling](../domain-modeling/SKILL.md) to record accepted terms and durable
decisions in its existing context and ADR formats. Follow those files directly
when the agent has no skill-invocation tool.

Keep unresolved proposals in the conversation or local planning notes. Create
`CONTEXT.md`, `CONTEXT-MAP.md`, or an ADR only when a resolved decision needs it.
Keep `AGENTS.md` canonical and `CLAUDE.md` as its adapter. Verify documentation
changes through [verify-change](../verify-change/SKILL.md).
