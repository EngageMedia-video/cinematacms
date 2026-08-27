# Shared agentic workflow

This repository gives coding agents the same project rules and verification
baseline. The workflow standardizes outcomes, not each developer's choice of
agent or local tools.

## Instruction architecture

`AGENTS.md` is the canonical entry point for repository-wide agent
instructions. Keep shared rules there or in the project document that it links
to. Do not copy the same rule into several agent-specific files.

The repository supports these instruction paths:

| Agent | Repository entry point | Behavior |
|---|---|---|
| Codex | `AGENTS.md` | Loads the file directly. |
| Claude Code | `CLAUDE.md` | Imports `AGENTS.md`. |
| GitHub Copilot agents and CLI | `AGENTS.md` | Loads the file directly in supported agent modes. |

`CLAUDE.md` is an adapter, not a second source of instructions. Keep it limited
to the `@AGENTS.md` import unless the repository needs a Claude-specific rule
that cannot apply to other agents.

The compatibility choices follow the official documentation for
[Codex project instructions](https://developers.openai.com/codex/agent-configuration/agents-md),
[Claude Code project instructions](https://code.claude.com/docs/en/memory), and
[GitHub Copilot instruction support](https://docs.github.com/en/copilot/reference/custom-instructions-support).

## Shared and personal configuration

Commit configuration when every contributor needs it to complete repository
work consistently. Shared configuration includes:

- repository rules and links to their sources;
- portable build, lint, test, and verification commands;
- checked-in hooks or tool settings that enforce a team decision;
- agent adapters required to load the canonical instructions.

Keep configuration local when it depends on a person, machine, account, or
agent installation. Do not commit:

- personal memories, preferences, or conversation history;
- credentials, tokens, account identifiers, or private service URLs;
- absolute home-directory paths;
- editor state, local indexes, or agent caches;
- MCP server configuration that depends on a developer's private installation.

The ignored `.serena/`, `.claude/`, `.agents/`, and `CLAUDE.local.md` paths are
available for this local configuration. A local instruction can add a personal
preference, but it must not weaken repository security or completion rules.

## Tool capability and fallback

Agents may use a code graph, symbolic editor, browser, or MCP server when one is
available. Repository work must not require those optional tools. Use the
closest built-in or command-line alternative and preserve the same evidence:

- use text search when semantic code search is unavailable;
- use normal file editing when symbolic editing is unavailable;
- use primary documentation sources when a current external fact affects the
  change;
- record a missing capability only when it prevents a required check.

## Common verification baseline

Run this command before a commit or pull request:

```bash
make agent-check
```

The target checks unstaged and staged diffs for whitespace errors, then runs
every repository pre-commit hook. It is the common baseline for human and
agent-authored changes. It does not replace the backend, frontend, migration,
build, or workflow tests that cover the changed area. Select those tests from
`CONTRIBUTING.md` and the relevant project documentation.

## Maintain the workflow

When a shared rule changes:

1. Update its canonical project document or `AGENTS.md`.
2. Update an agent adapter only when the agent cannot load `AGENTS.md` directly.
3. Keep adapters free of repeated project rules.
4. Run `make agent-check`.
5. Start a fresh agent session and ask it to identify its active repository
   instructions and verification baseline.

If an agent needs a non-portable setup, document the required capability and a
fallback here. Keep the installation details in personal configuration.
