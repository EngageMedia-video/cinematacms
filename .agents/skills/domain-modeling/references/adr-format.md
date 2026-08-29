# ADR format

Store an ADR next to the existing one in `docs/technical/` and name it
`adr-NNN-short-decision.md`. Continue the existing sequence; `adr-001` is
`docs/technical/adr-001-webpack-to-vite.md`.

Follow the format of the existing ADR:

```markdown
# ADR-NNN: Short decision title

**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Superseded by ADR-NNN
**Deciders**: The people or team that made the decision

## Context

State the forces that make the decision necessary: the constraint, the
measurement, or the failure the current design produces.

## Decision

State the chosen option and why it fits those constraints.
```

Add rejected options, consequences, or a migration path only when they help a
future contributor revisit the decision. Keep an ADR focused on one decision.
Link a superseding ADR instead of rewriting accepted history.
