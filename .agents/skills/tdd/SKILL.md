---
name: tdd
description: Implement a feature or bug fix test-first through red-green-refactor. Use when the user requests TDD, test-first development, a regression test, or an integration test.
---

# Develop test-first

Work in vertical slices. Complete one observable behavior before starting the
next behavior.

## Choose the behavior boundary

Read the existing tests around the affected code. Test through the narrowest
public interface that proves the requested behavior. Use Django views, forms,
models, services, or frontend user behavior as the boundary when those are the
interfaces that callers use.

If the boundary requires a new public interface or a product decision, ask the
user before writing the test. Otherwise, follow the existing test structure.

Prefer real repository components. Mock only external systems, time,
randomness, or another boundary that the existing suite already isolates.

## Run the red-green-refactor cycle

For each behavior:

1. Write one test that describes the observable outcome.
2. Run the narrowest test command and confirm that the test fails for the
   expected missing behavior.
3. Change only enough production code to make the test pass.
4. Run the same command and confirm that the test passes.
5. Refactor only while the test remains green.
6. Repeat for the next behavior.

Do not accept a failure caused by syntax, setup, fixtures, or the environment as
the red phase. Do not write a batch of tests against behavior that has not been
implemented yet.

## Preserve useful tests

Use independent expected values from the requirement or a worked example. Do
not recompute the expected value with the same algorithm as the implementation.

Name the behavior and condition in the test. Avoid assertions about private
methods, internal call order, or implementation-specific state.

## Finish with evidence

Run the relevant test group after every slice. Before completion, run
`make agent-check` and the broader checks selected by the `verify-change` skill.
Report the commands that demonstrated the red and green states.
