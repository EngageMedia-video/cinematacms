---
name: grilling
description: Stress-test a plan, decision, or idea through focused rounds of questions. Use when the user asks to grill their thinking or resolve important design trade-offs.
---

# Resolve design decisions

Read `AGENTS.md` and `docs/technical/agentic-workflow.md`. Inspect the affected
code and project documents before asking the contributor for facts.

Map decisions and their prerequisites. Reuse decisions already accepted in the
conversation; do not reopen them without new evidence. Ask only questions whose
prerequisites are settled, in manageable rounds. Give a recommended answer and
explain the relevant trade-off. Wait for required decisions before dependent work;
continue independent investigation while waiting.

Stop when the decisions needed for the requested scope are resolved. Report the
agreed behavior, constraints, and remaining uncertainty. A design interview ends
with a design; implement only within the contributor's requested scope. Use the
repository `codebase-design` skill for interface alternatives and `domain-modeling`
when accepted terminology or a durable decision needs recording.
