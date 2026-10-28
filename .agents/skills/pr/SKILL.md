---
name: pr
description: Draft or update a pull request body using the CinemataCMS PR template, verification evidence, Analytics declaration, and AI assistance policy.
metadata:
  credits:
    skill: show-me
    author: Dex Horthy
    organisation: Humanlayer
    url: "https://github.com/humanlayer/skills/blob/main/plugins/show-me/skills/show-me/SKILL.md"
---

# Write a CinemataCMS pull request body

Read `AGENTS.md`, `CONTRIBUTING.md`, and
`docs/technical/engineering-standards-proposal.md`. Start from
`.github/PULL_REQUEST_TEMPLATE.md`; preserve its sections and declarations.

Inspect the actual diff against the intended base and the originating requirement.
Lead Description with the problem and resulting behavior. Fill Related Issue and
Motivation and Context from the accepted scope. Use a closing keyword only when
this PR actually resolves that issue.

In How Has This Been Tested, include exact commands, results, manual evidence,
and blocked or unrun checks. Use [verify-change](../verify-change/SKILL.md) when
verification is part of the request; do not invent evidence. State migration,
rollout, or rollback considerations when the actual change requires them.

Complete Analytics using `CODING_STANDARDS.md` and the template's coverage fields.
Select exactly one Analytics declaration and one AI assistance declaration. Name
AI tools and their substantive use according to the engineering policy. Complete
Types of changes, Checklist, and Modern Track Checklist only where supported by
the diff and evidence; include screenshots for relevant visual changes.

Return the body as a local draft unless the contributor requested PR creation or
editing. For an authorized publication, use a temporary file and `--body-file`
for multiline text, follow `docs/agents/issue-tracker.md` for repository targeting,
and report the resulting PR and CI state accurately.
