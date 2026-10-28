# Compare interface alternatives

Use [codebase-design](../../codebase-design/SKILL.md) to define the behavior,
callers, invariants, and test boundary before comparing alternatives.

Compare materially different interfaces when one real trade-off remains: a
minimal entry point versus the current caller-oriented interface, for example.
Do not manufacture flexibility for hypothetical consumers.

For each alternative, show a small usage example, what the implementation hides,
caller migration, error behavior, and verification strategy. Assess the effect on
existing callers and test coverage. Recommend the smallest interface that meets
the accepted requirements, including retaining the current interface when it fits.

Perform the comparison in the active session. Independent agent proposals are
optional only when delegation is authorized and available. Record accepted durable
decisions through the repository domain-modeling workflow; interface comparison
does not authorize implementation.
