# Domain context format

Use a root `CONTEXT.md` for one domain context. Use a root `CONTEXT-MAP.md` only
when the repository contains multiple contexts that need separate glossaries.

## `CONTEXT.md`

```markdown
# Context name

One or two sentences that define the context.

## Language

**Canonical term**

One or two sentences that define the domain concept without implementation
details.

Avoid: ambiguous synonym, obsolete synonym
```

Include only product-specific terms. Pick one canonical term and list synonyms
that contributors must avoid. Group terms only when the glossary has a natural
subdomain.

## `CONTEXT-MAP.md`

List each context, link to its `CONTEXT.md`, and describe relationships between
contexts. Do not create multiple contexts only because the code has several
Django apps or frontend directories.
