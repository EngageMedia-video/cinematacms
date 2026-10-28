# Assess dependencies and test boundaries

Use [codebase-design](../../codebase-design/SKILL.md) and `CODING_STANDARDS.md`.
Trace the current callers and dependencies before proposing consolidation.

- For pure computation, test observable behavior through the module interface.
- For database, filesystem, or queue behavior, reuse the repository's existing
  test services and fixtures. A substitute must preserve the behavior being tested.
- For owned remote services, preserve transport and failure contracts while
  keeping decision logic testable.
- For third-party services, reuse existing integration boundaries and controlled
  test responses; do not add a port or adapter solely to match this vocabulary.

Propose a new seam only when actual coupling or verification needs justify it.
Describe what it hides and how each caller changes. Preserve regression coverage;
replace old tests only after the replacement proves the same observable contract.
Do not delete tests simply because a module becomes internal.
