# Logic prototype

State the model question and the cases that will answer it. Reuse project domain
terms from `docs/agents/domain.md` and inspect the relevant behavior first.

Choose the smallest runnable shape: an existing project-language script for a
technical model, or a self-contained HTML demo when a contributor needs to drive
states interactively. Use in-memory state and plain domain labels. Keep decision
logic separate from the demo's controls; avoid connecting it to live services.

Demonstrate the normal path, the disputed edge case, and invalid transitions.
For nontrivial model logic, retain a small runnable assertion or focused check
for the invariant being explored. Use existing test tooling when the prototype
lives in the project; do not create a second test framework.

Run the scenarios and report what they establish and what remains uncertain.
Provide the launch command or artifact path. Keep the model and evidence local;
a validated prototype still needs repository implementation, security, tests,
and review before production use. Follow [the prototype skill](SKILL.md) for
verification and authorized integration.
