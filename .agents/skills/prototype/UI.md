# UI prototype

Read `CODING_STANDARDS.md` and `docs/technical/FRONTEND_WORKFLOW.md` before
choosing a host page, component, styles, or build command. Reuse the appropriate
CinemataCMS frontend track; new feature prototypes should follow Modern Track
patterns. Do not introduce a parallel frontend stack.

Build the number of variants needed to answer the question. Prefer an isolated
local demo or development-only variant within the existing page when realistic
surrounding content matters. Keep the normal route behavior intact and ensure
prototype controls cannot ship in a production build. Avoid adding a shared
switcher abstraction when a local control suffices.

Use fixtures for mutations. Preserve existing authentication and privacy
boundaries. Make controls keyboard-accessible, label them clearly, and check
relevant viewports, themes, and focus behavior. Compare layout or interaction
alternatives when those are the question, rather than merely changing colors.

Run the existing build or test command that covers the prototype and inspect it
in a browser when available. If browser inspection is unavailable, report that
limit. Hand over the local URL, launch command, variants, and observations.

Capture the selected design when the contributor decides. Stop at the prototype
outcome unless production integration was requested; that work follows
[implement](../implement/SKILL.md). Follow [the prototype skill](SKILL.md) for
verification and retention of local evidence.
