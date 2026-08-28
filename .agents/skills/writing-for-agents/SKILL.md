---
name: writing-for-agents
description: Create or edit repository instructions that coding agents consume. Use for AGENTS.md, CLAUDE.md, shared skills, and documents reached from agent instructions. Do not use for general product or contributor documentation.
---

# Write instructions for agents

Make an agent follow the same process across runs without copying project rules
into every instruction file.

## Keep one source for each rule

Put a rule in the document that owns it. Keep `AGENTS.md` as a short entry point
with pointers to detailed sources. Keep `CLAUDE.md` as an adapter unless a rule
applies only to Claude Code.

A pointer must name both the source and the task that requires it. Strengthen a
weak pointer before copying the target content into an always-loaded file.

Treat repository configuration, commands, and directory layout as sources of
truth. Document only facts that an agent cannot reliably discover there, or
link to the canonical file.

## Structure the instruction

- Put the actions that every run needs in the main file.
- Move branch-specific detail into a linked reference.
- Keep a concept's definition, rule, and exception together.
- End each workflow step with a result that the agent can verify.
- Delete instructions that do not change behavior.
- Prefer a positive target behavior. Keep prohibitions for real safety or
  authorization boundaries.

For a skill, keep the frontmatter description short and discriminating. Name
the tasks that trigger it and the nearby task that must not trigger it. Put
detailed instructions in the body and conditional material in references.

## Validate the result

Check that every pointer reaches an existing file, every command exists, and no
rule has a second source. Validate each changed skill's frontmatter, then run
`make agent-check`. Test an explicit skill invocation and a realistic prompt
that should select it automatically.
