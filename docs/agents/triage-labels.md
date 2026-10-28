# CinemataCMS triage conventions

Use the tracker labels already established by the project. Inspect them with
`gh label list --repo EngageMedia-video/cinematacms` before an authorized update.
The following labels were present when this integration was checked:

| Purpose | Existing label |
|---|---|
| Defect | `bug` |
| New behavior | `enhancement` |
| Documentation | `documentation` |
| Clarification or discussion | `question`, `discussion` |
| Duplicate, invalid, or declined request | `duplicate`, `invalid`, `wontfix` |
| QA outcome | `qa:ready`, `qa:failed`, `qa:passed` |

QA labels describe QA state, not readiness for agent implementation. Use the
accepted requirements and verification evidence to assess implementation
readiness. Preserve unrelated labels and maintainer decisions.

The upstream skill roles `needs-triage`, `needs-info`, `ready-for-agent`, and
`ready-for-human` are descriptive concepts, not installed CinemataCMS labels.
Report them in prose when useful; do not create those labels as a prerequisite.
Change labels only within an authorized tracker action.
The AI contribution workflow maintains `ai-assisted`; follow the engineering
standards and PR declaration rather than treating it as a triage state.
