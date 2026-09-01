---
name: diagnosing-bugs
description: Reproduce and diagnose a functional defect, flaky test, or performance regression. Use when the user reports broken, failing, intermittent, or slow behavior. Diagnose without implementing a fix unless the user requests one.
---

# Diagnose a bug

Build evidence before choosing a cause. Redact credentials, tokens, personal
data, and private URLs from commands, logs, fixtures, and reports.

## Build a feedback loop

Create one command that exercises the reported path and detects the exact
symptom. Prefer an existing test, a new failing test, a request against a local
service, or a focused frontend test. Use a temporary harness only when the
normal boundary cannot reproduce the defect.

Tighten the command until it is fast and deterministic. For an intermittent
defect, record the reproduction rate and raise it enough to compare hypotheses.
If no local command can reproduce the symptom, list what you tried and identify
the artifact or environment access needed next.

## Establish the cause

1. Reproduce the reported symptom.
2. Remove inputs, configuration, and steps until each remaining element is
   necessary.
3. Write two or more falsifiable hypotheses when the cause is not already
   proven by the minimal reproduction.
4. Test one variable at a time. Add temporary instrumentation only at the
   boundary that separates the hypotheses.
5. State which evidence rules each hypothesis in or out.

For a performance regression, measure a baseline before tracing the slow path.
Compare timings or query counts with the same input and environment.

## Stop or fix according to the request

For a diagnosis-only request, stop after identifying the root cause, affected
path, and correction direction. Do not edit production code.

If the user requested a fix, convert the minimal reproduction into a regression
test at the correct public boundary. Confirm that it fails, apply the smallest
fix, and confirm that both the regression test and the original reproduction
pass.

Remove all temporary instrumentation and harnesses before completion. Report
the reproduction command, the root cause, the evidence, and any remaining
uncertainty.
