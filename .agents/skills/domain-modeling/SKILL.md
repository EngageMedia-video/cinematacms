---
name: domain-modeling
description: Build and sharpen CinemataCMS domain language. Use when a task changes domain terminology, creates or edits CONTEXT.md, or records an architectural decision. Do not use only to read existing terminology.
---

# Model the domain

Keep product language, code, and durable decisions aligned. Resolve a term or
decision before recording it.

## Find the domain source

If `CONTEXT-MAP.md` exists, use it to locate the relevant context. Otherwise,
use the root `CONTEXT.md`. Create either file only when the task resolves the
first term that belongs there.

Read the affected models, views, serializers, frontend behavior, tests, and
existing documentation. Treat code as evidence of current behavior, not proof
that its terminology is correct.

## Resolve domain language

For each disputed or overloaded term:

1. State the competing meanings.
2. Test them against concrete user and data scenarios.
3. Identify the meaning that the product needs.
4. Check whether the code and documentation use that meaning consistently.
5. Record the canonical term after the meaning is settled.

Keep implementation details, task plans, and temporary notes out of the domain
glossary. Use [the context format](references/context-format.md) when creating
or editing a context file. When you create the first context file, add its
routing line to `AGENTS.md` in the same change so later tasks find it.

## Record durable decisions sparingly

Create an ADR only when a decision is hard to reverse, surprising without its
context, and based on a real trade-off. Use
[the ADR format](references/adr-format.md). Do not create an ADR for a routine
implementation choice.

Finish when the resolved language is recorded, its relationship to the
affected code and documentation is explicit, and any mismatch outside the
authorized scope is reported.
