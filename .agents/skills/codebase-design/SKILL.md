---
name: codebase-design
description: Design or improve a module interface and its seam. Use for architecture or refactor discussions that must reduce caller knowledge, concentrate behavior, or improve testability. Do not use for routine implementation inside an accepted design.
---

# Design a deep module

A module is a function, class, package, Django application boundary, frontend
feature, or other unit with an interface and an implementation. A deep module
hides substantial behavior behind an interface that callers can learn and test
without knowing its internals.

Use these terms consistently:

- **Interface:** every fact a caller must know, including inputs, outputs,
  invariants, ordering, errors, configuration, and performance constraints.
- **Seam:** the place where behavior can vary without editing the caller.
- **Adapter:** one implementation that satisfies an interface at a seam.
- **Depth:** the capability that callers gain relative to the interface they
  must learn.
- **Locality:** keeping related behavior, knowledge, and verification in one
  place.

## Choose the module shape

1. Map the callers, dependencies, tests, and behavior that currently changes
   together.
2. Put the seam where callers need stable behavior and implementations can
   vary for a concrete reason.
3. Minimize methods, parameters, ordering constraints, and leaked state.
4. Keep policy behind the interface. Keep transport, persistence, or framework
   details in an adapter when they genuinely vary.
5. Test through the same interface that production callers use.

Use the deletion test. If deleting the module makes its complexity disappear,
the module was probably a pass-through. If the complexity spreads back across
callers, the module was providing locality.

One adapter does not justify a speculative seam. Add a seam when a real caller,
test double, or alternate implementation needs it.

Present the proposed interface, its invariants, the seam location, the affected
callers, and the focused tests that prove it. Do not implement the design unless
the user also requests implementation.
