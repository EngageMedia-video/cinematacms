---
name: research
description: Investigate a technical question against primary sources. Use when a contributor needs current framework, dependency, security, API, standard, or repository facts before making a decision. Do not implement a change unless the user separately requests it.
---

# Research a technical question

Trace each conclusion to the source that owns the fact. Prefer official
documentation, specifications, source code, release notes, and first-party
APIs. Use secondary sources only to locate a primary source.

Use a background agent when the active environment supports delegation and the
research can run independently. Otherwise, research in the current session.
The evidence standard stays the same.

## Establish the question

State the decision that the research must inform, the facts required to make
it, and any version or date boundary. Inspect repository configuration before
researching an external default that the repository may override.

## Gather evidence

- Cite the primary source next to each material claim.
- Distinguish a documented fact from an inference.
- Compare publication and event dates for changing information.
- Pin framework, dependency, API, or standard claims to the relevant version.
- Record contradictory evidence and unresolved questions.

Write a Markdown research note only when the user requests a durable artifact
or the result supports a repository decision that future contributors must
audit. Otherwise, report the findings in the conversation.

Finish when every recommendation is traceable to evidence and the remaining
uncertainty is explicit.
