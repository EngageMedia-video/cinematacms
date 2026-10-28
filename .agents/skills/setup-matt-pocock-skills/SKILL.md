---
name: setup-matt-pocock-skills
description: Maintain the existing CinemataCMS skill routing, tracker configuration, and domain layout when a contributor requests a workflow configuration change.
disable-model-invocation: true
---

# Maintain the existing skill configuration

This repository is already configured. Read `AGENTS.md`,
`docs/technical/agentic-workflow.md`, and the requested configuration under
`docs/agents/`: `issue-tracker.md`, `triage-labels.md`, or `domain.md`.

Inspect the current setup before changing it. Preserve `.agents/skills/` as the
canonical skill directory, `.claude/skills` as its adapter, and `CLAUDE.md` as the
`AGENTS.md` import. Use [writing-for-agents](../writing-for-agents/SKILL.md) for
instruction and routing changes.

Change only the configuration requested. Reuse existing GitHub conventions and
the repository `domain-modeling` layout. Do not scaffold empty context documents,
introduce OpenSpec, install personal MCP configuration, or create tracker labels
as a prerequisite for using these skills.

For an upstream skill update, compare against the pinned source in
`SOURCES.mattpocock.json`, preserve repository adaptations, update source and
adapted-file hashes, and retain the license. Validate metadata, references,
discovery through the shared adapter, and realistic skill behavior; run
`make agent-check`. Report local changes separately from any authorized external
configuration updates.
